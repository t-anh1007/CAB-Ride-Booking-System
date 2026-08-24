const { z } = require('zod');

const adminLoginSchema = z.object({
    destination: z.string().trim().min(3).max(255),
    password: z.string().min(8).max(1024),
});

const mfaChallengeSchema = z
    .object({
        challengeToken: z.string().trim().min(16).max(512),
        totpCode: z
            .string()
            .trim()
            .regex(/^\d{6}$/, 'TOTP code must be a 6-digit value')
            .optional(),
        recoveryCode: z.string().trim().min(8).max(128).optional(),
    })
    .refine((value) => Boolean(value.totpCode || value.recoveryCode), {
        message: 'Either totpCode or recoveryCode is required',
        path: ['totpCode'],
    });

module.exports = {
    adminLoginSchema,
    mfaChallengeSchema,
};
