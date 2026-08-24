const { z } = require('zod');

const registerSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(6).max(100),
    name: z.string().trim().min(2).max(100),
    role: z.enum(['customer', 'driver']).default('customer'),
});

const otpRequestSchema = z.object({
    destination: z.string().trim().min(3).max(255),
    role: z.enum(['customer', 'driver']),
    channel: z.enum(['sms', 'email']).default('sms'),
});

const otpVerifySchema = z.object({
    destination: z.string().trim().min(3).max(255),
    role: z.enum(['customer', 'driver']),
    code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, 'OTP code must be a 6-digit value'),
});

module.exports = {
    registerSchema,
    otpRequestSchema,
    otpVerifySchema,
};
