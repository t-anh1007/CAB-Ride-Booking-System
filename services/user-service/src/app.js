import express from "express";
import { bootstrapBroker } from "../../../platform/node/broker.js";
import { getServiceManifest } from "../../../platform/architecture/service-manifests.js";
import { serviceConfig } from "./config.js";
import { requestContextMiddleware } from "./lib/request-context.js";
import { authContextMiddleware } from "./middleware/auth-context.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createUserRepository } from "./repositories/create-user-repository.js";
import { createUserRoutes } from "./routes/user-routes.js";
import { createUserDomainService } from "./services/user-domain-service.js";

export async function createApp() {
  const manifest = getServiceManifest("user-service");
  const repository = await createUserRepository(serviceConfig);
  const broker = await bootstrapBroker(manifest);
  const userDomainService = createUserDomainService(repository);
  const app = express();

  app.use(express.json());
  app.use(requestContextMiddleware);

  // Internal routes (No auth context required)
  app.post("/internal/users/bootstrap", async (req, res) => {
    const { subjectId, accountId, phone } = req.body;
    try {
      const existingUser = await repository.findById(subjectId);
      if (existingUser) {
        return res.status(200).json({ success: true, message: "User exists", data: existingUser });
      }

      const newUser = {
        userId: subjectId,
        role: "customer",
        accountStatus: "active",
        fullName: `User ${subjectId.slice(0, 8)}`,
        displayName: `User_${subjectId.slice(0, 4)}`,
        phone: phone || "",
        email: "",
        avatarUrl: "",
        bio: "",
        defaultPaymentMethod: "cash",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const savedUser = await repository.upsert(newUser);
      res.status(201).json({ success: true, message: "Bootstrapped", data: savedUser });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.use(authContextMiddleware);
  app.use(createUserRoutes({
    broker,
    repository,
    userDomainService
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    manifest,
    broker,
    repository
  };
}
