import { ROLES } from "@/constants/roles.js";

function readRuntimeConfig() {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__APP_CONFIG__ || {};
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

const runtimeConfig = readRuntimeConfig();

export const isStandaloneMode = normalizeBoolean(
  runtimeConfig.STANDALONE_MODE,
  import.meta.env.VITE_STANDALONE_MODE === "true"
);

const mockSessionsByRole = {
  [ROLES.CUSTOMER]: {
    accessToken: "standalone-customer-token",
    role: ROLES.CUSTOMER,
    user: {
      id: "customer-demo",
      name: "Demo Customer",
      phone: "0123 456 789"
    }
  },
  [ROLES.DRIVER]: {
    accessToken: "standalone-driver-token",
    role: ROLES.DRIVER,
    user: {
      id: "driver-demo",
      name: "Demo Driver",
      phone: "0987 654 321"
    }
  },
  [ROLES.ADMIN]: {
    accessToken: "standalone-admin-token",
    role: ROLES.ADMIN,
    user: {
      id: "admin-demo",
      name: "Demo Admin",
      phone: "0900 000 001"
    }
  }
};

function normalizeStandaloneRole(value) {
  if (Object.values(ROLES).includes(value)) {
    return value;
  }

  return ROLES.ADMIN;
}

export const standaloneRole = normalizeStandaloneRole(
  runtimeConfig.STANDALONE_ROLE || import.meta.env.VITE_STANDALONE_ROLE || ROLES.ADMIN
);
export const mockSession = mockSessionsByRole[standaloneRole];
