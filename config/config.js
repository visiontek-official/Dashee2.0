module.exports = {
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
    secretKey: '**************************************************************', // your sectret key used for token generation
};
