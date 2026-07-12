/**

* MetricsRepository
*
* PostgreSQL repository responsible for storing and querying
* aggregated endpoint metrics.
*
* Responsibilities:
* * Upsert endpoint-level metrics.
* * Retrieve metrics with filtering and pagination.
* * Fetch top endpoints by traffic.
* * Generate overall analytics summaries.
*
* Unlike MongoDB, which stores raw API events, PostgreSQL stores
* aggregated analytical data optimized for dashboards and reporting.
  */

import { BaseRepository } from "./BaseRepository.js";

const MAX_LIMIT = 1000;
const QUERY_TIMEOUT_MS = 30000;

export class MetricsRepository extends BaseRepository {
/**
* Creates a MetricsRepository instance.
*
* @param {Object} dependencies
* @param {Object} dependencies.logger - Logger instance.
* @param {Object} dependencies.postgres - PostgreSQL client/pool.
*/
constructor({ logger, postgres } = {}) {
super({ logger });

    this.postgres = postgres;
}

/**
 * Inserts or updates aggregated endpoint metrics.
 *
 * If a metric record already exists for the same:
 * - client
 * - service
 * - endpoint
 * - method
 * - time bucket
 *
 * then values are merged using PostgreSQL UPSERT logic.
 *
 * @param {Object} metricsData
 */
async upsertEndpointMetrics(metricsData) {
    try {
        const {
            clientId,
            serviceName,
            endpoint,
            method,
            totalHits,
            errorHits,
            avgLatency,
            minLatency,
            maxLatency,
            timeBucket,
        } = metricsData;

        const query = `
            INSERT INTO endpoint_metrics (
                client_id,
                service_name,
                endpoint,
                method,
                total_hits,
                error_hits,
                avg_latency,
                min_latency,
                max_latency,
                time_bucket
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10
            )
            ON CONFLICT (
                client_id,
                service_name,
                endpoint,
                method,
                time_bucket
            )
            DO UPDATE SET
                total_hits = endpoint_metrics.total_hits + EXCLUDED.total_hits,

                error_hits = endpoint_metrics.error_hits + EXCLUDED.error_hits,

                avg_latency = (
                    (
                        endpoint_metrics.avg_latency * endpoint_metrics.total_hits
                    ) +
                    (
                        EXCLUDED.avg_latency * EXCLUDED.total_hits
                    )
                ) /
                (
                    endpoint_metrics.total_hits + EXCLUDED.total_hits
                ),

                min_latency = LEAST(
                    endpoint_metrics.min_latency,
                    EXCLUDED.min_latency
                ),

                max_latency = GREATEST(
                    endpoint_metrics.max_latency,
                    EXCLUDED.max_latency
                ),

                updated_at = CURRENT_TIMESTAMP
        `;

        await this._query(query, [
            clientId,
            serviceName,
            endpoint,
            method,
            totalHits,
            errorHits,
            avgLatency,
            minLatency,
            maxLatency,
            timeBucket,
        ]);
    } catch (error) {
        this.logger.error("Error upserting endpoint metrics", {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
}

/**
 * Retrieves endpoint metrics using optional filters.
 *
 * Supports:
 * - client filtering
 * - service filtering
 * - endpoint filtering
 * - time range filtering
 * - pagination
 *
 * @param {Object} filter
 * @returns {Promise<Array>}
 */
async getMetrics(filter = {}) {
    try {
        const {
            clientId,
            serviceName,
            endpoint,
            startTime,
            endTime,
            limit = 100,
            offset = 0,
        } = filter;

        const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
        const safeOffset = Math.max(0, offset);

        let query = `
            SELECT
                service_name,
                endpoint,
                method,
                SUM(total_hits) AS total_hits,
                SUM(error_hits) AS error_hits,
                SUM(avg_latency * total_hits) /
                NULLIF(SUM(total_hits), 0) AS avg_latency,
                MIN(min_latency) AS min_latency,
                MAX(max_latency) AS max_latency,
                time_bucket
            FROM endpoint_metrics
        `;

        const params = [];
        let paramIndex = 1;

        const whereConditions = [];

        if (clientId != null) {
            whereConditions.push(`client_id = $${paramIndex}`);
            params.push(clientId);
            paramIndex++;
        }

        if (serviceName) {
            whereConditions.push(`service_name = $${paramIndex}`);
            params.push(serviceName);
            paramIndex++;
        }

        if (endpoint) {
            whereConditions.push(`endpoint = $${paramIndex}`);
            params.push(endpoint);
            paramIndex++;
        }

        if (startTime) {
            whereConditions.push(`time_bucket >= $${paramIndex}`);
            params.push(startTime);
            paramIndex++;
        }

        if (endTime) {
            whereConditions.push(`time_bucket <= $${paramIndex}`);
            params.push(endTime);
            paramIndex++;
        }

        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(" AND ")}`;
        }

        query += `
            GROUP BY
                service_name,
                endpoint,
                method,
                time_bucket
            ORDER BY time_bucket DESC
            LIMIT $${paramIndex}
            OFFSET $${paramIndex + 1}
        `;

        params.push(safeLimit, safeOffset);

        const result = await this._query(query, params);
        return result.rows;
    } catch (error) {
        this.logger.error("Error getting endpoint metrics", {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
}

/**
 * Returns the highest-traffic endpoints.
 *
 * @param {number|null} clientId
 * @param {number} limit
 * @param {Date|null} startTime
 * @returns {Promise<Array>}
 */
async getTopEndpoints(clientId, limit = 10, startTime = null) {
    try {
        const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

        let query = `
            SELECT
                service_name,
                endpoint,
                method,
                SUM(total_hits) AS total_hits,
                SUM(avg_latency * total_hits) /
                NULLIF(SUM(total_hits), 0) AS avg_latency,
                SUM(error_hits) AS error_hits
            FROM endpoint_metrics
        `;

        const params = [];
        let paramIndex = 1;

        if (clientId != null) {
            query += ` WHERE client_id = $${paramIndex}`;
            params.push(clientId);
            paramIndex++;
        }

        if (startTime) {
            query += clientId != null ? ` AND` : ` WHERE`;
            query += ` time_bucket >= $${paramIndex}`;

            params.push(startTime);
            paramIndex++;
        }

        query += `
            GROUP BY service_name, endpoint, method
            ORDER BY total_hits DESC
            LIMIT $${paramIndex}
        `;

        params.push(safeLimit);

        const result = await this._query(query, params);
        return result.rows;
    } catch (error) {
        this.logger.error("Error getting top endpoints", {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
}

/**
 * Returns overall system statistics.
 *
 * @param {number|null} clientId
 * @param {Date|null} startTime
 * @param {Date|null} endTime
 * @returns {Promise<Object>}
 */
async getOverallStats(clientId, startTime = null, endTime = null) {
    try {
        let query = `
            SELECT
                SUM(total_hits) AS total_hits,
                SUM(error_hits) AS error_hits,
                SUM(avg_latency * total_hits) /
                NULLIF(SUM(total_hits), 0) AS avg_latency,
                COUNT(DISTINCT service_name) AS unique_services,
                COUNT(DISTINCT endpoint) AS unique_endpoints
            FROM endpoint_metrics
        `;

        const params = [];
        let paramIndex = 1;

        if (clientId != null) {
            query += ` WHERE client_id = $${paramIndex}`;
            params.push(clientId);
            paramIndex++;
        }

        if (startTime) {
            query += clientId != null ? ` AND` : ` WHERE`;
            query += ` time_bucket >= $${paramIndex}`;

            params.push(startTime);
            paramIndex++;
        }

        if (endTime) {
            query += (clientId != null || startTime)
                ? ` AND`
                : ` WHERE`;

            query += ` time_bucket <= $${paramIndex}`;

            params.push(endTime);
            paramIndex++;
        }

        const result = await this._query(query, params);

        return result.rows[0] || {};
    } catch (error) {
        this.logger.error("Error getting overall stats", {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
}

/**
 * Internal helper for executing PostgreSQL queries.
 *
 * Applies statement timeout protection and validates
 * repository configuration.
 *
 * @private
 */
_query(sql, params = [], client = this.postgres) {
    const target = client || this.postgres;

    if (!target || typeof target.query !== "function") {
        const err = new Error(
            "Postgres client not configured on MetricsRepository"
        );

        this.logger.error(
            "Database query failed: Postgres client not configured"
        );

        throw err;
    }

    return target.query({
        text: sql,
        values: params,
        statement_timeout: QUERY_TIMEOUT_MS,
    });
}

}
