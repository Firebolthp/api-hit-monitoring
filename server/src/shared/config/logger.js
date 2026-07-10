import winston from "winston";
import config from "./index.js";

const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({
        stack: true,
    }),
    winston.format.splat(),
    winston.format.json()
);

const logger = winston.createLogger({
    level: config.nodeEnv === "production" ? "info" : "debug",

    format: logFormat,

    defaultMeta: {
        service: "api-monitoring",
        environment: config.nodeEnv,
    },

    transports: [
        new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 5 * 1024 * 1024, // 5 MB
            maxFiles: 5,
        }),

        new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 10,
        }),
    ],

    exceptionHandlers: [
        new winston.transports.File({
            filename: "logs/exceptions.log",
        }),
    ],

    rejectionHandlers: [
        new winston.transports.File({
            filename: "logs/rejections.log",
        }),
    ],
});

if (config.nodeEnv !== "production") {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({
                    format: "HH:mm:ss",
                }),
                winston.format.printf(
                    ({ timestamp, level, message, stack }) =>
                        `${timestamp} ${level}: ${stack || message}`
                )
            ),
        })
    );
}

export default logger;