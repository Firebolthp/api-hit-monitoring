import express from "express";
import dependencies from "../Dependencies/dependencies.js";
import authorize from "../../../shared/middlewares/authorize.js";
import authenticate from "../../../shared/middlewares/authenticate.js";
import validate from "../../../shared/middlewares/validate.js";
import requestLogger from "../../../shared/middlewares/requestLogger.js";

import {
    onboardSuperAdminSchema,
    loginSchema,
    registrationSchema
} from "../validation/authSchema.js";

import { APPLICATION_ROLES } from "../../../shared/constants/roles.js";

const router = express.Router();

const { controller } = dependencies;
const authController = controller.authController;

/**
 * Initial system setup.
 *
 * Creates the very first Super Admin account.
 * This endpoint becomes effectively unusable after
 * the first admin is onboarded.
 */
router.post(
    "/onboard-super-admin",
    requestLogger,
    validate(onboardSuperAdminSchema),
    (req, res, next) =>
        authController.onboardSuperAdmin(req, res, next)
);

/**
 * Register a new user.
 *
 * Access:
 * SUPER_ADMIN only
 */
router.post(
    "/register",
    requestLogger,
    authenticate,
    authorize([APPLICATION_ROLES.SUPER_ADMIN]),
    validate(registrationSchema),
    (req, res, next) =>
        authController.register(req, res, next)
);

/**
 * Authenticate a user and issue a JWT token.
 */
router.post(
    "/login",
    requestLogger,
    validate(loginSchema),
    (req, res, next) =>
        authController.login(req, res, next)
);

/**
 * Fetch the profile of the currently authenticated user.
 */
router.get(
    "/profile",
    requestLogger,
    authenticate,
    (req, res, next) =>
        authController.getProfile(req, res, next)
);

/**
 * Logout the authenticated user by clearing
 * the authentication cookie.
 */
router.get(
    "/logout",
    requestLogger,
    authenticate,
    (req, res, next) =>
        authController.logout(req, res, next)
);

export default router;