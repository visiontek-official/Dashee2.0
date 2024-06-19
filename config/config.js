module.exports = {
    server_url: 'http://visiontek.ddns.net',
    sql_server_url: 'localhost',
    webPort: 8001,
    apiPort: 8002,
    logging: true,
    api_debug: true,
    dbUser: 'VisionTEK',
    dbPassword: 'b!lls4w5yqYN]Wsb',
    dbName: 'dashee2_0',
    sqlPort: 3306,
    uploadConfig: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'video/mp4', 'video/avi']
    },
    secretKey: 'q8i570tovb1u439dlt101nhv0mire6omvq3wk5prz652zj5sd70bsz7aukdt', // used for token generation
};