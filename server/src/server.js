import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import config from './shared/config/index.js';
import logger from './shared/config/logger.js';
import mongodb from './shared/config/mongodb.js';
import postgres from './shared/config/postgres.js';
import rabbitmq from './shared/config/rabbitmq.js';

import errorHandler from './shared/middlewares/errorHandler.js';
import ResponseFormatter from './shared/utils/responseFormatter.js';

// Routers
import authRouter from './services/auth/routes/authRouter.js';
import clientRouter from './services/client/routes/clientRoutes.js';
import ingestRouter from './services/ingest/routes/ingestRoutes.js';
import analyticsRouter from './services/analytics/routes/analyticsRoutes.js';

/**
 * ============================================================
 * API Hit Monitoring System
 * ============================================================
 *
 * Application Entry Point
 *
 * Responsibilities:
 * - Initialize Express application
 * - Register global middlewares
 * - Register application routes
 * - Establish infrastructure connections
 *   - MongoDB
 *   - PostgreSQL
 *   - RabbitMQ
 * - Configure graceful shutdown
 * - Handle process-level failures
 *
 * Future Scope:
 * - API versioning (/api/v1)
 * - Request rate limiting
 * - Redis caching
 * - OpenTelemetry tracing
 * - Prometheus/Grafana metrics
 * - Swagger/OpenAPI documentation
 * - Kubernetes readiness/liveness probes
 * - Centralized audit logging
 * ============================================================
 */

/**
 * Initialize Express application.
 */
const app = express();

/**
 * Required when application is deployed behind:
 * - Nginx
 * - AWS Load Balancer
 * - Render
 * - Railway
 * - Reverse proxies
 */
app.set('trust proxy', 1);

/**
 * ============================================================
 * Global Middlewares
 * ============================================================
 */

/**
 * Security headers.
 */
app.use(helmet());

/**
 * Cross-Origin Resource Sharing.
 */
app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

/**
 * Parse cookies.
 */
app.use(cookieParser());

/**
 * Parse incoming JSON payloads.
 *
 * Limit added to protect against
 * excessively large request bodies.
 */
app.use(
    express.json({
        limit: '1mb',
    })
);

/**
 * Parse URL encoded payloads.
 */
app.use(
    express.urlencoded({
        extended: true,
        limit: '1mb',
    })
);

/**
 * ============================================================
 * Request Logger Middleware
 * ============================================================
 *
 * Logs:
 * - HTTP Method
 * - Route
 * - IP Address
 * - User Agent
 * - Response Time
 *
 * Future Scope:
 * - Request IDs
 * - Correlation IDs
 * - Distributed tracing
 */
function requestLogger(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;

        logger.info(`${req.method} ${req.originalUrl}`, {
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    });

    next();
}

app.use(requestLogger);

/**
 * ============================================================
 * Health Check Endpoint
 * ============================================================
 *
 * Used by:
 * - Load Balancers
 * - Monitoring Systems
 * - Kubernetes Health Checks
 */
app.get('/health', (req, res) => {
    res.status(200).json(
        ResponseFormatter.success(
            {
                status: 'healthy',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            },
            'Service is healthy'
        )
    );
});

/**
 * ============================================================
 * Root Endpoint
 * ============================================================
 */
app.get('/', (req, res) => {
    res.status(200).json(
        ResponseFormatter.success(
            {
                service: 'API Hit Monitoring System',
                version: '1.0.0',
                endpoints: {
                    health: '/health',
                    auth: '/api/auth',
                    ingest: '/api/hit',
                    analytics: '/api/analytics',
                },
            },
            'API Hit Monitoring Service'
        )
    );
});

/**
 * ============================================================
 * Application Routes
 * ============================================================
 */
app.use('/api/auth', authRouter);
app.use('/api/hit', ingestRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api', clientRouter);

/**
 * ============================================================
 * 404 Handler
 * ============================================================
 */
app.use((req, res) => {
    res.status(404).json(
        ResponseFormatter.error(
            'Endpoint not found',
            404
        )
    );
});

/**
 * Global Error Handler
 */
app.use(errorHandler);

/**
 * ============================================================
 * Infrastructure Initialization
 * ============================================================
 *
 * Establishes all external service connections
 * before the HTTP server starts accepting traffic.
 *
 * Future Scope:
 * - Redis Connection
 * - Kafka Connection
 * - Elasticsearch Connection
 */
async function initializeConnections() {
    try {
        logger.info('Initializing infrastructure connections...');

        await mongodb.connect();
        await postgres.testConnection();
        await rabbitmq.connect();

        logger.info(
            'All infrastructure connections established successfully'
        );
    } catch (error) {
        logger.error(
            'Failed to initialize infrastructure connections',
            {
                error: error.message,
                stack: error.stack,
            }
        );

        throw error;
    }
}

/**
 * Prevent multiple shutdown executions.
 */
let isShuttingDown = false;

/**
 * ============================================================
 * Graceful Shutdown
 * ============================================================
 *
 * Ensures:
 * - No new requests are accepted
 * - Existing requests complete
 * - Database connections close cleanly
 * - RabbitMQ channels close properly
 *
 * Future Scope:
 * - Close Redis Connections
 * - Stop Background Workers
 * - Flush Metrics Buffers
 */
async function gracefulShutdown(signal, server) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(async () => {
        logger.info('HTTP server closed');

        try {
            await mongodb.disconnect();
            await postgres.close();
            await rabbitmq.close();

            logger.info(
                'All resources released successfully'
            );

            process.exit(0);
        } catch (error) {
            logger.error(
                'Error occurred during shutdown',
                {
                    error: error.message,
                    stack: error.stack,
                }
            );

            process.exit(1);
        }
    });

    /**
     * Force shutdown after timeout.
     */
    setTimeout(() => {
        logger.error(
            'Graceful shutdown timeout exceeded. Forcing exit.'
        );

        process.exit(1);
    }, 10000);
}

/**
 * ============================================================
 * Server Bootstrap
 * ============================================================
 */
async function startServer() {
    try {
        await initializeConnections();

        const server = app.listen(config.port, () => {
            logger.info('Server started successfully', {
                port: config.port,
                environment: config.node_env,
                pid: process.pid,
                nodeVersion: process.version,
                url: `http://localhost:${config.port}`,
            });
        });

        /**
         * Process Signals
         */
        process.on('SIGTERM', () =>
            gracefulShutdown('SIGTERM', server)
        );

        process.on('SIGINT', () =>
            gracefulShutdown('SIGINT', server)
        );

        /**
         * Uncaught Exceptions
         *
         * Indicates programming errors
         * that escaped application control.
         */
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', {
                error: error.message,
                stack: error.stack,
            });

            gracefulShutdown(
                'uncaughtException',
                server
            );
        });

        /**
         * Unhandled Promise Rejections
         */
        process.on(
            'unhandledRejection',
            (reason) => {
                logger.error(
                    'Unhandled Promise Rejection',
                    {
                        reason:
                            reason instanceof Error
                                ? reason.message
                                : reason,
                        stack:
                            reason instanceof Error
                                ? reason.stack
                                : undefined,
                    }
                );

                gracefulShutdown(
                    'unhandledRejection',
                    server
                );
            }
        );
    } catch (error) {
        logger.error('Failed to start server', {
            error: error.message,
            stack: error.stack,
        });

        process.exit(1);
    }
}

startServer();
