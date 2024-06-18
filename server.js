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

// Helper function to generate token
const generateToken = (userId) => {
    return jwt.sign({ userId }, config.secretKey, { expiresIn: '1h' });
};

// Verify Token Middleware
function verifyToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).send({ auth: false, message: 'No token provided.' });
    }
    jwt.verify(token.split(' ')[1], config.secretKey, function(err, decoded) { // Use config.secretKey
        if (err) {
            return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
        }
        req.userId = decoded.userId;
        next();
    });
}

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

const db = mysql.createConnection({
    host: 'localhost',
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    port: config.sqlPort
});

db.connect((err) => {
    if (err) {
        log('Database connection failed: ' + err, true);
        throw err;
    }
    log('Connected to database');
    createTables();
    logOutAllUsers(); // Log out all users on server start
});

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
    if (publicPaths.some(path => req.path.startsWith(path))) {
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

// Your API routes here

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

apiApp.post('/api/some-endpoint', (req, res) => {
    apiLog(`API request to /api/some-endpoint: ${JSON.stringify(req.body)}`);
    // Your API logic here
    res.json({ success: true });
});

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

app.get('/api/user-details', (req, res) => {
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

//**********************************API END POINTS**********************************

app.use((req, res, next) => {
    const publicPaths = ['/index.html', '/login', '/signup', '/css', '/js', '/images'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
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

app.post('/rename-file', (req, res) => {
    const { oldName, newName, currentFolder } = req.body;
    const userDir = path.join(__dirname, 'uploads', req.session.userId.toString(), currentFolder || '');
    const oldPath = path.join(userDir, oldName);
    const newPath = path.join(userDir, newName);

    fs.rename(oldPath, newPath, (err) => {
        if (err) {
            log('File rename failed: ' + err, true);
            return res.status(500).json({ success: false, message: 'File rename failed' });
        }
        log(`File renamed from ${oldPath} to ${newPath}`);
        res.json({ success: true });
    });
});

app.post('/delete-file', (req, res) => {
    const { fileName, currentFolder } = req.body;
    const userDir = path.join(__dirname, 'uploads', req.session.userId.toString(), currentFolder || '');
    const filePath = path.join(userDir, fileName);

    fs.rm(filePath, { recursive: true, force: true }, (err) => {
        if (err) {
            log('File delete failed: ' + err, true);
            return res.status(500).json({ success: false, message: 'File delete failed' });
        }
        log(`File deleted: ${filePath}`);
        res.json({ success: true });
    });
});

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

app.listen(config.webPort, () => {
    log(`Web server running on port ${config.webPort}`);
});
