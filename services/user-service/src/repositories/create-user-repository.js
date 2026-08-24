import { createInMemoryUserRepository } from "./in-memory-user-repository.js";
import { createPostgresUserRepository } from "./postgres-user-repository.js";

export async function createUserRepository(config) {
  if (config.storageMode === "in-memory") {
    return createInMemoryUserRepository();
  }

  if (config.storageMode === "postgresql") {
    return createPostgresUserRepository(config.postgres);
  }

  try {
    return await createPostgresUserRepository(config.postgres);
  } catch (error) {
    const repository = createInMemoryUserRepository();
    repository.fallbackReason = error.message;
    return repository;
  }
}
