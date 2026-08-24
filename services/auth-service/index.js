const { startServer } = require('./src/server');

startServer().catch((error) => {
  console.error('[auth-service] startup failed', error);
  process.exit(1);
});
