import dotenv from "dotenv";

dotenv.config();

/**
 * Validate required environment variables
 */
const requiredEnvVars = [
  "JWT_SECRET",
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});

/**
 * Application Configuration
 */
const config = Object.freeze({
  // Server
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),

  // MongoDB
  mongo: {
    uri:
      process.env.MONGO_URI ||
      "mongodb://localhost:27017/api_monitoring",
    dbName:
      process.env.MONGO_DB_NAME ||
      "api_monitoring",
  },

  // PostgreSQL
  postgres: {
    host: process.env.PG_HOST || "localhost",
    port: Number(process.env.PG_PORT || 5432),
    database:
      process.env.PG_DATABASE ||
      "api_monitoring",
    user: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "postgres",
  },

  // RabbitMQ
  rabbitmq: {
    url:
      process.env.RABBITMQ_URL ||
      "amqp://localhost:5672",

    queue:
      process.env.RABBITMQ_QUEUE ||
      "api_hits",

    publisherConfirms:
      process.env.RABBITMQ_PUBLISHER_CONFIRMS ===
      "true",

    retryAttempts: Number(
      process.env.RABBITMQ_RETRY_ATTEMPTS || 3
    ),

    retryDelay: Number(
      process.env.RABBITMQ_RETRY_DELAY || 1000
    ),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn:
      process.env.JWT_EXPIRES_IN || "24h",
  },

  // Rate Limiting
  rateLimit: {
    windowMs: Number(
      process.env.RATE_LIMIT_WINDOW_MS || 900000
    ), // 15 min

    maxRequests: Number(
      process.env.RATE_LIMIT_MAX_REQUESTS || 1000
    ),
  },

  // Cookies
  cookie: {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? "strict"
        : "lax",

    expiresIn:
      24 * 60 * 60 * 1000, // 24h
  },
});

export default config;