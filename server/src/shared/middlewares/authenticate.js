import config from "../config/index.js";
import ResponseFormatter from "../utils/responseFormatter.js";
import jwt from "jsonwebtoken";
import logger from "../config/logger.js";

/**
 * Authentication middleware.
 *
 * Validates JWT tokens and attaches authenticated user
 * information to req.user for downstream middleware
 * and controllers.
 */
const authenticate = async (req, res, next) => {
    try {
        let token = null;

        // Token from cookie
        if (req.cookies?.authToken) {
            token = req.cookies.authToken;
        }

        // Optional Bearer token support
        else if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer ")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json(
                ResponseFormatter.error(
                    "Authentication token is required",
                    401
                )
            );
        }

        const decoded = jwt.verify(token, config.jwt.secret);

        const {
            userId,
            email,
            username,
            role,
            clientId
        } = decoded;

        req.user = {
            userId,
            email,
            username,
            role,
            clientId
        };

        return next();
    } catch (error) {
        logger.error("Authentication failed", {
            error: error.message,
            path: req.path
        });

        if (error.name === "TokenExpiredError") {
            return res.status(401).json(
                ResponseFormatter.error(
                    "Token expired",
                    401
                )
            );
        }

        return res.status(401).json(
            ResponseFormatter.error(
                "Invalid token",
                401
            )
        );
    }
};

export default authenticate;