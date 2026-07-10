import mongoose from "mongoose";

/**
 * Client Schema
 *
 * Represents an organization/business using the API Monitoring Platform.
 *
 * A Client acts as a tenant in the multi-tenant architecture.
 * Each client can have:
 * - Multiple users
 * - Multiple API keys
 * - API monitoring data
 * - Custom platform settings
 */
const clientSchema = new mongoose.Schema(
    {
        /**
         * Organization name.
         */
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },

        /**
         * Unique URL-friendly identifier.
         *
         * Examples:
         * acme-corp
         * google-india
         * startup-xyz
         */
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: /^[a-z0-9-]+$/,
        },

        /**
         * Primary contact email for the organization.
         */
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,

            validate: {
                validator: function (email) {
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                },
                message: "Please enter a valid email address.",
            },
        },

        /**
         * Optional client description.
         */
        description: {
            type: String,
            maxlength: 500,
            default: "",
        },

        /**
         * Official organization website.
         */
        website: {
            type: String,
            default: "",

            validate: {
                validator: function (url) {
                    if (!url) return true;

                    try {
                        new URL(url);
                        return true;
                    } catch {
                        return false;
                    }
                },
                message: "Please enter a valid website URL.",
            },
        },

        /**
         * User who created this client.
         *
         * Typically a super_admin.
         */
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        /**
         * Soft activation flag.
         *
         * Inactive clients cannot access platform resources.
         */
        isActive: {
            type: Boolean,
            default: true,
        },

        /**
         * Client-specific platform configuration.
         */
        settings: {
            /**
             * Number of days monitoring data should be retained.
             */
            dataRetentionDays: {
                type: Number,
                default: 30,
                min: 7,
                max: 365,
            },

            /**
             * Enables/disables alert generation.
             */
            alertsEnabled: {
                type: Boolean,
                default: true,
            },

            /**
             * Client timezone used for dashboards,
             * reports, and alert scheduling.
             */
            timezone: {
                type: String,
                default: "UTC",
            },
        },
    },
    {
        timestamps: true,
        collection: "clients",
    }
);

/**
 * Indexes
 *
 * Optimized for:
 * - Active client filtering
 * - Client lookup by slug
 * - Contact email searches
 */
clientSchema.index({
    isActive: 1,
});

clientSchema.index({
    email: 1,
});

clientSchema.index({
    slug: 1,
    isActive: 1,
});

/**
 * Create Client model.
 */
const Client = mongoose.model("Client", clientSchema);

export default Client;