import logger from "../../../shared/config/logger.js";
import {
    APPLICATION_ROLES,
    isValidClientRole
} from "../../../shared/constants/roles.js";
import AppError from "../../../shared/utils/AppError.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

/**
 * ClientService
 *
 * Handles business logic related to:
 * - Client onboarding
 * - Client user management
 * - API key management
 * - Client access validation
 */
export class ClientService {
    constructor(dependencies) {
        if (!dependencies) {
            throw new Error("Dependencies are required");
        }

        if (!dependencies.clientRepository) {
            throw new Error("ClientRepository is required");
        }

        if (!dependencies.apiKeyRepository) {
            throw new Error("ApiKeyRepository is required");
        }

        if (!dependencies.userRepository) {
            throw new Error("UserRepository is required");
        }

        this.clientRepository = dependencies.clientRepository;
        this.apiKeyRepository = dependencies.apiKeyRepository;
        this.userRepository = dependencies.userRepository;
    }

    /**
     * Removes sensitive fields before returning user data.
     *
     * @param {Object} user
     * @returns {Object}
     */
    formatClientForResponse(user) {
        const userObj = user.toObject ? user.toObject() : { ...user };

        delete userObj.password;

        return userObj;
    }

    /**
     * Generates a URL-friendly slug from a client name.
     *
     * @param {string} name
     * @returns {string}
     */
    generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim();
    }

    /**
     * Creates a new client.
     *
     * Only Super Admins should be allowed to create clients.
     *
     * @param {Object} clientData
     * @param {Object} adminUser
     * @returns {Promise<Object>}
     */
    async createClient(clientData, adminUser) {
        try {
            if (adminUser.role !== APPLICATION_ROLES.SUPER_ADMIN) {
                throw new AppError(
                    "Only Super Admin can create clients",
                    403
                );
            }

            const {
                name,
                email,
                description,
                website
            } = clientData;

            const slug = this.generateSlug(name);

            const existingClient =
                await this.clientRepository.findBySlug(slug);

            if (existingClient) {
                throw new AppError(
                    `Client with slug ${slug} already exists`,
                    409
                );
            }

            const client = await this.clientRepository.create({
                name,
                slug,
                email,
                description,
                website,
                createdBy: adminUser.userId
            });

            logger.info("Client created successfully", {
                clientId: client._id,
                slug: client.slug,
                createdBy: adminUser.userId
            });

            return client;
        } catch (error) {
            logger.error("Error creating client", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Checks whether a user can access a specific client.
     *
     * Super Admins can access all clients.
     *
     * @param {Object} user
     * @param {string} clientId
     * @returns {boolean}
     */
    canUserAccessClient(user, clientId) {
        if (user.role === APPLICATION_ROLES.SUPER_ADMIN) {
            return true;
        }

        return (
            user.clientId &&
            user.clientId.toString() === clientId.toString()
        );
    }

    /**
     * Creates a user under a client.
     *
     * @param {string} clientId
     * @param {Object} userData
     * @param {Object} adminUser
     * @returns {Promise<Object>}
     */
    async createClientUser(clientId, userData, adminUser) {
        try {
            if (!this.canUserAccessClient(adminUser, clientId)) {
                throw new AppError("Access denied", 403);
            }

            const {
                username,
                email,
                password,
                role = APPLICATION_ROLES.CLIENT_VIEWER
            } = userData;

            if (!isValidClientRole(role)) {
                throw new AppError(
                    "Invalid role for client user",
                    400
                );
            }

            const existingUser =
                await this.userRepository.findByUsername(username);

            if (existingUser) {
                throw new AppError(
                    "Username already exists",
                    409
                );
            }

            const existingEmail =
                await this.userRepository.findByEmail(email);

            if (existingEmail) {
                throw new AppError(
                    "Email already exists",
                    409
                );
            }

            const client =
                await this.clientRepository.findById(clientId);

            if (!client) {
                throw new AppError("Client not found", 404);
            }

            let permissions = {
                canCreateApiKeys: false,
                canManageUsers: false,
                canViewAnalytics: true,
                canExportData: false
            };

            if (role === APPLICATION_ROLES.CLIENT_ADMIN) {
                permissions = {
                    canCreateApiKeys: true,
                    canManageUsers: true,
                    canViewAnalytics: true,
                    canExportData: true
                };
            }

            const user = await this.userRepository.create({
                username,
                email,
                password,
                role,
                clientId,
                permissions
            });

            logger.info("Client user created successfully", {
                clientId,
                userId: user._id,
                role
            });

            return this.formatClientForResponse(user);
        } catch (error) {
            logger.error("Error creating client user", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Generates a new API key.
     *
     * @returns {string}
     */
    generateApiKey() {
        const prefix = "apim";
        const randomBytes = crypto.randomBytes(20).toString("hex");

        return `${prefix}_${randomBytes}`;
    }

    /**
     * Creates a new API key for a client.
     *
     * @param {string} clientId
     * @param {Object} keyData
     * @param {Object} user
     * @returns {Promise<Object>}
     */
    async createApiKey(clientId, keyData, user) {
        try {
            const client =
                await this.clientRepository.findById(clientId);

            if (!client) {
                throw new AppError("Client not found", 404);
            }

            if (!this.canUserAccessClient(user, clientId)) {
                throw new AppError("Access denied", 403);
            }

            if (
                user.role !== APPLICATION_ROLES.SUPER_ADMIN &&
                user.role !== APPLICATION_ROLES.CLIENT_ADMIN
            ) {
                throw new AppError(
                    "Only Super Admin and Client Admin can create API keys",
                    403
                );
            }

            const {
                name,
                description,
                environment = "production"
            } = keyData;

            const keyId = uuidv4();
            const keyValue = this.generateApiKey();

            const apiKey = await this.apiKeyRepository.create({
                keyId,
                keyValue,
                clientId,
                name,
                description,
                environment,
                createdBy: user.userId
            });

            logger.info("API key created successfully", {
                keyId,
                clientId,
                createdBy: user.userId
            });

            return apiKey;
        } catch (error) {
            logger.error("Error creating API key", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Retrieves all API keys belonging to a client.
     *
     * API key values are removed from the response.
     *
     * @param {string} clientId
     * @param {Object} user
     * @returns {Promise<Array>}
     */
    async getClientApiKeys(clientId, user) {
        try {
            if (!this.canUserAccessClient(user, clientId)) {
                throw new AppError(
                    "Access denied to this client",
                    403
                );
            }

            const apiKeys =
                await this.apiKeyRepository.findByClientId(clientId);

            return apiKeys.map((key) => {
                const keyObj =
                    key.toObject ? key.toObject() : key;

                delete keyObj.keyValue;

                return keyObj;
            });
        } catch (error) {
            logger.error("Error getting client API keys", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Finds a client using an API key.
     *
     * Used by ingest/monitoring services.
     *
     * @param {string} apiKey
     * @returns {Promise<Object|null>}
     */
    async getClientByApiKey(apiKey) {
        try {
            const key =
                await this.apiKeyRepository.findByKeyValue(apiKey);

            if (!key) {
                return null;
            }

            if (key.isExpired()) {
                return null;
            }

            return {
                client: key.clientId,
                apiKey: key
            };
        } catch (error) {
            logger.error("Error finding client by API key", {
                error: error.message
            });

            throw error;
        }
    }
}