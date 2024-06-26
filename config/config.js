require('dotenv').config(); // Load environment variables from .env file

module.exports = {
    server_url: 'visiontek.ddns.net', // The base URL for the server
    sql_server_url: 'localhost', // The URL for the SQL server
    webPort: 8001, // Port for the web server
    apiPort: 8002, // Port for the API server
    logging: true, // Enable or disable logging
    api_debug: true, // Enable or disable API debugging
    clearLogsOnStart: true, // Clear logs when the server starts
    dbUser: process.env.DB_USER, // Database user, loaded from environment variable
    dbPassword: process.env.DB_PASSWORD, // Database password, loaded from environment variable
    dbName: 'dashee2_0', // Name of the database
    sqlPort: 3306, // Port for the SQL server
    uploadConfig: {
        maxFileSize: 50 * 1024 * 1024, // Maximum file size for uploads (50MB)
        allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'video/mp4', 'video/avi'] // Allowed file formats for uploads
    },
    secretKey: process.env.SECRET_KEY, // Secret key for token generation, loaded from environment variable
    adminToken: process.env.ADMIN_TOKEN, // Admin token for authentication, loaded from environment variable
    support_request_max_file_size_mb: 10, // Maximum file size for support requests (10MB)
    support_request_file_formats: 'png,jpg,jpeg,webp,mp4,avi', // Allowed file formats for support requests
    g_site_key: process.env.G_SITE_KEY, // Google reCAPTCHA site key, loaded from environment variable
    g_secret_key: process.env.G_SECRET_KEY, // Google reCAPTCHA secret key, loaded from environment variable
    smtp: {
        host: process.env.SMTP_HOST, // SMTP server host, loaded from environment variable
        port: process.env.SMTP_PORT, // SMTP server port, loaded from environment variable
        secure: process.env.SMTP_SECURE === 'true', // Use secure connection (true or false), loaded from environment variable
        auth: {
            user: process.env.SMTP_USER, // SMTP user, loaded from environment variable
            pass: process.env.SMTP_PASS // SMTP password, loaded from environment variable
        }
    }
};
