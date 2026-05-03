import express from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest, requireRole } from './commonAuth';
import { query, withTransaction } from '../db';

export const adminRouter = express.Router();

adminRouter.use(authMiddleware, requireRole(['ADMIN', 'HR']));

const penaltySchema = z.object({
  userId: z.number().int().positive(),
  amount: z.number().int().positive(),
  reason: z.string().max(255)
});

adminRouter.post('/penalty', async (req: AuthRequest, res) => {
  const parsed = penaltySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const { userId, amount, reason } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const { rows } = await client.query<{ balance: number }>(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      const user = rows[0];
      if (!user) throw Object.assign(new Error('Пользователь не найден'), { statusCode: 404 });
      if (user.balance < amount) {
        throw Object.assign(
          new Error(`Недостаточно средств: баланс ${user.balance} KK, штраф ${amount} KK`),
          { statusCode: 400 }
        );
      }

      await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]);
      await client.query(
        `INSERT INTO transactions (user_id, amount, type, comment)
         VALUES ($1, $2, 'PENALTY', $3)`,
        [userId, -amount, reason]
      );
    });

    res.json({ success: true });
  } catch (e) {
    const err = e as { message?: string; statusCode?: number };
    res.status(err.statusCode ?? 500).json({ error: err.message || 'Penalty failed' });
  }
});

const banSchema = z.object({
  userId: z.number().int().positive(),
  banned: z.boolean()
});

adminRouter.post('/ban', async (req: AuthRequest, res) => {
  const parsed = banSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const { userId, banned } = parsed.data;

  const { rows } = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (!rows[0]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  await query('UPDATE users SET is_banned_from_shop = $1 WHERE id = $2', [banned, userId]);

  res.json({ success: true });
});

adminRouter.get('/quests/submissions', async (_req, res) => {
  const { rows } = await query<{
    id: number;
    user_id: number;
    quest_id: number;
    status: string;
    proof_url: string | null;
    comment: string | null;
    submitted_at: string | null;
  }>(
    `SELECT id, user_id, quest_id, status, proof_url, comment, submitted_at
     FROM user_quests
     WHERE status = 'IN_REVIEW'
     ORDER BY submitted_at DESC NULLS LAST`,
    []
  );

  res.json({ submissions: rows });
});

adminRouter.post('/quests/submissions/:id/approve', async (req: AuthRequest, res) => {
  const submissionId = Number(req.params.id);
  if (Number.isNaN(submissionId)) {
    return res.status(400).json({ error: 'Invalid submission id' });
  }

  try {
    const reward = await withTransaction(async (client) => {
      const { rows } = await client.query<{
        id: number;
        user_id: number;
        quest_id: number;
        status: string;
      }>('SELECT id, user_id, quest_id, status FROM user_quests WHERE id = $1 FOR UPDATE', [submissionId]);

      const submission = rows[0];
      if (!submission) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });
      if (submission.status !== 'IN_REVIEW') {
        throw Object.assign(new Error('Заявка уже обработана'), { statusCode: 400 });
      }

      const { rows: questRows } = await client.query<{ reward_coins: number }>(
        'SELECT reward_coins FROM quests WHERE id = $1',
        [submission.quest_id]
      );
      const rewardCoins = questRows[0]?.reward_coins ?? 0;

      await client.query(
        `UPDATE user_quests
         SET status = 'COMPLETED',
             reviewed_at = now(),
             reviewed_by = $2
         WHERE id = $1`,
        [submissionId, req.userId ?? null]
      );

      if (rewardCoins > 0) {
        await client.query(
          'UPDATE users SET balance = balance + $1, total_earned = total_earned + $1 WHERE id = $2',
          [rewardCoins, submission.user_id]
        );
        await client.query(
          `INSERT INTO transactions (user_id, amount, type, comment, meta)
           VALUES ($1, $2, 'QUEST_REWARD', $3, $4)`,
          [submission.user_id, rewardCoins, 'Награда за квест', { questId: submission.quest_id }]
        );
      }

      return rewardCoins;
    });

    res.json({ success: true, reward });
  } catch (e) {
    const err = e as { message?: string; statusCode?: number };
    res.status(err.statusCode ?? 500).json({ error: err.message || 'Approve failed' });
  }
});

adminRouter.post('/quests/submissions/:id/reject', async (req: AuthRequest, res) => {
  const submissionId = Number(req.params.id);
  if (Number.isNaN(submissionId)) {
    return res.status(400).json({ error: 'Invalid submission id' });
  }

  const { rows } = await query('SELECT id, status FROM user_quests WHERE id = $1', [submissionId]);
  if (!rows[0]) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  await query(
    `UPDATE user_quests
     SET status = 'REJECTED',
         reviewed_at = now(),
         reviewed_by = $2
     WHERE id = $1`,
    [submissionId, req.userId ?? null]
  );

  res.json({ success: true });
});

adminRouter.get('/transactions', async (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const type = typeof req.query.type === 'string' ? req.query.type : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (userId && !Number.isNaN(userId)) {
    params.push(userId);
    conditions.push(`user_id = $${params.length}`);
  }

  if (type) {
    params.push(type);
    conditions.push(`type = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit);
  params.push(offset);

  const { rows } = await query<{
    id: number;
    user_id: number;
    amount: number;
    type: string;
    comment: string | null;
    created_at: string;
  }>(
    `SELECT id, user_id, amount, type, comment, created_at
     FROM transactions
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ transactions: rows, page, limit });
});
