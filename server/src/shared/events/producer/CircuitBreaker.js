/**
 * Circuit breaker states.
 *
 * CLOSED:
 *   Normal operation. All requests are allowed.
 *
 * OPEN:
 *   Requests are rejected immediately.
 *   After cooldown expires, transitions to HALF_OPEN.
 *
 * HALF_OPEN:
 *   Allows a limited number of probe requests.
 *   Successes close the circuit.
 *   Any failure reopens the circuit.
 */
export const CircuitState = Object.freeze({
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
});

export class CircuitBreaker {
    /**
     * @param {Object} opts
     * @param {number} [opts.failureThreshold=5]
     * @param {number} [opts.cooldownMs=30000]
     * @param {number} [opts.halfOpenMaxAttempts=3]
     * @param {Object} [opts.logger=console]
     */
    constructor(opts = {}) {
        this.failureThreshold = Math.max(
            1,
            opts.failureThreshold ?? 5
        );

        this.cooldownMs = Math.max(
            1000,
            opts.cooldownMs ?? 30_000
        );

        this.halfOpenMaxAttempts = Math.max(
            1,
            opts.halfOpenMaxAttempts ?? 3
        );

        this.logger = opts.logger ?? console;

        this._state = CircuitState.CLOSED;
        this._failures = 0;

        this._lastFailureTime = 0;

        this._halfOpenAttempts = 0;
        this._halfOpenSuccesses = 0;
    }

    /**
     * Returns true if the cooldown period has elapsed.
     *
     * @private
     */
    _cooldownElapsed() {
        return Date.now() - this._lastFailureTime >= this.cooldownMs;
    }

    /**
     * Centralized state transition handler.
     *
     * Ensures all state changes are logged consistently
     * and any state-specific counters are reset properly.
     *
     * @param {string} newState
     * @private
     */
    _transitionTo(newState) {
        const previousState = this._state;

        if (previousState === newState) {
            return;
        }

        this._state = newState;

        this.logger.info('[CircuitBreaker] state transition', {
            from: previousState,
            to: newState
        });

        if (newState === CircuitState.HALF_OPEN) {
            this._halfOpenAttempts = 0;
            this._halfOpenSuccesses = 0;
        }
    }

    /**
     * Opens the circuit and starts cooldown timer.
     *
     * @private
     */
    _openCircuit() {
        this._lastFailureTime = Date.now();

        this._transitionTo(CircuitState.OPEN);

        this.logger.error('[CircuitBreaker] circuit opened', {
            failures: this._failures,
            failureThreshold: this.failureThreshold,
            cooldownMs: this.cooldownMs
        });
    }

    /**
     * Resets the circuit back to healthy state.
     *
     * @private
     */
    _reset() {
        this._failures = 0;
        this._halfOpenAttempts = 0;
        this._halfOpenSuccesses = 0;

        this._transitionTo(CircuitState.CLOSED);

        this.logger.info(
            '[CircuitBreaker] circuit fully recovered'
        );
    }

    /**
     * Returns current state.
     *
     * Automatically moves OPEN -> HALF_OPEN
     * when cooldown period expires.
     */
    get state() {
        if (
            this._state === CircuitState.OPEN &&
            this._cooldownElapsed()
        ) {
            this._transitionTo(CircuitState.HALF_OPEN);
        }

        return this._state;
    }

    /**
     * Determines whether a request should be allowed.
     *
     * @returns {boolean}
     */
    allowRequest() {
        const currentState = this.state;

        if (currentState === CircuitState.CLOSED) {
            return true;
        }

        if (currentState === CircuitState.HALF_OPEN) {
            if (
                this._halfOpenAttempts <
                this.halfOpenMaxAttempts
            ) {
                this._halfOpenAttempts++;

                this.logger.info(
                    '[CircuitBreaker] half-open probe allowed',
                    {
                        attempt: this._halfOpenAttempts,
                        maxAttempts: this.halfOpenMaxAttempts
                    }
                );

                return true;
            }

            this.logger.warn(
                '[CircuitBreaker] half-open probe limit reached'
            );

            return false;
        }

        this.logger.warn(
            '[CircuitBreaker] request rejected because circuit is open'
        );

        return false;
    }

    /**
     * Records successful execution.
     */
    onSuccess() {
        if (this._state === CircuitState.HALF_OPEN) {
            this._halfOpenSuccesses++;

            this.logger.info(
                '[CircuitBreaker] half-open success',
                {
                    successes: this._halfOpenSuccesses,
                    required: this.halfOpenMaxAttempts
                }
            );

            if (
                this._halfOpenSuccesses >=
                this.halfOpenMaxAttempts
            ) {
                this._reset();
            }

            return;
        }

        if (this._failures > 0) {
            this.logger.info(
                '[CircuitBreaker] clearing failure counter'
            );

            this._failures = 0;
        }
    }

    /**
     * Records failed execution.
     */
    onFailure() {
        if (this._state === CircuitState.HALF_OPEN) {
            this.logger.warn(
                '[CircuitBreaker] probe failed, reopening circuit'
            );

            this._openCircuit();

            return;
        }

        this._failures++;
        this._lastFailureTime = Date.now();

        this.logger.error(
            '[CircuitBreaker] execution failure',
            {
                failures: this._failures,
                threshold: this.failureThreshold
            }
        );

        if (this._failures >= this.failureThreshold) {
            this._openCircuit();
        }
    }

    /**
     * Exposes internal metrics for monitoring,
     * dashboards and debugging.
     */
    snapshot() {
        return {
            state: this.state,
            failures: this._failures,
            lastFailureTime: this._lastFailureTime,
            halfOpenAttempts: this._halfOpenAttempts,
            halfOpenSuccesses: this._halfOpenSuccesses,
            cooldownMs: this.cooldownMs,
            failureThreshold: this.failureThreshold,
            timestamp: Date.now()
        };
    }
}