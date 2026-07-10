/**
 * ResponseFormatter
 *
 * Standardizes all API responses across the application.
 *
 * Benefits:
 * - Consistent response structure
 * - Easier frontend integration
 * - Predictable API contracts
 * - Centralized response formatting
 */
class ResponseFormatter {

    /**
     * Format successful response.
     *
     * @param {*} data Response payload
     * @param {string} message Success message
     * @param {number} statusCode HTTP status code
     * @param {Object|null} meta Additional metadata
     * @returns {Object}
     */
    static success(
        data = null,
        message = "Success",
        statusCode = 200,
        meta = null
    ) {
        return {
            success: true,
            message,
            data,
            meta,
            statusCode,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Format error response.
     *
     * NOTE:
     * Avoid exposing internal stack traces or
     * sensitive information in production.
     *
     * @param {string} message Error message
     * @param {number} statusCode HTTP status code
     * @param {*} error Optional error details
     * @returns {Object}
     */
    static error(
        message = "Internal Server Error",
        statusCode = 500,
        error = null
    ) {
        return {
            success: false,
            message,
            error,
            statusCode,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Format validation failure response.
     *
     * @param {*} error Validation errors
     * @returns {Object}
     */
    static validationError(error = null) {
        return {
            success: false,
            message: "Validation failed",
            error,
            statusCode: 400,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Format paginated response.
     *
     * @param {*} data Response payload
     * @param {number} page Current page
     * @param {number} limit Page size
     * @param {number} total Total records
     * @param {string} message Response message
     * @returns {Object}
     */
    static paginated(
        data = [],
        page,
        limit,
        total,
        message = "Data fetched successfully"
    ) {
        const safeLimit = limit > 0 ? limit : 1;

        return {
            success: true,
            message,
            data,

            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / safeLimit),
            },

            timestamp: new Date().toISOString(),
        };
    }
}

export default ResponseFormatter;