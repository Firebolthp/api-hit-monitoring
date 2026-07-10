/**
 * AppError
 *
 * Custom application error used to represent
 * expected (operational) failures.
 *
 * Examples:
 * - Validation errors
 * - Authentication failures
 * - Authorization failures
 * - Resource not found
 * - Business rule violations
 *
 * Unexpected programming errors should NOT
 * use this class and should be handled by
 * the global error middleware.
 */
class AppError extends Error {

    /**
     * Create a custom application error.
     *
     * @param {string} message Error message
     * @param {number} statusCode HTTP status code
     * @param {*} errors Additional error details
     */
    constructor(
        message,
        statusCode = 500,
        errors = null
    ) {
        super(message);

        this.name = "AppError";

        this.statusCode = statusCode;

        /**
         * fail  -> 4xx errors
         * error -> 5xx errors
         */
        this.status =
            statusCode >= 400 &&
            statusCode < 500
                ? "fail"
                : "error";

        /**
         * Additional error information.
         *
         * Examples:
         * - Validation details
         * - Field-level errors
         * - Business rule failures
         */
        this.errors = errors;

        /**
         * Indicates whether the error
         * is an expected operational error.
         */
        this.isOperational = true;

        Error.captureStackTrace(
            this,
            this.constructor
        );

        Object.freeze(this);
    }

    /**
     * 400 Bad Request
     */
    static badRequest(
        message = "Bad Request",
        errors = null
    ) {
        return new AppError(
            message,
            400,
            errors
        );
    }

    /**
     * 401 Unauthorized
     */
    static unauthorized(
        message = "Unauthorized"
    ) {
        return new AppError(
            message,
            401
        );
    }

    /**
     * 403 Forbidden
     */
    static forbidden(
        message = "Forbidden"
    ) {
        return new AppError(
            message,
            403
        );
    }

    /**
     * 404 Resource Not Found
     */
    static notFound(
        message = "Resource not found"
    ) {
        return new AppError(
            message,
            404
        );
    }

    /**
     * 409 Conflict
     */
    static conflict(
        message = "Conflict detected"
    ) {
        return new AppError(
            message,
            409
        );
    }

    /**
     * 500 Internal Server Error
     */
    static internal(
        message = "Internal Server Error"
    ) {
        return new AppError(
            message,
            500
        );
    }
}

export default AppError;