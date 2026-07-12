import { EVENT_TYPES } from "../eventContracts.js";
import { isRetryable } from "./RetryStrategy.js";

/**
 * EventProducer
 *
 * Responsible for reliably publishing events to RabbitMQ using:
 *
 * 1. Confirm Channels
 *    - Ensures the broker explicitly ACKs/NACKs each publish.
 *
 * 2. Circuit Breaker
 *    - Prevents continuously hitting RabbitMQ when it is unhealthy.
 *
 * 3. Retry Strategy
 *    - Retries transient failures using exponential backoff + jitter.
 *
 * Delivery Guarantee:
 * - At-Least-Once Delivery
 *
 * Notes:
 * - A publish is considered successful only after broker confirmation.
 * - Transient failures are retried.
 * - Permanent failures are surfaced immediately.
 */
export class EventProducer {
    /**
     * @param {Object} dependencies
     * @param {ConfirmChannelManager} dependencies.channelManager
     * @param {CircuitBreaker} dependencies.circuitBreaker
     * @param {RetryStrategy} dependencies.retryStrategy
     * @param {Object} [dependencies.logger]
     * @param {string} dependencies.queueName
     */
    constructor({
        channelManager,
        circuitBreaker,
        retryStrategy,
        logger,
        queueName,
    }) {
        if (!channelManager) {
            throw new Error("EventProducer requires channelManager");
        }

        if (!circuitBreaker) {
            throw new Error("EventProducer requires circuitBreaker");
        }

        if (!retryStrategy) {
            throw new Error("EventProducer requires retryStrategy");
        }

        if (!queueName) {
            throw new Error("EventProducer requires queueName");
        }

        this._channelManager = channelManager;
        this._circuitBreaker = circuitBreaker;
        this._retry = retryStrategy;
        this._logger = logger ?? console;
        this._queueName = queueName;

        /**
         * Lightweight in-memory operational metrics.
         * Can later be exported to Prometheus/OpenTelemetry.
         */
        this._metrics = {
            published: 0,
            failed: 0,
            retried: 0,
            retriesExhausted: 0,
        };

        /**
         * Prevents new publishes during service shutdown.
         */
        this._shuttingDown = false;
    }

    /**
     * Safely increments a metric counter.
     *
     * @param {string} metric
     * @private
     */
    _incrementMetric(metric) {
        this._metrics[metric] = (this._metrics[metric] || 0) + 1;
    }

    /**
     * Publishes an API hit event.
     *
     * Flow:
     * 1. Check circuit breaker
     * 2. Attempt publish
     * 3. Retry transient failures
     * 4. Record success/failure metrics
     *
     * @param {Object} eventData
     * @param {Object} [opts]
     * @param {string} [opts.correlationId]
     * @returns {Promise<boolean>}
     */
    async publishApiHit(eventData, opts = {}) {
        if (this._shuttingDown) {
            const error = new Error("EventProducer is shutting down");
            error.code = "SHUTDOWN_IN_PROGRESS";

            this._logger.warn(
                "[EventProducer] publish rejected during shutdown",
                {
                    eventId: eventData?.eventId,
                }
            );

            throw error;
        }

        /**
         * Fail fast when RabbitMQ is considered unhealthy.
         *
         * This prevents:
         * - Excessive retry storms
         * - Resource exhaustion
         * - Cascading failures
         */
        if (!this._circuitBreaker.allowRequest()) {
            this._logger.warn(
                "[EventProducer] publish blocked by circuit breaker",
                {
                    eventId: eventData?.eventId,
                    state: this._circuitBreaker.state,
                }
            );

            return false;
        }

        const correlationId =
            opts.correlationId ?? eventData.eventId;

        const startMs = Date.now();

        let attempt = 0;

        while (true) {
            try {
                await this._publish(eventData, {
                    correlationId,
                    attempt,
                });

                const latencyMs = Date.now() - startMs;

                /**
                 * Entire publish operation succeeded.
                 */
                this._circuitBreaker.onSuccess();

                this._incrementMetric("published");

                this._logger.info("[EventProducer] published", {
                    eventId: eventData.eventId,
                    correlationId,
                    attempt: attempt + 1,
                    latencyMs,
                    endpoint: eventData.endpoint,
                });

                return true;
            } catch (error) {
                this._logger.error(
                    "[EventProducer] publish attempt failed",
                    {
                        eventId: eventData?.eventId,
                        correlationId,
                        attempt: attempt + 1,
                        error: error.message,
                    }
                );

                const canRetry =
                    isRetryable(error) &&
                    this._retry.shouldRetry(attempt);

                /**
                 * Non-retryable or retry limit reached.
                 */
                if (!canRetry) {
                    this._circuitBreaker.onFailure();

                    this._incrementMetric("failed");

                    if (!this._retry.shouldRetry(attempt)) {
                        this._incrementMetric(
                            "retriesExhausted"
                        );
                    }

                    throw error;
                }

                this._incrementMetric("retried");

                const delayMs =
                    this._retry.delay(attempt);

                this._logger.warn(
                    "[EventProducer] scheduling retry",
                    {
                        eventId: eventData?.eventId,
                        attempt: attempt + 1,
                        nextDelayMs: delayMs,
                    }
                );

                await new Promise((resolve) =>
                    setTimeout(resolve, delayMs)
                );

                attempt++;
            }
        }
    }

    /**
     * Internal publish implementation.
     *
     * Uses RabbitMQ confirm publisher mode.
     *
     * Success:
     * - Broker ACK received
     *
     * Failure:
     * - Broker NACK
     * - Channel failure
     * - Confirmation timeout
     *
     * @param {Object} eventData
     * @param {Object} options
     * @param {string} options.correlationId
     * @param {number} options.attempt
     * @returns {Promise<void>}
     * @private
     */
    async _publish(eventData, { correlationId, attempt }) {
        const channel =
            await this._channelManager.getChannel();

        const message = {
            type: EVENT_TYPES.API_HIT,
            data: eventData,
            publishedAt: new Date().toISOString(),
            attempt: attempt + 1,
        };

        const payload = Buffer.from(
            JSON.stringify(message)
        );

        const publishOptions = {
            /**
             * Persist message to disk.
             *
             * Note:
             * Queue itself must also be durable.
             */
            persistent: true,

            contentType: "application/json",

            /**
             * Useful for tracing and idempotency.
             */
            messageId: eventData.eventId,

            correlationId,

            /**
             * AMQP timestamp is expressed in seconds.
             */
            timestamp: Math.floor(Date.now() / 1000),
        };

        return new Promise((resolve, reject) => {
            let settled = false;

            /**
             * Prevents hanging forever if broker
             * never responds with ACK/NACK.
             */
            const timeout = setTimeout(() => {
                if (settled) return;

                settled = true;

                reject(
                    new Error(
                        "Publish confirmation timeout"
                    )
                );
            }, 10_000);

            const written = channel.publish(
                "",
                this._queueName,
                payload,
                publishOptions,
                (err) => {
                    if (settled) return;

                    settled = true;

                    clearTimeout(timeout);

                    if (err) {
                        return reject(
                            new Error(
                                `Publish nacked: ${err.message}`
                            )
                        );
                    }

                    resolve();
                }
            );

            /**
             * Back-pressure means RabbitMQ's write buffer
             * is currently full.
             *
             * We don't fail immediately.
             * We log it and wait for drain notification.
             */
            if (!written) {
                this._logger.warn(
                    "[EventProducer] back-pressure detected",
                    {
                        eventId: eventData.eventId,
                        payloadBytes: payload.length,
                    }
                );

                channel.once("drain", () => {
                    this._logger.debug(
                        "[EventProducer] channel drain received",
                        {
                            eventId: eventData.eventId,
                        }
                    );
                });
            }
        });
    }

    /**
     * Gracefully stops the producer.
     *
     * New publish attempts will be rejected.
     *
     * Requires ConfirmChannelManager.close()
     * to be implemented.
     */
    async shutdown() {
        this._shuttingDown = true;

        this._logger.info(
            "[EventProducer] shutdown initiated"
        );

        await this._channelManager.close();

        this._logger.info(
            "[EventProducer] shutdown completed"
        );
    }

    /**
     * Returns producer health information.
     *
     * Useful for:
     * - Health endpoints
     * - Debugging
     * - Monitoring dashboards
     */
    getStats() {
        return {
            metrics: { ...this._metrics },
            circuitBreaker:
                this._circuitBreaker.snapshot(),
        };
    }
}