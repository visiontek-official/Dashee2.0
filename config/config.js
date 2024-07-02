require('dotenv').config(); // Load environment variables from .env file

module.exports = {
    server_url: process.env.SERVER_URL, // The base URL for the server
    sql_server_url: process.env.SQL_SERVER_URL, // The URL for the SQL server
    webPort: process.env.WEBPORT, // Port for the web server
    apiPort: process.env.APIPORT, // Port for the API server
    logging: true, // Enable or disable logging
    api_debug: true, // Enable or disable API debugging
    clearLogsOnStart: true, // Clear logs when the server starts
    dbUser: process.env.DB_USER, // Database user, loaded from environment variable
    dbPassword: process.env.DB_PASSWORD, // Database password, loaded from environment variable
    dbName: process.env.DATABASENAME, // Name of the database
    sqlPort: process.env.SQLPORT, // Port for the SQL server
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
