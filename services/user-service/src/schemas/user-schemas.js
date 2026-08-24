import { z } from "zod";
import {
  ACCOUNT_STATUSES,
  DRIVER_APPROVAL_STATUSES,
  DRIVER_KYC_STATUSES,
  SAVED_LOCATION_LABELS,
  SUPPORTED_LANGUAGES,
  USER_ROLES
} from "../domain/user-constants.js";

const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;

const optionalQueryValue = (schema) => z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  schema.optional()
);

const paginationNumber = (defaultValue, maxValue = 100) => z.preprocess(
  (value) => (value === "" || value == null ? defaultValue : Number(value)),
  z.number().int().min(1).max(maxValue)
);

export const userIdParamSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID")
});

export const locationIdParamSchema = z.object({
  locationId: z.string().uuid("locationId must be a valid UUID")
});

export const patchUserProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().regex(phoneRegex, "phone must be a valid Vietnamese phone number").optional(),
  email: z.string().trim().email().max(255).optional(),
  avatarUrl: z.string().trim().url().or(z.literal("")).optional(),
  bio: z.string().trim().max(500).optional(),
  role: z.enum(USER_ROLES).optional(),
  accountStatus: z.enum(ACCOUNT_STATUSES).optional(),
  defaultPaymentMethod: z.enum(["cash", "card", "wallet"]).optional()
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field must be provided"
});

export const patchDriverProfileSchema = z.object({
  kycStatus: z.enum(DRIVER_KYC_STATUSES).optional(),
  approvalStatus: z.enum(DRIVER_APPROVAL_STATUSES).optional(),
  approvalNotes: z.string().trim().max(500).optional(),
  vehicleType: z.string().trim().max(60).optional(),
  licenseNumber: z.string().trim().max(60).optional()
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field must be provided"
});

export const patchUserPreferencesSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
  pushNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  marketingOptIn: z.boolean().optional()
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field must be provided"
});

export const createSavedLocationSchema = z.object({
  label: z.enum(SAVED_LOCATION_LABELS),
  title: z.string().trim().min(1).max(120),
  addressLine: z.string().trim().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  note: z.string().trim().max(255).optional()
});

export const patchSavedLocationSchema = z.object({
  label: z.enum(SAVED_LOCATION_LABELS).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  addressLine: z.string().trim().min(1).max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  note: z.string().trim().max(255).optional()
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field must be provided"
});

export const createPaymentMethodSchema = z.object({
  type: z.enum(["card", "wallet"]),
  provider: z.string().trim().min(1).max(60).optional(),
  maskedValue: z.string().trim().min(1).max(120).optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
}).superRefine((payload, context) => {
  if (payload.type === "card") {
    if (!payload.provider) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provider"],
        message: "provider is required for card payment methods"
      });
    }

    if (!payload.maskedValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maskedValue"],
        message: "maskedValue is required for card payment methods"
      });
    }
  }
});

export const userListQuerySchema = z.object({
  page: paginationNumber(1),
  limit: paginationNumber(20),
  search: optionalQueryValue(z.string().trim().min(1).max(120)),
  role: optionalQueryValue(z.enum(USER_ROLES)),
  accountStatus: optionalQueryValue(z.enum(ACCOUNT_STATUSES)),
  approvalStatus: optionalQueryValue(z.enum(DRIVER_APPROVAL_STATUSES)),
  kycStatus: optionalQueryValue(z.enum(DRIVER_KYC_STATUSES))
});

export const eligibleDriversQuerySchema = z.object({
  page: paginationNumber(1),
  limit: paginationNumber(20),
  search: optionalQueryValue(z.string().trim().min(1).max(120)),
  accountStatus: optionalQueryValue(z.enum(ACCOUNT_STATUSES)),
  approvalStatus: optionalQueryValue(z.enum(DRIVER_APPROVAL_STATUSES)),
  kycStatus: optionalQueryValue(z.enum(DRIVER_KYC_STATUSES))
});
