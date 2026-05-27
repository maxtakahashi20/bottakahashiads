const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { env } = require('./config/env');
const { authRouter } = require('./routes/auth');
const { apiRouter } = require('./routes/api');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: env.webUrl,
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '512kb' }));

app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Erro interno' });
});

app.listen(env.port, () => {
  console.log(`[Takahashi Ads API] http://localhost:${env.port}`);
  console.log(`[Takahashi Ads API] Web: ${env.webUrl}`);
});
