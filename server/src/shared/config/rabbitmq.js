import amqp from "amqplib";
import config from "./index.js";
import logger from "./logger.js";

/**
 * RabbitMQ Connection Manager (Singleton)
 *
 * Maintains a single RabbitMQ connection and channel
 * shared across the application.
 */
class RabbitMQConnection {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.isConnecting = false;
    }

    /**
     * Establishes a RabbitMQ connection and channel.
     * Prevents concurrent connection attempts during startup.
     *
     * @returns {Promise<amqp.Channel>}
     */
    async connect() {
        if (this.channel) {
            return this.channel;
        }

        // Prevent multiple services from creating
        // duplicate connections simultaneously.
        if (this.isConnecting) {
            await new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (!this.isConnecting) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            });

            return this.channel;
        }

        try {
            this.isConnecting = true;

            logger.info("Connecting to RabbitMQ...");

            this.connection = await amqp.connect(
                config.rabbitmq.url
            );

            this.channel =
                await this.connection.createChannel();

            /**
             * Dead Letter Queue (DLQ)
             *
             * Stores messages that cannot be processed
             * successfully after retries.
             */
            const dlqName =
                `${config.rabbitmq.queue}.dlq`;

            await this.channel.assertQueue(dlqName, {
                durable: true,
            });

            /**
             * Primary queue used for API hit events.
             * Failed messages are routed to the DLQ.
             */
            await this.channel.assertQueue(
                config.rabbitmq.queue,
                {
                    durable: true,
                    arguments: {
                        "x-dead-letter-exchange": "",
                        "x-dead-letter-routing-key":
                            dlqName,
                    },
                }
            );

            logger.info(
                "RabbitMQ connected. Queue: %s",
                config.rabbitmq.queue
            );

            this.connection.on("close", () => {
                logger.warn(
                    "RabbitMQ connection closed."
                );

                this.connection = null;
                this.channel = null;
            });

            this.connection.on("error", (error) => {
                logger.error(
                    "RabbitMQ connection error: %s",
                    error.message
                );

                this.connection = null;
                this.channel = null;
            });

            return this.channel;
        } catch (error) {
            logger.error(
                "Failed to connect to RabbitMQ: %s",
                error.message
            );

            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * Returns the active RabbitMQ channel.
     *
     * @returns {amqp.Channel|null}
     */
    getChannel() {
        return this.channel;
    }

    /**
     * Returns the current RabbitMQ connection status.
     *
     * @returns {"connected" | "closing" | "disconnected"}
     */
    getStatus() {
        if (!this.connection || !this.channel) {
            return "disconnected";
        }

        if (this.connection.closing) {
            return "closing";
        }

        return "connected";
    }

    /**
     * Gracefully closes the RabbitMQ channel
     * and underlying connection.
     */
    async close() {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }

            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }

            logger.info(
                "RabbitMQ connection closed."
            );
        } catch (error) {
            logger.error(
                "Failed to close RabbitMQ connection: %s",
                error.message
            );
        }
    }
}

export default new RabbitMQConnection();