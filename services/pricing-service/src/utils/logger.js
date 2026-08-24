import winston from 'winston';

export const logger = winston.createLogger({
    level: 'info',
    // Định dạng chuẩn JSON có chứa timestamp và service_name
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'pricing-service' },
    transports: [
        new winston.transports.Console()
    ]
});