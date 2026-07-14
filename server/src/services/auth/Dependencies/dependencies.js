import MongoUserRepository from "../repository/UserRepository.js";
import { AuthService } from "../service/authService.js";
import { AuthController } from "../controller/authController.js";

/**
 * Dependency Injection Container
 *
 * Responsible for creating and wiring together
 * repositories, services, and controllers used
 * by the Auth module.
 */
class Container {
    /**
     * Initialize module dependencies.
     *
     * @returns {Object}
     */
    static init() {
        /**
         * Repository Layer
         */
        const repositories = {
            userRepository: MongoUserRepository,
        };

        /**
         * Service Layer
         */
        const services = {
            authService: new AuthService(
                repositories.userRepository
            ),
        };

        /**
         * Controller Layer
         */
        const controller = {
            authController: new AuthController(
                services.authService
            ),
        };

        return {
            repositories,
            services,
            controller,
        };
    }
}

const initialized = Container.init();

export { Container };
export default initialized;