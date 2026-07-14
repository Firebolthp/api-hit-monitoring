/**
 * BaseApiKeyRepository
 *
 * Defines the contract for API key repository implementations.
 * Concrete repositories must provide implementations for all
 * API key-related database operations.
 */
export default class BaseApiKeyRepository {
    /**
     * @param {*} model Database model used by the repository.
     */
    constructor(model) {
        if (!model) {
            throw new Error("Model is required");
        }

        this.model = model;
    }

    /**
     * Create a new API key.
     *
     * @param {Object} apiKeyData
     */
    async create(apiKeyData) {
        throw new Error("create() must be implemented");
    }

    /**
     * Find an API key by its value.
     *
     * @param {string} keyValue
     * @param {boolean} includeInactive
     */
    async findByKeyValue(keyValue, includeInactive) {
        throw new Error("findByKeyValue() must be implemented");
    }

    /**
     * Retrieve API keys belonging to a client.
     *
     * @param {string} clientId
     * @param {Object} filters
     */
    async findByClientId(clientId, filters) {
        throw new Error("findByClientId() must be implemented");
    }

    /**
     * Count API keys belonging to a client.
     *
     * @param {string} clientId
     * @param {Object} filters
     */
    async countByClientId(clientId, filters) {
        throw new Error("countByClientId() must be implemented");
    }
}