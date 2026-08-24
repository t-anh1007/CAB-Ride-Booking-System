import { readSecret } from "./read-secret.js";

export const serviceConfig = {
  port: Number(process.env.PORT || 3105),
  storageMode: process.env.USER_SERVICE_STORAGE || "auto",
  postgres: {
    connectionString: readSecret("DATABASE_URL", ""),
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: readSecret("POSTGRES_PASSWORD", ""),
    ssl: parseBoolean(process.env.POSTGRES_SSL, false)
  }
};

function parseBoolean(value, defaultValue) {
  if (value == null) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
