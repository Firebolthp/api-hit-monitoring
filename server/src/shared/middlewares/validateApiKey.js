import ResponseFormatter from "../utils/responseFormatter.js";
import logger from "../config/logger.js";
import clientContainer from "../../services/client/Dependencies/dependencies.js";

/**
 * API Key Validation Middleware
 *
 * Used by external clients to authenticate
 * requests using an API key.
 */
const validateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.get("x-api-key");

        if (!apiKey) {
            logger.warn("API request without API key", {
                path: req.path,
                ip: req.ip,
            });

            return res.status(401).json(
                ResponseFormatter.error(
                    "API key is required",
                    401
                )
            );
        }

        /**
         * Validate API key and fetch associated client.
         */
        const result =
            await clientContainer.services.clientService.getClientByApiKey(
                apiKey
            );

        if (!result) {
            logger.warn("Invalid API key attempted", {
                path: req.path,
                ip: req.ip,
                apiKey: `${apiKey.substring(0, 8)}...`,
            });

            return res.status(403).json(
                ResponseFormatter.error(
                    "Invalid API key",
                    403
                )
            );
        }

        const {
            client,
            apiKey: apiKeyObj
        } = result;

        /**
         * Client must be active.
         */
        if (!client.isActive) {
            logger.warn(
                "Inactive client attempted API access",
                {
                    path: req.path,
                    ip: req.ip,
                    clientId: client._id,
                }
            );

            return res.status(403).json(
                ResponseFormatter.error(
                    "Client account is inactive",
                    403
                )
            );
        }

        /**
         * Verify API key permissions.
         */
        if (!apiKeyObj.permissions?.canIngest) {
            logger.warn(
                "API key without ingest permission attempted access",
                {
                    path: req.path,
                    ip: req.ip,
                    apiKeyId: apiKeyObj._id,
                }
            );

            return res.status(403).json(
                ResponseFormatter.error(
                    "API key does not have ingest permissions",
                    403
                )
            );
        }

        /**
         * Attach validated context for downstream services.
         */
        req.client = client;
        req.apiKey = apiKeyObj;

        logger.debug("API key validated successfully", {
            clientId: client._id,
            clientName: client.name,
            apiKeyId: apiKeyObj._id,
        });

        return next();
    } catch (error) {
        logger.error("Error validating API key", {
            error: error.message,
            stack: error.stack,
            path: req.path,
        });

        return res.status(500).json(
            ResponseFormatter.error(
                "Internal server error",
                500
            )
        );
    }
};

export default validateApiKey;