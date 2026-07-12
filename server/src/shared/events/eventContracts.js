/**
 * Centralized registry of all event types used by the application.
 *
 * Why this file exists:
 * ---------------------
 * Event producers and consumers communicate through event names.
 * Defining those names in multiple places can lead to:
 *
 * - Typographical errors
 * - Inconsistent naming
 * - Difficult refactoring
 * - Producer/consumer contract mismatches
 *
 * By maintaining a single source of truth, both publishers and
 * consumers reference the same event identifiers.
 *
 * Example:
 *
 * Producer:
 *   type: EVENT_TYPES.API_HIT
 *
 * Consumer:
 *   if (message.type === EVENT_TYPES.API_HIT) { ... }
 *
 * Naming Convention:
 * ------------------
 * Use UPPER_SNAKE_CASE for all event names.
 *
 * Examples:
 * - API_HIT
 * - USER_CREATED
 * - ORDER_PLACED
 * - PAYMENT_COMPLETED
 *
 * NOTE:
 * Event names form part of the contract between services.
 * Changing an existing event type may break consumers.
 */
export const EVENT_TYPES = Object.freeze({
    /**
     * Published whenever an API request is processed
     * and needs to be recorded for analytics,
     * monitoring, auditing, or reporting purposes.
     *
     * Expected payload example:
     * {
     *   eventId: "uuid",
     *   endpoint: "/api/users",
     *   method: "GET",
     *   statusCode: 200,
     *   responseTimeMs: 42,
     *   timestamp: "2026-07-12T10:00:00Z"
     * }
     */
    API_HIT: "API_HIT",
});