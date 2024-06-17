const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const config = require('./config/config');

const app = express();
const port = config.port;
const logFile = path.join(__dirname, 'logs', 'server.log');

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const userDir = path.join(__dirname, 'uploads', req.session.userId.toString(), req.body.folder || '');
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Keep the original file name
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

// Add this function to log messages
const log = (message, indepth = false) => {
    const logMessage = `[${new Date().toISOString()}] ${message}`;
    fs.appendFileSync(logFile, logMessage + '\n'); // Always log to file
    if (config.logging || indepth) {
        console.log(logMessage); // Log to console conditionally
    }
};

const db = mysql.createConnection({
    host: 'localhost',
    user: config.dbUser,
    password: config.dbPassword,
    port: config.sqlPort
});

db.connect((err) => {
    if (err) {
        log('Database connection failed: ' + err, true);
        throw err;
    }
    log('Connected to database');
    db.query(`CREATE DATABASE IF NOT EXISTS ${config.dbName}`, (err, result) => {
        if (err) {
            log('Database creation failed: ' + err, true);
            throw err;
        }
        log('Database checked/created');
        db.changeUser({ database: config.dbName }, (err) => {
            if (err) {
                log('Database selection failed: ' + err, true);
                throw err;
            }
            createTables();
        });
    });
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
        enabled BOOLEAN DEFAULT true
    )`;

    const screenTableQuery = `CREATE TABLE IF NOT EXISTS screens (
        screen_id INT AUTO_INCREMENT PRIMARY KEY,
        screen_name VARCHAR(255) NOT NULL,
        pairing_code VARCHAR(255) NOT NULL,
        user_id INT NOT NULL,
        enabled BOOLEAN DEFAULT false,
        last_connected DATETIME DEFAULT NULL,
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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploads directory
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
}));

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

// Add logging to verify session data
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    log(`Login form data: ${JSON.stringify(req.body)}`);
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ? AND enabled = true';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            log('Login failed: ' + err, true);
            return res.json({ success: false, message: 'Login failed. Please try again.' });
        }
        log(`Login query results: ${JSON.stringify(results)}`);
        if (results.length > 0) {
            const user = results[0];
            req.session.userId = user.id;
            req.session.firstName = user.firstname;
            req.session.lastName = user.lastname;
            req.session.profilePic = user.profile_pic || 'https://i.ibb.co/BTwp6Bv/default-profile-pic.png';
            req.session.role = user.role;
            log(`User logged in: ${email}`);
            log(`Session data: ${JSON.stringify(req.session)}`);
            return res.json({ success: true });
        } else {
            log(`Incorrect email or password or user not enabled for: ${email}`, true);
            return res.json({ success: false, message: 'Incorrect email or password or user not enabled' });
        }
    });
});

app.post('/update-profile', upload.single('profile-pic'), (req, res) => {
    const { firstname, lastname, email, password } = req.body;
    let sql;
    let params;

    if (req.file) {
        sql = 'UPDATE users SET firstname = ?, lastname = ?, profile_pic = ? WHERE email = ?';
        params = [firstname, lastname, `/uploads/${req.session.userId}/${req.file.filename}`, email];
    } else {
        sql = 'UPDATE users SET firstname = ?, lastname = ? WHERE email = ?';
        params = [firstname, lastname, email];
    }

    if (password) {
        sql = sql.replace('WHERE', ', password = ? WHERE');
        params.splice(params.length - 1, 0, password);
    }

    db.query(sql, params, (err, result) => {
        if (err) {
            log('Profile update failed: ' + err, true);
            res.status(500).json({ success: false, message: 'Profile update failed' });
            return;
        }
        log(`User profile updated: ${email}`, true);
        res.json({ success: true });
    });
});

app.get('/getUserDetails', (req, res) => {
    log(`Fetching user details for session: ${JSON.stringify(req.session)}`);
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({
        firstName: req.session.firstName,
        lastName: req.session.lastName,
        profilePic: req.session.profilePic,
        role: req.session.role
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

    const sql = 'SELECT id, firstname, lastname, email, role, enabled FROM users';
    db.query(sql, (err, results) => {
        if (err) {
            log('Error fetching users: ' + err, true);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        res.json(results);
    });
});

app.post('/updateUser', (req, res) => {
    const { id, firstName, lastName, email, role, enabled } = req.body;

    const sql = 'UPDATE users SET firstname = ?, lastname = ?, email = ?, role = ?, enabled = ? WHERE id = ?';
    db.query(sql, [firstName, lastName, email, role, enabled, id], (err, result) => {
        if (err) {
            log('Error updating user: ' + err, true);
            return res.status(500).json({ success: false, message: 'Failed to update user' });
        }
        log(`User updated: ${email}`);
        res.json({ success: true });
    });
});

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

app.listen(port, () => {
    log(`Server running on port ${port}`);
});

app.get('/getUserStats', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const totalUsersQuery = 'SELECT COUNT(*) AS totalUsers FROM users';
    const activeUsersQuery = 'SELECT COUNT(*) AS activeUsers FROM users WHERE enabled = true';
    const disabledUsersQuery = 'SELECT COUNT(*) AS disabledUsers FROM users WHERE enabled != 1';
    const totalScreensQuery = 'SELECT COUNT(*) AS totalScreens FROM screens';

    db.query(totalUsersQuery, (err, totalUsersResult) => {
        if (err) {
            log('Error fetching total users: ' + err, true);
            return res.status(500).json({ error: 'Failed to fetch total users' });
        }

        db.query(activeUsersQuery, (err, activeUsersResult) => {
            if (err) {
                log('Error fetching active users: ' + err, true);
                return res.status(500).json({ error: 'Failed to fetch active users' });
            }

            db.query(disabledUsersQuery, (err, disabledUsersResult) => {
                if (err) {
                    log('Error fetching disabled users: ' + err, true);
                    return res.status(500).json({ error: 'Failed to fetch disabled users' });
                }

                db.query(totalScreensQuery, (err, totalScreensResult) => {
                    if (err) {
                        log('Error fetching total screens: ' + err, true);
                        return res.status(500).json({ error: 'Failed to fetch total screens' });
                    }

                    const stats = {
                        totalUsers: totalUsersResult[0].totalUsers,
                        activeUsers: activeUsersResult[0].activeUsers,
                        disabledUsers: disabledUsersResult[0].disabledUsers,
                        totalScreens: totalScreensResult[0].totalScreens
                    };

                    res.json(stats);
                });
            });
        });
    });
});


// Add screen endpoint
app.post('/addScreen', (req, res) => {
    const { pairingCode, screenName } = req.body;
    const userId = req.session.userId; // Assuming user ID is stored in session

    const sql = 'INSERT INTO screens (screen_name, pairing_code, user_id, enabled, last_connected) VALUES (?, ?, ?, false, NOW())';
    db.query(sql, [screenName, pairingCode, userId], (err, result) => {
        if (err) {
            console.error('Error adding screen:', err);
            res.json({ success: false });
        } else {
            res.json({ success: true });
        }
    });
});

// Get screens endpoint
app.get('/getScreens', (req, res) => {
    const userId = req.session.userId; // Assuming user ID is stored in session

    const sql = 'SELECT * FROM screens WHERE user_id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error retrieving screens:', err);
            res.json({ success: false });
        } else {
            res.json({ success: true, screens: results });
        }
    });
});

//Screen Details
app.get('/getScreenDetails', (req, res) => {
    const screenId = req.query.screenId;
    const sql = 'SELECT * FROM screens WHERE screen_id = ?';

    db.query(sql, [screenId], (err, results) => {
        if (err) {
            console.error('Error retrieving screen details:', err);
            res.json({ success: false });
        } else {
            res.json(results[0]);
        }
    });
});

