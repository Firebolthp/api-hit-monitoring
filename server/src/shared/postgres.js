import pg from "pg";
import config from "./index.js";
import logger from "./logger.js";

const { Pool } = pg;

/**
 * PostgreSQL Connection Manager (Singleton)
 *
 * Maintains a single PostgreSQL connection pool
 * shared across the entire application.
 */
class PostgresConnection {
    constructor() {
        this.pool = null;
    }

    /**
     * Returns the shared PostgreSQL pool.
     * Creates the pool on first access.
     *
     * @returns {Pool}
     */
    getPool() {
        if (!this.pool) {
            this.pool = new Pool({
                host: config.postgres.host,
                port: config.postgres.port,
                database: config.postgres.database,
                user: config.postgres.user,
                password: config.postgres.password,

                // Connection Pool Configuration
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            this.pool.on("error", (error) => {
                logger.error(
                    "Unexpected PostgreSQL pool error: %s",
                    error.message
                );
            });

            logger.info("PostgreSQL connection pool initialized.");
        }

        return this.pool;
    }

    /**
     * Verifies database connectivity.
     * Useful during application startup and health checks.
     */
    async testConnection() {
        try {
            const pool = this.getPool();

            const client = await pool.connect();

            const result = await client.query(
                "SELECT NOW()"
            );

            client.release();

            logger.info(
                "PostgreSQL connection verified at %s",
                result.rows[0].now
            );
        } catch (error) {
            logger.error(
                "Failed to connect to PostgreSQL: %s",
                error.message
            );

            throw error;
        }
    }

    /**
     * Executes a SQL query using the shared pool.
     *
     * @param {string} text - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<import('pg').QueryResult>}
     */
    async query(text, params = []) {
        const pool = this.getPool();
        const start = Date.now();

        try {
            const result = await pool.query(
                text,
                params
            );

            const duration = Date.now() - start;

            logger.debug("Query executed", {
                duration,
                rows: result.rowCount,
            });

            return result;
        } catch (error) {
            logger.error(
                "PostgreSQL query failed: %s",
                error.message
            );

            throw error;
        }
    }

    /**
     * Gracefully closes the PostgreSQL pool.
     * Typically called during application shutdown.
     */
    async close() {
        if (!this.pool) {
            return;
        }

        await this.pool.end();

        this.pool = null;

        logger.info(
            "PostgreSQL connection pool closed."
        );
    }

    /**
     * Indicates whether the pool has been initialized.
     *
     * @returns {boolean}
     */
    isConnected() {
        return this.pool !== null;
    }
}

export default new PostgresConnection();