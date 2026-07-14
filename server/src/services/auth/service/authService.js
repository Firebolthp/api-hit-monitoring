import config from "../../../shared/config/index.js";
import AppError from "../../../shared/utils/AppError.js";
import jwt from "jsonwebtoken";
import logger from "../../../shared/config/logger.js";
import bcrypt from "bcryptjs";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.js";

/**
 * AuthService
 *
 * Handles authentication and authorization related business logic:
 * - Initial super admin onboarding
 * - User registration
 * - User login
 * - Profile retrieval
 * - Role verification
 */
export class AuthService {
    constructor(userRepository) {
        if (!userRepository) {
            throw new Error("UserRepository is required");
        }

        this.userRepository = userRepository;
    }

    /**
     * Generates a JWT token for an authenticated user.
     *
     * @param {Object} user
     * @returns {string}
     */
    generateToken(user) {
        const { _id, email, username, role, clientId } = user;

        const payload = {
            userId: _id,
            username,
            email,
            role,
            clientId
        };

        return jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn
        });
    }

    /**
     * Removes sensitive fields before sending user data in API responses.
     *
     * @param {Object} user
     * @returns {Object}
     */
    formatUserForResponse(user) {
        const userObj = user.toObject ? user.toObject() : { ...user };

        delete userObj.password;

        return userObj;
    }

    /**
     * Compares a plain-text password against a hashed password.
     *
     * @param {string} userEnteredPassword
     * @param {string} hashedPassword
     * @returns {Promise<boolean>}
     */
    async comparePassword(userEnteredPassword, hashedPassword) {
        return bcrypt.compare(userEnteredPassword, hashedPassword);
    }

    /**
     * Creates the first Super Admin in the system.
     *
     * This operation is allowed only once.
     *
     * @param {Object} superAdminData
     * @returns {Promise<Object>}
     */
    async onboardSuperAdmin(superAdminData) {
        try {
            const existingUsers = await this.userRepository.findAll();

            if (existingUsers && existingUsers.length > 0) {
                throw new AppError(
                    "Super admin onboarding is disabled",
                    403
                );
            }

            const user = await this.userRepository.create(superAdminData);
            const token = this.generateToken(user);

            logger.info("Super admin onboarded successfully", {
                username: user.username,
                role: user.role
            });

            return {
                user: this.formatUserForResponse(user),
                token
            };
        } catch (error) {
            logger.error("Error onboarding super admin", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Registers a new user.
     *
     * @param {Object} userData
     * @returns {Promise<Object>}
     */
    async register(userData) {
        try {
            const existingUser = await this.userRepository.findByUsername(
                userData.username
            );

            if (existingUser) {
                throw new AppError("Username already exists", 409);
            }

            const existingEmail = await this.userRepository.findByEmail(
                userData.email
            );

            if (existingEmail) {
                throw new AppError("Email already exists", 409);
            }

            const user = await this.userRepository.create(userData);
            const token = this.generateToken(user);

            logger.info("User registered successfully", {
                username: user.username,
                role: user.role
            });

            return {
                user: this.formatUserForResponse(user),
                token
            };
        } catch (error) {
            logger.error("Error in register service", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Authenticates a user and returns a JWT token.
     *
     * @param {string} username
     * @param {string} password
     * @returns {Promise<Object>}
     */
    async login(username, password) {
        try {
            const user = await this.userRepository.findByUsername(username);

            if (!user) {
                throw new AppError("Invalid credentials", 401);
            }

            if (!user.isActive) {
                throw new AppError("Account is deactivated", 403);
            }

            const isPasswordValid = await this.comparePassword(
                password,
                user.password
            );

            if (!isPasswordValid) {
                throw new AppError("Invalid credentials", 401);
            }

            const token = this.generateToken(user);

            logger.info("User logged in successfully", {
                username: user.username,
                role: user.role
            });

            return {
                user: this.formatUserForResponse(user),
                token
            };
        } catch (error) {
            logger.error("Error in login service", {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Retrieves a user's profile by ID.
     *
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getProfile(userId) {
        try {
            const user = await this.userRepository.findById(userId);

            if (!user) {
                throw new AppError("User not found", 404);
            }

            return this.formatUserForResponse(user);
        } catch (error) {
            logger.error("Error getting user profile", {
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Checks whether a user has Super Admin privileges.
     *
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async checkSuperAdminPermissions(userId) {
        try {
            const user = await this.userRepository.findById(userId);

            if (!user) {
                throw new AppError("User not found", 404);
            }

            return user.role === APPLICATION_ROLES.SUPER_ADMIN;
        } catch (error) {
            logger.error("Error checking super admin permissions", {
                userId,
                error: error.message
            });

            throw error;
        }
    }
}