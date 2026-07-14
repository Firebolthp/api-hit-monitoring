import logger from "../config/logger.js";

/**
 * Request logging middleware.
 *
 * Logs:
 * - HTTP method
 * - Request path
 * - Client IP
 * - Response status
 * - Request duration
 * - Authenticated user information (if available)
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - startTime;

        logger.info("HTTP Request", {
            method: req.method,
            path: req.originalUrl || req.url,
            ip: req.ip || req.socket.remoteAddress,
            status: res.statusCode,
            duration: `${duration}ms`,

            // Available after authentication middleware
            userId: req.user?.userId || null,
            role: req.user?.role || null,
        });
    });

    next();
};

export default requestLogger;