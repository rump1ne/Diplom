import express from 'express';
import cors from 'cors';
import { json } from 'express';
import path from 'path';
import fs from 'fs';
import { authRouter } from './modules/auth';
import { usersRouter } from './modules/users';
import { questsRouter } from './modules/quests';
import { shopRouter } from './modules/shop';
import { p2pRouter } from './modules/p2p';
import { promoRouter } from './modules/promo';
import { gachaRouter } from './modules/gacha';
import { adminRouter } from './modules/admin';

export const createApp = () => {
  const app = express();

  const allowedOrigins = process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:4000'];

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Разрешаем запросы без origin (мобильные клиенты, Postman, curl)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/quests', questsRouter);
  app.use('/api/shop', shopRouter);
  app.use('/api/p2p', p2pRouter);
  app.use('/api/promo', promoRouter);
  app.use('/api/gacha', gachaRouter);
  app.use('/api/admin', adminRouter);

  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  }

  // Глобальный обработчик ошибок — логирует все 500-е
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

  return app;
};
