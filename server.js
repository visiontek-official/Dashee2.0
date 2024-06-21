const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const config = require('./config/config');

const app = express(); // Web server
const apiApp = express(); // API server
const logFile = path.join(__dirname, 'logs', 'server.log');
const apiLogFile = path.join(__dirname, 'logs', 'api.log');
const swaggerSetup = require('./swagger');

// Helper function to generate token
const generateToken = (userId) => {
    return jwt.sign({ userId }, config.secretKey, { expiresIn: '1h' });
};

// Verify Token Middleware
function verifyToken(req, res, next) {
    const token = req.headers['authorization'];
    console.log('Received Token:', token);
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
        created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`;

    const screenTableQuery = `CREATE TABLE IF NOT EXISTS screens (
        screen_id INT AUTO_INCREMENT PRIMARY KEY,
        screen_name VARCHAR(255) NOT NULL,
        pairing_code VARCHAR(255) NOT NULL,
        user_id INT NOT NULL,
        enabled BOOLEAN DEFAULT false,
        last_connected DATETIME DEFAULT NULL,
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

    db.query(userTableQuery, (err, result) => {
        if (err) {
            log('User table creation failed: ' + err, true);
            throw err;
        }
        log('User table checked/created');
        checkAdminUser();
    });

    db.query(screenTableQuery, (err, result) => {
        if (err) {
            log('Screen table creation failed: ' + err, true);
            throw err;
        }
        log('Screen table checked/created');
    });

    db.query(contentTableQuery, (err, result) => {
        if (err) {
            log('Content table creation failed: ' + err, true);
            throw err;
        }
        log('Content table checked/created');
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

apiApp.listen(config.apiPort, () => {
    apiLog(`API server running on port ${config.apiPort}`);
});

// API server middleware and routes
apiApp.use(bodyParser.urlencoded({ extended: true }));
apiApp.use(bodyParser.json());

// Middleware to log API requests and responses and verify tokens if required
apiApp.use((req, res, next) => {
    apiLog(`API request: ${req.method} ${req.url} - Body: ${JSON.stringify(req.body)}`);
    next();
});

// Middleware to log API requests and responses and verify tokens
app.use((req, res, next) => {
    const publicPaths = ['/index.html', '/login', '/signup', '/css', '/js', '/images'];
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
        console.log('Fetched statistics:', { totalUsers, activeUsers, disabledUsers, totalScreens });
        res.json({ totalUsers, activeUsers, disabledUsers, totalScreens });
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
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.session.userId;

    const sql = 'SELECT * FROM content WHERE user_id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching files:', err);
            return res.status(500).json({ error: 'Failed to fetch files' });
        }

        const files = results.map(file => ({
            name: file.file_name,
            path: file.file_path,
            type: file.file_type,
            uploadDate: file.upload_date
        }));

        res.json(files);
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
    const sql = 'INSERT INTO users (firstname, lastname, email, password, profile_pic) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [firstname, lastname, email, password, 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png'], (err, result) => {
        if (err) {
            log('Signup failed: ' + err, true);
            return res.json({ success: false, message: 'Signup failed. Please try again.' });
        }
        log(`User signed up: ${email}`, true);
        return res.json({ success: true });
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
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ? AND enabled = true';
    db.query(sql, [email, password], (err, results) => {
        if (err) return res.json({ success: false, message: 'Login failed. Please try again.' });

        if (results.length > 0) {
            const user = results[0];
            const token = jwt.sign({ userId: user.id }, config.secretKey, { expiresIn: '1h' });

            log(`Generated token: ${token}`);

            const updateSql = 'UPDATE users SET logged_in = TRUE, api_token = ? WHERE id = ?';
            db.query(updateSql, [token, user.id], (err) => {
                if (err) return res.json({ success: false, message: 'Login failed. Please try again.' });

                const fetchUpdatedUserSql = 'SELECT * FROM users WHERE id = ?';
                db.query(fetchUpdatedUserSql, [user.id], (err, updatedResults) => {
                    if (err) return res.json({ success: false, message: 'Login failed. Please try again.' });

                    log(`Updated user data: ${JSON.stringify(updatedResults)}`);

                    req.session.regenerate((err) => {
                        if (err) return res.json({ success: false, message: 'Login failed. Please try again.' });

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
        } else {
            res.json({ success: false, message: 'Incorrect email or password or user not enabled' });
        }
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
app.post('/api/upload-file', upload.single('file'), (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.session.userId;
    const originalName = req.file.originalname;
    const userDir = path.join(__dirname, 'uploads', userId.toString());

    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    const filePath = path.join(userDir, originalName);
    const relativePath = `uploads/${userId.toString()}/${originalName}`;
    const urlPath = `${config.server_url}:${config.webPort}/${relativePath}`;
    const fileSizeInKB = Math.round(req.file.size / 1024); // Convert bytes to KB

    fs.rename(req.file.path, filePath, (err) => {
        if (err) {
            console.log('File move failed: ' + err);
            return res.status(500).json({ success: false, message: 'File move failed' });
        }

        const sql = 'INSERT INTO content (user_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [userId, originalName, urlPath, req.file.mimetype, fileSizeInKB], (err, result) => {
            if (err) {
                console.log('File save to database failed: ' + err);
                return res.status(500).json({ success: false, message: 'File save to database failed' });
            }

            console.log(`File uploaded and saved: ${filePath}`);
            res.json({ success: true, filePath: urlPath });
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
        SELECT file_name, file_description, file_path, file_tags, file_schedule_start, file_schedule_end, upload_date, file_size, file_orientation, file_dimensions
        FROM content
        WHERE file_name = ? AND user_id = ?`;
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
 *     summary: Save file details
 *     description: Update details of a specific file.
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
 *     responses:
 *       200:
 *         description: File details saved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error saving file details
 */
app.post('/api/save-file-details', (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { file, title, description, tags, schedule_start, schedule_end, size, orientation, dimensions } = req.body;

    const sql = `
        UPDATE content
        SET file_name = ?, file_description = ?, file_tags = ?, file_schedule_start = ?, file_schedule_end = ?, file_size = ?, file_orientation = ?, file_dimensions = ?
        WHERE file_name = ? AND user_id = ?`;
    db.query(sql, [title, description, tags, schedule_start, schedule_end, size, orientation, dimensions, file, userId], (err, results) => {
        if (err) {
            console.error('Error saving file details:', err);
            return res.status(500).json({ error: 'Failed to save file details' });
        }
        res.json({ success: true });
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

    fs.rm(filePath, { recursive: true, force: true }, (err) => {
        if (err) {
            log('File delete failed: ' + err, true);
            return res.status(500).json({ success: false, message: 'File delete failed' });
        }

        // Delete from the database
        const sql = 'DELETE FROM content WHERE file_name = ? AND user_id = ?';
        db.query(sql, [fileName, userId], (err, result) => {
            if (err) {
                log('Database deletion failed: ' + err, true);
                return res.status(500).json({ success: false, message: 'Database deletion failed' });
            }
            log(`File deleted: ${filePath}`);
            res.json({ success: true });
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

    const sql = 'SELECT id, firstname, lastname, email, role, enabled, created, updated, logged_in FROM users';
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
    const sql = 'SELECT id, firstname, lastname, email, role, enabled, profile_pic FROM users WHERE id = ?';
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
    const query = 'INSERT INTO screens (screen_name, pairing_code, user_id) VALUES (?, ?, ?)';
    db.query(query, [screen_name, pairing_code, req.userId], (err, results) => {
        if (err) {
            return res.status(500).send({ message: 'Error adding screen', error: err });
        }
        res.status(200).send({ success: true, message: 'Screen added successfully' });
    });
});

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

// Setup Swagger at the end to avoid interference
swaggerSetup(app);

app.listen(config.webPort, () => {
    log(`Web server running on port ${config.webPort}`);
});