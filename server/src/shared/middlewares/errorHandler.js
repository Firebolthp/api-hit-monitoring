import logger from "../config/logger.js";
import ResponseFormatter from "../utils/responseFormatter.js";

/**
 * Global error handling middleware.
 *
 * Handles:
 * - AppError
 * - Mongoose validation errors
 * - Mongo duplicate key errors
 * - JWT errors
 * - Unknown server errors
 */
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal server error";
    let errors = err.errors || null;

    /**
     * Mongoose validation errors.
     */
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = "Validation Error";

        errors = Object.values(err.errors).map(
            (error) => error.message
        );
    }

    /**
     * Invalid MongoDB ObjectId.
     */
    else if (err.name === "CastError") {
        statusCode = 400;
        message = "Invalid resource ID";
    }

    /**
     * Duplicate unique field.
     */
    else if (
        err.name === "MongoServerError" &&
        err.code === 11000
    ) {
        statusCode = 409;
        message = "Duplicate key error";
    }

    /**
     * JWT validation errors.
     */
    else if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid token";
    }

    /**
     * JWT expiration.
     */
    else if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Token expired";
    }

    logger.error("Unhandled application error", {
        message: err.message,
        statusCode,
        path: req.path,
        method: req.method,
        stack: err.stack
    });

    return res
        .status(statusCode)
        .json(
            ResponseFormatter.error(
                message,
                statusCode,
                errors
            )
        );
};

export default errorHandler;