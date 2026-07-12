/**

* ApiHitRepository
*
* MongoDB repository responsible for managing raw API hit events.
*
* Responsibilities:
* * Persist raw API hit events received from RabbitMQ.
* * Retrieve stored API hit records.
* * Count API hit records based on filters.
* * Delete old records according to retention policies.
*
* MongoDB is used here as the raw event store because it handles
* high-volume writes efficiently and provides flexibility for
* evolving event schemas.
  */

import { BaseRepository } from "./BaseRepository.js";

export class ApiHitRepository extends BaseRepository {
/**
* Creates an ApiHitRepository instance.
*
* @param {Object} dependencies
* @param {import("mongoose").Model} dependencies.model - Mongoose model used for persistence.
* @param {Object} dependencies.logger - Logger instance.
*/
constructor({ model, logger } = {}) {
super({ logger });

    if (!model) {
        throw new Error("ApiHitRepository requires a mongoose model");
    }

    this.model = model;
}

/**
 * Saves a raw API hit event to MongoDB.
 *
 * Duplicate events are safely ignored when a unique index
 * (typically on eventId) is violated.
 *
 * @param {Object} eventData - API hit payload.
 * @returns {Promise<Object|null>} Saved document or null for duplicate events.
 */
async save(eventData) {
    try {
        const doc = new this.model(eventData);
        await doc.save();

        this.logger.info("API hit saved to MongoDB", {
            eventId: eventData.eventId,
        });

        return doc;
    } catch (error) {
        // MongoDB duplicate key error
        if (error?.code === 11000) {
            this.logger.warn("Duplicate event ID detected, skipping save", {
                eventId: eventData.eventId,
            });

            return null;
        }

        this.logger.error("Error saving API hit", {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
}

/**
 * Retrieves API hit records matching the supplied filter.
 *
 * Supports pagination and sorting.
 *
 * @param {Object} filter - MongoDB query filter.
 * @param {Object} options - Query options.
 * @param {number} options.limit - Maximum records to fetch.
 * @param {number} options.skip - Records to skip.
 * @param {Object} options.sort - Sorting configuration.
 * @returns {Promise<Array>}
 */
async find(filter = {}, options = {}) {
    try {
        const {
            limit = 100,
            skip = 0,
            sort = { timestamp: -1 },
        } = options;

        const hits = await this.model
            .find(filter)
            .sort(sort)
            .limit(limit)
            .skip(skip)
            .lean();

        return hits;
    } catch (error) {
        this.logger.error("Error finding API hits", {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
}

/**
 * Counts API hit records matching the provided filter.
 *
 * @param {Object} filters
 * @returns {Promise<number>}
 */
async count(filters = {}) {
    try {
        return await this.model.countDocuments(filters);
    } catch (error) {
        this.logger.error("Error counting API hits", {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
}

/**
 * Deletes API hit records older than the provided date.
 *
 * Useful for retention and cleanup jobs.
 *
 * @param {Date} beforeDate
 * @returns {Promise<number>} Number of deleted documents.
 */
async deleteOldHits(beforeDate) {
    try {
        const result = await this.model.deleteMany({
            timestamp: { $lt: beforeDate },
        });

        this.logger.info("Deleted old API hits", {
            count: result.deletedCount,
        });

        return result.deletedCount;
    } catch (error) {
        this.logger.error("Error deleting old API hits", {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
}

}
