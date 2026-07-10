import mongoose from "mongoose";

/**
 * ApiHit Schema
 *
 * Stores every API request received by the monitoring platform.
 *
 * This collection is expected to grow rapidly and serves as the
 * primary source for analytics, dashboards, reporting,
 * and monitoring insights.
 *
 * Example event:
 *
 * {
 *   serviceName: "payment-service",
 *   endpoint: "/api/v1/payments",
 *   method: "POST",
 *   statusCode: 200,
 *   latencyMs: 85
 * }
 */
const apiHitSchema = new mongoose.Schema(
    {
        /**
         * Unique identifier for the event.
         *
         * Used for deduplication and event tracing.
         */
        eventId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        /**
         * Original request timestamp generated
         * by the producer service.
         */
        timestamp: {
            type: Date,
            required: true,
            index: true,
        },

        /**
         * Service generating the request.
         *
         * Example:
         * payment-service
         * auth-service
         * notification-service
         */
        serviceName: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },

        /**
         * API route being accessed.
         *
         * Example:
         * /api/v1/orders
         * /api/v1/login
         */
        endpoint: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },

        /**
         * HTTP method used.
         */
        method: {
            type: String,
            required: true,
            enum: [
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS",
                "HEAD",
            ],
        },

        /**
         * HTTP response status code.
         */
        statusCode: {
            type: Number,
            required: true,
            min: 100,
            max: 599,
            index: true,
        },

        /**
         * Request latency in milliseconds.
         */
        latencyMs: {
            type: Number,
            required: true,
            min: 0,
        },

        /**
         * Tenant owning this request.
         */
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true,
            index: true,
        },

        /**
         * API key used for authentication.
         */
        apiKeyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiKey",
            required: true,
            index: true,
        },

        /**
         * Source IP address.
         */
        ip: {
            type: String,
            required: true,
            trim: true,
        },

        /**
         * User-Agent header.
         */
        userAgent: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        timestamps: true,
        collection: "api_hits",
    }
);

/**
 * Compound Index:
 *
 * Used for endpoint analytics and dashboard queries.
 *
 * Example:
 * "Show requests for payment-service/orders
 * within the last 24 hours"
 */
apiHitSchema.index({
    clientId: 1,
    serviceName: 1,
    endpoint: 1,
    timestamp: -1,
});

/**
 * Compound Index:
 *
 * Used for error-rate analysis.
 *
 * Example:
 * "Show all 5xx responses
 * for a client over time."
 */
apiHitSchema.index({
    clientId: 1,
    timestamp: -1,
    statusCode: 1,
});

/**
 * Compound Index:
 *
 * Used for API-key-level analytics.
 */
apiHitSchema.index({
    apiKeyId: 1,
    timestamp: -1,
});

/**
 * TTL Index
 *
 * Automatically removes records after 30 days.
 *
 * 30 days × 24 × 60 × 60
 * = 2,592,000 seconds
 */
apiHitSchema.index(
    {
        timestamp: 1,
    },
    {
        expireAfterSeconds: 2592000,
    }
);

/**
 * Check if request was successful.
 *
 * @returns {boolean}
 */
apiHitSchema.methods.isSuccess = function () {
    return this.statusCode >= 200 && this.statusCode < 300;
};

/**
 * Check if request failed due to client error.
 *
 * @returns {boolean}
 */
apiHitSchema.methods.isClientError = function () {
    return this.statusCode >= 400 && this.statusCode < 500;
};

/**
 * Check if request failed due to server error.
 *
 * @returns {boolean}
 */
apiHitSchema.methods.isServerError = function () {
    return this.statusCode >= 500;
};

const ApiHit = mongoose.model(
    "ApiHit",
    apiHitSchema
);

export default ApiHit;