import ResponseFormatter from "../../../shared/utils/responseFormatter.js";

/**
 * ClientController
 *
 * Handles client-related HTTP requests and delegates
 * business logic to the ClientService layer.
 */
export class ClientController {
    /**
     * @param {Object} clientService
     * @param {Object} authService
     */
    constructor(clientService, authService) {
        if (!clientService) {
            throw new Error("ClientService is required");
        }

        if (!authService) {
            throw new Error("AuthService is required");
        }

        this.clientService = clientService;
        this.authService = authService;
    }

    /**
     * Creates a new client.
     *
     * Accessible only to Super Admin users.
     *
     * @param {Request} req
     * @param {Response} res
     * @param {Function} next
     */
    async createClient(req, res, next) {
        try {
            /**
             * Additional permission verification.
             * Route middleware and service layer should already
             * enforce Super Admin access.
             */
            const isSuperAdmin =
                await this.authService.checkSuperAdminPermissions(
                    req.user.userId
                );

            if (!isSuperAdmin) {
                return res
                    .status(403)
                    .json(
                        ResponseFormatter.error(
                            "Access denied",
                            403
                        )
                    );
            }

            const client = await this.clientService.createClient(
                req.body,
                req.user
            );

            return res.status(201).json(
                ResponseFormatter.success(
                    client,
                    "Client created successfully",
                    201
                )
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Creates a new user under a client.
     *
     * @param {Request} req
     * @param {Response} res
     * @param {Function} next
     */
    async createClientUser(req, res, next) {
        try {
            const { clientId } = req.params;

            const user =
                await this.clientService.createClientUser(
                    clientId,
                    req.body,
                    req.user
                );

            return res.status(201).json(
                ResponseFormatter.success(
                    user,
                    "Client user created successfully",
                    201
                )
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Creates a new API key for a client.
     *
     * @param {Request} req
     * @param {Response} res
     * @param {Function} next
     */
    async createApiKey(req, res, next) {
        try {
            const { clientId } = req.params;

            const apiKey =
                await this.clientService.createApiKey(
                    clientId,
                    req.body,
                    req.user
                );

            return res.status(201).json(
                ResponseFormatter.success(
                    apiKey,
                    "API key created successfully",
                    201
                )
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Retrieves all API keys belonging to a client.
     *
     * @param {Request} req
     * @param {Response} res
     * @param {Function} next
     */
    async getClientApiKeys(req, res, next) {
        try {
            const { clientId } = req.params;

            const apiKeys =
                await this.clientService.getClientApiKeys(
                    clientId,
                    req.user
                );

            return res.status(200).json(
                ResponseFormatter.success(
                    apiKeys,
                    "API keys fetched successfully",
                    200
                )
            );
        } catch (error) {
            next(error);
        }
    }
}