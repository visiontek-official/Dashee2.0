const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const mysql = require('mysql');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('./config/config');
const pairingCodes = {};
const pairedScreens = {};  // Store paired status
const events = []; //

const app = express(); // Web server
const apiApp = express(); // API server
const logFile = path.join(__dirname, 'logs', 'server.log');
const apiLogFile = path.join(__dirname, 'logs', 'api.log');
const saltRounds = 10;

// Define the paths for the logs and archive directories
const logDir = path.join(__dirname, 'logs');
const archiveDir = path.join(logDir, 'archive');

const swaggerSetup = require('./swagger');

//Web socket for live communication between server and client
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8100 });

// Map to store pairing code to WebSocket connection and last activity timestamp
const pairingCodeToWsMap = new Map();
const lastActivityMap = new Map();

// Helper function to generate token
const generateToken = (userId) => {
    return jwt.sign({ userId }, config.secretKey, { expiresIn: '1h' });
};

// Function to archive and clear logs
const archiveAndClearLogs = () => {
    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }

    const filesToArchive = ['api.log', 'server.log', 'swagger.log'];

    filesToArchive.forEach((file) => {
        const logFilePath = path.join(logDir, file);
        //const archiveFilePath = path.join(archiveDir, `${file.replace('.log', '')}-${Date.now()}.log`);
        const archiveFilePath = path.join(archiveDir, `${file}.backup.log`);

        if (fs.existsSync(logFilePath)) {
            fs.copyFileSync(logFilePath, archiveFilePath);  // Copy to archive
            fs.truncateSync(logFilePath, 0);                // Clear the original log file
        }
    });

    console.log('Logs have been archived and cleared');
};

// Call the function to archive and clear logs if the config is set to true
if (config.clearLogsOnStart) {
    archiveAndClearLogs();
}

// Verify Token Middleware
function verifyToken(req, res, next) {
    const token = req.headers['authorization'];
    console.log('Received Token:', token);
     // Check if the token is the admin token
     if (token === config.adminToken) {
        req.userId = 'admin';
        req.isAdmin = true;
        console.log('Admin token provided');
        return next();
    }
    if (!token) {
        console.log('No token provided');
        return res.status(403).send({ auth: false, message: 'No token provided.' });
    }
    jwt.verify(token.split(' ')[1], config.secretKey, function(err, decoded) {
        if (err) {
            console.log('Failed to authenticate token:', err);
            return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
        }
        req.userId = decoded.userId;
        console.log('Token authenticated, userId:', req.userId);
        next();
    });
}

// Serve the Google reCAPTCHA site key
app.get('/api/recaptcha-site-key', (req, res) => {
    res.json({ siteKey: config.g_site_key });
});

apiApp.use('/api/get-screens', verifyToken);
apiApp.use('/api/add-screen', verifyToken);

// Log function for web server
const log = (message, indepth = false) => {
    const logMessage = `[${new Date().toISOString()}] ${message}`;
    fs.appendFileSync(logFile, logMessage + '\n'); // Always log to file
    if (config.logging || indepth) {
        console.log(logMessage); // Log to console conditionally
    }
};

// Log function for API server
const apiLog = (message, indepth = false) => {
    const logMessage = `[${new Date().toISOString()}] ${message}`;
    fs.appendFileSync(apiLogFile, logMessage + '\n'); // Always log to file
    if (config.api_debug || indepth) {
        console.log(logMessage); // Log to console conditionally
    }
};

// MySQL Connection with Reconnect Logic

let db;

function handleDisconnect() {
    db = mysql.createConnection({
        host: config.sql_server_url,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.dbName,
        port: config.sqlPort
    });

    db.connect((err) => {
        if (err) {
            console.log('Database connection failed: ' + err);
            setTimeout(handleDisconnect, 2000); // Retry after 2 seconds
        } else {
            console.log(`Connected to database ${config.dbName}`);
            createTables();
            logOutAllUsers(); // Log out all users on server start
        }
    });

    db.on('error', (err) => {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('Database connection lost. Reconnecting...');
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

handleDisconnect();

const createTables = () => {
    const userTableQuery = `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstname VARCHAR(255) NOT NULL,
        lastname VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        profile_pic VARCHAR(255) DEFAULT 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png',
        role VARCHAR(50) DEFAULT 'user',
        enabled BOOLEAN DEFAULT true,
        logged_in BOOLEAN DEFAULT FALSE,
        api_token VARCHAR(255) DEFAULT NULL,
        reset_token VARCHAR(255) DEFAULT NULL,
        token_expiry BIGINT DEFAULT NULL,
        created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`;

    const screenTableQuery = `CREATE TABLE IF NOT EXISTS screens (
        screen_id INT AUTO_INCREMENT PRIMARY KEY,
        screen_name VARCHAR(255) NOT NULL,
        pairing_code VARCHAR(255) NOT NULL,
        user_id INT NOT NULL,
        enabled BOOLEAN DEFAULT false,
        online_status BOOLEAN DEFAULT false,
        last_connected DATETIME DEFAULT NULL,
        screen_url VARCHAR(255) NOT NULL,
        created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`;

    const contentTableQuery = `CREATE TABLE IF NOT EXISTS content (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_description VARCHAR(255) DEFAULT NULL,
        file_path VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_tags VARCHAR(255) DEFAULT NULL,
        file_schedule_start DATETIME DEFAULT NULL,
        file_schedule_end DATETIME DEFAULT NULL,
        file_size VARCHAR(50) DEFAULT NULL,
        file_orientation VARCHAR(50) DEFAULT NULL,
        file_dimensions VARCHAR(50) DEFAULT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`;

    const eventsTableQuery = `CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        start DATETIME NOT NULL,
        end DATETIME,
        category VARCHAR(50),
        color VARCHAR(7) NOT NULL DEFAULT '#3788d8',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

    const playlistsTableQuery = `CREATE TABLE IF NOT EXISTS playlists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        screenId INT,
        userId INT,
        contentId INT,
        sequenceNumber INT,
        displayDuration TIME,
        transition VARCHAR(255),
        transitionSpeedLabel VARCHAR(255),
        scheduleEnabled BOOLEAN,
        monStart TIME,
        monEnd TIME,
        tueStart TIME,
        tueEnd TIME,
        wedStart TIME,
        wedEnd TIME,
        thuStart TIME,
        thuEnd TIME,
        friStart TIME,
        friEnd TIME,
        satStart TIME,
        satEnd TIME,
        sunStart TIME,
        sunEnd TIME,
        thumbnail VARCHAR(255),
        title VARCHAR(255),
        orientation VARCHAR(255),
        fileType VARCHAR(255),
        startDate DATETIME,
        expirationDate DATETIME,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(255),
        shufflePlay BOOLEAN,
        defaultTransition VARCHAR(255),
        defaultTransitionSpeedLabel VARCHAR(255),
        enableImageTransitions BOOLEAN,
        enableWebappTransitions BOOLEAN
    )`;

    db.query(userTableQuery, (err, result) => {
        if (err) {
            console.log('User table creation failed: ' + err);
            throw err;
        }
        console.log('User table checked/created');
        checkAdminUser();
    });

    db.query(screenTableQuery, (err, result) => {
        if (err) {
            console.log('Screen table creation failed: ' + err);
            throw err;
        }
        console.log('Screen table checked/created');
    });

    db.query(contentTableQuery, (err, result) => {
        if (err) {
            console.log('Content table creation failed: ' + err);
            throw err;
        }
        console.log('Content table checked/created');
    });

    db.query(playlistsTableQuery, (err, result) => {
        if (err) {
            console.log('Playlists table creation failed: ' + err);
            throw err;
        }
        console.log('Playlists table checked/created');
    });

    db.query(eventsTableQuery, (err, result) => {
        if (err) {
            console.log('Events table creation failed: ' + err);
            throw err;
        }
        console.log('Events table checked/created');
    });
};

const checkAdminUser = () => {
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, ['info@visiontek.co.za'], (err, results) => {
        if (err) {
            log('Admin user check failed: ' + err, true);
            throw err;
        }
        if (results.length === 0) {
            const insertSql = 'INSERT INTO users (firstname, lastname, email, password, profile_pic, role, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)';
            const adminPassword = 'admin'; // Use a fixed password for demonstration
            db.query(insertSql, ['VisionTEK', 'Administrator', 'info@visiontek.co.za', adminPassword, 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png', 'admin', true], (err, result) => {
                if (err) {
                    log('Admin user creation failed: ' + err, true);
                    throw err;
                }
                if (config.displayAdminCredentials) {
                    const message = `Admin user created: info@visiontek.co.za / ${adminPassword}`;
                    log(message, true);
                }
            });
        } else {
            log('Admin user already exists');
        }
    });
};

const logOutAllUsers = () => {
    const sql = 'UPDATE users SET logged_in = FALSE, api_token = NULL';
    db.query(sql, (err, result) => {
        if (err) {
            log('Failed to log out all users: ' + err, true);
            throw err;
        }
        log('All users logged out');
    });
};

// Web server middleware and routes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploads directory
app.use(session({
    secret: config.secretKey,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set secure to true if using HTTPS
}));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: config.uploadConfig.maxFileSize },
    fileFilter: function (req, file, cb) {
        if (config.uploadConfig.allowedFormats.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file format'));
        }
    }
});

/*
apiApp.listen(config.apiPort, () => {
    apiLog(`API server running on port ${config.apiPort}`);
});
*/

// API server middleware and routes
apiApp.use(bodyParser.urlencoded({ extended: true }));
apiApp.use(bodyParser.json());

function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// Middleware to log API requests and responses and verify tokens if required
apiApp.use((req, res, next) => {
    console.log(`API request: ${req.method} ${req.url} - Body: ${JSON.stringify(req.body)}`);
    next();
});

// Middleware to log API requests and responses and verify tokens
app.use((req, res, next) => {
    const publicPaths = ['/index.html', '/login', '/signup', '/forgot-password', '/reset-password', '/css', '/js', '/images'];
    if (publicPaths.some(path => req.path.startsWith(path)) || req.path.startsWith('/api')) {
        return next();
    }

    const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (!token) {
        console.log('No token provided, redirecting to login');
        return res.redirect('/index.html');
    }

    jwt.verify(token, config.secretKey, (err, decoded) => {
        if (err) {
            console.log('Token verification failed:', err);
            return res.redirect('/index.html');
        }

        console.log('Decoded token:', decoded);

        const sql = 'SELECT * FROM users WHERE id = ?';
        db.query(sql, [decoded.userId], (err, results) => {
            if (err) {
                console.log('Error checking api_token:', err);
                return res.status(500).json({ error: 'Failed to check api_token' });
            }

            console.log('User data from token verification:', results);

            if (results.length > 0 && token === results[0].api_token) {
                console.log('Token verified');
                req.session.userId = decoded.userId;
                req.session.save(() => {
                    console.log('Session saved:', req.session);
                    next();
                });
            } else {
                req.session.destroy();
                console.log('Invalid token, redirecting to login');
                return res.redirect('/index.html');
            }
        });
    });
});

// Use the verifyToken middleware for specific routes
apiApp.use('/api/get-screens', verifyToken);
apiApp.use('/api/add-screen', verifyToken);

// Your API routes here


// Check session status
app.get('/api/check-session', verifyToken, (req, res) => {
    res.status(200).send({ sessionExpired: false });
});

/**
 * @swagger
 * /login:
 *   get:
 *     summary: Login page
 *     description: Serve the login page.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Login page served
 */
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/*
apiApp.post('/api/some-endpoint', (req, res) => {
    apiLog(`API request to /api/some-endpoint: ${JSON.stringify(req.body)}`);
    // Your API logic here
    res.json({ success: true });
});
*/

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a list of all users. Only accessible by admin.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   firstname:
 *                     type: string
 *                   lastname:
 *                     type: string
 *                   email:
 *                     type: string
 *                   role:
 *                     type: string
 *                   enabled:
 *                     type: boolean
 *                   profile_pic:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
app.get('/api/users', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, config.secretKey);

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.userId;

    // Check if the user is an admin
    const sqlCheckAdmin = 'SELECT role FROM users WHERE id = ?';
    db.query(sqlCheckAdmin, [userId], (err, results) => {
        if (err) {
            console.log('Failed to verify user role:', err);
            return res.status(500).json({ error: 'Failed to verify user role' });
        }
        if (results.length === 0 || results[0].role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Fetch all users
        const sqlFetchUsers = 'SELECT id, firstname, lastname, email, role, enabled, profile_pic FROM users';
        db.query(sqlFetchUsers, (err, results) => {
            if (err) {
                console.log('Failed to fetch users:', err);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }
            console.log('Fetched users:', results);
            res.json(results);
        });
    });
});

/**
 * @swagger
 * /api/user-details:
 *   get:
 *     summary: Get user details
 *     description: Retrieve details of the logged-in user.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 firstname:
 *                   type: string
 *                 lastname:
 *                   type: string
 *                 email:
 *                   type: string
 *                 profile_pic:
 *                   type: string
 *                 role:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
app.get('/api/user-details', (req, res) => {
    const userId = req.session.userId;
    console.log('Session userId:', userId);
    if (!userId) {
        console.log('No session user ID, redirecting to login');
        return res.redirect('/index.html');
    }

    const sql = 'SELECT firstname, lastname, email, profile_pic, role FROM users WHERE id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.log('Failed to fetch user details:', err);
            return res.status(500).json({ error: 'Failed to fetch user details' });
        }
        if (results.length > 0) {
            console.log('Fetched user details:', results[0]);
            res.json(results[0]);
        } else {
            console.log('User not found');
            res.status(404).json({ error: 'User not found' });
        }
    });
});

/**
 * @swagger
 * /api/statistics:
 *   get:
 *     summary: Get statistics
 *     description: Retrieve statistics of users and screens.
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: integer
 *                 activeUsers:
 *                   type: integer
 *                 disabledUsers:
 *                   type: integer
 *                 totalScreens:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
app.get('/api/statistics', (req, res) => {
    const queries = {
        totalUsers: 'SELECT COUNT(*) AS count FROM users',
        activeUsers: 'SELECT COUNT(*) AS count FROM users WHERE logged_in = TRUE',
        disabledUsers: 'SELECT COUNT(*) AS count FROM users WHERE enabled = FALSE',
        totalScreens: 'SELECT COUNT(*) AS count FROM screens',
        onlineScreens: 'SELECT COUNT(*) AS count FROM screens WHERE online_status = 1',
        totalPlaylists: 'SELECT COUNT(*) AS count FROM playlists',
        dailyUsers: 'SELECT DATE(created) AS date, COUNT(*) AS count FROM users GROUP BY DATE(created)',
        dailyScreens: 'SELECT DATE(created) AS date, COUNT(*) AS count FROM screens GROUP BY DATE(created)',
        dailyPlaylists: 'SELECT DATE(createdAt) AS date, COUNT(*) AS count FROM playlists GROUP BY DATE(createdAt)'
    };

    Promise.all(Object.values(queries).map(query => new Promise((resolve, reject) => {
        db.query(query, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    })))
    .then(([totalUsers, activeUsers, disabledUsers, totalScreens, onlineScreens, totalPlaylists, dailyUsers, dailyScreens, dailyPlaylists]) => {
        const formatResults = (results) => results.map(row => ({ date: row.date, count: row.count }));
        
        console.log('Fetched statistics:', { 
            totalUsers: totalUsers[0].count, 
            activeUsers: activeUsers[0].count, 
            disabledUsers: disabledUsers[0].count, 
            totalScreens: totalScreens[0].count,
            onlineScreens: onlineScreens[0].count,
            totalPlaylists: totalPlaylists[0].count,
            dailyUsers: formatResults(dailyUsers),
            dailyScreens: formatResults(dailyScreens),
            dailyPlaylists: formatResults(dailyPlaylists)
        });
        
        res.json({ 
            totalUsers: totalUsers[0].count, 
            activeUsers: activeUsers[0].count, 
            disabledUsers: disabledUsers[0].count, 
            totalScreens: totalScreens[0].count,
            onlineScreens: onlineScreens[0].count,
            totalPlaylists: totalPlaylists[0].count,
            dailyUsers: formatResults(dailyUsers),
            dailyScreens: formatResults(dailyScreens),
            dailyPlaylists: formatResults(dailyPlaylists)
        });
    })
    .catch(err => {
        console.log('Failed to fetch statistics:', err);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    });
});

//**********************************API END POINTS**********************************
/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get statistics
 *     description: Retrieve various statistics.
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: integer
 *                 activeUsers:
 *                   type: integer
 *                 disabledUsers:
 *                   type: integer
 *                 totalScreens:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error retrieving statistics
 */
apiApp.get('/api/stats', verifyToken, (req, res) => {
    const queries = {
        totalUsers: 'SELECT COUNT(*) AS count FROM users',
        activeUsers: 'SELECT COUNT(*) AS count FROM users WHERE logged_in = TRUE',
        disabledUsers: 'SELECT COUNT(*) AS count FROM users WHERE enabled = FALSE',
        totalScreens: 'SELECT COUNT(*) AS count FROM screens'
    };

    Promise.all(Object.values(queries).map(query => new Promise((resolve, reject) => {
        db.query(query, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0].count);
            }
        });
    })))
    .then(([totalUsers, activeUsers, disabledUsers, totalScreens]) => {
        apiLog('Fetched statistics:', { totalUsers, activeUsers, disabledUsers, totalScreens });
        res.json({ totalUsers, activeUsers, disabledUsers, totalScreens });
    })
    .catch(err => {
        apiLog('Failed to fetch statistics:', err);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    });
});

/**
 * @swagger
 * /api/user-data:
 *   get:
 *     summary: Get user data
 *     description: Retrieve details of the logged-in user.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 firstname:
 *                   type: string
 *                 lastname:
 *                   type: string
 *                 email:
 *                   type: string
 *                 profile_pic:
 *                   type: string
 *                 role:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
apiApp.get('/api/user-data', verifyToken, (req, res) => {
    const userId = req.userId; // Use the userId from the token

    console.log(`User ID from token: ${userId}`);

    const sql = 'SELECT firstname, lastname, email, profile_pic, role FROM users WHERE id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.log('Failed to fetch user data:', err);
            return res.status(500).json({ error: 'Failed to fetch user data' });
        }
        if (results.length > 0) {
            console.log('Fetched user data:', results[0]);
            res.json(results[0]);
        } else {
            console.log('User not found');
            res.status(404).json({ error: 'User not found' });
        }
    });
});

/**
 * @swagger
 * /api/get-files:
 *   post:
 *     summary: Get user files
 *     description: Retrieve files for the logged-in user.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   path:
 *                     type: string
 *                   type:
 *                     type: string
 *                   uploadDate:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */
app.post('/api/get-files', (req, res) => {
    const userId = req.session.userId; // Get userId from session
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const sql = 'SELECT id, file_name AS name, file_path AS path, file_type AS type, upload_date FROM content WHERE user_id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching files:', err);
            return res.status(500).json({ error: 'Failed to fetch files' });
        }

        res.json(results);
    });
});


//**********************************API END POINTS**********************************
/**
 * @swagger
 * /signup:
 *   post:
 *     summary: User signup
 *     description: Register a new user.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               terms:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Signup successful
 *       400:
 *         description: Signup failed
 */
app.post('/signup', (req, res) => {
    const { firstname, lastname, email, password, terms } = req.body;
    log(`Signup form data: ${JSON.stringify(req.body)}`);

    if (!terms) {
        return res.json({ success: false, message: 'You must accept the terms and conditions to register.' });
    }

    // Check if the email already exists
    const checkEmailSql = 'SELECT * FROM users WHERE email = ?';
    db.query(checkEmailSql, [email], (err, results) => {
        if (err) {
            log('Error checking email: ' + err, true);
            return res.json({ success: false, message: 'Signup failed. Please try again.' });
        }

        if (results.length > 0) {
            // Email already exists
            return res.json({ success: false, message: 'Email already exists. Please use a different email.' });
        }

        // Hash the password
        bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
            if (err) {
                log('Error hashing password: ' + err, true);
                return res.json({ success: false, message: 'Signup failed. Please try again.' });
            }

            const sql = 'INSERT INTO users (firstname, lastname, email, password, profile_pic) VALUES (?, ?, ?, ?, ?)';
            db.query(sql, [firstname, lastname, email, hashedPassword, 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png'], (err, result) => {
                if (err) {
                    log('Signup failed: ' + err, true);
                    return res.json({ success: false, message: 'Signup failed. Please try again.' });
                }
                log(`User signed up: ${email}`, true);
                return res.json({ success: true });
            });
        });
    });
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: User login
 *     description: Log in a user and return a JWT token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid email or password
 */
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    log(`Login form data: ${JSON.stringify(req.body)}`);
    const sql = 'SELECT * FROM users WHERE email = ? AND enabled = true';
    
    db.query(sql, [email], (err, results) => {
        if (err) {
            return res.json({ success: false, message: 'Login failed. Please try again.' });
        }

        if (results.length === 0) {
            return res.json({ success: false, message: 'Incorrect email or password or user not enabled' });
        }

        const user = results[0];

        // Compare the provided password with the hashed password in the database
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.json({ success: false, message: 'Login failed. Please try again.' });
            }

            if (!isMatch) {
                return res.json({ success: false, message: 'Incorrect email or password or user not enabled' });
            }

            // If password matches, generate the token and proceed with login
            const token = jwt.sign({ userId: user.id }, config.secretKey, { expiresIn: '1h' });

            log(`Generated token: ${token}`);

            const updateSql = 'UPDATE users SET logged_in = TRUE, api_token = ? WHERE id = ?';
            db.query(updateSql, [token, user.id], (err) => {
                if (err) {
                    return res.json({ success: false, message: 'Login failed. Please try again.' });
                }

                const fetchUpdatedUserSql = 'SELECT * FROM users WHERE id = ?';
                db.query(fetchUpdatedUserSql, [user.id], (err, updatedResults) => {
                    if (err) {
                        return res.json({ success: false, message: 'Login failed. Please try again.' });
                    }

                    log(`Updated user data: ${JSON.stringify(updatedResults)}`);

                    req.session.regenerate((err) => {
                        if (err) {
                            return res.json({ success: false, message: 'Login failed. Please try again.' });
                        }

                        req.session.userId = user.id;
                        req.session.firstName = user.firstname;
                        req.session.lastName = user.lastname;
                        req.session.profilePic = user.profile_pic || 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png';
                        req.session.role = user.role;
                        log(`User logged in: ${email}`);
                        log(`Session data: ${JSON.stringify(req.session)}`);
                        req.session.save(() => {
                            log('Session data after login:', req.session);

                            // Store the token in localStorage (use JavaScript in your frontend)
                            res.json({ success: true, token });
                        });
                    });
                });
            });
        });
    });
});


/**
 * @swagger
 * /logout:
 *   post:
 *     summary: User logout
 *     description: Log out the current user.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       500:
 *         description: Logout failed
 */
app.post('/logout', (req, res) => {
    if (req.session.userId) {
        db.query('UPDATE users SET logged_in = FALSE, api_token = NULL WHERE id = ?', [req.session.userId], (err) => {
            if (err) {
                log('Logout failed: ' + err, true);
                return res.json({ success: false, message: 'Logout failed. Please try again.' });
            }
            req.session.destroy();
            log('User logged out');
            return res.redirect('/login');
        });
    } else {
        return res.redirect('/login');
    }
});

/**
 * @swagger
 * /api/update-profile:
 *   post:
 *     summary: Update user profile
 *     description: Update the profile details of the logged-in user.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               profilePic:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: No fields to update
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error updating profile
 */
app.post('/api/update-profile', upload.single('profilePic'), (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        console.log('No session user ID, redirecting to login');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check which fields have been provided
    const fields = [];
    const values = [];

    if (req.body.firstname) {
        fields.push('firstname = ?');
        values.push(req.body.firstname);
    }

    if (req.body.lastname) {
        fields.push('lastname = ?');
        values.push(req.body.lastname);
    }

    if (req.body.email) {
        fields.push('email = ?');
        values.push(req.body.email);
    }

    if (req.body.password) {
        fields.push('password = ?');
        values.push(req.body.password);
    }

    if (req.file) {
        fields.push('profile_pic = ?');
        values.push('/uploads/' + req.file.filename);
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);

    // Construct the SQL query dynamically based on provided fields
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    db.query(sql, values, (err, results) => {
        if (err) {
            console.log('Failed to update profile:', err);
            return res.status(500).json({ error: 'Failed to update profile' });
        }
        console.log('Updated user data:', results);
        res.json({ success: true });
    });
});

/**
 * @swagger
 * /getUserDetails:
 *   get:
 *     summary: Get user details
 *     description: Retrieve details of the logged-in user.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 firstname:
 *                   type: string
 *                 lastname:
 *                   type: string
 *                 email:
 *                   type: string
 *                 profile_pic:
 *                   type: string
 *                 role:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
app.get('/getUserDetails', (req, res) => {
    log(`Fetching user details for session: ${JSON.stringify(req.session)}`);
    const userId = req.session.userId;
    if (!userId) {
        console.log('No session user ID, redirecting to login');
        return res.redirect('/index.html');
    }

    const sql = 'SELECT firstname, lastname, email, profile_pic, role FROM users WHERE id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.log('Failed to fetch user details:', err);
            return res.status(500).json({ error: 'Failed to fetch user details' });
        }
        if (results.length > 0) {
            console.log('Fetched user details:', results[0]);
            res.json(results[0]);
        } else {
            console.log('User not found');
            res.status(404).json({ error: 'User not found' });
        }
    });
});

/**
 * @swagger
 * /api/upload-file:
 *   post:
 *     summary: Upload a file
 *     description: Upload a file to the server.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Error uploading file
 */
const sanitizeFileName = (fileName) => {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_'); // Replace non-alphanumeric characters (except dots and dashes) with underscores
};

app.post('/api/upload-file', (req, res) => {
    upload.single('file')(req, res, function (err) {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: `File too large. Maximum size is ${config.uploadConfig.maxFileSize / (1024 * 1024)}MB.`
                    });
                }
                return res.status(400).json({ success: false, message: err.message });
            } else if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
        }

        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const userId = req.session.userId;
        const originalName = req.file.originalname;
        const sanitizedFileName = sanitizeFileName(originalName);
        const userDir = path.join(__dirname, 'uploads', userId.toString());

        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        const filePath = path.join(userDir, sanitizedFileName);
        const relativePath = `uploads/${userId.toString()}/${sanitizedFileName}`;
        const urlPath = `${config.server_url}:${config.webPort}/${relativePath}`;
        const fileSizeInKB = Math.round(req.file.size / 1024); // Convert bytes to KB

        fs.rename(req.file.path, filePath, (err) => {
            if (err) {
                console.log('File move failed: ' + err);
                return res.status(500).json({ success: false, message: 'File move failed' });
            }

            const sql = 'INSERT INTO content (user_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)';
            db.query(sql, [userId, sanitizedFileName, urlPath, req.file.mimetype, fileSizeInKB], (err, result) => {
                if (err) {
                    console.log('File save to database failed: ' + err);
                    return res.status(500).json({ success: false, message: 'File save to database failed' });
                }

                console.log(`File uploaded and saved: ${filePath}`);
                res.json({ success: true, filePath: urlPath });
            });
        });
    });
});



/*
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    log(`File upload attempt: ${JSON.stringify(req.file)}`);
    if (req.file) {
        log(`File uploaded: ${req.file.path}`);
        return res.json({ success: true, filePath: req.file.path });
    } else {
        log('File upload failed', true);
        return res.status(400).json({ success: false, message: 'File upload failed' });
    }
});
*/

/**
 * @swagger
 * /move-file:
 *   post:
 *     summary: Move a file
 *     description: Move a file to a different folder.
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *               targetFolder:
 *                 type: string
 *               currentFolder:
 *                 type: string
 *     responses:
 *       200:
 *         description: File moved successfully
 *       500:
 *         description: Error moving file
 */
app.post('/move-file', (req, res) => {
    const { fileName, targetFolder, currentFolder } = req.body;
    const userDir = path.join(__dirname, 'uploads', req.session.userId.toString());
    const oldPath = path.join(userDir, currentFolder, fileName);
    const newPath = path.join(userDir, targetFolder, fileName);

    fs.rename(oldPath, newPath, (err) => {
        if (err) {
            log('File move failed: ' + err, true);
            return res.status(500).json({ success: false, message: 'File move failed' });
        }
        log(`File moved from ${oldPath} to ${newPath}`);
        res.json({ success: true });
    });
});

/**
 * @swagger
 * /getFiles:
 *   post:
 *     summary: Get user files
 *     description: Retrieve files for the logged-in user.
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               folder:
 *                 type: string
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Error retrieving files
 */
app.post('/getFiles', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { folder } = req.body;
    const userDir = path.join(__dirname, 'uploads', req.session.userId.toString(), folder || '');

    fs.readdir(userDir, (err, files) => {
        if (err) {
            console.error('Error reading user directory:', err);
            return res.status(500).json({ error: 'Failed to read user directory' });
        }
        const fileData = files.map(file => {
            const filePath = path.join(userDir, file);
            const stat = fs.statSync(filePath);
            const fileType = stat.isDirectory() ? 'folder' : path.extname(file).substring(1);
            return {
                name: file,
                path: `/uploads/${req.session.userId}/${folder ? folder + '/' : ''}${file}`,
                type: fileType,
                uploadDate: stat.mtime.toISOString()
            };
        });
        res.json(fileData);
    });
});

//Get Files Endpoint
/**
 * @swagger
 * /api/file-details:
 *   get:
 *     summary: Get file details
 *     description: Retrieve details of a specific file.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: file
 *         schema:
 *           type: string
 *         required: true
 *         description: The name of the file
 *     responses:
 *       200:
 *         description: File details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 file_name:
 *                   type: string
 *                 file_description:
 *                   type: string
 *                 file_path:
 *                   type: string
 *                 file_tags:
 *                   type: string
 *                 file_schedule_start:
 *                   type: string
 *                   format: date-time
 *                 file_schedule_end:
 *                   type: string
 *                   format: date-time
 *                 upload_date:
 *                   type: string
 *                   format: date-time
 *                 file_size:
 *                   type: string
 *                 file_orientation:
 *                   type: string
 *                 file_dimensions:
 *                   type: string
 *                 displayDuration:
 *                   type: string
 *                   format: time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 */
app.get('/api/file-details', (req, res) => {
    const { file } = req.query;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const sql = `
        SELECT c.*, p.displayDuration
        FROM content c
        LEFT JOIN playlists p ON c.id = p.contentId
        WHERE c.file_name = ? AND c.user_id = ?`;
    db.query(sql, [file, userId], (err, results) => {
        if (err) {
            console.error('Error fetching file details:', err);
            return res.status(500).json({ error: 'Failed to fetch file details' });
        }

        if (results.length > 0) {
            const fileDetails = results[0];
            res.json(fileDetails);
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    });
});

//Save File Endpoint
/**
 * @swagger
 * /api/save-file-details:
 *   post:
 *     summary: Update file details
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               tags:
 *                 type: string
 *               schedule_start:
 *                 type: string
 *                 format: date-time
 *               schedule_end:
 *                 type: string
 *                 format: date-time
 *               size:
 *                 type: string
 *               orientation:
 *                 type: string
 *               dimensions:
 *                 type: string
 *               display_duration:
 *                 type: string
 *                 example: '00:01:00'
 *     responses:
 *       200:
 *         description: File details updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Not authenticated
 *       500:
 *         description: Failed to save file details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to save file details
 */

app.post('/api/save-file-details', (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { file, title, description, tags, schedule_start, schedule_end, size, orientation, dimensions, display_duration } = req.body;

    console.log('Received request to save file details:', {
        file, title, description, tags, schedule_start, schedule_end, size, orientation, dimensions, display_duration
    });

    const sql = `
        UPDATE content
        SET file_name = ?, file_description = ?, file_tags = ?, file_schedule_start = ?, file_schedule_end = ?, file_size = ?, file_orientation = ?, file_dimensions = ?
        WHERE file_name = ? AND user_id = ?`;
    db.query(sql, [title, description, tags, schedule_start, schedule_end, size, orientation, dimensions, file, userId], (err, results) => {
        if (err) {
            console.error('Error saving file details:', err);
            return res.status(500).json({ error: 'Failed to save file details' });
        }

        const playlistQuery = `UPDATE playlists SET displayDuration = ? WHERE contentId = (SELECT id FROM content WHERE file_name = ? AND user_id = ?)`;
        db.query(playlistQuery, [display_duration, file, userId], (err, result) => {
            if (err) {
                console.error('Error updating playlists table:', err);
                return res.status(500).json({ error: 'Failed to update display duration' });
            }

            console.log('Playlists table updated successfully with displayDuration:', display_duration);
            res.json({ success: true });
        });
    });
});

//Rename File Endpoint
/**
 * @swagger
 * /api/rename-file:
 *   post:
 *     summary: Rename file
 *     description: Rename a specific file.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldName:
 *                 type: string
 *               newName:
 *                 type: string
 *               currentFolder:
 *                 type: string
 *     responses:
 *       200:
 *         description: File renamed successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error renaming file
 */
app.post('/api/rename-file', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { oldName, newName, currentFolder } = req.body;
    const userId = req.session.userId;
    const userDir = path.join(__dirname, 'uploads', userId.toString(), currentFolder || '');
    const oldPath = path.join(userDir, oldName);
    const newPath = path.join(userDir, newName);
    const relativePath = `uploads/${userId.toString()}/${currentFolder ? currentFolder + '/' : ''}${newName}`;
    const urlPath = `${config.server_url}:${config.webPort}/${relativePath}`;

    fs.rename(oldPath, newPath, (err) => {
        if (err) {
            log('File rename failed: ' + err, true);
            return res.status(500).json({ success: false, message: 'File rename failed' });
        }

        const sql = 'UPDATE content SET file_name = ?, file_path = ? WHERE file_name = ? AND user_id = ?';
        db.query(sql, [newName, urlPath, oldName, userId], (err, result) => {
            if (err) {
                log('Database update failed: ' + err, true);
                return res.status(500).json({ success: false, message: 'Database update failed' });
            }
            log(`File renamed from ${oldPath} to ${newPath}`);
            res.json({ success: true });
        });
    });
});

//Delete File Endpoint
/**
 * @swagger
 * /api/delete-file:
 *   post:
 *     summary: Delete file
 *     description: Delete a specific file.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *               currentFolder:
 *                 type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error deleting file
 */
app.post('/api/delete-file', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { fileName, currentFolder } = req.body;
    const userId = req.session.userId;
    const userDir = path.join(__dirname, 'uploads', userId.toString(), currentFolder || '');
    const filePath = path.join(userDir, fileName);
    const relativePath = `uploads/${userId.toString()}/${currentFolder ? currentFolder + '/' : ''}${fileName}`;
    const urlPath = `${config.server_url}:${config.webPort}/${relativePath}`;

    console.log(`Attempting to delete file: ${filePath}`);
    console.log(`File Name: ${fileName}, User ID: ${userId}`);

    // First, fetch the contentid from the database
    const fetchIdSql = 'SELECT id FROM content WHERE file_name = ? AND user_id = ?';
    db.query(fetchIdSql, [fileName, userId], (err, results) => {
        if (err) {
            console.error('Error fetching content ID:', err);
            return res.status(500).json({ success: false, message: 'Error fetching content ID' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Content not found' });
        }

        const contentid = results[0].id;

        console.log(`Content ID: ${contentid}`);

        fs.rm(filePath, { recursive: true, force: true }, (err) => {
            if (err) {
                console.error('File delete failed:', err);
                return res.status(500).json({ success: false, message: 'File delete failed' });
            }

            console.log(`File deleted from filesystem: ${filePath}`);

            // Delete from the database
            const deleteSql = 'DELETE FROM content WHERE id = ? AND file_name = ? AND user_id = ?';
            db.query(deleteSql, [contentid, fileName, userId], (err, result) => {
                if (err) {
                    console.error('Database deletion failed:', err);
                    return res.status(500).json({ success: false, message: 'Database deletion failed' });
                }
                console.log(`Database record deleted for file: ${fileName}`);
                res.json({ success: true });
            });
        });
    });
});


/**
 * @swagger
 * /getUsers:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a list of all users. Only accessible by admin.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   firstname:
 *                     type: string
 *                   lastname:
 *                     type: string
 *                   email:
 *                     type: string
 *                   role:
 *                     type: string
 *                   enabled:
 *                     type: boolean
 *                   created:
 *                     type: string
 *                     format: date-time
 *                   updated:
 *                     type: string
 *                     format: date-time
 *                   logged_in:
 *                     type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
app.get('/getUsers', (req, res) => {
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.status(401).json({ error: 'Not authenticated or not authorized' });
    }

    const sql = 'SELECT * FROM users';
    db.query(sql, (err, results) => {
        if (err) {
            log('Error fetching users: ' + err, true);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        res.json(results);
    });
});

/**
 * @swagger
 * /api/update-user:
 *   post:
 *     summary: Update user
 *     description: Update details of a specific user.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               profilePic:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: No fields to update
 *       500:
 *         description: Error updating user
 */
app.post('/api/update-user', upload.single('profilePic'), verifyToken, (req, res) => {
    const { id, firstname, lastname, email, role, enabled } = req.body;
    const profilePic = req.file ? `/uploads/${req.file.filename}` : null;
    const fieldsToUpdate = {};

    if (firstname) fieldsToUpdate.firstname = firstname;
    if (lastname) fieldsToUpdate.lastname = lastname;
    if (email) fieldsToUpdate.email = email;
    if (role) fieldsToUpdate.role = role;
    if (enabled !== undefined) fieldsToUpdate.enabled = enabled;
    if (profilePic) fieldsToUpdate.profile_pic = profilePic;

    console.log('Received profile update request:', fieldsToUpdate);

    if (Object.keys(fieldsToUpdate).length === 0) {
        console.log('No fields to update');
        return res.status(400).json({ error: 'No fields to update' });
    }

    const sql = 'UPDATE users SET ? WHERE id = ?';
    db.query(sql, [fieldsToUpdate, id], (err, results) => {
        if (err) {
            console.error('Failed to update user:', err);
            return res.status(500).json({ error: 'Failed to update user' });
        }
        console.log('User updated successfully:', results);
        res.json({ success: true });
    });
});

/**
 * @swagger
 * /api/user/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve details of a specific user by ID.
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 firstname:
 *                   type: string
 *                 lastname:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 enabled:
 *                   type: boolean
 *                 profile_pic:
 *                   type: string
 *       404:
 *         description: User not found
 *       500:
 *         description: Error retrieving user details
 */
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT * FROM users WHERE id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Failed to fetch user details:', err);
            return res.status(500).json({ error: 'Failed to fetch user details' });
        }
        if (results.length > 0) {
            console.log('Fetched user details:', results[0]);
            res.json(results[0]);
        } else {
            console.log('User not found');
            res.status(404).json({ error: 'User not found' });
        }
    });
});

//app.post('/updateUser', (req, res) => {
//    const { id, firstName, lastName, email, role, enabled } = req.body;
//
//    const sql = 'UPDATE users SET firstname = ?, lastname = ?, email = ?, role = ?, enabled = ?, updated = CURRENT_TIMESTAMP WHERE id = ?';
//    db.query(sql, [firstName, lastName, email, role, enabled, id], (err, result) => {
//        if (err) {
//            log('Error updating user: ' + err, true);
//            return res.status(500).json({ success: false, message: 'Failed to update user' });
//        }
//        log(`User updated: ${email}`);
//        res.json({ success: true });
//    });
//});

/**
 * @swagger
 * /upload-profile-pic:
 *   post:
 *     summary: Upload profile picture
 *     description: Upload a new profile picture for a user.
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               profile-pic:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
 *       500:
 *         description: Error uploading profile picture
 */
app.post('/upload-profile-pic', upload.single('profile-pic'), (req, res) => {
    const { userId } = req.body;
    const profilePicPath = `/uploads/${req.session.userId}/${req.file.filename}`;

    const sql = 'UPDATE users SET profile_pic = ? WHERE id = ?';
    db.query(sql, [profilePicPath, userId], (err, result) => {
        if (err) {
            log('Error updating profile picture: ' + err, true);
            return res.status(500).json({ success: false, message: 'Failed to update profile picture' });
        }
        log(`Profile picture updated for user: ${userId}`);
        res.json({ success: true });
    });
});

/**
 * @swagger
 * /create-folder:
 *   post:
 *     summary: Create a folder
 *     description: Create a new folder in the user's directory.
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               folderName:
 *                 type: string
 *               currentFolder:
 *                 type: string
 *     responses:
 *       200:
 *         description: Folder created successfully
 *       400:
 *         description: Folder already exists
 *       500:
 *         description: Error creating folder
 */
app.post('/create-folder', (req, res) => {
    const { folderName, currentFolder } = req.body;
    const userDir = path.join(__dirname, 'uploads', req.session.userId.toString(), currentFolder || '', folderName);

    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
        log(`Folder created: ${folderName}`);
        res.json({ success: true });
    } else {
        log('Folder creation failed: Folder already exists', true);
        res.status(400).json({ success: false, message: 'Folder already exists' });
    }
});

/**
 * @swagger
 * /api/get-screens:
 *   get:
 *     summary: Get user screens
 *     description: Retrieve screens for the logged-in user.
 *     tags: [Screens]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Screens retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   screen_id:
 *                     type: integer
 *                   screen_name:
 *                     type: string
 *                   pairing_code:
 *                     type: string
 *                   enabled:
 *                     type: boolean
 *                   online_status:
 *                     type: integer
 *                   last_connected:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */
app.get('/api/get-screens', verifyToken, (req, res) => {
    const query = 'SELECT * FROM screens WHERE user_id = ?';
    db.query(query, [req.userId], (err, results) => {
        if (err) {
            return res.status(500).send({ message: 'Error fetching screens', error: err });
        }
        res.status(200).send(results);
    });
});

/**
 * @swagger
 * /api/add-screen:
 *   post:
 *     summary: Add a new screen
 *     description: Add a new screen for the logged-in user.
 *     tags: [Screens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               screenName:
 *                 type: string
 *               pairingCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Screen added successfully
 *       400:
 *         description: Failed to add screen
 */
app.post('/api/add-screen', verifyToken, (req, res) => {
    const { screen_name, pairing_code } = req.body;
    const screen_url = `http://visiontek.ddns.net:8001/connected.html?pairingCode=${pairing_code}`;
    const query = 'INSERT INTO screens (screen_name, pairing_code, user_id, screen_url) VALUES (?, ?, ?, ?)';
    db.query(query, [screen_name, pairing_code, req.userId, screen_url], (err, results) => {
        if (err) {
            return res.status(500).send({ message: 'Error adding screen', error: err });
        }

        // Notify pairing success
        notifyPairingSuccess(pairing_code);

        res.status(200).send({ success: true, message: 'Screen added successfully', screen_url });
    });
});

// Periodic task to check and update online status
setInterval(() => {
    const now = Date.now();
    lastActivityMap.forEach((timestamp, pairingCode) => {
        if (now - timestamp > 60000) { // 60 seconds threshold for inactivity
            const ws = pairingCodeToWsMap.get(pairingCode);
            if (ws) {
                ws.terminate(); // Close the WebSocket connection
                pairingCodeToWsMap.delete(pairingCode);
                lastActivityMap.delete(pairingCode);
                updateOnlineStatus(pairingCode, 0); // Set online status to 0 (offline)
            }
        }
    });
}, 10000); // Check every 10 seconds

/**
 * @swagger
 * /api/rename-screen:
 *   post:
 *     summary: Rename a screen
 *     description: Update the name of a screen for the authenticated user.
 *     tags: [Screens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - screen_id
 *               - new_screen_name
 *             properties:
 *               screen_id:
 *                 type: string
 *                 description: The ID of the screen to rename.
 *               new_screen_name:
 *                 type: string
 *                 description: The new name for the screen.
 *     responses:
 *       200:
 *         description: Screen renamed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Screen renamed successfully
 *       500:
 *         description: Error renaming screen.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */
app.post('/api/rename-screen', verifyToken, (req, res) => {
    const { screen_id, new_screen_name } = req.body;
    const query = 'UPDATE screens SET screen_name = ? WHERE screen_id = ? AND user_id = ?';
    db.query(query, [new_screen_name, screen_id, req.userId], (err, results) => {
        if (err) {
            return res.status(500).send({ message: 'Error renaming screen', error: err });
        }
        res.status(200).send({ success: true, message: 'Screen renamed successfully' });
    });
});

/**
 * @swagger
 * /api/delete-screen:
 *   post:
 *     summary: Delete a screen
 *     description: Delete a screen for the authenticated user.
 *     tags: [Screens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - screen_id
 *             properties:
 *               screen_id:
 *                 type: string
 *                 description: The ID of the screen to delete.
 *     responses:
 *       200:
 *         description: Screen deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Screen deleted successfully
 *       500:
 *         description: Error deleting screen.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */
app.post('/api/delete-screen', verifyToken, (req, res) => {
    const { screen_id } = req.body;
    const query = 'DELETE FROM screens WHERE screen_id = ? AND user_id = ?';
    db.query(query, [screen_id, req.userId], (err, results) => {
        if (err) {
            return res.status(500).send({ message: 'Error deleting screen', error: err });
        }
        res.status(200).send({ success: true, message: 'Screen deleted successfully' });
    });
});

/**
 * @swagger
 * /api/screen-details/{id}:
 *   get:
 *     summary: Get screen details by ID
 *     description: Retrieve the details of a specific screen by its ID.
 *     tags: [Screens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the screen to retrieve.
 *     responses:
 *       200:
 *         description: Successfully retrieved screen details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 screen_id:
 *                   type: integer
 *                   example: 1
 *                 screen_name:
 *                   type: string
 *                   example: "Screen Title 1"
 *                 pairing_code:
 *                   type: string
 *                   example: "ABC123"
 *                 user_id:
 *                   type: integer
 *                   example: 1
 *                 enabled:
 *                   type: boolean
 *                   example: true
 *                 online_status:
 *                   type: integer
 *                   example: 1
 *                 last_connected:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-01-01T12:00:00Z"
 *                 created:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-01-01T12:00:00Z"
 *                 updated:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-01-01T12:00:00Z"
 *                 thumbnail:
 *                   type: string
 *                   example: "/uploads/screen-thumbnail.png"
 *       404:
 *         description: Screen not found.
 *       500:
 *         description: Internal server error.
 */
app.get('/api/screen-details/:id', (req, res) => {
    const screenId = req.params.id;
    const query = 'SELECT * FROM screens WHERE screen_id = ?';
    
    db.query(query, [screenId], (err, result) => {
        if (err) {
            console.error('Error fetching screen details:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (result.length === 0) {
            return res.status(404).json({ error: 'Screen not found' });
        }

        const screenDetails = result[0];
        // Ensure the path to the thumbnail is correct
        screenDetails.thumbnail = `/uploads/screen-thumbnail.png`;
        
        res.json(screenDetails);
    });
});

/**
 * @swagger
 * /api/search-screens:
 *   get:
 *     summary: Search screens
 *     description: Search for screens by name for the logged-in user.
 *     tags: [Screens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: The search query for the screen name.
 *     responses:
 *       200:
 *         description: Screens retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   screen_id:
 *                     type: integer
 *                   screen_name:
 *                     type: string
 *                   pairing_code:
 *                     type: string
 *                   user_id:
 *                     type: integer
 *                   enabled:
 *                     type: boolean
 *                   online_status:
 *                     type: integer
 *                   last_connected:
 *                     type: string
 *                     format: date-time
 *                   created:
 *                     type: string
 *                     format: date-time
 *                   updated:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
app.get('/api/search-screens', (req, res) => {
    const query = req.query.query.toLowerCase();
    const token = req.headers['authorization'].split(' ')[1];
    let userId;

    try {
        const decoded = jwt.verify(token, config.secretKey); // Use the secret key from the config
        userId = decoded.userId;
    } catch (err) {
        console.error('Invalid token:', err);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const sql = `SELECT * FROM screens WHERE screen_name LIKE ? AND user_id = ?`;
    const searchQuery = `%${query}%`;
    
    db.query(sql, [searchQuery, userId], (err, results) => {
        if (err) {
            console.error('Error fetching screens:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});

/**
 * @swagger
 * /api/add-to-multiple-screens:
 *   post:
 *     tags: [Playlists]
 *     summary: Add content to multiple screens
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selectedScreens:
 *                 type: array
 *                 items:
 *                   type: integer
 *               addPosition:
 *                 type: integer
 *               duration:
 *                 type: integer
 *               fileName:
 *                 type: string
 *             required:
 *               - selectedScreens
 *               - addPosition
 *               - duration
 *               - fileName
 *     responses:
 *       200:
 *         description: Content added to multiple screens successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: No screens selected
 *       500:
 *         description: Failed to add content to playlists
 */
apiApp.post('/api/add-to-multiple-screens', verifyToken, (req, res) => {
    const { selectedScreens, addPosition, duration, fileName } = req.body;
    const userId = req.userId;

    if (!selectedScreens || selectedScreens.length === 0) {
        return res.status(400).json({ success: false, message: 'No screens selected' });
    }

    console.log('Adding content to multiple screens:', { selectedScreens, addPosition, duration, fileName, userId });

    getContentDetailsByFileName(fileName, (err, content) => {
        if (err || !content) {
            console.error('Content not found:', err);
            return res.status(500).json({ success: false, message: 'Content not found' });
        }

        let queries = selectedScreens.map(screenId => {
            return new Promise((resolve, reject) => {
                const query = `INSERT INTO playlists (screenId, contentId, sequenceNumber, displayDuration, userId) VALUES (?, ?, ?, ?, ?)`;
                db.query(query, [screenId, content.id, addPosition, duration, userId], function(err) {
                    if (err) {
                        console.error('Error inserting into playlists:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });

        Promise.all(queries)
            .then(() => {
                console.log('Content successfully added to multiple screens');
                res.json({ success: true, message: 'Content added to multiple screens successfully' });
            })
            .catch(err => {
                console.error('Failed to add content to playlists:', err);
                res.status(500).json({ success: false, message: 'Failed to add content to playlists', error: err });
            });
    });
});

function getContentDetailsByFileName(fileName, callback) {
    const query = `SELECT * FROM content WHERE file_name = ?`;
    db.query(query, [fileName], (err, row) => {
        if (err) {
            return callback(err);
        }
        callback(null, row[0]);
    });
}

/**
 * @swagger
 * /api/file-id:
 *   get:
 *     tags: [Content]
 *     summary: Get content ID by file name
 *     parameters:
 *       - name: fileName
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Content ID retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 contentId:
 *                   type: integer
 *       404:
 *         description: Content not found
 *       500:
 *         description: Failed to fetch content ID
 */
app.get('/api/file-id', (req, res) => {
    const { fileName } = req.query;
    const sql = 'SELECT id FROM content WHERE file_name = ?';
    db.query(sql, [fileName], (err, results) => {
        if (err) {
            console.error('Error fetching content ID:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch content ID' });
        }
        if (results.length > 0) {
            res.json({ success: true, contentId: results[0].id });
        } else {
            res.status(404).json({ success: false, message: 'Content not found' });
        }
    });
});

/**
 * @swagger
 * /api/add-to-playlists:
 *   post:
 *     tags: [Playlists]
 *     summary: Add content to playlists
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contentId:
 *                 type: integer
 *               selectedScreens:
 *                 type: array
 *                 items:
 *                   type: integer
 *             required:
 *               - contentId
 *               - selectedScreens
 *     responses:
 *       200:
 *         description: Content added to playlists successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Failed to add to playlists
 */
app.post('/api/add-to-playlists', verifyToken, (req, res) => {
    const { contentId, selectedScreens } = req.body;
    const userId = req.userId;

    if (!contentId || !selectedScreens || selectedScreens.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    const values = selectedScreens.map(screenId => [screenId, contentId, userId]);

    const sql = 'INSERT INTO playlists (screenId, contentId, userId) VALUES ?';
    db.query(sql, [values], (err, results) => {
        if (err) {
            console.error('Error adding to playlists:', err);
            return res.status(500).json({ success: false, message: 'Failed to add to playlists' });
        }
        res.json({ success: true, message: 'Content added to playlists successfully' });
    });
});

/**
 * @swagger
 * /api/screen-playlists/{screenId}:
 *   get:
 *     tags: [Playlists]
 *     summary: Get playlists for a screen
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: screenId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Playlists fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 playlists:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Failed to fetch playlists
 */
app.get('/api/screen-playlists/:screenId', verifyToken, (req, res) => {
    const { screenId } = req.params;

    const sql = 'SELECT * FROM playlists WHERE screenId = ?';
    db.query(sql, [screenId], (err, results) => {
        if (err) {
            console.error('Error fetching playlists:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch playlists' });
        }
        res.json({ success: true, playlists: results });
    });
});

/**
 * @swagger
 * /api/content-details/{contentId}:
 *   get:
 *     tags: [Content]
 *     summary: Get content details by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: contentId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Content details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 content:
 *                   type: object
 *       404:
 *         description: Content not found
 *       500:
 *         description: Failed to fetch content details
 */
app.get('/api/content-details/:contentId', verifyToken, (req, res) => {
    const { contentId } = req.params;

    const sql = 'SELECT file_path, file_name, file_type, file_orientation FROM content WHERE id = ?';
    db.query(sql, [contentId], (err, results) => {
        if (err) {
            console.error('Error fetching content details:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch content details' });
        }
        if (results.length > 0) {
            res.json({ success: true, content: results[0] });
        } else {
            res.status(404).json({ success: false, message: 'Content not found' });
        }
    });
});

/**
 * @swagger
 * /api/delete-playlist-item/{playlistId}:
 *   delete:
 *     tags: [Playlists]
 *     summary: Delete a playlist item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: playlistId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Playlist item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Failed to delete playlist item
 */
app.delete('/api/delete-playlist-item/:playlistId', verifyToken, (req, res) => {
    const { playlistId } = req.params;

    const sql = 'DELETE FROM playlists WHERE id = ?';
    db.query(sql, [playlistId], (err, results) => {
        if (err) {
            console.error('Error deleting playlist item:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete playlist item' });
        }
        res.json({ success: true, message: 'Playlist item deleted successfully' });
    });
});

/**
 * @swagger
 * /api/user-content:
 *   get:
 *     tags: [Content]
 *     summary: Get user content
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User content fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 content:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Failed to fetch user content
 */
app.get('/api/user-content', verifyToken, (req, res) => {
    const userId = req.userId;

    const sql = 'SELECT * FROM content WHERE user_id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user content:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch user content' });
        }
        res.json({ success: true, content: results });
    });
});

/**
 * @swagger
 * /api/add-to-playlist:
 *   post:
 *     tags: [Playlists]
 *     summary: Add content to a playlist
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contentId:
 *                 type: integer
 *               screenId:
 *                 type: integer
 *             required:
 *               - contentId
 *               - screenId
 *     responses:
 *       200:
 *         description: Content added to playlist successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Failed to add to playlist
 */
app.post('/api/add-to-playlist', verifyToken, (req, res) => {
    const { contentId, screenId } = req.body;
    const userId = req.userId;

    const sql = 'INSERT INTO playlists (screenId, contentId, userId) VALUES (?, ?, ?)';
    db.query(sql, [screenId, contentId, userId], (err, results) => {
        if (err) {
            console.error('Error adding to playlist:', err);
            return res.status(500).json({ success: false, message: 'Failed to add to playlist' });
        }
        res.json({ success: true, message: 'Content added to playlist successfully' });
    });
});

/**
 * @swagger
 * /api/search-content:
 *   get:
 *     tags: [Content]
 *     summary: Search content
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: query
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Content search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: Failed to fetch content
 */
app.get('/api/search-content', (req, res) => {
    const query = req.query.query.toLowerCase();
    const token = req.headers['authorization'].split(' ')[1];
    let userId;

    try {
        const decoded = jwt.verify(token, config.secretKey); // Use the secret key from the config
        userId = decoded.userId;
    } catch (err) {
        console.error('Invalid token:', err);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const sql = `SELECT * FROM content WHERE file_name LIKE ? AND user_id = ?`;
    const searchQuery = `%${query}%`;
    
    db.query(sql, [searchQuery, userId], (err, results) => {
        if (err) {
            console.error('Error fetching content:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});

app.post('/api/remove-from-all-playlists', (req, res) => {
    const { contentid } = req.body;
    const userId = req.session.userId; // Get userId from session

    if (!userId) {
        console.error('Not authenticated: No user ID in session');
        return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!contentid) {
        console.error('Bad request: Missing contentid');
        return res.status(400).json({ error: 'Missing contentid' });
    }

    console.log(`Attempting to remove all playlists for content ID: ${contentid} for user ID ${userId}`);

    // Select the records to be deleted from the playlists table
    const selectSql = `
        SELECT p.id AS playlistId, p.userId, p.contentId, c.file_name
        FROM playlists p
        JOIN content c ON p.contentId = c.id
        WHERE p.userId = ? AND p.contentId = ?
    `;
    db.query(selectSql, [userId, contentid], (err, results) => {
        if (err) {
            console.error('Error selecting from playlists:', err);
            return res.status(500).json({ error: 'Failed to select from playlists' });
        }

        if (results.length === 0) {
            console.log(`No playlists found for content ID ${contentid} and user ID ${userId}`);
            return res.status(404).json({ error: 'No playlists found to delete' });
        }

        console.log(`Playlists to be deleted:`, results);

        // Proceed to delete the records from the playlists table
        const deleteSql = 'DELETE FROM playlists WHERE userId = ? AND contentId = ?';
        db.query(deleteSql, [userId, contentid], (err, result) => {
            if (err) {
                console.error('Error deleting from playlists:', err);
                return res.status(500).json({ error: 'Failed to delete from playlists' });
            }

            console.log(`Deleted ${result.affectedRows} record(s) from playlists for content ID ${contentid} and user ID ${userId}`);
            res.json({ success: true });
        });
    });
});

app.get('/pairing', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pairing.html'));
});

// Endpoint to generate and store a pairing code
app.post('/api/generate-pairing-code', (req, res) => {
    const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    pairingCodes[pairingCode] = { timestamp: Date.now() };
    res.json({ success: true, pairingCode });
});

// Endpoint to check pairing status
app.get('/api/check-pairing-status', (req, res) => {
    const { code } = req.query;
    const paired = pairedScreens[code] || false;
    res.json({ paired });
});

// Endpoint to get content for paired screen
app.get('/api/get-content', (req, res) => {
    const { pairingCode } = req.query;

    const query = `
        SELECT c.file_path, c.file_type
        FROM playlists p
        JOIN content c ON p.contentId = c.id
        JOIN screens s ON p.screenid = s.screen_id
        WHERE s.pairing_code = ? AND s.online_status = 1
        ORDER BY p.sequenceNumber ASC
        LIMIT 1
    `;
    db.query(query, [pairingCode], (err, results) => {
        if (err) {
            return res.status(500).send({ error: 'Error fetching content' });
        }
        if (results.length === 0) {
            return res.status(404).send({ error: 'No content found' });
        }
        res.send(results[0]);
    });
});

// Endpoint to check online status
app.get('/api/check-online-status', (req, res) => {
    const { pairingCode } = req.query;
    
    const query = 'SELECT online_status FROM screens WHERE pairing_code = ?';
    db.query(query, [pairingCode], (err, results) => {
        if (err) {
            return res.status(500).send({ error: 'Error checking online status' });
        }
        if (results.length === 0) {
            return res.status(404).send({ error: 'Screen not found' });
        }
        res.send({ online: results[0].online_status === 1 });
    });
});

// Helper function to update the online_status in the database
function updateOnlineStatus(pairingCode, status) {
    const query = 'UPDATE screens SET online_status = ? WHERE pairing_code = ?';
    db.query(query, [status, pairingCode], (err) => {
        if (err) {
            console.error(`Error updating online status for pairing code ${pairingCode}:`, err);
        } else {
            console.log(`Updated online status for pairing code ${pairingCode} to ${status}`);
        }
    });
}

// Update online status based on WebSocket connection
wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.replace('/?', ''));
    const pairingCode = params.get('pairingCode');

    if (pairingCode) {
        pairingCodeToWsMap.set(pairingCode, ws);
        lastActivityMap.set(pairingCode, Date.now());
        updateOnlineStatus(pairingCode, 1); // Set online status to 1 (online)

        ws.on('close', () => {
            pairingCodeToWsMap.delete(pairingCode);
            lastActivityMap.delete(pairingCode);
            updateOnlineStatus(pairingCode, 0); // Set online status to 0 (offline)
        });

        ws.on('message', () => {
            lastActivityMap.set(pairingCode, Date.now());
        });
    }
});

function notifyPairingSuccess(pairingCode) {
    const ws = pairingCodeToWsMap.get(pairingCode);
    if (ws) {
        ws.send(JSON.stringify({ type: 'pairingSuccess' }));
    }
}

wss.on('close', () => {
    console.log('WebSocket connection closed');
});

// Update the store pairing code endpoint to set paired status when pairing is done
app.post('/api/store-pairing-code', (req, res) => {
    const { pairingCode } = req.body;
    if (!pairingCode) {
        return res.status(400).json({ success: false, message: 'Pairing code is required' });
    }

    // Store pairing code with a timestamp for expiration (e.g., 10 minutes)
    pairedScreens[pairingCode] = false;  // Initial status is not paired
    pairingCodes[pairingCode] = { timestamp: Date.now() };
    res.json({ success: true });
});

// Endpoint to validate pairing code
app.post('/api/validate-pairing-code', (req, res) => {
    const { pairingCode } = req.body;
    if (!pairingCode) {
        return res.status(400).json({ success: false, message: 'Pairing code is required' });
    }

    const codeData = pairingCodes[pairingCode];
    if (codeData && (Date.now() - codeData.timestamp < 10 * 60 * 1000)) {
        pairedScreens[pairingCode] = true;
        delete pairingCodes[pairingCode];
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, message: 'Invalid or expired pairing code' });
    }
});

app.get('/connected', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'connected.html'));
});

// Add this endpoint to your server.js

app.get('/api/playlist/:pairingCode', (req, res) => {
    const { pairingCode } = req.params;
    const sql = `
        SELECT c.file_path, c.file_type
        FROM playlists p
        JOIN content c ON p.contentId = c.id
        JOIN screens s ON p.screenid = s.screen_id
        WHERE s.pairing_code = ?
        ORDER BY p.sequenceNumber ASC
    `;

    db.query(sql, [pairingCode], (err, results) => {
        if (err) {
            console.error('Error fetching playlist:', err);
            return res.status(500).json({ error: 'Failed to fetch playlist' });
        }
        res.json({ success: true, playlist: results });
    });
});

// Add this to your WebSocket handling in server.js
const updateClientsWithPlaylist = (pairingCode) => {
    const sql = `
        SELECT c.file_path, c.file_type
        FROM playlists p
        JOIN content c ON p.contentId = c.id
        JOIN screens s ON p.screenid = s.screen_id
        WHERE s.pairing_code = ?
        ORDER BY p.sequenceNumber ASC
    `;

    db.query(sql, [pairingCode], (err, results) => {
        if (err) {
            console.error('Error fetching playlist for WebSocket update:', err);
            return;
        }

        console.log(`Sending playlist update for pairing code ${pairingCode}:`, results);

        const message = JSON.stringify({
            type: 'playlistUpdate',
            playlist: results
        });
        wss.clients.forEach(client => {
            if (client.pairingCode === pairingCode && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
};

app.get('/api/check-playlist', (req, res) => {
    const fileName = req.query.file;
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
        console.error('No authorization header provided');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authorizationHeader.split(' ')[1];
    if (!token) {
        console.error('No token provided');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Implement your own logic to extract userId from the token
    const userId = getUserIdFromToken(token); 
    if (!userId) {
        console.error('Invalid token, unable to extract userId');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`Checking playlist for userId: ${userId} and fileName: ${fileName}`);

    const query = `
        SELECT COUNT(*) AS count
        FROM playlists p
        JOIN content c ON p.contentId = c.id
        WHERE c.user_id = ? AND c.file_name = ?
    `;

    db.query(query, [userId, fileName], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log(`Query result: ${JSON.stringify(results)}`);

        res.json({ isInPlaylist: results[0].count > 0 });
    });
});

// Middleware to authenticate token
function authenticateToken(req, res, next) {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
        console.error('No authorization header provided');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authorizationHeader.split(' ')[1];
    if (!token) {
        console.error('No token provided');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Implement your own logic to extract userId from the token
    const userId = getUserIdFromToken(token); 
    if (!userId) {
        console.error('Invalid token, unable to extract userId');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    req.userId = userId; // Attach the userId to the request object for later use
    next();
}

function getUserIdFromToken(token) {
    try {
        const decoded = jwt.verify(token, config.secretKey);
        return decoded.userId; // Adjust based on how your token is structured
    } catch (err) {
        console.error('Failed to decode token:', err);
        return null;
    }
}

app.post('/api/get-playlist-content', async (req, res) => {
    try {
        const { pairing_code } = req.body;
        const content = await getContentByPairingCode(pairing_code);

        if (content.length > 0) {
            res.json({ success: true, content });
        } else {
            res.json({ success: false, message: 'No content found' });
        }
    } catch (error) {
        console.error('Error fetching playlist content:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// Function to get content by pairing code
function getContentByPairingCode(pairingCode) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT c.file_path, c.file_type, p.displayDuration
            FROM playlists p
            JOIN content c ON p.contentId = c.id
            JOIN screens s ON p.screenid = s.screen_id
            WHERE s.pairing_code = ?
            ORDER BY p.sequenceNumber ASC
        `;
        db.query(sql, [pairingCode], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

app.get('/api/user-playlists', (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const sql = `
        SELECT p.id, CONCAT('Playlist ', p.id) AS name, p.screenid, p.createdAt, c.file_path
        FROM playlists p
        JOIN content c ON p.userid = c.user_id
        WHERE c.user_id = ?
    `;
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.log('Failed to fetch playlists:', err);
            return res.status(500).json({ error: 'Failed to fetch playlists' });
        }

        const groupedPlaylists = results.reduce((acc, playlist) => {
            const key = `${playlist.name}_${playlist.screenid}`;
            if (!acc[key]) {
                acc[key] = {
                    name: playlist.name,
                    screenid: playlist.screenid,
                    createdAt: playlist.createdAt,
                    file_paths: [],
                    ids: [],
                };
            }
            acc[key].file_paths.push(playlist.file_path);
            acc[key].ids.push(playlist.id);
            return acc;
        }, {});

        res.json({ playlists: Object.values(groupedPlaylists) });
    });
});

app.delete('/api/delete-playlist/:id', (req, res) => {
    const playlistId = req.params.id;
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const sql = 'DELETE FROM playlists WHERE id = ? AND userid = ?';
    db.query(sql, [playlistId, userId], (err, result) => {
        if (err) {
            console.log('Failed to delete playlist:', err);
            return res.status(500).json({ error: 'Failed to delete playlist' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Playlist not found or not authorized' });
        }
        res.status(204).send();
    });
});

// Sending Support Request Endpoint
const supportStorage = multer.memoryStorage();
const supportUpload = multer({ 
    storage: supportStorage,
    limits: { fileSize: config.support_request_max_file_size_mb * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedFormats = config.support_request_file_formats.split(',').map(format => `image/${format}`).concat(['video/mp4', 'video/avi']);
        if (allowedFormats.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file format'), false);
        }
    }
});

app.post('/api/send-support-request', supportUpload.single('attachment'), async (req, res) => {
    const { name, email, subject, message, copy, recaptcha } = req.body;
    const attachment = req.file;

    console.log('Request Body:', req.body); // Log to debug the request body
    if (!name || !email || !subject || !message || !recaptcha) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const recaptchaSecret = config.g_secret_key;
    const recaptchaVerificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${recaptcha}`;

    try {
        const recaptchaResponse = await axios.post(recaptchaVerificationUrl);
        if (!recaptchaResponse.data.success) {
            return res.status(400).json({ error: 'reCAPTCHA verification failed' });
        }

        const transporter = nodemailer.createTransport({
            host: 'smtpout.secureserver.net',
            port: 465,
            secure: true,
            auth: {
                user: 'info@visiontek.co.za',
                pass: 'KristyLee5483@!1'
            }
        });

        const mailOptions = {
            from: config.smtp.auth.user,
            to: config.to,
            subject: `DasheeApp | Support Request: ${subject}`,
            html: `<p><strong>Name:</strong> ${name}</p>
                   <p><strong>Email:</strong> ${email}</p>
                   <p><strong>Message:</strong></p>
                   <p>${message}</p>`,
            attachments: []
        };

        if (attachment) {
            mailOptions.attachments.push({
                filename: attachment.originalname,
                content: attachment.buffer,
                contentType: attachment.mimetype
            });
        }

        if (copy) {
            mailOptions.cc = email;
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
                return res.status(500).json({ error: 'Failed to send support request' });
            } else {
                console.log('Email sent:', info.response);
                return res.json({ success: true });
            }
        });
    } catch (error) {
        console.log('Error verifying reCAPTCHA:', error);
        return res.status(500).json({ error: 'reCAPTCHA verification failed' });
    }
});

// Forgot password endpoint
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    console.log(`Received forgot password request for email: ${email}`);

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (result.length === 0) {
            console.warn('No user exists with this email address');
            return res.status(404).json({ success: false, message: 'No user exists with this email address' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

        const tokenExpiry = Date.now() + 3600000; // 1 hour from now
        db.query('UPDATE users SET reset_token = ?, token_expiry = ? WHERE email = ?', [resetToken, tokenExpiry, email], (err, updateResult) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            const mailOptions = {
                from: config.smtp.auth.user,
                to: email,
                subject: 'Dashee | Password Reset Request',
                html: `<p>Please click the link below to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`
            };

            const transporter = nodemailer.createTransport({
                host: config.smtp.host,
                port: config.smtp.port,
                secure: config.smtp.secure,
                auth: {
                    user: config.smtp.auth.user,
                    pass: config.smtp.auth.pass
                }
            });

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Failed to send email:', error);
                    return res.status(500).json({ success: false, message: 'Failed to send email' });
                }
                console.log('Reset link sent to email:', email);
                res.json({ success: true, message: 'Reset link sent to your email address.' });
            });
        });
    });
});

// Reset password endpoint
app.post('/reset-password', async (req, res) => {
    const { password, token } = req.body;

    try {
        // Check if the reset token is valid and not expired
        const user = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE reset_token = ? AND token_expiry > ?', [token, Date.now()], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });

        if (user.length === 0) {
            return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Update the user's password and clear the reset token and expiry
        await new Promise((resolve, reject) => {
            db.query('UPDATE users SET password = ?, reset_token = NULL, token_expiry = NULL WHERE id = ?', [hashedPassword, user[0].id], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });

        res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to reset password.' });
    }
});

// Fetch all events for the user
app.get('/api/events', authenticateToken, (req, res) => {
    const userId = req.userId;
    const sql = 'SELECT * FROM events WHERE user_id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching events:', err);
            return res.status(500).json({ error: 'Failed to fetch events' });
        }
        res.json(results);
    });
});

// Create a new event
app.post('/api/events', authenticateToken, (req, res) => {
    const { title, start, end, category, color } = req.body;
    const userId = req.userId;

    // Insert event into the database
    const sql = 'INSERT INTO events (title, start, end, category, color, user_id) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [title, start, end, category, color, userId], (err, result) => {
        if (err) {
            console.error('Error inserting event:', err);
            return res.status(500).json({ error: 'Failed to insert event' });
        }
        res.json({ id: result.insertId, title, start, end, category, color });
    });
});

// Get event details
app.get('/api/events/:id', authenticateToken, (req, res) => {
    const userId = req.userId;
    const eventId = req.params.id;
    const sql = 'SELECT * FROM events WHERE id = ? AND user_id = ?';
    db.query(sql, [eventId, userId], (err, results) => {
        if (err) {
            console.error('Error fetching event details:', err);
            return res.status(500).json({ error: 'Failed to fetch event details' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(results[0]);
    });
});

//Update the event
app.put('/api/events/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, start, end, category, color } = req.body;
    const userId = req.userId;

    // Update event in the database
    const sql = 'UPDATE events SET title = ?, start = ?, end = ?, category = ?, color = ? WHERE id = ? AND user_id = ?';
    db.query(sql, [title, start, end, category, color, id, userId], (err, result) => {
        if (err) {
            console.error('Error updating event:', err);
            return res.status(500).json({ error: 'Failed to update event' });
        }
        res.json({ title, start, end, category, color });
    });
});

// Delete an event
app.delete('/api/events/:id', authenticateToken, (req, res) => {
    const userId = req.userId;
    const eventId = req.params.id;
    const sql = 'DELETE FROM events WHERE id = ? AND user_id = ?';
    db.query(sql, [eventId, userId], (err, result) => {
        if (err) {
            console.error('Error deleting event:', err);
            return res.status(500).json({ error: 'Failed to delete event' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.sendStatus(204);
    });
});


// Endpoint: /api/config
/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Get configuration settings
 *     tags:
 *       - Config
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved configuration settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 maxFileSize:
 *                   type: integer
 *                   description: Maximum file size allowed for uploads
 */
app.get('/api/config', (req, res) => {
    res.json({ maxFileSize: config.uploadConfig.maxFileSize });
});

// Setup Swagger at the end to avoid interference
swaggerSetup(app);

app.listen(config.webPort, () => {
    log(`WEB & API server running on port ${config.webPort}`);
});