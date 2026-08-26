import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';

import { requestContextMiddleware } from '../src/lib/request-context.js';
import { authContextMiddleware } from '../src/middleware/auth-context.js';
import { errorHandler, notFoundHandler } from '../src/middleware/error-handler.js';
import { createInMemoryUserRepository } from '../src/repositories/in-memory-user-repository.js';
import { createUserRoutes } from '../src/routes/user-routes.js';
import { createUserDomainService } from '../src/services/user-domain-service.js';

const existingUserId = '33333333-3333-4333-8333-333333333333';
const missingUserId = '44444444-4444-4444-8444-444444444444';
let baseUrl;
let server;

before(async () => {
  const repository = createInMemoryUserRepository();
  const userDomainService = createUserDomainService(repository);
  await userDomainService.upsertUserProfile(existingUserId, {
    fullName: 'Existing User',
    displayName: 'Existing',
    phone: '0901234567',
    email: 'existing@example.com'
  });

  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use(authContextMiddleware);
  app.use(createUserRoutes({
    broker: { connected: false, mode: 'test', supportedEvents: [] },
    repository,
    userDomainService
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/users`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

async function request(method, userId, body) {
  const response = await fetch(`${baseUrl}/${userId}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      'x-auth-role': 'Customer',
      'x-auth-subject-id': userId,
      'x-auth-user-id': userId,
      'x-request-id': `REQ-${userId.slice(0, 8)}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json() };
}

test('GET existing profile returns the real aggregate with 200', async () => {
  const response = await request('GET', existingUserId);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.userId, existingUserId);
  assert.equal(response.body.data.fullName, 'Existing User');
  assert.ok(response.body.data.preferences);
  assert.deepEqual(response.body.data.savedLocations, []);
});

test('GET missing profile returns 404', async () => {
  const response = await request('GET', missingUserId);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /user not found/i);
});

test('PATCH valid profile update returns 200 and the updated profile', async () => {
  const response = await request('PATCH', existingUserId, {
    displayName: 'Updated User',
    bio: 'Updated profile'
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.displayName, 'Updated User');
  assert.equal(response.body.data.bio, 'Updated profile');
  assert.equal(response.body.data.fullName, 'Existing User');
});
