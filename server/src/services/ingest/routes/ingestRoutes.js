import express from "express";
import ingestContainer from '../Dependencies/dependencies.js';
import validateApiKey from '../../../shared/middlewares/validateApiKey.js';
import rateLimit from 'express-rate-limit';
import config from '../../../shared/config/index.js';

const { ingestController } = ingestContainer;

/**
 * Router responsible for exposing API hit ingestion endpoints.
 *
 * This layer should only:
 * - Define routes.
 * - Attach middleware.
 * - Delegate requests to controllers.
 *
 * This layer should NOT:
 * - Contain business logic.
 * - Perform event validation.
 * - Interact with RabbitMQ.
 * - Publish events.
 *
 * Request Flow:
 * Route
 *   → API Key Validation
 *   → Rate Limiter
 *   → Controller
 *   → Service
 *   → EventProducer
 *   → Circuit Breaker
 *   → RabbitMQ
 */
const router = express.Router();

/**
 * Rate limiter for ingest endpoints.
 *
 * Purpose:
 * - Prevent API abuse.
 * - Protect the ingestion service from excessive traffic.
 * - Reduce load on RabbitMQ and downstream consumers.
 *
 * Example:
 * If configured for:
 * - windowMs = 60,000
 * - maxRequests = 100
 *
 * Then each client may send up to 100 requests
 * per minute before receiving HTTP 429 responses.
 */
const ingestLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,

    /**
     * Response returned when a client exceeds
     * the configured request threshold.
     */
    message: {
        success: false,
        message: 'Too many requests, please try again later',
        statusCode: 429
    },

    // Return standardized RateLimit headers.
    standardHeaders: true,

    // Disable deprecated X-RateLimit-* headers.
    legacyHeaders: false
});

/**
 * POST /
 *
 * Ingest an API hit event.
 *
 * Middleware Order:
 *
 * 1. validateApiKey
 *    - Verifies API key authenticity.
 *    - Loads client information into request context.
 *
 * 2. ingestLimiter
 *    - Prevents excessive requests.
 *
 * 3. ingestController.ingestHit
 *    - Processes the request.
 *    - Queues the event for asynchronous processing.
 *
 * Response:
 * - 202 Accepted → Event queued successfully.
 * - 401 Unauthorized → Invalid API key.
 * - 429 Too Many Requests → Rate limit exceeded.
 * - 503 Service Unavailable → Circuit breaker rejection.
 */
router.post(
    '/',
    validateApiKey,
    ingestLimiter,
    (req, res, next) =>
        ingestController.ingestHit(req, res, next)
);

export default router;