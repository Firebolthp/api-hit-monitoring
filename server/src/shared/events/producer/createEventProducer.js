import config from "../../config/index.js";
import logger from "../../config/logger.js";
import rabbitmq from "../../config/rabbitmq.js";

import { CircuitBreaker } from "./CircuitBreaker.js";
import { ConfirmChannelManager } from "./ConfirmChannelManager.js";
import { RetryStrategy } from "./RetryStrategy.js";
import { EventProducer } from "./eventProducer.js";

/**
 * Factory responsible for constructing a fully configured EventProducer.
 *
 * Why a Factory?
 * --------------
 * EventProducer depends on multiple infrastructure components:
 *
 * - RabbitMQ Connection Manager
 * - Confirm Channel Manager
 * - Circuit Breaker
 * - Retry Strategy
 * - Logger
 *
 * Creating those dependencies inside EventProducer would tightly couple
 * business logic with infrastructure concerns.
 *
 * This factory centralizes dependency wiring and makes testing easier by
 * allowing callers to override any dependency.
 *
 * Example:
 *
 * const producer = createEventProducer();
 *
 * Example (testing):
 *
 * const producer = createEventProducer({
 *   rabbitmq: mockRabbitMQ,
 *   logger: mockLogger
 * });
 *
 * @param {Object} [overrides]
 * @param {Object} [overrides.logger]
 * @param {Object} [overrides.rabbitmq]
 * @param {string} [overrides.queueName]
 * @param {ConfirmChannelManager} [overrides.channelManager]
 * @param {CircuitBreaker} [overrides.circuitBreaker]
 * @param {RetryStrategy} [overrides.retryStrategy]
 *
 * @returns {EventProducer}
 */
export function createEventProducer(overrides = {}) {
    /**
     * Infrastructure dependencies.
     */
    const log = overrides.logger ?? logger;
    const rmq = overrides.rabbitmq ?? rabbitmq;
    const queueName =
        overrides.queueName ??
        config.rabbitmq.queue;

    /**
     * Validate critical configuration.
     */
    if (!rmq) {
        throw new Error(
            "RabbitMQ connection manager is required"
        );
    }

    if (!queueName) {
        throw new Error(
            "RabbitMQ queue name is required"
        );
    }

    if (
        config.rabbitmq.retryAttempts == null ||
        config.rabbitmq.retryAttempts < 0
    ) {
        throw new Error(
            "Invalid rabbitmq.retryAttempts configuration"
        );
    }

    if (
        config.rabbitmq.retryDelay == null ||
        config.rabbitmq.retryDelay < 0
    ) {
        throw new Error(
            "Invalid rabbitmq.retryDelay configuration"
        );
    }

    /**
     * Confirm Channel Manager
     *
     * Maintains a reusable RabbitMQ confirm channel.
     *
     * Benefits:
     * - Broker acknowledgements
     * - Lower channel creation overhead
     * - Centralized channel recovery
     */
    const channelManager =
        overrides.channelManager ??
        new ConfirmChannelManager({
            rabbitmq: rmq,
            logger: log,
        });

    /**
     * Circuit Breaker
     *
     * Protects the application from repeatedly
     * attempting publishes while RabbitMQ is unhealthy.
     *
     * CLOSED
     *   -> normal operation
     *
     * OPEN
     *   -> fail fast
     *
     * HALF_OPEN
     *   -> recovery probes
     */
    const circuitBreaker =
        overrides.circuitBreaker ??
        new CircuitBreaker({
            failureThreshold: 2,
            cooldownMs: 30_000,
            halfOpenMaxAttempts: 3,
            logger: log,
        });

    /**
     * Retry Strategy
     *
     * Handles transient RabbitMQ failures using:
     * - Exponential backoff
     * - Delay capping
     * - Jitter
     *
     * Prevents retry storms and reduces
     * pressure on recovering brokers.
     */
    const retryStrategy =
        overrides.retryStrategy ??
        new RetryStrategy({
            maxRetries:
                config.rabbitmq.retryAttempts,

            baseDelayMs:
                config.rabbitmq.retryDelay,

            maxDelayMs: 5_000,

            jitterFactor: 0.3,
        });

    log.info(
        "[EventProducerFactory] creating producer",
        {
            queueName,
            retryAttempts:
                config.rabbitmq.retryAttempts,
            retryDelay:
                config.rabbitmq.retryDelay,
        }
    );

    /**
     * Dependency Injection
     *
     * The producer receives fully initialized
     * infrastructure components and focuses only
     * on publishing responsibilities.
     */
    return new EventProducer({
        channelManager,
        circuitBreaker,
        retryStrategy,
        logger: log,
        queueName,
    });
}