const argon2 = require('argon2');

async function hashPassword(plainTextPassword) {
    return argon2.hash(String(plainTextPassword), {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
    });
}

async function verifyPassword(plainTextPassword, passwordHash) {
    if (!passwordHash) {
        return false;
    }

    try {
        return await argon2.verify(passwordHash, String(plainTextPassword));
    } catch (_error) {
        return false;
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
};
