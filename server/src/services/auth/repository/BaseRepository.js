/**
 * BaseRepository
 *
 * Defines the contract for repository implementations.
 * Concrete repositories must implement all CRUD/query methods
 * required by the service layer.
 */
export default class BaseRepository {
    constructor(model) {
        if (!model) {
            throw new Error("Model is required");
        }

        this.model = model;
    }

    /**
     * Create a new record.
     *
     * @param {Object} data
     */
    async create(data) {
        throw new Error("create() must be implemented");
    }

    /**
     * Find a record by its ID.
     *
     * @param {string} id
     */
    async findById(id) {
        throw new Error("findById() must be implemented");
    }

    /**
     * Find a record by username.
     *
     * @param {string} username
     */
    async findByUsername(username) {
        throw new Error("findByUsername() must be implemented");
    }

    /**
     * Find a record by email.
     *
     * @param {string} email
     */
    async findByEmail(email) {
        throw new Error("findByEmail() must be implemented");
    }

    /**
     * Retrieve all records.
     */
    async findAll() {
        throw new Error("findAll() must be implemented");
    }
}