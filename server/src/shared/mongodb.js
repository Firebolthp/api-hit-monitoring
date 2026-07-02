import mongoose from "mongoose";
import config from "./index.js";
import logger from "./logger.js";

/**
 * MongoDB Connection Manager (Singleton)
 *
 * Maintains a single shared MongoDB connection
 * across the entire application.
 */
class MongoConnection {
    constructor() {
        this.connection = null;
    }

    /**
     * Establish a MongoDB connection.
     * Reuses the existing connection if already connected.
     *
     * @returns {Promise<mongoose.Connection>}
     */
    async connect() {
        try {
            if (this.connection) {
                logger.debug("MongoDB connection already established.");
                return this.connection;
            }

            await mongoose.connect(config.mongo.uri, {
                dbName: config.mongo.dbName,
            });

            this.connection = mongoose.connection;

            logger.info(
                "MongoDB connected successfully. Database: %s",
                config.mongo.dbName
            );

            this.connection.on("error", (error) => {
                logger.error(
                    "MongoDB connection error: %s",
                    error.message
                );
            });

            this.connection.on("disconnected", () => {
                logger.warn("MongoDB disconnected.");
            });

            this.connection.on("reconnected", () => {
                logger.info("MongoDB reconnected.");
            });

            return this.connection;
        } catch (error) {
            logger.error(
                "Failed to connect to MongoDB: %s",
                error.message
            );

            throw error;
        }
    }

    /**
     * Gracefully close the active MongoDB connection.
     */
    async disconnect() {
        try {
            if (!this.connection) {
                return;
            }

            await mongoose.disconnect();

            this.connection = null;

            logger.info("MongoDB connection closed.");
        } catch (error) {
            logger.error(
                "Failed to disconnect MongoDB: %s",
                error.message
            );

            throw error;
        }
    }

    /**
     * Returns the active MongoDB connection instance.
     *
     * @returns {mongoose.Connection|null}
     */
    getConnection() {
        return this.connection;
    }

    /**
     * Indicates whether MongoDB is currently connected.
     *
     * @returns {boolean}
     */
    isConnected() {
        return mongoose.connection.readyState === 1;
    }
}

export default new MongoConnection();