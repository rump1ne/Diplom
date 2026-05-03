import express from 'express';
import { authMiddleware, AuthRequest } from './commonAuth';
import { query } from '../db';
import { redeemPromoForUser } from './promo';
import { z } from 'zod';

export const usersRouter = express.Router();

usersRouter.use(authMiddleware);

usersRouter.get('/me', async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { rows: users } = await query<{
    id: number;
    email: string;
    nickname: string;
    full_name: string | null;
    position: string | null;
    avatar_url: string | null;
    role: string;
    balance: number;
    total_earned: number;
  }>(
    `SELECT id, email, nickname, full_name, position, avatar_url, role, balance, total_earned
     FROM users WHERE id = $1`,
    [userId]
  );

  const user = users[0];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { rows: statsRows } = await query<{ completed_count: string }>(
    `SELECT COUNT(*)::text AS completed_count
     FROM user_quests
     WHERE user_id = $1 AND status = 'COMPLETED'`,
    [userId]
  );

  const completedCount = Number(statsRows[0]?.completed_count ?? '0');

  res.json({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    fullName: user.full_name,
    position: user.position,
    avatarUrl: user.avatar_url,
    role: user.role,
    balance: user.balance,
    totalEarned: user.total_earned,
    completedQuests: completedCount
  });
});

usersRouter.get('/me/inventory', async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { rows } = await query<{
    id: number;
    status: string;
    acquired_at: string;
    name: string;
    description: string;
    type: string;
  }>(
    `SELECT ii.id,
            ii.status,
            ii.acquired_at,
            si.name,
            si.description,
            si.type
     FROM inventory_items ii
     JOIN shop_items si ON si.id = ii.shop_item_id
     WHERE ii.user_id = $1 AND ii.status = 'OWNED'
     ORDER BY ii.acquired_at DESC`,
    [userId]
  );

  res.json({ items: rows });
});

const promoSchema = z.object({
  code: z.string().min(3)
});

usersRouter.post('/me/promo', async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const parsed = promoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const result = await redeemPromoForUser(userId, parsed.data.code);
    res.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Promo redeem failed';
    res.status(400).json({ error: message });
  }
});

