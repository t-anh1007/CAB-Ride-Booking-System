const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const express = require('express');

const { createSessionRoutes } = require('../src/routes/session.routes');

test('session routes expose auth context at /api/v1/auth/me', async (t) => {
    const server = await createRouteTestServer();
    t.after(() => server.close());

    const response = await fetch(`${server.url}/api/v1/auth/me`, {
        headers: {
            authorization: 'Bearer access-token',
        },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.route, 'me');
});

test('session routes do not expose the old duplicated /api/v1/auth/auth/me path', async (t) => {
    const server = await createRouteTestServer();
    t.after(() => server.close());

    const response = await fetch(`${server.url}/api/v1/auth/auth/me`, {
        headers: {
            authorization: 'Bearer access-token',
        },
    });

    assert.equal(response.status, 404);
});

async function createRouteTestServer() {
    const app = express();
    const controller = {
        refresh: (_req, res) => res.status(200).json({ success: true, data: { route: 'refresh' } }),
        oauthToken: (_req, res) => res.status(200).json({ success: true, data: { route: 'oauthToken' } }),
        logout: (_req, res) => res.status(200).json({ success: true, data: { route: 'logout' } }),
        oauthRevoke: (_req, res) => res.status(200).json({ success: true, data: { route: 'oauthRevoke' } }),
        logoutAll: (_req, res) => res.status(200).json({ success: true, data: { route: 'logoutAll' } }),
        me: (_req, res) => res.status(200).json({ success: true, data: { route: 'me' } }),
    };

    app.use(express.json());
    app.use('/api/v1/auth', createSessionRoutes(controller));
    app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

    const server = http.createServer(app);
    server.listen(0);
    await once(server, 'listening');
    const address = server.address();

    return {
        url: `http://127.0.0.1:${address.port}`,
        close() {
            return new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        },
    };
}
