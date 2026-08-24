const crypto = require('crypto');
const { SignJWT, exportJWK, importPKCS8, importSPKI, jwtVerify } = require('jose');

function createJwtService(options) {
    const { security, env = {} } = options;
    const algorithm = security.token.algorithm || 'RS256';
    const issuer = security.token.issuer;
    const audience = security.token.audience;
    const accessTokenTtlMinutes = security.token.accessTokenTtlMinutes;
    const configuredKid = security.token.activeKid || 'auth-key-local-1';

    let statePromise = null;

    async function ensureState() {
        if (!statePromise) {
            statePromise = initializeJwtState({
                algorithm,
                configuredKid,
                activePrivateKeyPem: security.token.activePrivateKeyPem,
                activePublicKeyPem: security.token.activePublicKeyPem,
                previousKid: security.token.previousKid,
                previousPublicKeyPem: security.token.previousPublicKeyPem,
                allowEphemeralFallback: env.nodeEnv === 'development',
            });
        }
        return statePromise;
    }

    return {
        async signAccessToken({
            subjectId,
            sessionId,
            roles,
            accountId,
            scopes = [],
            permissions = [],
            authMethod = 'otp',
        }) {
            const state = await ensureState();
            const normalizedRoles = Array.isArray(roles) ? roles.filter(Boolean) : [];
            const primaryRole = normalizedRoles[0] || null;
            const normalizedScopes = Array.isArray(scopes)
                ? scopes.map((item) => String(item || '').trim()).filter(Boolean)
                : [];
            const normalizedPermissions = Array.isArray(permissions)
                ? permissions.map((item) => String(item || '').trim()).filter(Boolean)
                : [];

            const token = await new SignJWT({
                typ: 'access',
                sub: subjectId,
                sid: sessionId,
                aid: accountId,
                role: primaryRole,
                roles: normalizedRoles,
                scope: normalizedScopes.join(' '),
                permissions: normalizedPermissions,
                amr: [authMethod],
            })
                .setProtectedHeader({ alg: algorithm, kid: state.kid, typ: 'JWT' })
                .setIssuer(issuer)
                .setAudience(audience)
                .setSubject(subjectId)
                .setIssuedAt()
                .setJti(crypto.randomUUID())
                .setExpirationTime(`${accessTokenTtlMinutes}m`)
                .sign(state.privateKey);

            return {
                token,
                tokenType: 'Bearer',
                expiresInSeconds: accessTokenTtlMinutes * 60,
                kid: state.kid,
            };
        },

        async verifyAccessToken(token) {
            const state = await ensureState();
            const { payload } = await jwtVerify(
                token,
                (protectedHeader) => {
                    const keyEntry = state.verificationKeys.find((item) => item.kid === protectedHeader.kid);
                    if (!keyEntry) {
                        const error = new Error('Unknown signing key identifier');
                        error.code = 'JWT_KID_UNKNOWN';
                        throw error;
                    }
                    return keyEntry.key;
                },
                {
                    issuer,
                    audience,
                    algorithms: [algorithm],
                }
            );
            return payload;
        },

        async getJwks() {
            const state = await ensureState();
            return {
                keys: state.jwks,
            };
        },

        getMetadata() {
            return {
                issuer,
                audience,
                algorithm,
                accessTokenTtlMinutes,
            };
        },
    };
}

async function initializeJwtState({
    algorithm,
    configuredKid,
    activePrivateKeyPem,
    activePublicKeyPem,
    previousKid,
    previousPublicKeyPem,
    allowEphemeralFallback,
}) {
    const privateKeyPem = activePrivateKeyPem || '';
    const publicKeyPem = activePublicKeyPem || '';

    if (privateKeyPem && publicKeyPem) {
        const privateKey = await importPKCS8(privateKeyPem, algorithm);
        const publicKey = await importSPKI(publicKeyPem, algorithm);
        const activePublicJwk = await exportPublicJwkWithKid(publicKey, configuredKid, algorithm);
        const jwks = [activePublicJwk];
        const verificationKeys = [{ kid: configuredKid, key: publicKey }];

        if (previousKid && previousPublicKeyPem) {
            const previousPublicKey = await importSPKI(previousPublicKeyPem, algorithm);
            jwks.push(await exportPublicJwkWithKid(previousPublicKey, previousKid, algorithm));
            verificationKeys.push({ kid: previousKid, key: previousPublicKey });
        }

        return {
            privateKey,
            publicKey,
            publicJwk: activePublicJwk,
            jwks,
            verificationKeys,
            kid: configuredKid,
        };
    }

    if (!allowEphemeralFallback) {
        const error = new Error('Active JWT keypair is required outside development');
        error.code = 'JWT_ACTIVE_KEYPAIR_REQUIRED';
        throw error;
    }

    const generated = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const privateKey = await importPKCS8(generated.privateKey, algorithm);
    const publicKey = await importSPKI(generated.publicKey, algorithm);
    const generatedKid = configuredKid || `auth-key-${Date.now()}`;
    const publicJwk = await exportPublicJwkWithKid(publicKey, generatedKid, algorithm);

    return {
        privateKey,
        publicKey,
        publicJwk,
        jwks: [publicJwk],
        verificationKeys: [{ kid: generatedKid, key: publicKey }],
        kid: generatedKid,
    };
}

async function exportPublicJwkWithKid(publicKey, kid, algorithm) {
    const jwk = await exportJWK(publicKey);
    return {
        ...jwk,
        use: 'sig',
        alg: algorithm,
        kid,
    };
}

module.exports = {
    createJwtService,
};
