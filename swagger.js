const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

const swaggerLogFile = path.join(__dirname, 'logs', 'swagger.log');

const logSwagger = (message) => {
    const logMessage = `[${new Date().toISOString()}] ${message}`;
    fs.appendFileSync(swaggerLogFile, logMessage + '\n');
    console.log(logMessage);
};

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Dashee API',
            version: '2.0.1',
            description: 'API documentation for the Dashee project',
        },
        servers: [
            {
                url: 'http://api.visiontek.co.za:8001', // Change this to your server URL and port
                description: 'DasheeV2' // Custom server name
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./server.js'], // Adjust the path as needed
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = (app) => {
    app.use('/api', (req, res, next) => {
        logSwagger(`Swagger UI accessed: ${req.method} ${req.url}`);
        next();
    }, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        swaggerOptions: {
            validatorUrl: 'https://validator.swagger.io/validator', // Add the validator URL here
        }
    }));

    // Log message when Swagger setup is complete
    const swaggerServerUrl = options.definition.servers[0].url;
    logSwagger(`Swagger UI is set up and accessible at ${swaggerServerUrl}/api`);
};
