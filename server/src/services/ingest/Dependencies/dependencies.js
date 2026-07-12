import { createEventProducer } from "../../../shared/events/producer/createEventProducer.js";
import { IngestController } from "../controller/ingestController.js";
import { IngestService } from "../services/ingestServices.js";

/**
 * Dependency Injection Container for the Ingest module.
 *
 * Purpose:
 * - Centralize object creation.
 * - Manage dependency wiring.
 * - Keep controllers and services loosely coupled.
 *
 * Instead of creating dependencies inside controllers or services,
 * all object construction happens here.
 *
 * Benefits:
 * - Easier testing (dependencies can be mocked).
 * - Better separation of concerns.
 * - Improved maintainability.
 * - Single location for dependency configuration.
 *
 * Dependency Graph:
 *
 * EventProducer
 *       │
 *       ▼
 * IngestService
 *       │
 *       ▼
 * IngestController
 */
class Container {

    /**
     * Initializes all dependencies required by the Ingest module.
     *
     * Creation Order:
     *
     * 1. EventProducer
     *    - Responsible for publishing events.
     *    - Internally uses Circuit Breaker + RabbitMQ.
     *
     * 2. IngestService
     *    - Contains business logic.
     *    - Depends on EventProducer.
     *
     * 3. IngestController
     *    - Handles HTTP requests.
     *    - Depends on IngestService.
     *
     * @returns {{
     *   services: {
     *      ingestService: IngestService
     *   },
     *   controllers: {
     *      ingestController: IngestController
     *   }
     * }}
     */
    static init() {

        /**
         * Create infrastructure dependency responsible
         * for event publishing.
         */
        const eventProducer = createEventProducer();

        /**
         * Service layer initialization.
         */
        const services = {
            ingestService: new IngestService({
                eventProducer
            })
        };

        /**
         * Controller layer initialization.
         */
        const controllers = {
            ingestController: new IngestController({
                ingestService: services.ingestService
            })
        };

        return {
            services,
            controllers
        };
    }
}

/**
 * Initialize all dependencies once during application startup.
 *
 * This ensures:
 * - Shared instances are reused.
 * - Services remain singleton-like.
 * - Controllers share the same service instances.
 */
const container = Container.init();

/**
 * Export initialized module dependencies.
 *
 * Consumers do not need to know how dependencies
 * are constructed; they simply import what they need.
 */
export default {
    ingestService: container.services.ingestService,
    ingestController: container.controllers.ingestController,
    Container
};