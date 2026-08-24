import { randomUUID } from "node:crypto";
import { ApiError } from "../lib/api-error.js";
import {
  createDefaultDriverProfile,
  createDefaultPreferences,
  DEFAULT_ACCOUNT_STATUS,
  DEFAULT_USER_ROLE
} from "../domain/user-constants.js";

export function createInMemoryUserRepository() {
  const users = new Map();
  const driverProfiles = new Map();
  const preferencesByUser = new Map();
  const savedLocationsByUser = new Map();
  const paymentMethodsByUser = new Map();
  const wallets = new Map();

  return {
    kind: "in-memory",
    async close() {
      return true;
    },
    async getUserById(userId) {
      return users.get(userId) || null;
    },
    async upsertUserProfile(userId, payload) {
      const existing = users.get(userId) || null;

      ensureUniqueProfile(users, userId, payload, existing);

      const now = new Date().toISOString();
      const nextUser = {
        userId,
        role: payload.role ?? existing?.role ?? DEFAULT_USER_ROLE,
        accountStatus: payload.accountStatus ?? existing?.accountStatus ?? DEFAULT_ACCOUNT_STATUS,
        fullName: payload.fullName ?? existing?.fullName ?? "",
        displayName: payload.displayName ?? existing?.displayName ?? "",
        phone: payload.phone ?? existing?.phone ?? "",
        email: payload.email ?? existing?.email ?? "",
        avatarUrl: payload.avatarUrl ?? existing?.avatarUrl ?? "",
        bio: payload.bio ?? existing?.bio ?? "",
        defaultPaymentMethod: payload.defaultPaymentMethod ?? existing?.defaultPaymentMethod ?? "cash",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };

      users.set(userId, nextUser);

      if (!wallets.has(userId)) {
        wallets.set(userId, createWalletAccount(userId, now));
      }

      if (!preferencesByUser.has(userId)) {
        preferencesByUser.set(userId, createDefaultPreferences(userId, now));
      }

      if (nextUser.role === "DRIVER" && !driverProfiles.has(userId)) {
        driverProfiles.set(userId, createDefaultDriverProfile(userId, now));
      }

      return {
        user: nextUser,
        created: existing == null
      };
    },
    async getDriverProfileByUserId(userId) {
      return driverProfiles.get(userId) || null;
    },
    async upsertDriverProfile(userId, payload) {
      const existing = driverProfiles.get(userId) || null;
      const now = new Date().toISOString();
      const base = existing ?? createDefaultDriverProfile(userId, now);
      const nextDriverProfile = {
        ...base,
        ...payload,
        userId,
        createdAt: base.createdAt,
        updatedAt: now
      };

      driverProfiles.set(userId, nextDriverProfile);
      return nextDriverProfile;
    },
    async getUserPreferencesByUserId(userId) {
      const existing = preferencesByUser.get(userId);
      if (existing) {
        return existing;
      }

      const now = new Date().toISOString();
      const nextPreferences = createDefaultPreferences(userId, now);
      preferencesByUser.set(userId, nextPreferences);
      return nextPreferences;
    },
    async upsertUserPreferences(userId, payload) {
      const base = await this.getUserPreferencesByUserId(userId);
      const now = new Date().toISOString();
      const nextPreferences = {
        ...base,
        ...payload,
        userId,
        createdAt: base.createdAt,
        updatedAt: now
      };

      preferencesByUser.set(userId, nextPreferences);
      return nextPreferences;
    },
    async listSavedLocationsByUserId(userId) {
      return [...(savedLocationsByUser.get(userId) || [])];
    },
    async createSavedLocation(userId, payload) {
      const now = new Date().toISOString();
      const createdLocation = {
        locationId: randomUUID(),
        userId,
        label: payload.label,
        title: payload.title,
        addressLine: payload.addressLine,
        latitude: payload.latitude,
        longitude: payload.longitude,
        note: payload.note ?? "",
        createdAt: now,
        updatedAt: now
      };

      const existingLocations = savedLocationsByUser.get(userId) || [];
      savedLocationsByUser.set(userId, [...existingLocations, createdLocation]);

      return createdLocation;
    },
    async updateSavedLocation(userId, locationId, payload) {
      const existingLocations = savedLocationsByUser.get(userId) || [];
      const targetLocation = existingLocations.find((location) => location.locationId === locationId);

      if (!targetLocation) {
        throw new ApiError(404, "Saved location not found");
      }

      const now = new Date().toISOString();
      const nextLocation = {
        ...targetLocation,
        ...payload,
        locationId,
        userId,
        updatedAt: now
      };

      savedLocationsByUser.set(userId, existingLocations.map((location) => (
        location.locationId === locationId ? nextLocation : location
      )));

      return nextLocation;
    },
    async deleteSavedLocation(userId, locationId) {
      const existingLocations = savedLocationsByUser.get(userId) || [];
      const nextLocations = existingLocations.filter((location) => location.locationId !== locationId);

      if (nextLocations.length === existingLocations.length) {
        throw new ApiError(404, "Saved location not found");
      }

      savedLocationsByUser.set(userId, nextLocations);
      return {
        locationId,
        deleted: true
      };
    },
    async listUsers(filters) {
      return buildPaginatedUserList([...users.values()], driverProfiles, filters);
    },
    async listEligibleDrivers(filters) {
      return buildPaginatedUserList(
        [...users.values()].filter((user) => user.role === "DRIVER"),
        driverProfiles,
        filters
      );
    },
    async listPaymentMethods(userId) {
      return [...(paymentMethodsByUser.get(userId) || [])];
    },
    async createPaymentMethod(userId, payload) {
      const user = users.get(userId);
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      const existingMethods = paymentMethodsByUser.get(userId) || [];
      const now = new Date().toISOString();
      const isDefault = payload.isDefault === true || existingMethods.length === 0;
      const createdMethod = {
        paymentMethodId: randomUUID(),
        userId,
        type: payload.type,
        provider: payload.provider ?? defaultProvider(payload.type),
        maskedValue: payload.maskedValue ?? defaultMaskedValue(payload.type),
        isDefault,
        status: payload.status ?? "ACTIVE",
        createdAt: now,
        updatedAt: now
      };

      const nextMethods = existingMethods.map((method) => ({
        ...method,
        isDefault: isDefault ? false : method.isDefault,
        updatedAt: isDefault ? now : method.updatedAt
      }));
      nextMethods.push(createdMethod);
      paymentMethodsByUser.set(userId, nextMethods);

      if (isDefault) {
        users.set(userId, {
          ...user,
          defaultPaymentMethod: payload.type,
          updatedAt: now
        });
      }

      return createdMethod;
    },
    async getWalletByUserId(userId) {
      return wallets.get(userId) || null;
    }
  };
}

function ensureUniqueProfile(users, userId, payload, existing) {
  for (const user of users.values()) {
    if (user.userId === userId) {
      continue;
    }

    const nextPhone = payload.phone ?? existing?.phone;
    const nextEmail = payload.email ?? existing?.email;

    if (nextPhone && user.phone === nextPhone) {
      throw new ApiError(409, "Phone number already exists");
    }

    if (nextEmail && user.email === nextEmail) {
      throw new ApiError(409, "Email already exists");
    }
  }
}

function createWalletAccount(userId, now) {
  return {
    walletAccountId: randomUUID(),
    userId,
    balance: 0,
    currency: "VND",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now
  };
}

function buildPaginatedUserList(users, driverProfiles, filters) {
  const filteredUsers = users
    .filter((user) => matchesUserFilter(user, driverProfiles.get(user.userId) || null, filters))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const total = filteredUsers.length;
  const startIndex = (filters.page - 1) * filters.limit;
  const items = filteredUsers
    .slice(startIndex, startIndex + filters.limit)
    .map((user) => mapUserSummary(user, driverProfiles.get(user.userId) || null));

  return {
    items,
    pagination: buildPagination(filters.page, filters.limit, total)
  };
}

function matchesUserFilter(user, driverProfile, filters) {
  if (filters.role && user.role !== filters.role) {
    return false;
  }

  if (filters.accountStatus && user.accountStatus !== filters.accountStatus) {
    return false;
  }

  if (filters.approvalStatus && driverProfile?.approvalStatus !== filters.approvalStatus) {
    return false;
  }

  if (filters.kycStatus && driverProfile?.kycStatus !== filters.kycStatus) {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const normalizedSearch = filters.search.toLowerCase();
  return [
    user.fullName,
    user.displayName,
    user.phone,
    user.email
  ].some((value) => value?.toLowerCase().includes(normalizedSearch));
}

function mapUserSummary(user, driverProfile) {
  return {
    userId: user.userId,
    role: user.role,
    accountStatus: user.accountStatus,
    fullName: user.fullName,
    displayName: user.displayName,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    driverProfile: driverProfile ? {
      kycStatus: driverProfile.kycStatus,
      approvalStatus: driverProfile.approvalStatus,
      vehicleType: driverProfile.vehicleType
    } : null
  };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

function defaultProvider(type) {
  return type === "wallet" ? "cab-wallet" : "unknown-provider";
}

function defaultMaskedValue(type) {
  return type === "wallet" ? "CAB Wallet" : "";
}
