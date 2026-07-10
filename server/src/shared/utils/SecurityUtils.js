/**
 * SecurityUtils
 *
 * Centralized utility class for security-related operations.
 *
 * Current Responsibilities:
 * - Password validation
 *
 * Future Responsibilities:
 * - API key generation
 * - Token generation
 * - Encryption utilities
 * - Hashing utilities
 */
class SecurityUtils {

    /**
     * Password policy configuration.
     *
     * Values can be overridden through environment variables
     * without modifying application code.
     */
    static PASSWORD_REQUIREMENTS = {
        minLength: parseInt(
            process.env.PASSWORD_MIN_LENGTH || "8",
            10
        ),

        requireUppercase:
            (process.env.PASSWORD_REQUIRE_UPPERCASE || "true") ===
            "true",

        requireLowercase:
            (process.env.PASSWORD_REQUIRE_LOWERCASE || "true") ===
            "true",

        requireNumbers:
            (process.env.PASSWORD_REQUIRE_NUMBERS || "true") ===
            "true",

        requireSymbols:
            (process.env.PASSWORD_REQUIRE_SYMBOLS || "true") ===
            "true",
    };

    /**
     * Common weak passwords that should never be accepted.
     *
     * Using a Set provides O(1) lookup performance.
     */
    static WEAK_PASSWORDS = new Set([
        "password",
        "123456",
        "qwerty",
        "admin",
        "letmein",
        "password123",
        "admin123",
        "12345678",
        "welcome",
    ]);

    /**
     * Validate password against configured security policy.
     *
     * @param {string} password
     * @returns {{
     *  success: boolean,
     *  errors: string[]
     * }}
     */
    static validatePassword(password) {
        const errors = [];
        const requirements = this.PASSWORD_REQUIREMENTS;

        if (!password) {
            return {
                success: false,
                errors: ["Password is required"],
            };
        }

        if (
            password.length <
            requirements.minLength
        ) {
            errors.push(
                `Password must be at least ${requirements.minLength} characters long`
            );
        }

        if (
            requirements.requireUppercase &&
            !/[A-Z]/.test(password)
        ) {
            errors.push(
                "Password must contain at least one uppercase letter"
            );
        }

        if (
            requirements.requireLowercase &&
            !/[a-z]/.test(password)
        ) {
            errors.push(
                "Password must contain at least one lowercase letter"
            );
        }

        if (
            requirements.requireNumbers &&
            !/[0-9]/.test(password)
        ) {
            errors.push(
                "Password must contain at least one number"
            );
        }

        if (
            requirements.requireSymbols &&
            !/[^A-Za-z0-9]/.test(password)
        ) {
            errors.push(
                "Password must contain at least one special character"
            );
        }

        if (
            this.WEAK_PASSWORDS.has(
                password.toLowerCase()
            )
        ) {
            errors.push(
                "Password is too common and easily guessable"
            );
        }

        return {
            success: errors.length === 0,
            errors,
        };
    }
}

export default SecurityUtils;