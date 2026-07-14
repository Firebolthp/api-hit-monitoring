import BaseClientRepository from "./BaseClientRepository.js";
import Client from "../../../shared/models/Client.js";
import logger from "../../../shared/config/logger.js";

/**
 * MongoDB implementation of the Client repository.
 *
 * Handles client-related persistence operations including:
 * - Client creation
 * - Client lookup
 * - Client listing
 * - Client counting
 */
class MongoClientRepository extends BaseClientRepository {
    constructor() {
        super(Client);
    }

    /**
     * Creates a new client.
     *
     * @param {Object} clientData
     * @returns {Promise<Object>}
     */
    async create(clientData) {
        try {
            const client = new this.model(clientData);

            await client.save();

            logger.info("Client created successfully", {
                clientId: client._id,
                slug: client.slug
            });

            return client;
        } catch (error) {
            logger.error("Error creating client in DB", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Finds a client by ID.
     *
     * @param {string} clientId
     * @returns {Promise<Object|null>}
     */
    async findById(clientId) {
        try {
            const client = await this.model.findById(clientId);

            return client;
        } catch (error) {
            logger.error("Error finding client by ID", {
                clientId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Finds a client by slug.
     *
     * @param {string} slug
     * @returns {Promise<Object|null>}
     */
    async findBySlug(slug) {
        try {
            return await this.model.findOne({ slug });
        } catch (error) {
            logger.error("Error finding client by slug", {
                slug,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Retrieves clients using filters and pagination options.
     *
     * @param {Object} filters
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async find(filters = {}, options = {}) {
        try {
            const {
                limit = 50,
                skip = 0,
                sort = { createdAt: -1 }
            } = options;

            return await this.model
                .find(filters)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .select("-__v");
        } catch (error) {
            logger.error("Error finding clients", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Counts clients matching the supplied filters.
     *
     * @param {Object} filters
     * @returns {Promise<number>}
     */
    async count(filters = {}) {
        try {
            return await this.model.countDocuments(filters);
        } catch (error) {
            logger.error("Error counting clients", {
                error: error.message
            });

            throw error;
        }
    }
}

export default new MongoClientRepository();