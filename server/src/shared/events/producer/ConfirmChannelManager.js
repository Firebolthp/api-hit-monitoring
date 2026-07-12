/**
 * ConfirmChannelManager
 *
 * Maintains exactly one RabbitMQ confirm channel.
 *
 * Responsibilities:
 * - Lazily create a confirm channel when needed
 * - Reuse existing healthy channel
 * - Automatically invalidate channel on close/error
 * - Prevent concurrent channel creation
 * - Wake all waiting callers once channel becomes available
 *
 * The manager itself does NOT reconnect RabbitMQ.
 * It relies on the RabbitMQ connection manager to maintain
 * a healthy AMQP connection.
 */

import { EventEmitter } from 'node:events';

export class ConfirmChannelManager extends EventEmitter {
    /**
     * @param {Object} options
     * @param {Object} options.rabbitmq RabbitMQ connection manager
     * @param {Object} [options.logger]
     */
    constructor({ rabbitmq, logger }) {
        super();

        if (!rabbitmq) {
            throw new Error(
                'ConfirmChannelManager requires a RabbitMQ connection manager'
            );
        }

        this._rabbitmq = rabbitmq;
        this._logger = logger ?? console;

        this._channel = null;

        /**
         * Prevents parallel channel creation.
         */
        this._connecting = false;

        /**
         * Callers waiting for channel creation.
         *
         * [{ resolve, reject }]
         */
        this._connectWaiters = [];
    }

    /**
     * Returns a healthy confirm channel.
     *
     * If one already exists it is reused.
     * If channel creation is already in progress,
     * waits for the existing creation attempt.
     *
     * @returns {Promise<any>}
     */
    async getChannel() {
        if (this._channel) {
            return this._channel;
        }

        if (this._connecting) {
            return new Promise((resolve, reject) => {
                this._connectWaiters.push({
                    resolve,
                    reject
                });
            });
        }

        return this._connect();
    }

    /**
     * Safely invalidate current channel.
     *
     * Protects against stale channel events
     * affecting a newer channel instance.
     *
     * @param {Object} channel
     * @private
     */
    _invalidateChannel(channel) {
        if (this._channel === channel) {
            this._channel = null;
        }
    }

    /**
     * Creates a new RabbitMQ confirm channel.
     *
     * @returns {Promise<any>}
     * @private
     */
    async _connect() {
        this._connecting = true;

        try {
            let connection;

            /**
             * Reuse existing connection if available.
             */
            if (this._rabbitmq.connection) {
                connection = this._rabbitmq.connection;
            } else {
                await this._rabbitmq.connect();

                if (!this._rabbitmq.connection) {
                    throw new Error(
                        'Failed to obtain RabbitMQ connection'
                    );
                }

                connection = this._rabbitmq.connection;
            }

            /**
             * Confirm channels guarantee broker ACK/NACK
             * for published messages.
             */
            const channel =
                await connection.createConfirmChannel();

            /**
             * Triggered when broker write buffer
             * becomes writable again.
             */
            channel.on('drain', () => {
                this.emit('drain');
            });

            /**
             * Channel closed.
             */
            channel.on('close', () => {
                this._logger.warn(
                    '[ChannelManager] confirm channel closed'
                );

                this._invalidateChannel(channel);
            });

            /**
             * Channel error.
             */
            channel.on('error', (err) => {
                this._logger.error(
                    '[ChannelManager] confirm channel error',
                    {
                        message: err.message,
                        code: err.code,
                        stack: err.stack
                    }
                );

                this._invalidateChannel(channel);

                this.emit('error', err);
            });

            this._channel = channel;

            this._logger.info(
                '[ChannelManager] confirm channel ready'
            );

            /**
             * Resolve all callers waiting for channel creation.
             */
            for (const waiter of this._connectWaiters) {
                waiter.resolve(channel);
            }

            this._connectWaiters = [];

            return channel;
        } catch (error) {
            this._logger.error(
                '[ChannelManager] failed to create confirm channel',
                {
                    message: error.message,
                    stack: error.stack
                }
            );

            for (const waiter of this._connectWaiters) {
                waiter.reject(error);
            }

            this._connectWaiters = [];

            throw error;
        } finally {
            this._connecting = false;
        }
    }

    /**
     * Returns current manager health information.
     *
     * Useful for diagnostics and monitoring.
     */
    snapshot() {
        return {
            hasChannel: !!this._channel,
            connecting: this._connecting,
            waitingRequests: this._connectWaiters.length,
            timestamp: Date.now()
        };
    }
}