import clientRepository from "../../client/repository/ClientRepository.js";
import processorContainer from "../../processor/Dependencies/dependencies.js";
import authContainer from "../../auth/Dependencies/dependencies.js";

import { AnalyticsService } from "../services/analyticsService.js";
import { AnalyticsController } from "../controller/analyticsController.js";

/**
 * Analytics Dependency Container
 *
 * This container is responsible for wiring together all dependencies
 * required by the Analytics module.
 *
 * Dependency Flow:
 *
 * Metrics Repository (Processor Module)
 *              ↓
 *      Analytics Service
 *              ↓
 *     Analytics Controller
 *              ↓
 *       Analytics Router
 *
 * Responsibilities:
 * - Reuse shared repositories from other modules
 * - Instantiate analytics services
 * - Inject dependencies into controllers
 * - Provide a centralized dependency graph
 *
 * Why use a container?
 * - Promotes dependency injection.
 * - Makes testing easier.
 * - Prevents tight coupling between layers.
 * - Keeps object creation in a single place.
 */
class Container {
    /**
     * Initializes the Analytics module dependency graph.
     *
     * @returns {{
     *   repositories: Object,
     *   services: Object,
     *   controllers: Object
     * }}
     */
    static init() {
        /**
         * Repository Layer
         *
         * clientRepository:
         * - Used to validate client ownership and existence.
         *
         * metricsRepository:
         * - Reused from Processor Service.
         * - Provides access to aggregated analytics data
         *   stored in PostgreSQL.
         */
        const repositories = {
            clientRepository,
            metricsRepository:
                processorContainer.repositories.metricsRepository,
        };

        /**
         * Service Layer
         *
         * AnalyticsService contains the business logic
         * for dashboard statistics, endpoint analytics,
         * and time-series metrics.
         */
        const analyticsService = new AnalyticsService(
            repositories.metricsRepository
        );

        const services = {
            analyticsService,

            /**
             * Reuse Auth Service from Auth Module.
             *
             * Used for:
             * - Permission checks
             * - Role validation
             * - Super admin verification
             */
            authService:
                authContainer.services &&
                authContainer.services.authService,
        };

        /**
         * Controller Layer
         *
         * AnalyticsController orchestrates:
         * - Authentication checks
         * - Authorization checks
         * - Request validation
         * - Analytics service execution
         */
        const analyticsController = new AnalyticsController({
            analyticsService: services.analyticsService,
            authService: services.authService,
            clientRepository: repositories.clientRepository,
        });

        const controllers = {
            analyticsController,
        };

        return {
            repositories,
            services,
            controllers,
        };
    }
}

/**
 * Initialize dependencies once during application startup.
 *
 * This creates singleton-like instances that are reused
 * throughout the Analytics module lifecycle.
 */
const initialized = Container.init();

export { Container };
export default initialized;