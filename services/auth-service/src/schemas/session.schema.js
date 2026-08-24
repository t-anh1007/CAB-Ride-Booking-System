const { z } = require('zod');

const refreshSchema = z.object({
    refreshToken: z.string().trim().min(32).max(2048),
});

const logoutSchema = z.object({
    refreshToken: z.string().trim().min(32).max(2048),
});

const logoutAllSchema = z.object({
    refreshToken: z.string().trim().min(32).max(2048),
});

const oauthTokenSchema = z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().trim().min(32).max(2048),
});

const oauthRevokeSchema = z.object({
    token: z.string().trim().min(32).max(2048),
});

module.exports = {
    refreshSchema,
    logoutSchema,
    logoutAllSchema,
    oauthTokenSchema,
    oauthRevokeSchema,
};
