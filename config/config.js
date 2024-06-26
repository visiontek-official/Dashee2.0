module.exports = {
    server_url: 'http://visiontek.ddns.net',
    sql_server_url: 'localhost',
    webPort: 8001,
    apiPort: 8002,
    logging: true,
    api_debug: true,
    clearLogsOnStart: true,  // Set this to true or false to control archiving and clearing of logs
    dbUser: 'VisionTEK',
    dbPassword: 'b!lls4w5yqYN]Wsb',
    dbName: 'dashee2_0',
    sqlPort: 3306,
    uploadConfig: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'video/mp4', 'video/avi']
    },
    secretKey: 'q8i570tovb1u439dlt101nhv0mire6omvq3wk5prz652zj5sd70bsz7aukdt', // used for token generation
    adminToken: '3v3fb7h2haosp1xyz6jica3iz400xbuco5o96lbose6o19akuf1aicwnr7oy',
};