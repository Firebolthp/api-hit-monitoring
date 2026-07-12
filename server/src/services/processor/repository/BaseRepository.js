/**
 * BaseRepository
 *
 * Abstract repository contract that defines the common interface
 * for all repositories in the application.
 *
 * Concrete repositories should extend this class and implement
 * the required methods according to the underlying database.
 */
export class BaseRepository {
    constructor({ logger = console } = {}) {
        this.logger = logger;
    }

    /**
     * Persist data to the database.
     *
     * @param {Object} data - Data to be stored.
     * @returns {Promise<any>}
     */
    async save(data) {
        throw new Error(`${this.constructor.name}: save() not implemented`);
    }

    /**
     * Retrieve records matching the provided criteria.
     *
     * @param {Object} query - Search criteria.
     * @returns {Promise<any>}
     */
    async find(query) {
        throw new Error(`${this.constructor.name}: find() not implemented`);
    }

    /**
     * Count records matching the provided criteria.
     *
     * @param {Object} query - Search criteria.
     * @returns {Promise<number>}
     */
    async count(query) {
        throw new Error(`${this.constructor.name}: count() not implemented`);
    }

    /**
     * Remove old records based on a retention policy.
     *
     * @param {Date} cutoffDate - Records older than this date may be deleted.
     * @returns {Promise<number>}
     */
    async deleteOldHits(cutoffDate) {
        throw new Error(`${this.constructor.name}: deleteOldHits() not implemented`);
    }
}