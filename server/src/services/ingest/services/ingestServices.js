import logger from '../../../shared/config/logger.js';
import AppError from '../../../shared/utils/AppError.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service responsible for processing incoming API hit events.
 *
 * Responsibilities:
 * 1. Validate incoming API hit payloads.
 * 2. Transform the payload into a standardized event format.
 * 3. Publish the event through the EventProducer.
 * 4. Handle circuit breaker rejections gracefully.
 *
 * This service does NOT:
 * - Interact directly with RabbitMQ.
 * - Know queue names or exchange details.
 * - Manage circuit breaker state.
 *
 * Those responsibilities are delegated to the EventProducer layer,
 * keeping the business logic isolated from infrastructure concerns.
 */
export class IngestService {
    /**
     * Creates a new IngestService instance.
     *
     * Dependency Injection is used here so that the service remains
     * loosely coupled to the underlying event publishing implementation.
     *
     * @param {Object} dependencies
     * @param {EventProducer} dependencies.eventProducer - Publisher responsible for sending events to RabbitMQ.
     */
    constructor({ eventProducer }) {
        if (!eventProducer) {
            throw new Error('IngestService requires eventProducer');
        }

        this.eventProducer = eventProducer;
    }

    /**
     * Processes an incoming API hit event.
     *
     * Flow:
     * 1. Validate incoming payload.
     * 2. Create a normalized event object.
     * 3. Publish the event via EventProducer.
     * 4. Return publishing status to the caller.
     *
     * If the circuit breaker is open, the EventProducer returns false,
     * allowing the service to fail gracefully without crashing.
     *
     * @param {Object} hitData - Raw API hit payload received from client.
     * @returns {Promise<Object>} Result of the ingestion attempt.
     */
    async ingestApiHit(hitData) {
        try {
            // Validate request payload before processing.
            this.validateHitData(hitData);

            // Create a standardized event that will be consumed
            // by downstream processing services.
            const event = {
                eventId: uuidv4(),
                timestamp: new Date(),

                serviceName: hitData.serviceName,
                endpoint: hitData.endpoint,
                method: hitData.method.toUpperCase(),

                statusCode: parseInt(hitData.statusCode, 10),
                latencyMs: parseFloat(hitData.latencyMs),

                clientId: hitData.clientId,
                apiKeyId: hitData.apiKeyId,

                // Optional metadata useful for analytics and monitoring.
                ip: hitData.ip || 'unknown',
                userAgent: hitData.userAgent || '',
            };

            // Publish event through EventProducer.
            // Internally this may go through a circuit breaker before RabbitMQ.
            const published = await this.eventProducer.publishApiHit(event);

            if (!published) {
                logger.warn('API hit rejected by circuit breaker', {
                    eventId: event.eventId,
                    endpoint: event.endpoint,
                    method: event.method,
                    clientId: event.clientId,
                });

                return {
                    eventId: event.eventId,
                    status: 'rejected',
                    reason: 'service_unavailable',
                    timestamp: event.timestamp,
                };
            }

            logger.info('API hit ingested', {
                eventId: event.eventId,
                endpoint: event.endpoint,
                method: event.method,
                clientId: event.clientId,
            });

            return {
                eventId: event.eventId,
                status: 'queued',
                timestamp: event.timestamp,
            };
        } catch (error) {
            logger.error('Error ingesting API hit:', error);
            throw error;
        }
    }

    /**
     * Validates incoming API hit payload.
     *
     * Validation Rules:
     * - Required fields must be present.
     * - HTTP method must be valid.
     * - Status code must be between 100 and 599.
     * - Latency must be a non-negative number.
     *
     * Throws an AppError when validation fails so that
     * the controller layer can return a proper 4xx response.
     *
     * @param {Object} hitData
     * @throws {AppError}
     */
    validateHitData(hitData) {
        const requiredFields = [
            'serviceName',
            'endpoint',
            'method',
            'statusCode',
            'latencyMs',
            'clientId',
        ];

        // Identify any missing mandatory fields.
        const missingFields = requiredFields.filter(
            (field) => !hitData[field]
        );

        if (missingFields.length > 0) {
            throw new AppError(
                `Missing required fields: ${missingFields.join(',')}`,
                400
            );
        }

        // Only allow valid HTTP methods.
        const validMethods = [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS',
            'HEAD',
        ];

        if (!validMethods.includes(hitData.method.toUpperCase())) {
            throw new AppError(
                `Invalid HTTP methods: ${hitData.method}`,
                400
            );
        }

        // Status code must be a valid HTTP response code.
        const statusCode = parseInt(hitData.statusCode, 10);

        if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
            throw new AppError(
                `Invalid Status code : ${hitData.statusCode}`,
                400
            );
        }

        // Latency should always be a non-negative number.
        const latency = parseFloat(hitData.latencyMs);

        if (isNaN(latency) || latency < 0) {
            throw new AppError(
                `Invalid latency : ${hitData.latencyMs}`,
                400
            );
        }
    }
}