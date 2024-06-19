module.exports = {
    webPort: 8001,
    apiPort: 8002,
    logging: true,//enable server logs
    api_debug: true,//enable api logs
    dbUser: '******',//your database username
    dbPassword: '********',//your database user password
    dbName: '*******',//your database name
    sqlPort: 3306,
    uploadConfig: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'video/mp4', 'video/avi']
    },
    secretKey: '**************************************************************', // your sectret key used for token generation
};
