import logger from "../../../shared/config/logger.js";
import AppError from "../../../shared/utils/AppError.js";

/**
 * Analytics Service
 *
 * Handles all analytics-related business logic for the dashboard.
 * This service retrieves aggregated metrics from the repository layer
 * and transforms raw database results into API-friendly responses.
 *
 * Responsibilities:
 * - Calculate overall API statistics
 * - Retrieve top-performing endpoints
 * - Generate time-series analytics data
 * - Parse and validate time filters
 */
export class AnalyticsService {
    /**
     * @param {Object} metricsRepo Repository responsible for fetching analytics data
     */
    constructor(metricsRepo) {
        if (!metricsRepo) {
            throw new Error("AnalyticsService requires a metricsRepository");
        }

        this.metricsRepository = metricsRepo;
    }

    /**
     * Returns overall statistics for a client within a given time range.
     *
     * Metrics:
     * - Total API hits
     * - Error hits
     * - Success hits
     * - Error rate
     * - Average latency
     * - Unique services
     * - Unique endpoints
     *
     * @param {string} clientId
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getOverallStats(clientId, filters = {}) {
        try {
            const { startTime, endTime } = this.parseTimeFilters(filters);

            const stats = await this.metricsRepository.getOverallStats(
                clientId,
                startTime,
                endTime
            );

            const totalHits = parseInt(stats.total_hits) || 0;
            const errorHits = parseInt(stats.error_hits) || 0;

            const errorRate =
                totalHits > 0 ? (errorHits / totalHits) * 100 : 0;

            return {
                totalHits,
                errorHits,
                successHits: totalHits - errorHits,
                errorRate: parseFloat(errorRate.toFixed(2)),
                avgLatency: parseFloat(stats.avg_latency) || 0,
                uniqueServices: parseInt(stats.unique_services) || 0,
                uniqueEndpoints: parseInt(stats.unique_endpoints) || 0,

                timeRange: {
                    start: startTime,
                    end: endTime,
                },
            };
        } catch (error) {
            logger.error(
                `Error getting overall stats for client ${clientId}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Parses and validates time filters.
     *
     * Default behavior:
     * - startTime = current time - 24 hours
     * - endTime = current time
     *
     * @param {Object} filters
     * @returns {{startTime: Date, endTime: Date}}
     */
    parseTimeFilters(filters = {}) {
        let { startTime, endTime } = filters;

        if (!startTime) {
            startTime = new Date();

            // Default analytics window = last 24 hours
            startTime.setHours(startTime.getHours() - 24);
        } else {
            startTime = new Date(startTime);
        }

        if (!endTime) {
            endTime = new Date();
        } else {
            endTime = new Date(endTime);
        }

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            throw new AppError("Invalid date format provided", 400);
        }

        return {
            startTime,
            endTime,
        };
    }

    /**
     * Retrieves the most frequently used endpoints.
     *
     * Results include:
     * - Total hits
     * - Average latency
     * - Error count
     * - Error rate
     *
     * @param {string} clientId
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async getTopEndpoints(clientId, options = {}) {
        try {
            const { limit = 10, startTime } = options;

            const parsedStartTime = startTime
                ? new Date(startTime)
                : null;

            const endpoints =
                await this.metricsRepository.getTopEndpoints(
                    clientId,
                    limit,
                    parsedStartTime
                );

            return endpoints.map((endpoint) => {
                const totalHits =
                    parseInt(endpoint.total_hits) || 0;

                const errorHits =
                    parseInt(endpoint.error_hits) || 0;

                const errorRate =
                    totalHits > 0
                        ? (errorHits / totalHits) * 100
                        : 0;

                return {
                    serviceName: endpoint.service_name,
                    endpoint: endpoint.endpoint,
                    method: endpoint.method,

                    totalHits,
                    errorHits,

                    avgLatency: parseFloat(
                        parseFloat(endpoint.avg_latency).toFixed(2)
                    ),

                    errorRate: parseFloat(
                        errorRate.toFixed(2)
                    ),
                };
            });
        } catch (error) {
            logger.error(
                `Error getting top endpoints for client ${clientId}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Returns time-series analytics data.
     *
     * Useful for:
     * - Dashboard charts
     * - Traffic trends
     * - Latency trends
     * - Error tracking over time
     *
     * @param {string} clientId
     * @param {Object} filters
     * @returns {Promise<Array>}
     */
    async getTimeSeries(clientId, filters = {}) {
        try {
            const {
                serviceName,
                endpoint,
                startTime,
                endTime,
                limit = 100,
            } = filters;

            const {
                startTime: start_time,
                endTime: end_time,
            } = this.parseTimeFilters({
                startTime,
                endTime,
            });

            const metrics =
                await this.metricsRepository.getMetrics({
                    clientId,
                    serviceName,
                    endpoint,
                    startTime: start_time,
                    endTime: end_time,
                    limit,
                });

            return metrics.map((metric) => ({
                serviceName: metric.service_name,
                endpoint: metric.endpoint,
                method: metric.method,

                totalHits: parseInt(metric.total_hits),
                errorHits: parseInt(metric.error_hits),

                avgLatency: parseFloat(
                    parseFloat(metric.avg_latency).toFixed(2)
                ),

                minLatency: parseFloat(
                    parseFloat(metric.min_latency).toFixed(2)
                ),

                maxLatency: parseFloat(
                    parseFloat(metric.max_latency).toFixed(2)
                ),

                timeBucket: metric.time_bucket,
            }));
        } catch (error) {
            logger.error(
                `Error getting time series for client ${clientId}:`,
                error
            );
            throw error;
        }
    }
}