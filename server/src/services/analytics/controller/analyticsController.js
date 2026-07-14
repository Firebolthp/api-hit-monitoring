import ResponseFormatter from "../../../shared/utils/responseFormatter.js";
import AppError from "../../../shared/utils/AppError.js";
import logger from "../../../shared/config/logger.js";

/**
 * Analytics Controller
 *
 * Handles incoming analytics API requests and acts as the entry point
 * for all analytics-related operations.
 *
 * Responsibilities:
 * - Validate authentication and authorization
 * - Resolve client scope for analytics queries
 * - Validate incoming time filters
 * - Invoke analytics service methods
 * - Format API responses consistently
 *
 * Access Rules:
 * - Super Admins can access analytics for any client.
 * - Regular users can only access analytics for their own client.
 * - Users must have the canViewAnalytics permission.
 */
export class AnalyticsController {
    /**
     * @param {Object} dependencies
     * @param {AnalyticsService} dependencies.analyticsService
     * @param {AuthService} dependencies.authService
     * @param {ClientRepository} dependencies.clientRepository
     */
    constructor({
        analyticsService: analyticsSvc,
        authService: authSvc,
        clientRepository: clientRepo,
    } = {}) {
        // Enforce explicit dependency injection.
        if (!analyticsSvc || !authSvc || !clientRepo) {
            throw new Error(
                "AnalyticsController requires analyticsService, authService, and clientRepository"
            );
        }

        this.analyticsService = analyticsSvc;
        this.authService = authSvc;
        this.clientRepository = clientRepo;
    }

    /**
     * Retrieves overall analytics statistics.
     *
     * Query Params:
     * - startTime
     * - endTime
     * - clientId (optional, super admin only)
     *
     * Returns:
     * - Total hits
     * - Error hits
     * - Success hits
     * - Error rate
     * - Average latency
     * - Service and endpoint counts
     */
    async getStats(req, res, next) {
        try {
            const { startTime, endTime } = req.query;

            const isSuperAdmin = await this.ensureCanViewAnalytics(req);

            const finalClientId = await this.resolveFinalClientId(
                req,
                isSuperAdmin
            );

            const timeRange = this.validateTimeRange(
                startTime,
                endTime
            );

            const stats = await this.analyticsService.getOverallStats(
                finalClientId,
                timeRange
            );

            res.status(200).json(
                ResponseFormatter.success(
                    stats,
                    "Statistics retrieved successfully",
                    200
                )
            );
        } catch (error) {
            logger.error("Failed to retrieve analytics statistics", error);
            next(error);
        }
    }

    /**
     * Validates and normalizes incoming time filters.
     *
     * Supported Formats:
     * - Unix timestamps
     * - ISO date strings
     *
     * Validation Rules:
     * - Dates must be valid
     * - startTime must not be greater than endTime
     *
     * @param {string|number} startTime
     * @param {string|number} endTime
     * @returns {{startTime: number|null, endTime: number|null}}
     */
    validateTimeRange(startTime, endTime) {
        const parseValue = (value) => {
            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                return null;
            }

            // Support Unix timestamps.
            if (/^\d+$/.test(String(value))) {
                return Number(value);
            }

            const parsed = Date.parse(String(value));

            return Number.isNaN(parsed) ? NaN : parsed;
        };

        const start = parseValue(startTime);
        const end = parseValue(endTime);

        if (
            (startTime && Number.isNaN(start)) ||
            (endTime && Number.isNaN(end))
        ) {
            throw new AppError("Invalid time format", 400);
        }

        if (start !== null && end !== null && start > end) {
            throw new AppError(
                "Invalid time range: start > end",
                400
            );
        }

        return {
            startTime: start,
            endTime: end,
        };
    }

    /**
     * Ensures the authenticated user can access analytics.
     *
     * Access Rules:
     * - Super Admin -> Full access
     * - Client User -> Must have canViewAnalytics permission
     *
     * @param {Object} req
     * @returns {Promise<boolean>} True if super admin, otherwise false.
     */
    async ensureCanViewAnalytics(req) {
        if (!req.user || !req.user.userId) {
            throw new AppError("Authentication required", 401);
        }

        const isSuperAdmin =
            await this.authService.checkSuperAdminPermissions(
                req.user.userId
            );

        if (isSuperAdmin) {
            return true;
        }

        const profile = await this.authService.getProfile(
            req.user.userId
        );

        if (
            !profile ||
            !profile.permissions ||
            !profile.permissions.canViewAnalytics
        ) {
            throw new AppError(
                "Insufficient permissions to view analytics",
                403
            );
        }

        return false;
    }

    /**
     * Resolves which client's analytics data should be queried.
     *
     * Super Admin:
     * - Can query any client using query.clientId
     * - Can query all clients when no clientId is provided
     *
     * Regular User:
     * - Restricted to their associated client
     *
     * @param {Object} req
     * @param {boolean} isSuperAdmin
     * @returns {Promise<string|null>}
     */
    async resolveFinalClientId(req, isSuperAdmin) {
        const queryClientId = req.query.clientId;
        const userClientId = req.user?.clientId;

        if (isSuperAdmin) {
            if (queryClientId) {
                if (!this.isValidObjectId(queryClientId)) {
                    throw new AppError(
                        "Invalid clientId format",
                        400
                    );
                }

                const client =
                    await this.clientRepository.findById(
                        queryClientId
                    );

                if (!client) {
                    throw new AppError("Client not found", 404);
                }

                return queryClientId;
            }

            // Null indicates no client filter should be applied.
            return null;
        }

        if (!userClientId) {
            throw new AppError(
                "Access denied - no client association",
                403
            );
        }

        if (!this.isValidObjectId(userClientId)) {
            throw new AppError(
                "Invalid client association",
                400
            );
        }

        const client =
            await this.clientRepository.findById(userClientId);

        if (!client) {
            throw new AppError("Client not found", 404);
        }

        return userClientId;
    }

    /**
     * Validates MongoDB ObjectId format.
     *
     * @param {string} id
     * @returns {boolean}
     */
    isValidObjectId(id) {
        return (
            typeof id === "string" &&
            /^[0-9a-fA-F]{24}$/.test(id)
        );
    }

    /**
     * Retrieves complete dashboard data.
     *
     * Dashboard Includes:
     * - Overall statistics
     * - Top endpoints
     * - Recent activity / time-series data
     *
     * Uses Promise.allSettled() intentionally so that
     * partial dashboard data can still be returned even if
     * one widget fails to load.
     */
    async getDashboard(req, res, next) {
        try {
            const { startTime, endTime } = req.query;

            const isSuperAdmin = await this.ensureCanViewAnalytics(
                req
            );

            const finalClientId = await this.resolveFinalClientId(
                req,
                isSuperAdmin
            );

            const timeRange = this.validateTimeRange(
                startTime,
                endTime
            );

            const results = await Promise.allSettled([
                this.analyticsService.getOverallStats(
                    finalClientId,
                    timeRange
                ),
                this.analyticsService.getTopEndpoints(
                    finalClientId,
                    {
                        limit: 5,
                        startTime: timeRange.startTime,
                    }
                ),
                this.analyticsService.getTimeSeries(
                    finalClientId,
                    {
                        ...timeRange,
                        limit: 24,
                    }
                ),
            ]);

            const [stats, topEndpoints, recentTimeSeries] =
                results.map((result) =>
                    result.status === "fulfilled"
                        ? result.value
                        : null
                );

            const dashboard = {
                stats,
                topEndpoints,
                recentActivity: recentTimeSeries,
            };

            res.status(200).json(
                ResponseFormatter.success(
                    dashboard,
                    "Dashboard data retrieved successfully",
                    200
                )
            );
        } catch (error) {
            logger.error(
                "Failed to retrieve analytics dashboard",
                error
            );
            next(error);
        }
    }
}