import express from "express";
import analyticsContainer from "../Dependencies/dependencies.js";
import authenticate from "../../../shared/middlewares/authenticate.js";

const { analyticsController } = analyticsContainer.controllers;

/**
 * Analytics Router
 *
 * Defines all analytics-related API endpoints.
 *
 * Responsibilities:
 * - Route incoming requests to the appropriate controller methods.
 * - Ensure requests are authenticated before accessing analytics data.
 *
 * Available Endpoints:
 *
 * GET /stats
 * - Returns overall analytics statistics.
 * - Supports optional time range filtering.
 *
 * GET /dashboard
 * - Returns complete dashboard data.
 * - Includes statistics, top endpoints, and recent activity.
 */

const router = express.Router();

/**
 * GET /analytics/stats
 *
 * Returns:
 * - Total hits
 * - Error hits
 * - Success hits
 * - Error rate
 * - Average latency
 * - Service and endpoint counts
 *
 * Access:
 * - Super Admin
 * - Users with canViewAnalytics permission
 */
router.get(
    "/stats",
    authenticate,
    (req, res, next) =>
        analyticsController.getStats(req, res, next)
);

/**
 * GET /analytics/dashboard
 *
 * Returns dashboard data required by the frontend:
 * - Overall statistics
 * - Top endpoints
 * - Recent activity (time-series metrics)
 *
 * Access:
 * - Super Admin
 * - Users with canViewAnalytics permission
 */
router.get(
    "/dashboard",
    authenticate,
    (req, res, next) =>
        analyticsController.getDashboard(req, res, next)
);

export default router;