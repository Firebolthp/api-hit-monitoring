import express from "express";
import clientDependencies from "../Dependencies/dependencies.js";

import authenticate from "../../../shared/middlewares/authenticate.js";
import authorize from "../../../shared/middlewares/authorize.js";
import requestLogger from "../../../shared/middlewares/requestLogger.js";

import { APPLICATION_ROLES } from "../../../shared/constants/roles.js";

// Create router instance
const router = express.Router();

// Resolve controller from dependency container
const { clientController } = clientDependencies.controller;

// All client routes require authentication
router.use(authenticate);

/**
 * Create a new client.
 * Accessible only by Super Admins.
 */
router.post(
    "/admin/clients/onboard",
    requestLogger,
    authorize([APPLICATION_ROLES.SUPER_ADMIN]),
    (req, res, next) =>
        clientController.createClient(req, res, next)
);

/**
 * Create a user under a client.
 * Accessible by Super Admins and Client Admins.
 */
router.post(
    "/admin/clients/:clientId/users",
    requestLogger,
    authorize([
        APPLICATION_ROLES.SUPER_ADMIN,
        APPLICATION_ROLES.CLIENT_ADMIN
    ]),
    (req, res, next) =>
        clientController.createClientUser(req, res, next)
);

/**
 * Create an API key for a client.
 * Accessible by Super Admins and Client Admins.
 */
router.post(
    "/admin/clients/:clientId/api/keys",
    requestLogger,
    authorize([
        APPLICATION_ROLES.SUPER_ADMIN,
        APPLICATION_ROLES.CLIENT_ADMIN
    ]),
    (req, res, next) =>
        clientController.createApiKey(req, res, next)
);

/**
 * Retrieve API keys for a client.
 * Tenant-level access validation is enforced in the service layer.
 */
router.get(
    "/admin/clients/:clientId/api/keys",
    requestLogger,
    authorize([
        APPLICATION_ROLES.SUPER_ADMIN,
        APPLICATION_ROLES.CLIENT_ADMIN,
        APPLICATION_ROLES.CLIENT_VIEWER
    ]),
    (req, res, next) =>
        clientController.getClientApiKeys(req, res, next)
);

export default router;