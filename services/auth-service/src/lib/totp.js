const crypto = require('crypto');
const speakeasy = require('speakeasy');

function generateTotpSecret({ accountLabel, issuer }) {
    const secret = speakeasy.generateSecret({
        length: 32,
        name: `${issuer}:${accountLabel}`,
        issuer,
    });

    return {
        base32: secret.base32,
        otpauthUrl: secret.otpauth_url,
    };
}

function verifyTotpCode({ secretBase32, token, window = 1 }) {
    return speakeasy.totp.verify({
        secret: secretBase32,
        encoding: 'base32',
        token: String(token || '').trim(),
        window,
    });
}

function generateRecoveryCodes(count = 8) {
    return Array.from({ length: count }).map(() => {
        const code = crypto.randomBytes(5).toString('hex').toUpperCase();
        return `${code.slice(0, 5)}-${code.slice(5)}`;
    });
}

function hashRecoveryCode(code) {
    return crypto.createHash('sha256').update(String(code).toUpperCase()).digest('hex');
}

module.exports = {
    generateTotpSecret,
    verifyTotpCode,
    generateRecoveryCodes,
    hashRecoveryCode,
};
