import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import SecurityUtils from "../utils/SecurityUtils.js";

/**
 * User Schema
 *
 * Represents an authenticated user within the API Monitoring System.
 * Supports:
 * - Authentication
 * - Role-Based Access Control (RBAC)
 * - Client-level multi-tenancy
 * - Granular permissions
 *
 * User Types:
 * - super_admin   : Global system administrator
 * - client_admin  : Manages a specific client account
 * - client_viewer : Read-only access to client resources
 */
const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            validate: {
                validator: function (username) {
                    return /^[a-zA-Z0-9_.-]+$/.test(username);
                },
                message:
                    "Username may only contain letters, numbers, underscores, dots, and hyphens.",
            },
        },

        email: {
            type: String,
            required: true,
            unique: true,
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
         * Password is hidden from query results by default.
         *
         * To retrieve it during authentication:
         * User.findOne({ email }).select("+password")
         */
        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false,

            validate: {
                validator: function (password) {
                    /**
                     * Skip validation if password is already hashed.
                     * Supports bcrypt hash prefixes:
                     * $2a$, $2b$, $2y$
                     */
                    const isBcryptHash =
                        /^\$2[aby]\$\d{2}\$/.test(password);

                    if (
                        this.isModified("password") &&
                        password &&
                        !isBcryptHash
                    ) {
                        const validation =
                            SecurityUtils.validatePassword(password);

                        return validation.success;
                    }

                    return true;
                },

                message: function (props) {
                    const isBcryptHash =
                        /^\$2[aby]\$\d{2}\$/.test(props.value);

                    if (!isBcryptHash) {
                        const validation =
                            SecurityUtils.validatePassword(props.value);

                        return validation.errors.join(". ");
                    }

                    return "Password validation failed.";
                },
            },
        },

        role: {
            type: String,
            enum: [
                "super_admin",
                "client_admin",
                "client_viewer",
            ],
            default: "client_viewer",
        },

        /**
         * Every non-super-admin user must belong to a client.
         */
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",

            required: function () {
                return this.role !== "super_admin";
            },
        },

        /**
         * Determines whether user access is enabled.
         */
        isActive: {
            type: Boolean,
            default: true,
        },

        /**
         * Fine-grained permission controls.
         */
        permissions: {
            canCreateApiKeys: {
                type: Boolean,
                default: false,
            },

            canManageUsers: {
                type: Boolean,
                default: false,
            },

            canViewAnalytics: {
                type: Boolean,
                default: true,
            },

            canExportData: {
                type: Boolean,
                default: false,
            },
        },
    },
    {
        timestamps: true,
        collection: "users",
    }
);

/**
 * Hash password before persisting user document.
 *
 * Runs only when password is newly created or modified.
 */
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }

    try {
        const saltRounds = 10;

        this.password = await bcrypt.hash(
            this.password,
            saltRounds
        );

        next();
    } catch (error) {
        next(error);
    }
});

/**
 * Compare a plain-text password against
 * the stored bcrypt hash.
 *
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (
    candidatePassword
) {
    return bcrypt.compare(
        candidatePassword,
        this.password
    );
};

/**
 * Indexes
 *
 * Optimized for:
 * - Client user management
 * - Authentication lookups
 * - Role filtering
 */
userSchema.index({
    clientId: 1,
    isActive: 1,
});

userSchema.index({
    email: 1,
    isActive: 1,
});

userSchema.index({
    role: 1,
});

const User = mongoose.model("User", userSchema);

export default User;