import ResponseFormatter from "../utils/responseFormatter.js";

/**
 * Authorization middleware.
 *
 * Restricts access to users whose role exists in the supplied
 * list of allowed roles.
 *
 * Usage:
 * authorize([APPLICATION_ROLES.SUPER_ADMIN])
 */
const authorize = (allowedRoles = []) => (req, res, next) => {
    try {
        if (!req.user || !req.user.role) {
            return res
                .status(401)
                .json(
                    ResponseFormatter.error(
                        "Authentication required",
                        401
                    )
                );
        }

        // No role restrictions applied.
        if (allowedRoles.length === 0) {
            return next();
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res
                .status(403)
                .json(
                    ResponseFormatter.error(
                        "Insufficient permissions",
                        403
                    )
                );
        }

        return next();
    } catch (error) {
        return res
            .status(403)
            .json(ResponseFormatter.error("Forbidden", 403));
    }
};

export default authorize;