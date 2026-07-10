import mongoose from "mongoose";
import SecurityUtils from "../utils/SecurityUtils.js";

/**
 * API Key Schema
 *
 * Represents credentials used by client applications
 * to authenticate and send monitoring data into the platform.
 *
 * Each API key belongs to exactly one client (tenant)
 * and can have its own permissions, environment,
 * expiration policy, and security restrictions.
 */
const apiKeySchema = new mongoose.Schema(
    {
        /**
         * Public identifier used internally for lookup.
         *
         * Example:
         * akid_123abc456def
         */
        keyId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        /**
         * API secret key used for authentication.
         *
         * NOTE:
         * Currently stored as plain value.
         * Production systems typically store
         * only a hashed version.
         */
        keyValue: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        /**
         * Owning client/tenant.
         */
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true,
            index: true,
        },

        /**
         * Human-readable name.
         *
         * Example:
         * Production Backend Key
         * Payment Service Key
         */
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },

        /**
         * Optional description.
         */
        description: {
            type: String,
            maxlength: 500,
            default: "",
        },

        /**
         * Deployment environment.
         */
        environment: {
            type: String,
            enum: [
                "production",
                "staging",
                "development",
                "testing",
            ],
            default: "production",
        },

        /**
         * Soft enable/disable flag.
         */
        isActive: {
            type: Boolean,
            default: true,
        },

        /**
         * Permission controls.
         */
        permissions: {
            canIngest: {
                type: Boolean,
                default: true,
            },

            canReadAnalytics: {
                type: Boolean,
                default: false,
            },

            /**
             * Restrict key usage to specific services.
             */
            allowedServices: [
                {
                    type: String,
                    trim: true,
                },
            ],
        },

        /**
         * Security restrictions.
         */
        security: {
            /**
             * Allowed source IPs/CIDR ranges.
             */
            allowedIPs: [
                {
                    type: String,

                    validate: {
                        validator: function (value) {
                            return (
                                /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(
                                    value
                                ) ||
                                value === "0.0.0.0/0"
                            );
                        },

                        message:
                            "Invalid IP address format.",
                    },
                },
            ],

            /**
             * Allowed request origins.
             */
            allowedOrigins: [
                {
                    type: String,

                    validate: {
                        validator: function (value) {
                            return (
                                /^https?:\/\/[^\s]+$/.test(
                                    value
                                ) || value === "*"
                            );
                        },

                        message:
                            "Invalid origin format.",
                    },
                },
            ],

            /**
             * Last successful key rotation timestamp.
             */
            lastRotated: {
                type: Date,
                default: Date.now,
            },

            /**
             * Number of days before expiry
             * to start generating warnings.
             */
            rotationWarningDays: {
                type: Number,
                default: 30,
                min: 1,
                max: 365,
            },
        },

        /**
         * Automatic expiration timestamp.
         *
         * Expired documents are automatically
         * removed by MongoDB TTL index.
         */
        expiresAt: {
            type: Date,

            default: () => {
                const days = parseInt(
                    process.env.API_KEY_EXPIRY_DAYS || "365"
                );

                return new Date(
                    Date.now() +
                    days * 24 * 60 * 60 * 1000
                );
            },

            index: true,
        },

        /**
         * Additional metadata.
         */
        metadata: {
            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },

            purpose: {
                type: String,
                trim: true,
                maxlength: 200,
            },

            tags: [
                {
                    type: String,
                    trim: true,
                    maxlength: 50,
                },
            ],
        },

        /**
         * User who created this key.
         */
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
        collection: "api_keys",
    }
);

/**
 * Query optimization indexes.
 */
apiKeySchema.index({
    clientId: 1,
    isActive: 1,
});

apiKeySchema.index({
    keyValue: 1,
    isActive: 1,
});

apiKeySchema.index({
    environment: 1,
    clientId: 1,
});

apiKeySchema.index({
    "metadata.createdBy": 1,
});

apiKeySchema.index(
    {
        expiresAt: 1,
    },
    {
        expireAfterSeconds: 0,
    }
);

/**
 * Check whether the API key has expired.
 *
 * @returns {boolean}
 */
apiKeySchema.methods.isExpired =
    function () {
        if (!this.expiresAt) {
            return false;
        }

        return (
            new Date(this.expiresAt) <
            new Date()
        );
    };

/**
 * Check whether the key is currently usable.
 *
 * @returns {boolean}
 */
apiKeySchema.methods.isActiveKey =
    function () {
        return (
            this.isActive &&
            !this.isExpired()
        );
    };

/**
 * Determine whether key rotation warning
 * should be triggered.
 *
 * @returns {boolean}
 */
apiKeySchema.methods.needsRotation =
    function () {
        if (!this.expiresAt) {
            return false;
        }

        const warningDate = new Date(
            this.expiresAt
        );

        warningDate.setDate(
            warningDate.getDate() -
            this.security.rotationWarningDays
        );

        return new Date() >= warningDate;
    };

const ApiKey = mongoose.model(
    "ApiKey",
    apiKeySchema
);

export default ApiKey;