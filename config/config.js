module.exports = {
    server_url: 'Server URL',
    sql_server_url: 'localhost',
    webPort: 8001,
    apiPort: 8002,
    logging: true,
    api_debug: true,
    clearLogsOnStart: true,  // Set this to true or false to control archiving and clearing of logs
    dbUser: 'Database Username',
    dbPassword: 'Database Password',
    dbName: 'Database Name',
    sqlPort: 3306,
    uploadConfig: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'video/mp4', 'video/avi']
    },
    secretKey: 'API secret key', // used for token generation
    adminToken: 'API admin token',
    support_request_max_file_size_mb: 10,
    support_request_file_formats: 'png,jpg,jpeg,webp,mp4,avi',
    g_site_key: 'your-secret-key',
    g_secret_key: 'your-secret-key',
};