import logger from "../../../shared/config/logger.js";
import ResponseFormatter from "../../../shared/utils/responseFormatter.js";

/**
 * Controller responsible for handling incoming API hit ingestion requests.
 *
 * Responsibilities:
 * 1. Receive and validate request context.
 * 2. Extract request metadata.
 * 3. Delegate business processing to IngestService.
 * 4. Return appropriate HTTP responses.
 *
 * This controller intentionally remains thin and contains no business logic.
 * All validation, event creation, and publishing logic are delegated to
 * the service layer.
 *
 * Request Flow:
 * Route → Controller → Service → EventProducer → Circuit Breaker → RabbitMQ
 */
export class IngestController {
    /**
     * Creates a new controller instance.
     *
     * Dependency Injection keeps the controller decoupled from concrete
     * service implementations and improves testability.
     *
     * @param {Object} dependencies
     * @param {IngestService} dependencies.ingestService - Service responsible for processing API hit events.
     */
    constructor({ ingestService }) {
        if (!ingestService) {
            throw new Error("IngestController requires ingest service");
        }

        this.ingestService = ingestService;
    }

    /**
     * Handles incoming API hit requests.
     *
     * Steps:
     * 1. Extract authenticated client information.
     * 2. Merge request payload with metadata.
     * 3. Forward data to IngestService.
     * 4. Return an appropriate response based on processing outcome.
     *
     * Success:
     * - Returns 202 Accepted because processing happens asynchronously.
     *
     * Circuit Breaker Rejection:
     * - Returns 503 Service Unavailable when the EventProducer rejects
     *   the request due to RabbitMQ or downstream infrastructure issues.
     *
     * Errors:
     * - Any unexpected errors are forwarded to Express error middleware.
     *
     * @param {Request} req - Express request object.
     * @param {Response} res - Express response object.
     * @param {Function} next - Express error middleware callback.
     */
    async ingestHit(req, res, next) {
        try {
            /**
             * Client information is typically injected by an
             * authentication/API-key middleware before reaching
             * this controller.
             */
            logger.info('Ingest: Client data received', {
                clientId: req.client._id,
                clientName: req.client.name,
                clientKeys: Object.keys(req.client)
            });

            /**
             * Build a complete hit payload by combining:
             * - Request body data
             * - Authenticated client information
             * - API key metadata
             * - Network metadata
             */
            const hitData = {
                ...req.body,

                clientId: req.client._id,
                apiKeyId: req.apiKey._id,

                // Request origin information useful for analytics.
                ip: req.ip || req.connection.remoteAddress,

                // User agent can help identify consumers and clients.
                userAgent: req.headers['user-agent'] || ''
            };

            logger.info('Ingest: Hit data prepared', {
                clientId: req.client._id,
                endpoint: hitData.endpoint,
                method: hitData.method
            });

            /**
             * Delegate business processing to service layer.
             */
            const result = await this.ingestService.ingestApiHit(hitData);

            /**
             * Circuit breaker rejected the request.
             * This typically indicates downstream infrastructure
             * is temporarily unavailable.
             */
            if (result.status === 'rejected') {
                return res.status(503).json(
                    ResponseFormatter.error(
                        'Service temporarily unavailable',
                        503,
                        {
                            eventId: result.eventId,
                            reason: result.reason,
                            retryAfter: '30 seconds'
                        }
                    )
                );
            }

            /**
             * Event successfully queued for asynchronous processing.
             *
             * 202 Accepted is preferred over 200 OK because the request
             * has been accepted but processing will occur later via
             * RabbitMQ consumers.
             */
            return res.status(202).json(
                ResponseFormatter.success(
                    result,
                    'API hit queued for processing',
                    202
                )
            );

        } catch (error) {
            /**
             * Delegate error handling to centralized Express
             * error middleware.
             */
            next(error);
        }
    }
}