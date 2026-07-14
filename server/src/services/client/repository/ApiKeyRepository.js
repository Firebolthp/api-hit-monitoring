import logger from "../../../shared/config/logger.js";
import ApiKey from "../../../shared/models/ApiKey.js";
import BaseApiKeyRepository from "./BaseApiKeyRepository.js";

/**
 * MongoDB implementation of the API key repository.
 *
 * Handles API key persistence operations including:
 * - Key creation
 * - Key lookup
 * - Client key listing
 * - Key counting
 */
class MongoApiKeyRepository extends BaseApiKeyRepository {
    constructor() {
        super(ApiKey);
    }

    /**
     * Creates a new API key.
     *
     * @param {Object} apiKeyData
     * @returns {Promise<Object>}
     */
    async create(apiKeyData) {
        try {
            const apiKey = new this.model(apiKeyData);

            await apiKey.save();

            logger.info("API key created successfully", {
                keyId: apiKey.keyId
            });

            return apiKey;
        } catch (error) {
            logger.error("Error creating API key", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Finds an API key by its value.
     *
     * By default, only active API keys are returned.
     *
     * @param {string} keyValue
     * @param {boolean} includeInactive
     * @returns {Promise<Object|null>}
     */
    async findByKeyValue(keyValue, includeInactive = false) {
        try {
            const filter = { keyValue };

            if (!includeInactive) {
                filter.isActive = true;
            }

            return await this.model
                .findOne(filter)
                .populate("clientId");
        } catch (error) {
            logger.error("Error finding API key by value", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Retrieves API keys belonging to a client.
     *
     * @param {string} clientId
     * @param {Object} filters
     * @returns {Promise<Array>}
     */
    async findByClientId(clientId, filters = {}) {
        try {
            const query = {
                clientId,
                ...filters
            };

            return await this.model
                .find(query)
                .populate("createdBy", "username email")
                .sort({ createdAt: -1 });
        } catch (error) {
            logger.error("Error finding API keys by client ID", {
                clientId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Counts API keys belonging to a client.
     *
     * @param {string} clientId
     * @param {Object} filters
     * @returns {Promise<number>}
     */
    async countByClientId(clientId, filters = {}) {
        try {
            const query = {
                clientId,
                ...filters
            };

            return await this.model.countDocuments(query);
        } catch (error) {
            logger.error("Error counting API keys", {
                clientId,
                error: error.message
            });

            throw error;
        }
    }
}

export default new MongoApiKeyRepository();