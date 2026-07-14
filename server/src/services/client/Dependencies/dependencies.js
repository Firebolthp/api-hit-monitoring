import MongoClientRepository from "../repository/ClientRepository.js";
import MongoApiKeyRepository from "../repository/ApiKeyRepository.js";
import MongoUserRepository from "../../auth/repository/UserRepository.js";

import { ClientService } from "../services/clientService.js";
import { ClientController } from "../controller/clientController.js";

import authContainer from "../../auth/Dependencies/dependencies.js";

/**
 * Dependency Injection Container
 *
 * Responsible for creating and wiring together all
 * repositories, services, and controllers used by
 * the Client module.
 */
class Container {
    /**
     * Initializes all module dependencies.
     *
     * @returns {Object}
     */
    static init() {
        /**
         * Repository Layer
         */
        const repositories = {
            clientRepository: MongoClientRepository,
            apiKeyRepository: MongoApiKeyRepository,
            userRepository: MongoUserRepository
        };

        /**
         * Service Layer
         */
        const services = {
            clientService: new ClientService({
                clientRepository: repositories.clientRepository,
                apiKeyRepository: repositories.apiKeyRepository,
                userRepository: repositories.userRepository
            })
        };

        /**
         * Controller Layer
         */
        const controller = {
            clientController: new ClientController(
                services.clientService,
                authContainer.services.authService
            )
        };

        return {
            repositories,
            services,
            controller
        };
    }
}

const initialized = Container.init();

export { Container };
export default initialized;