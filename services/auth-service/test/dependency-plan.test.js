const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveDependencyPlan } = require('../src/app');

test('resolveDependencyPlan marks otp routes as redis-sensitive', () => {
    assert.deepEqual(resolveDependencyPlan({ method: 'POST', path: '/login/otp/request' }), {
        requirePostgres: false,
        requireRedis: true,
    });
    assert.deepEqual(resolveDependencyPlan({ method: 'POST', path: '/login/otp/verify' }), {
        requirePostgres: false,
        requireRedis: true,
    });
});

test('resolveDependencyPlan marks refresh and logout routes as db+redis sensitive', () => {
    assert.deepEqual(resolveDependencyPlan({ method: 'POST', path: '/refresh' }), {
        requirePostgres: true,
        requireRedis: true,
    });
    assert.deepEqual(resolveDependencyPlan({ method: 'POST', path: '/logout-all' }), {
        requirePostgres: true,
        requireRedis: true,
    });
});

test('resolveDependencyPlan marks admin login route as db-sensitive', () => {
    assert.deepEqual(resolveDependencyPlan({ method: 'POST', path: '/login/admin' }), {
        requirePostgres: true,
        requireRedis: false,
    });
});

test('resolveDependencyPlan normalizes gateway-prefixed paths', () => {
    assert.deepEqual(
        resolveDependencyPlan({ method: 'POST', path: '/api/v1/auth/login/otp/request' }),
        { requirePostgres: false, requireRedis: true }
    );
    assert.deepEqual(
        resolveDependencyPlan({ method: 'POST', path: '/api/v1/auth/refresh' }),
        { requirePostgres: true, requireRedis: true }
    );
});
