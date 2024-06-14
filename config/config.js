module.exports = {
    port: 8001,
    dbUser: 'root',
    dbPassword: '',
    dbName: 'dashee2_0',
    sqlPort: 3306,
    logging: true,
    displayAdminCredentials: true,
    uploadConfig: {
        allowedFormats: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
        maxFileSize: 10485760 // 10 MB
    }
};
