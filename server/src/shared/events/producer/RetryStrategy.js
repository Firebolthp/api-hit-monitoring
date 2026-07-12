/**
 * Error patterns commonly associated with
 * transient RabbitMQ/network failures.
 *
 * These errors are generally recoverable through
 * retries with exponential backoff.
 */
const RETRYABLE_PATTERNS = [
    'channel closed',
    'connection closed',
    'econnreset',
    'econnrefused',
    'etimedout',
    'buffer full',
    'heartbeat timeout',
    'not available',
    'server connection closed'
];

/**
 * Determines whether an error is considered retryable.
 *
 * Retryable:
 * - Temporary network issues
 * - RabbitMQ channel interruptions
 * - Broker connectivity issues
 * - Heartbeat failures
 *
 * Non-retryable:
 * - Validation errors
 * - Serialization errors
 * - Programming mistakes
 *
 * @param {*} err
 * @returns {boolean}
 */
export function isRetryable(err) {
    if (!err) {
        return false;
    }

    const message = String(
        err.message ?? ''
    ).toLowerCase();

    const code = String(
        err.code ?? ''
    ).toUpperCase();

    /**
     * DNS resolution failures may be temporary
     * in containerized or service-discovery
     * environments.
     */
    if (code === 'ENOTFOUND') {
        return true;
    }

    return RETRYABLE_PATTERNS.some(
        (pattern) =>
            message.includes(pattern.toLowerCase()) ||
            code.includes(pattern.toUpperCase())
    );
}

/**
 * Retry strategy implementing:
 *
 * - Exponential backoff
 * - Delay capping
 * - Random jitter
 *
 * Example delays:
 *
 * Attempt 0 -> ~200ms
 * Attempt 1 -> ~400ms
 * Attempt 2 -> ~800ms
 * Attempt 3 -> ~1600ms
 *
 * (actual values vary due to jitter)
 */
export class RetryStrategy {
    /**
     * @param {Object} [opts]
     * @param {number} [opts.maxRetries=3]
     * @param {number} [opts.baseDelayMs=200]
     * @param {number} [opts.maxDelayMs=5000]
     * @param {number} [opts.jitterFactor=0.3]
     */
    constructor(opts = {}) {
        this.maxRetries = Math.max(
            0,
            opts.maxRetries ?? 3
        );

        this.baseDelayMs = Math.max(
            1,
            opts.baseDelayMs ?? 200
        );

        this.maxDelayMs = Math.max(
            this.baseDelayMs,
            opts.maxDelayMs ?? 5000
        );

        /**
         * 0 → no jitter
         * 1 → up to ±100% jitter
         */
        this.jitterFactor = Math.max(
            0,
            opts.jitterFactor ?? 0.3
        );
    }

    /**
     * Returns true if another retry
     * attempt should be performed.
     *
     * @param {number} attempt
     * @returns {boolean}
     */
    shouldRetry(attempt) {
        return attempt < this.maxRetries;
    }

    /**
     * Calculates retry delay using
     * exponential backoff with jitter.
     *
     * Formula:
     *
     * delay = min(
     *   baseDelay * 2^attempt,
     *   maxDelay
     * )
     *
     * jitter = ±(delay * jitterFactor)
     *
     * @param {number} attempt
     * @returns {number}
     */
    delay(attempt) {
        const exponentialDelay =
            this.baseDelayMs * Math.pow(2, attempt);

        const cappedDelay = Math.min(
            exponentialDelay,
            this.maxDelayMs
        );

        const jitterRange =
            cappedDelay * this.jitterFactor;

        const jitter =
            (Math.random() - 0.5) *
            2 *
            jitterRange;

        return Math.max(
            0,
            Math.round(cappedDelay + jitter)
        );
    }

    /**
     * Waits for the calculated delay.
     *
     * @param {number} attempt
     * @returns {Promise<void>}
     */
    wait(attempt) {
        const delayMs = this.delay(attempt);

        return new Promise((resolve) => {
            setTimeout(resolve, delayMs);
        });
    }

    /**
     * Exposes strategy configuration.
     *
     * Useful for diagnostics and
     * operational monitoring.
     */
    snapshot() {
        return {
            maxRetries: this.maxRetries,
            baseDelayMs: this.baseDelayMs,
            maxDelayMs: this.maxDelayMs,
            jitterFactor: this.jitterFactor,
            timestamp: Date.now()
        };
    }
}