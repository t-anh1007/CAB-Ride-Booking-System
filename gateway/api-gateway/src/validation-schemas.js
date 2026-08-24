import { z } from "zod";

const uuidSchema = z.string().uuid();
const phoneDestinationSchema = z
  .string()
  .regex(/^(0|\+84)[0-9]{9,10}$/, "Số điện thoại không đúng định dạng (10-11 chữ số)");
const emailDestinationSchema = z.string().trim().toLowerCase().email();
const authDestinationSchema = z.union([phoneDestinationSchema, emailDestinationSchema]);
const isoDateSchema = z.string().datetime({ offset: true });
const moneyIntegerSchema = z.number().int().nonnegative();
const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(3).max(250).optional()
});
const bookingPaymentMethodSchema = z.enum(["CASH", "CREDIT_CARD", "E_WALLET", "cash", "credit_card", "e_wallet"]);
const priceSnapshotSchema = z
  .object({
    amount: moneyIntegerSchema,
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    surgeMultiplier: z.number().min(1).optional()
  })
  .strict();

export const httpSchemas = {
  login: z
    .object({
      identifier: z.string().min(3).max(255),
      password: z.string().min(8).max(255),
      clientType: z.enum(["customer-app", "driver-app", "admin-dashboard"]).optional()
    })
    .strict(),
  authRegister: z
    .object({
      email: emailDestinationSchema,
      password: z.string().min(6).max(100),
      name: z.string().min(2).max(100),
      role: z.enum(["customer", "driver"]).optional()
    })
    .strict(),
  refresh: z
    .object({
      refreshToken: z.string().min(10).max(2048)
    })
    .strict(),
  authOtpRequest: z
    .object({
      destination: authDestinationSchema,
      role: z.enum(["customer", "driver"]),
      channel: z.enum(["sms", "email"]).optional()
    })
    .strict(),
  authOtpVerify: z
    .object({
      destination: authDestinationSchema,
      role: z.enum(["customer", "driver"]),
      code: z.string().regex(/^\d{6}$/)
    })
    .strict(),
  authAdminLogin: z
    .object({
      destination: z.string().min(3).max(255),
      password: z.string().min(8).max(1024)
    })
    .strict(),
  authMfaChallenge: z
    .object({
      challengeToken: z.string().min(16).max(512),
      totpCode: z.string().regex(/^\d{6}$/).optional(),
      recoveryCode: z.string().min(8).max(128).optional()
    })
    .strict()
    .refine((value) => Boolean(value.totpCode || value.recoveryCode), {
      message: "Either totpCode or recoveryCode is required",
      path: ["totpCode"]
    }),
  authOauthToken: z
    .object({
      grant_type: z.literal("refresh_token"),
      refresh_token: z.string().min(10).max(2048)
    })
    .strict(),
  authOauthRevoke: z
    .object({
      token: z.string().min(10).max(2048)
    })
    .strict(),
  authLogout: z
    .object({
      refreshToken: z.string().min(10).max(2048)
    })
    .strict(),
  bookingCreate: z
    .object({
      userId: uuidSchema,
      pickup: coordinatesSchema,
      drop: coordinatesSchema.optional(),
      destination: coordinatesSchema.optional(),
      vehicleType: z.enum(["bike", "car", "car_plus"]),
      distanceKm: z.number().positive().optional(),
      paymentMethod: bookingPaymentMethodSchema.optional(),
      quoteId: z.string().min(8).max(128).optional(),
      priceSnapshot: priceSnapshotSchema.optional()
    })
    .strict()
    .superRefine((value, context) => {
      if (!value.drop && !value.destination) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destination"],
          message: "Either destination or drop is required"
        });
      }
    })
    .transform((value) => ({
      ...value,
      drop: value.drop || value.destination
    })),
  paymentCreate: z
    .object({
      rideId: uuidSchema,
      userId: uuidSchema,
      amount: moneyIntegerSchema,
      currency: z.string().regex(/^[A-Z]{3}$/).optional(),
      method: z.enum(["cash", "card", "wallet", "momo", "vnpay"])
    })
    .strict()
};

export const websocketSchemas = {
  driverLocationUpdate: z
    .object({
      type: z.literal("driver.location.update"),
      payload: z
        .object({
          rideId: uuidSchema,
          driverId: uuidSchema.optional(),
          rideStatus: z.string().min(1).optional(),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          recordedAt: isoDateSchema
        })
        .strict()
    })
    .strict()
};
