import { ApiError } from "../lib/api-error.js";
import { DEFAULT_ELIGIBLE_DRIVER_FILTERS } from "../domain/user-constants.js";

export function createUserDomainService(repository) {
  return {
    async getUser(userId) {
      const user = await ensureUserExists(repository, userId);
      return buildUserAggregate(repository, user);
    },
    async getUserSummary(userId) {
      const user = await ensureUserExists(repository, userId);
      return buildUserSummary(repository, user);
    },
    async listUsers(filters) {
      return repository.listUsers(filters);
    },
    async listEligibleDrivers(filters) {
      return repository.listEligibleDrivers({
        ...DEFAULT_ELIGIBLE_DRIVER_FILTERS,
        ...filters
      });
    },
    async upsertUserProfile(userId, payload) {
      const existing = await repository.getUserById(userId);

      if (!existing) {
        const requiredFields = ["fullName", "phone", "email"];
        const missingFields = requiredFields.filter((field) => !payload[field]);

        if (missingFields.length > 0) {
          throw new ApiError(400, "Missing required fields for profile creation", {
            missingFields
          });
        }
      }

      if (payload.defaultPaymentMethod && payload.defaultPaymentMethod !== "cash") {
        const paymentMethods = await repository.listPaymentMethods(userId);
        const hasCompatibleMethod = paymentMethods.some(
          (method) => method.type === payload.defaultPaymentMethod && method.status === "ACTIVE"
        );

        if (!hasCompatibleMethod) {
          throw new ApiError(400, "defaultPaymentMethod requires an active saved payment method");
        }
      }

      const result = await repository.upsertUserProfile(userId, payload);
      return {
        created: result.created,
        user: await buildUserAggregate(repository, result.user)
      };
    },
    async getDriverProfile(userId) {
      const user = await ensureUserExists(repository, userId);
      if (user.role !== "DRIVER") {
        throw new ApiError(400, "User does not have DRIVER role");
      }

      const driverProfile = await repository.getDriverProfileByUserId(userId);
      if (!driverProfile) {
        throw new ApiError(404, "Driver profile not found");
      }

      return driverProfile;
    },
    async upsertDriverProfile(userId, payload) {
      const user = await ensureUserExists(repository, userId);
      if (user.role !== "DRIVER") {
        throw new ApiError(400, "User does not have DRIVER role");
      }

      return repository.upsertDriverProfile(userId, payload);
    },
    async getPreferences(userId) {
      await ensureUserExists(repository, userId);
      const preferences = await repository.getUserPreferencesByUserId(userId);

      if (!preferences) {
        throw new ApiError(404, "User preferences not found");
      }

      return preferences;
    },
    async upsertPreferences(userId, payload) {
      await ensureUserExists(repository, userId);
      return repository.upsertUserPreferences(userId, payload);
    },
    async listSavedLocations(userId) {
      await ensureUserExists(repository, userId);
      return repository.listSavedLocationsByUserId(userId);
    },
    async createSavedLocation(userId, payload) {
      await ensureUserExists(repository, userId);
      return repository.createSavedLocation(userId, payload);
    },
    async updateSavedLocation(userId, locationId, payload) {
      await ensureUserExists(repository, userId);
      return repository.updateSavedLocation(userId, locationId, payload);
    },
    async deleteSavedLocation(userId, locationId) {
      await ensureUserExists(repository, userId);
      return repository.deleteSavedLocation(userId, locationId);
    },
    async listPaymentMethods(userId) {
      await ensureUserExists(repository, userId);
      return repository.listPaymentMethods(userId);
    },
    async createPaymentMethod(userId, payload) {
      await ensureUserExists(repository, userId);
      return repository.createPaymentMethod(userId, payload);
    },
    async getWallet(userId) {
      await ensureUserExists(repository, userId);
      const wallet = await repository.getWalletByUserId(userId);

      if (!wallet) {
        throw new ApiError(404, "Wallet not found");
      }

      return wallet;
    }
  };
}

async function ensureUserExists(repository, userId) {
  const user = await repository.getUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
}

async function buildUserAggregate(repository, user) {
  const [driverProfile, preferences, savedLocations] = await Promise.all([
    user.role === "DRIVER" ? repository.getDriverProfileByUserId(user.userId) : Promise.resolve(null),
    repository.getUserPreferencesByUserId(user.userId),
    repository.listSavedLocationsByUserId(user.userId)
  ]);

  return {
    ...user,
    driverProfile,
    preferences,
    savedLocations
  };
}

async function buildUserSummary(repository, user) {
  const driverProfile = user.role === "DRIVER"
    ? await repository.getDriverProfileByUserId(user.userId)
    : null;

  return {
    userId: user.userId,
    role: user.role,
    accountStatus: user.accountStatus,
    fullName: user.fullName,
    displayName: user.displayName,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    driverProfile: driverProfile ? {
      kycStatus: driverProfile.kycStatus,
      approvalStatus: driverProfile.approvalStatus,
      vehicleType: driverProfile.vehicleType
    } : null
  };
}
