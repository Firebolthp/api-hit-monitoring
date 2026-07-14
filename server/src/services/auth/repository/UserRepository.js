import BaseRepository from "./BaseRepository.js";
import User from "../../../shared/models/User.js";
import logger from "../../../shared/config/logger.js";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.js";

/**
 * MongoDB implementation of the UserRepository.
 *
 * Handles all user-related database operations.
 */
class MongoUserRepository extends BaseRepository {
    constructor() {
        super(User);
    }

    /**
     * Creates a new user.
     *
     * Automatically assigns full permissions
     * to Super Admin accounts when permissions
     * are not explicitly provided.
     *
     * @param {Object} userData
     * @returns {Promise<Object>}
     */
    async create(userData) {
        try {
            const data = { ...userData };

            if (
                data.role === APPLICATION_ROLES.SUPER_ADMIN &&
                !data.permissions
            ) {
                data.permissions = {
                    canCreateApiKeys: true,
                    canManageUsers: true,
                    canViewAnalytics: true,
                    canExportData: true
                };
            }

            const user = new this.model(data);

            await user.save();

            logger.info("User created successfully", {
                username: user.username,
                role: user.role
            });

            return user;
        } catch (error) {
            logger.error("Error creating user", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Finds a user by ID.
     *
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async findById(userId) {
        try {
            return await this.model.findById(userId);
        } catch (error) {
            logger.error("Error finding user by ID", {
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Finds a user by username.
     *
     * @param {string} username
     * @returns {Promise<Object|null>}
     */
    async findByUsername(username) {
        try {
            return await this.model.findOne({ username });
        } catch (error) {
            logger.error("Error finding user by username", {
                username,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Finds a user by email.
     *
     * @param {string} email
     * @returns {Promise<Object|null>}
     */
    async findByEmail(email) {
        try {
            return await this.model.findOne({ email });
        } catch (error) {
            logger.error("Error finding user by email", {
                email,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Retrieves all active users.
     *
     * Passwords are excluded from the result.
     *
     * @returns {Promise<Array>}
     */
    async findAll() {
        try {
            const users = await this.model
                .find({ isActive: true })
                .select("-password");

            return users;
        } catch (error) {
            logger.error("Error finding all users", {
                error: error.message
            });

            throw error;
        }
    }
}

export default new MongoUserRepository();