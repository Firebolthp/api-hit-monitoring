/**

* ProcessorService
*
* Core business layer responsible for processing API hit events
* consumed from RabbitMQ.
*
* Processing flow:
* 1. Persist raw event data to MongoDB.
* 2. Generate aggregated metrics.
* 3. Upsert metrics into PostgreSQL.
*
* Design Principle:
* MongoDB storage is considered critical and must succeed.
* PostgreSQL metrics storage is considered secondary because
* metrics can be rebuilt later from raw event data.
  */

export class ProcessorService {
/**
* Creates a ProcessorService instance.
*
* @param {Object} dependencies
* @param {Object} dependencies.apiHitRepository
* @param {Object} dependencies.metricsRepository
* @param {Object} dependencies.logger
*/
constructor({
apiHitRepository,
metricsRepository,
logger,
}) {
if (!apiHitRepository || !metricsRepository) {
throw new Error(
"ProcessorService requires apiHitRepository and metricsRepository"
);
}

    this.apiHitRepository = apiHitRepository;
    this.metricsRepository = metricsRepository;
    this.logger = logger;
}

/**
 * Converts a timestamp into a normalized aggregation bucket.
 *
 * Examples:
 * Hour Bucket:
 * 12:15 → 12:00
 * 12:59 → 12:00
 *
 * Day Bucket:
 * 2026-01-10 18:20 → 2026-01-10 00:00
 *
 * @param {Date|string} timestamp
 * @param {"minute"|"hour"|"day"} interval
 * @returns {Date}
 */
getTimeBucket(timestamp, interval = "hour") {
    const date = new Date(timestamp);

    switch (interval) {
        case "minute":
            date.setSeconds(0, 0);
            break;

        case "hour":
            date.setMinutes(0, 0, 0);
            break;

        case "day":
            date.setHours(0, 0, 0, 0);
            break;

        default:
            date.setMinutes(0, 0, 0);
    }

    return date;
}

/**
 * Processes a single API hit event.
 *
 * Workflow:
 * 1. Save raw event to MongoDB.
 * 2. Generate/update metrics in PostgreSQL.
 *
 * If MongoDB fails:
 * - Entire processing fails.
 *
 * If PostgreSQL fails:
 * - Raw event remains preserved.
 * - Failure is logged but event is not lost.
 *
 * @param {Object} eventData
 */
async processEvent(eventData) {
    let rawEventSaved = false;

    try {
        this.logger.info("Processing event", {
            eventId: eventData.eventId,
            clientId: eventData.clientId,
            serviceName: eventData.serviceName,
            endpoint: eventData.endpoint,
            method: eventData.method,
        });

        // STEP 1:
        // Persist raw event in MongoDB.
        await this.apiHitRepository.save(eventData);

        rawEventSaved = true;

        this.logger.info("Raw event saved to MongoDB", {
            eventId: eventData.eventId,
        });

        // STEP 2:
        // Update aggregated PostgreSQL metrics.
        await this._updateMetrics(eventData);

        this.logger.info("Event processed successfully", {
            eventId: eventData.eventId,
        });
    } catch (error) {
        if (!rawEventSaved) {
            this.logger.error(
                "Critical failure: raw event could not be saved",
                {
                    eventId: eventData.eventId,
                    error: error.message,
                }
            );

            throw error;
        }

        this.logger.error(
            "Non-critical failure: raw event saved but metrics update failed",
            {
                eventId: eventData.eventId,
                error: error.message,
            }
        );
    }
}

/**
 * Builds metrics payload and updates PostgreSQL aggregates.
 *
 * @private
 * @param {Object} eventData
 */
async _updateMetrics(eventData) {
    const timeBucket = this.getTimeBucket(
        eventData.timestamp,
        "hour"
    );

    const metricsData = {
        clientId: eventData.clientId?.toString(),
        serviceName: eventData.serviceName,
        endpoint: eventData.endpoint,
        method: eventData.method,

        totalHits: 1,

        errorHits:
            eventData.statusCode >= 400 ? 1 : 0,

        avgLatency: eventData.latencyMs,
        minLatency: eventData.latencyMs,
        maxLatency: eventData.latencyMs,

        timeBucket,
    };

    await this.metricsRepository.upsertEndpointMetrics(
        metricsData
    );

    this.logger.info("Metrics updated successfully", {
        eventId: eventData.eventId,
    });
}

/**
 * Deletes old raw events from MongoDB.
 *
 * Intended for scheduled cleanup jobs and
 * long-term storage management.
 *
 * @param {number} daysToKeep
 * @returns {Promise<number>}
 */
async cleanupOldEvents(daysToKeep = 30) {
    try {
        const cutoffDate = new Date();

        cutoffDate.setDate(
            cutoffDate.getDate() - daysToKeep
        );

        const deletedCount =
            await this.apiHitRepository.deleteOldHits(
                cutoffDate
            );

        this.logger.info("Cleanup completed", {
            deletedCount,
            cutoffDate,
        });

        return deletedCount;
    } catch (error) {
        this.logger.error("Error during cleanup", {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
}

}
