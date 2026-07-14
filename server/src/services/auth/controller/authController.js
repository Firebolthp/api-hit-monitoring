import config from "../../../shared/config/index.js";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.js";
import ResponseFormatter from "../../../shared/utils/responseFormatter.js";

/**
 * AuthController
 *
 * Handles authentication-related HTTP requests:
 * - Initial super admin onboarding
 * - User registration
 * - Login
 * - Profile retrieval
 * - Logout
 *
 * Delegates business logic to AuthService and formats responses
 * using ResponseFormatter.
 */
export class AuthController {
    constructor(authService) {
        if (!authService) {
            throw new Error("AuthService is required");
        }

        this.authService = authService;
    }

    /**
     * Creates the first Super Admin in the system.
     *
     * This endpoint should only work once during initial setup.
     *
     * @param {Request} req
     * @param {Response} res
     * @param {Function} next
     */
    async onboardSuperAdmin(req, res, next) {
        try {
            const { username, email, password } = req.body;

            const superAdminData = {
                username,
                email,
                password,
                role: APPLICATION_ROLES.SUPER_ADMIN
            };

            const { token, user } =
                await this.authService.onboardSuperAdmin(superAdminData);

            res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn
            });

            res.status(201).json(
                ResponseFormatter.success(
                    user,
                    "Super admin created successfully",
                    201
                )
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Registers a new user.
     *
     * Note:
     * Role assignment should be validated through authorization
     * rules to prevent privilege escalation.
     *
     * @param {Request} req
     * @param {Response} res
     * @param {Function} next
     */
    async register(req, res, next) {
        try {
            const { username, email, password, role } = req.body;

            const userData = {
                username,
                email,
                password,
                role: role || APPLICATION_ROLES.CLIENT_VIEWER
            };

            const { token, user } =
                await this.authService.register(userData);

            res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn
            });

            res.status(201).json(
                ResponseFormatter.success(
                    user,
                    "User created successfully",
                    201
                )
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Authenticates a user and issues a JWT token.
     *
     * @param {Request} req
     * @param {Response} res
     * @param {Function} next
     */
    async login(req, res, next) {
        try {
            const { username, password } = req.body;

            const { user, token } =
                await this.authService.login(username, password);

            res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn
            });

            res.status(200).json(
                ResponseFormatter.success(
                    user,
                    "User logged in successfully",
                    200
                )
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Retrieves the authenticated user's profile.
     *
     * User information is extracted from the JWT payload
     * attached by authentication middleware.
     *
     * @param {Request} req
     * @param {Response} res
     * @param {Function} next
     */
    async getProfile(req, res, next) {
        try {
            const userId = req.user.userId;

            const result = await this.authService.getProfile(userId);

            res.status(200).json(
                ResponseFormatter.success(
                    result,
                    "Profile fetched successfully",
                    200
                )
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * Clears the authentication cookie and logs out the user.
     *
     * @param {Request} req
     * @param {Response} res
     * @param {Function} next
     */
    async logout(req, res, next) {
        try {
            res.clearCookie("authToken");

            res.status(200).json(
                ResponseFormatter.success(
                    {},
                    "Logout successful",
                    200
                )
            );
        } catch (error) {
            next(error);
        }
    };
}