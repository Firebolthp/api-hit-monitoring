/**
 * BaseClientRepository
 *
 * Defines the contract for client repository implementations.
 * Concrete repositories must provide implementations for all
 * client-related database operations.
 */
export default class BaseClientRepository {
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
     * Create a new client.
     *
     * @param {Object} clientData
     */
    async create(clientData) {
        throw new Error("create() must be implemented");
    }

    /**
     * Find a client by ID.
     *
     * @param {string} clientId
     */
    async findById(clientId) {
        throw new Error("findById() must be implemented");
    }

    /**
     * Find a client by slug.
     *
     * @param {string} slug
     */
    async findBySlug(slug) {
        throw new Error("findBySlug() must be implemented");
    }

    /**
     * Find clients using filters and query options.
     *
     * @param {Object} filters
     * @param {Object} options
     */
    async find(filters, options) {
        throw new Error("find() must be implemented");
    }

    /**
     * Count clients matching supplied filters.
     *
     * @param {Object} filters
     */
    async count(filters) {
        throw new Error("count() must be implemented");
    }
}