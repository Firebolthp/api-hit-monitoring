/**
 * ============================================================
 * Endpoint Metrics Table
 * ============================================================
 *
 * Purpose:
 * Stores aggregated API monitoring metrics generated
 * from raw API hit events stored in MongoDB.
 *
 * Data Flow:
 *
 * MongoDB (Raw Events)
 *          ↓
 * Aggregation Worker
 *          ↓
 * PostgreSQL (Analytics Storage)
 *          ↓
 * Dashboard / Reporting APIs
 *
 * Future Scope:
 * - P95 Latency
 * - P99 Latency
 * - Availability %
 * - Error Rate %
 * - Requests Per Minute
 * - Requests Per Second
 * - Service Health Scoring
 * ============================================================
 */

CREATE TABLE IF NOT EXISTS endpoint_metrics (
    id SERIAL PRIMARY KEY,

    /**
     * Client/Tenant Identifier
     */
    client_id VARCHAR(24) NOT NULL,

    /**
     * Service generating traffic.
     *
     * Example:
     * auth-service
     * payment-service
     */
    service_name VARCHAR(255) NOT NULL,

    /**
     * API Endpoint.
     *
     * Example:
     * /api/v1/login
     */
    endpoint VARCHAR(500) NOT NULL,

    /**
     * HTTP Method.
     */
    method VARCHAR(10) NOT NULL,

    /**
     * Aggregation bucket.
     *
     * Example:
     * 10:25 → 10:00 bucket
     * 10:55 → 10:00 bucket
     */
    time_bucket TIMESTAMP NOT NULL,

    /**
     * Total requests received.
     */
    total_hits BIGINT NOT NULL DEFAULT 0,

    /**
     * Total failed requests.
     */
    error_hits BIGINT NOT NULL DEFAULT 0,

    /**
     * Average latency (milliseconds).
     */
    avg_latency NUMERIC(10,3) NOT NULL DEFAULT 0.000,

    /**
     * Minimum latency observed.
     */
    min_latency NUMERIC(10,3) NOT NULL DEFAULT 0.000,

    /**
     * Maximum latency observed.
     */
    max_latency NUMERIC(10,3) NOT NULL DEFAULT 0.000,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    /**
     * Prevent duplicate metric rows
     * for the same aggregation bucket.
     */
    UNIQUE (
        client_id,
        service_name,
        endpoint,
        method,
        time_bucket
    ),

    /**
     * Data integrity constraints.
     */
    CHECK (total_hits >= 0),
    CHECK (error_hits >= 0),
    CHECK (avg_latency >= 0),
    CHECK (min_latency >= 0),
    CHECK (max_latency >= 0)
);

/**
 * ============================================================
 * Query Optimization Indexes
 * ============================================================
 */

/**
 * Client level analytics.
 */
CREATE INDEX IF NOT EXISTS idx_endpoint_metrics_client_id
ON endpoint_metrics(client_id);

/**
 * Service level analytics.
 */
CREATE INDEX IF NOT EXISTS idx_endpoint_metrics_service
ON endpoint_metrics(client_id, service_name);

/**
 * Time-series analytics.
 */
CREATE INDEX IF NOT EXISTS idx_endpoint_metrics_time
ON endpoint_metrics(time_bucket);

/**
 * Endpoint analytics.
 */
CREATE INDEX IF NOT EXISTS idx_endpoint_metrics_endpoint
ON endpoint_metrics(
    client_id,
    service_name,
    endpoint
);

/**
 * Most common dashboard query pattern:
 *
 * WHERE client_id = ?
 * AND time_bucket BETWEEN ? AND ?
 */
CREATE INDEX IF NOT EXISTS idx_endpoint_metrics_client_time
ON endpoint_metrics(
    client_id,
    time_bucket
);

/**
 * ============================================================
 * Auto-update updated_at Timestamp
 * ============================================================
 */

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/**
 * Recreate trigger safely.
 */
DROP TRIGGER IF EXISTS update_endpoint_metrics_updated_at
ON endpoint_metrics;

CREATE TRIGGER update_endpoint_metrics_updated_at
BEFORE UPDATE
ON endpoint_metrics
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();