export const USER_ROLES = ["CUSTOMER", "DRIVER", "ADMIN"];
export const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"];
export const DRIVER_KYC_STATUSES = ["NOT_SUBMITTED", "SUBMITTED", "VERIFIED", "REJECTED"];
export const DRIVER_APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
export const SAVED_LOCATION_LABELS = ["HOME", "WORK", "OTHER"];
export const SUPPORTED_LANGUAGES = ["vi", "en"];

export const DEFAULT_USER_ROLE = "CUSTOMER";
export const DEFAULT_ACCOUNT_STATUS = "ACTIVE";
export const DEFAULT_DRIVER_KYC_STATUS = "NOT_SUBMITTED";
export const DEFAULT_DRIVER_APPROVAL_STATUS = "PENDING";
export const DEFAULT_LANGUAGE = "vi";

export const DEFAULT_ELIGIBLE_DRIVER_FILTERS = {
  role: "DRIVER",
  accountStatus: "ACTIVE",
  kycStatus: "VERIFIED",
  approvalStatus: "APPROVED"
};

export function createDefaultDriverProfile(userId, timestamp) {
  return {
    userId,
    kycStatus: DEFAULT_DRIVER_KYC_STATUS,
    approvalStatus: DEFAULT_DRIVER_APPROVAL_STATUS,
    approvalNotes: "",
    vehicleType: "",
    licenseNumber: "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createDefaultPreferences(userId, timestamp) {
  return {
    userId,
    language: DEFAULT_LANGUAGE,
    pushNotifications: true,
    emailNotifications: true,
    marketingOptIn: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
