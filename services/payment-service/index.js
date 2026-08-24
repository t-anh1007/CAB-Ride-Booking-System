const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ service: 'payment-service', status: 'ok' }));
app.get('/', (req, res) => res.send('Payment Service'));

const port = process.env.PORT || 3005;
app.listen(port, () => console.log(`Payment service listening on ${port}`));
