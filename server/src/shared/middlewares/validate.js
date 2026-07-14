import ResponseFormatter from "../../shared/utils/responseFormatter.js";

/**
 * Generic request validation middleware.
 *
 * Example schema:
 * {
 *   username: { required: true },
 *   email: { required: true },
 *   password: { required: true, minLength: 6 }
 * }
 */
const validate = (schema) => (req, res, next) => {
    if (!schema) {
        return next();
    }

    const errors = [];
    const body = req.body || {};

    Object.entries(schema).forEach(([field, rules]) => {
        const value = body[field];

        /**
         * Required field validation.
         */
        if (
            rules.required &&
            (
                value === undefined ||
                value === null ||
                (typeof value === "string" && value.trim() === "")
            )
        ) {
            errors.push(`${field} is required`);
            return;
        }

        /**
         * Minimum length validation.
         */
        if (
            rules.minLength &&
            typeof value === "string" &&
            value.length < rules.minLength
        ) {
            errors.push(
                `${field} must be at least ${rules.minLength} characters`
            );
        }

        /**
         * Custom field validation.
         */
        if (
            rules.custom &&
            typeof rules.custom === "function"
        ) {
            const customError = rules.custom(value, body);

            if (customError) {
                errors.push(customError);
            }
        }
    });

    if (errors.length > 0) {
        return res.status(400).json(
            ResponseFormatter.error(
                "Validation failed",
                400,
                errors
            )
        );
    }

    return next();
};

export default validate;