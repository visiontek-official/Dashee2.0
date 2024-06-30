require('dotenv').config();

module.exports = {
    server_url: 'localhost',
    sql_server_url: 'localhost',
    webPort: 8001,
    apiPort: 8002,
    logging: true,
    api_debug: true,
    clearLogsOnStart: true,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: 'dashee2_0',
    sqlPort: 3306,
    uploadConfig: {
        maxFileSize: 50 * 1024 * 1024,
        allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'video/mp4', 'video/avi']
    },
    secretKey: process.env.SECRET_KEY,
    adminToken: process.env.ADMIN_TOKEN,
    support_request_max_file_size_mb: 10,
    support_request_file_formats: 'png,jpg,jpeg,webp,mp4,avi',
    g_site_key: process.env.G_SITE_KEY,
    g_secret_key: process.env.G_SECRET_KEY,
    smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    }
};
