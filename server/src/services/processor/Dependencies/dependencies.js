/**

* Dependency Container
*
* Centralized dependency initialization for the Processor module.
*
* Responsibilities:
* * Create repository instances.
* * Inject shared infrastructure dependencies.
* * Create service instances.
* * Wire the complete dependency graph.
*
* This file acts as the Composition Root of the Processor module,
* ensuring that object creation remains separate from business logic.
  */

import { ApiHitRepository } from "../repository/ApiHitRepository.js";
import { MetricsRepository } from "../repository/MetricsRepository.js";
import { ProcessorService } from "../service/ProcessorService.js";

import ApiHit from "../../../shared/models/ApiHits.js";
import postgres from "../../../shared/config/postgres.js";
import logger from "../../../shared/config/logger.js";

class Container {
/**
* Initializes all processor module dependencies.
*
* Dependency Flow:
*
* PostgreSQL ─────────────┐
*                         ▼
*                   MetricsRepository
*
* Mongo Model ───────────┐
*                        ▼
*                 ApiHitRepository
*
* Repositories ──────────┐
* Logger ────────────────┤
*                        ▼
*                 ProcessorService
*
* @returns {{
*   repositories: Object,
*   services: Object
* }}
*/
static init() {
/**
* Repository Layer
*
* Responsible for database interactions.
*/
const repositories = {
apiHitRepository: new ApiHitRepository({
model: ApiHit,
logger,
}),

        metricsRepository: new MetricsRepository({
            logger,
            postgres,
        }),
    };

    /**
     * Service Layer
     *
     * Responsible for business logic and orchestration.
     */
    const services = {
        processorService: new ProcessorService({
            ...repositories,
            logger,
        }),
    };

    return {
        repositories,
        services,
    };
}


}

/**

* Initialize dependencies once during application startup.
*
* This creates singleton-like instances that are shared
* throughout the processor module lifecycle.
  */
  const initialized = Container.init();

export { Container };
export default initialized;
