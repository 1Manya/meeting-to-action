require('dotenv').config();
const express = require('express');
const cors = require('cors');

const meetingsRouter = require('./routes/meetings');
const actionItemsRouter = require('./routes/actionItems');
const apiKeyAuth = require('./middleware/apiKeyAuth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' })); // meeting notes can be long-ish

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth applies to everything under /api — /health stays open so
// Render's health checks (and you) can always confirm the server is up.
app.use('/api', apiKeyAuth);

app.use('/api/meetings', meetingsRouter);
app.use('/api/action-items', actionItemsRouter);

// Basic error handler as a safety net for anything routes don't catch
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});
