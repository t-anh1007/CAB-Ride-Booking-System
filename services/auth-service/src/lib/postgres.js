const { Pool } = require('pg');

let sharedPool = null;

function createPostgresPool(env) {
    return new Pool({
        host: env.postgres.host,
        port: env.postgres.port,
        user: env.postgres.user,
        password: env.postgres.password,
        database: env.postgres.database,
        max: env.postgres.maxPoolSize,
    });
}

function getPostgresPool(env) {
    if (!sharedPool) {
        sharedPool = createPostgresPool(env);
    }

    return sharedPool;
}

async function query(pool, text, params = []) {
    return pool.query(text, params);
}

async function checkPostgresHealth(pool) {
    await query(pool, 'SELECT 1');
    return { status: 'ok' };
}

async function closePostgresPool() {
    if (!sharedPool) {
        return;
    }

    await sharedPool.end();
    sharedPool = null;
}

module.exports = {
    createPostgresPool,
    getPostgresPool,
    query,
    checkPostgresHealth,
    closePostgresPool,
};
