const { hashPassword } = require('../lib/password');

function createAdminBootstrapService(options) {
    const {
        authAccountsRepository,
        adminCredentialsRepository,
        adminBootstrap,
        logger = console,
    } = options;

    return {
        async bootstrap() {
            const email = normalizeEmail(adminBootstrap && adminBootstrap.email);
            const password = String((adminBootstrap && adminBootstrap.password) || '');

            if (!email || !password) {
                logger.warn('Admin bootstrap skipped: missing AUTH_BOOTSTRAP_ADMIN_EMAIL or AUTH_BOOTSTRAP_ADMIN_PASSWORD');
                return { status: 'skipped', reason: 'missing_bootstrap_credentials' };
            }

            let account = await authAccountsRepository.findByDestination({
                destination: email,
                destinationType: 'email',
            });
            const accountExisted = Boolean(account);

            if (!account) {
                account = await authAccountsRepository.createAccount({
                    destination: email,
                    destinationType: 'email',
                    status: 'active',
                });
            }

            await authAccountsRepository.assignRole({ accountId: account.id, role: 'admin' });
            await authAccountsRepository.updateStatus(account.id, 'active');

            const passwordHash = await hashPassword(password);
            await adminCredentialsRepository.upsertCredential({
                accountId: account.id,
                passwordHash,
                mfaRequired: true,
            });

            logger.info('Admin bootstrap completed', { accountId: account.id, destination: email });
            return {
                status: 'ok',
                accountId: account.id,
                destination: email,
                idempotent: accountExisted,
                created: !accountExisted,
            };
        },
    };
}

function normalizeEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
}

module.exports = {
    createAdminBootstrapService,
};
