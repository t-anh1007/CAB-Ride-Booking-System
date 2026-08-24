/**
 * Runs gateway auth dry-run steps, writes one HTML file per case for browser screenshots.
 * Usage (from services/auth-service): node scripts/dry-run-with-html.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CASE_DIR = path.join(ROOT, 'images', 'browser-cases');

const BASE = process.env.GATEWAY_BASE_URL || 'http://127.0.0.1:3000/api/v1';
const CUSTOMER = '+84900000001';
const DRIVER = '+84900000002';
const ADMIN_EMAIL = 'admin@cab.local';
const ADMIN_PASSWORD = 'ChangeMe123!';
const RIDE_ACTIVE = 'ride-active-assigned-driver-1';
const RIDE_DONE = 'ride-completed-assigned-driver-1';

const state = {
    accessToken: '',
    refreshToken: '',
    driverAccessToken: '',
    driverRefreshToken: '',
    adminChallengeToken: '',
    otpauthUrl: '',
};

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function writeCase(slug, title, status, body) {
    const file = path.join(CASE_DIR, `${slug}.html`);
    const json = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    const qr =
        state.otpauthUrl && slug === 'admin-password-mfa-setup'
            ? `<p><strong>Quét QR bằng app authenticator (Google Authenticator / Authy):</strong></p>
               <p><img src="https://quickchart.io/qr?size=280&text=${encodeURIComponent(state.otpauthUrl)}" width="280" height="280" alt="MFA QR" /></p>
               <p><small>otpauth URL (backup): <code>${esc(state.otpauthUrl)}</code></small></p>`
            : '';
    const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  body{font-family:Segoe UI,system-ui,sans-serif;margin:0;padding:20px;background:#121212;color:#e0e0e0;}
  h1{font-size:1.1rem;color:#4fc3f7;margin:0 0 8px;}
  .status{font-size:0.95rem;color:#81c784;margin-bottom:12px;}
  pre{white-space:pre-wrap;word-break:break-all;background:#1e1e1e;padding:14px;border-radius:8px;border:1px solid #333;font-size:12px;line-height:1.4;}
  code{color:#ffcc80;}
</style></head>
<body>
  <h1>${esc(title)}</h1>
  <div class="status">HTTP ${esc(String(status))}</div>
  ${qr}
  <pre>${esc(json)}</pre>
</body></html>`;
    fs.mkdirSync(CASE_DIR, { recursive: true });
    fs.writeFileSync(file, html, 'utf8');
    return slug;
}

async function jsonFetch(method, urlPath, { headers = {}, body } = {}) {
    const url = urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`;
    const h = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const r = await fetch(url, {
        method,
        headers: h,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        json = { raw: text };
    }
    return { status: r.status, json };
}

async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() {
    fs.mkdirSync(CASE_DIR, { recursive: true });

    let r = await jsonFetch('GET', '/health');
    writeCase('health-gateway-200', '[Health] Gateway Health', r.status, r.json);

    r = await jsonFetch('GET', '/auth/health');
    writeCase('health-auth-200', '[Health] Auth Health', r.status, r.json);

    r = await jsonFetch('POST', '/auth/login/otp/request', {
        body: { destination: CUSTOMER, role: 'customer', channel: 'sms' },
    });
    if (r.status === 429) {
        await sleep((r.json?.error?.details?.retryAfterSeconds || 45) * 1000);
        r = await jsonFetch('POST', '/auth/login/otp/request', {
            body: { destination: CUSTOMER, role: 'customer', channel: 'sms' },
        });
    }
    writeCase('otp-customer-request-202', '[OTP Customer] Request OTP', r.status, r.json);
    const otpCustomer = r.json?.data?.debugOtpCode;
    if (!otpCustomer) {
        throw new Error('No debugOtpCode for customer; is NODE_ENV production?');
    }

    r = await jsonFetch('POST', '/auth/login/otp/verify', {
        body: { destination: CUSTOMER, role: 'customer', code: otpCustomer },
    });
    writeCase('otp-customer-verify-200', '[OTP Customer] Verify OTP', r.status, r.json);
    state.accessToken = r.json?.data?.accessToken || '';
    state.refreshToken = r.json?.data?.refreshToken || '';

    r = await jsonFetch('POST', '/auth/refresh', {
        body: { refreshToken: state.refreshToken },
    });
    writeCase('oauth-refresh-customer-200', '[OAuth2] Refresh Customer Token', r.status, r.json);
    state.accessToken = r.json?.data?.accessToken || state.accessToken;
    state.refreshToken = r.json?.data?.refreshToken || state.refreshToken;

    r = await jsonFetch('POST', '/auth/oauth/token', {
        body: { grant_type: 'refresh_token', refresh_token: state.refreshToken },
    });
    writeCase('oauth-token-alias-200', '[OAuth2] OAuth Token Alias', r.status, r.json);
    state.accessToken = r.json?.data?.accessToken || state.accessToken;
    state.refreshToken = r.json?.data?.refreshToken || state.refreshToken;

    r = await jsonFetch('POST', '/auth/login/otp/request', {
        body: { destination: DRIVER, role: 'driver', channel: 'sms' },
    });
    if (r.status === 429) {
        await sleep((r.json?.error?.details?.retryAfterSeconds || 45) * 1000);
        r = await jsonFetch('POST', '/auth/login/otp/request', {
            body: { destination: DRIVER, role: 'driver', channel: 'sms' },
        });
    }
    writeCase('otp-driver-request-202', '[OTP Driver] Request OTP', r.status, r.json);
    const otpDriver = r.json?.data?.debugOtpCode;
    if (!otpDriver) throw new Error('No debugOtpCode for driver');

    r = await jsonFetch('POST', '/auth/login/otp/verify', {
        body: { destination: DRIVER, role: 'driver', code: otpDriver },
    });
    writeCase('otp-driver-verify-200', '[OTP Driver] Verify OTP', r.status, r.json);
    state.driverAccessToken = r.json?.data?.accessToken || '';
    state.driverRefreshToken = r.json?.data?.refreshToken || '';

    r = await jsonFetch('GET', '/protected/customer');
    writeCase('rbac-customer-no-token-401', '[RBAC] Protected Customer — No Token', r.status, r.json);

    r = await jsonFetch('GET', '/protected/admin', {
        headers: { Authorization: `Bearer ${state.accessToken}` },
    });
    writeCase('rbac-admin-customer-token-403', '[RBAC] Protected Admin — Customer Token', r.status, r.json);

    r = await jsonFetch('GET', '/protected/driver', {
        headers: { Authorization: `Bearer ${state.driverAccessToken}` },
    });
    writeCase('rbac-driver-token-200', '[RBAC] Protected Driver — Driver Token', r.status, r.json);

    r = await jsonFetch('PATCH', `/ride/driver/rides/${RIDE_ACTIVE}/location`, {
        headers: {
            Authorization: `Bearer ${state.driverAccessToken}`,
            'Content-Type': 'application/json',
        },
        body: { latitude: 10.7769, longitude: 106.7009 },
    });
    writeCase('abac-active-ride-location-200', '[ABAC] Driver Update Active Ride Location', r.status, r.json);

    r = await jsonFetch('PATCH', `/ride/driver/rides/${RIDE_DONE}/location`, {
        headers: {
            Authorization: `Bearer ${state.driverAccessToken}`,
            'Content-Type': 'application/json',
        },
        body: { latitude: 10.7769, longitude: 106.7009 },
    });
    writeCase('abac-completed-ride-location-403', '[ABAC] Driver Update Completed Ride Location', r.status, r.json);

    r = await jsonFetch('GET', '/auth/auth/me', {
        headers: { Authorization: `Bearer ${state.accessToken}` },
    });
    writeCase('jwt-auth-me-customer-200', '[JWT] Auth Me — Customer', r.status, r.json);

    r = await jsonFetch('POST', '/auth/oauth/revoke', {
        body: { token: state.refreshToken },
    });
    writeCase('oauth-revoke-200', '[OAuth2] OAuth Revoke Alias', r.status, r.json);

    r = await jsonFetch('POST', '/auth/login/admin', {
        body: { destination: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    state.adminChallengeToken = r.json?.data?.challengeToken || '';
    const setup = r.json?.data?.mfaSetup;
    state.otpauthUrl = setup?.otpauthUrl || '';
    writeCase('admin-password-mfa-setup', '[Admin] Password Login — MFA setup / challenge', r.status, r.json);

    const slugs = [
        'health-gateway-200',
        'health-auth-200',
        'otp-customer-request-202',
        'otp-customer-verify-200',
        'oauth-refresh-customer-200',
        'oauth-token-alias-200',
        'otp-driver-request-202',
        'otp-driver-verify-200',
        'rbac-customer-no-token-401',
        'rbac-admin-customer-token-403',
        'rbac-driver-token-200',
        'abac-active-ride-location-200',
        'abac-completed-ride-location-403',
        'jwt-auth-me-customer-200',
        'oauth-revoke-200',
        'admin-password-mfa-setup',
    ];

    console.log(JSON.stringify({ slugs, caseDir: CASE_DIR }, null, 2));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
