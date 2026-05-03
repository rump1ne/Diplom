import express from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from './commonAuth';
import { withTransaction } from '../db';
import { config } from '../config';

export const p2pRouter = express.Router();

const transferSchema = z.object({
  toUserId: z.number().int().positive(),
  amount: z.number().int().positive(),
  comment: z.string().max(255).optional()
});

p2pRouter.post('/transfer', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const { toUserId, amount, comment } = parsed.data;

  if (toUserId === userId) {
    return res.status(400).json({ error: 'Нельзя перевести себе' });
  }

  try {
    await withTransaction(async (client) => {
      const { rows: senderRows } = await client.query<{ id: number; balance: number }>(
        'SELECT id, balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      const sender = senderRows[0];
      if (!sender) throw Object.assign(new Error('Sender not found'), { statusCode: 404 });

      const { rows: receiverRows } = await client.query<{ id: number }>(
        'SELECT id FROM users WHERE id = $1',
        [toUserId]
      );
      if (!receiverRows[0]) throw Object.assign(new Error('Получатель не найден'), { statusCode: 404 });

      if (sender.balance < amount) {
        throw Object.assign(new Error('Недостаточно Крисс-коинов'), { statusCode: 400 });
      }

      const { rows: monthRows } = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total
         FROM transactions
         WHERE user_id = $1
           AND type = 'P2P_SEND'
           AND date_trunc('month', created_at) = date_trunc('month', now())`,
        [userId]
      );
      const alreadySent = Number(monthRows[0]?.total ?? '0');
      if (alreadySent + amount > config.p2pMonthlyLimit) {
        throw Object.assign(new Error('Превышен месячный лимит переводов'), { statusCode: 400 });
      }

      await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]);
      await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, toUserId]);

      await client.query(
        `INSERT INTO transactions (user_id, amount, type, related_user_id, comment)
         VALUES ($1, $2, 'P2P_SEND', $3, $4)`,
        [userId, amount, toUserId, comment || 'Спасибо!']
      );
      await client.query(
        `INSERT INTO transactions (user_id, amount, type, related_user_id, comment)
         VALUES ($1, $2, 'P2P_RECEIVE', $3, $4)`,
        [toUserId, amount, userId, comment || 'Спасибо!']
      );
    });

    res.json({ success: true });
  } catch (e) {
    const err = e as { message?: string; statusCode?: number };
    const status = err.statusCode ?? 500;
    res.status(status).json({ error: err.message || 'Transfer failed' });
  }
});
