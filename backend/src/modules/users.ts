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
    activated_at: string | null;
    expires_at: string | null;
    name: string;
    description: string;
    type: string;
    image_url: string | null;
    rarity: string | null;
  }>(
    `SELECT ii.id,
            ii.status,
            ii.acquired_at,
            ii.activated_at,
            ii.expires_at,
            si.name,
            si.description,
            si.type,
            si.image_url,
            si.rarity
     FROM inventory_items ii
     JOIN shop_items si ON si.id = ii.shop_item_id
     WHERE ii.user_id = $1
       AND (ii.status = 'OWNED' OR ii.status = 'ACTIVATED')
       AND (ii.expires_at IS NULL OR ii.expires_at > now())
     ORDER BY ii.status DESC, ii.acquired_at DESC`,
    [userId]
  );

  res.json({ items: rows });
});

// ─────────────────────────────────────────────
// POST /api/users/me/inventory/:id/activate
// Активация предмета (PRIVILEGE)
// ─────────────────────────────────────────────

usersRouter.post('/me/inventory/:id/activate', async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const itemId = Number(req.params.id);
  if (Number.isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid item id' });
  }

  try {
    // Проверяем что предмет принадлежит пользователю и не активирован
    const { rows: invRows } = await query<{
      id: number;
      status: string;
      shop_item_id: number;
    }>(
      `SELECT id, status, shop_item_id
       FROM inventory_items
       WHERE id = $1 AND user_id = $2`,
      [itemId, userId]
    );

    const item = invRows[0];
    if (!item) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    if (item.status !== 'OWNED') {
      return res.status(400).json({ error: 'Предмет уже активирован или истёк' });
    }

    // Получаем duration_days товара
    const { rows: shopRows } = await query<{
      type: string;
      duration_days: number | null;
    }>(
      'SELECT type, duration_days FROM shop_items WHERE id = $1',
      [item.shop_item_id]
    );

    const shopItem = shopRows[0];
    if (!shopItem) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    // Мерч нельзя активировать
    if (shopItem.type === 'MERCH') {
      return res.status(400).json({ error: 'Мерч нельзя активировать — это физический предмет' });
    }

    // Вычисляем expires_at
    const expiresAt = shopItem.duration_days
      ? new Date(Date.now() + shopItem.duration_days * 24 * 60 * 60 * 1000)
      : null;

    await query(
      `UPDATE inventory_items
       SET status = 'ACTIVATED',
           activated_at = now(),
           expires_at = $2
       WHERE id = $1`,
      [itemId, expiresAt]
    );

    res.json({
      success: true,
      expiresAt: expiresAt ? expiresAt.toISOString() : null
    });
  } catch (e) {
    console.error('[ACTIVATE ITEM ERROR]', e);
    res.status(500).json({ error: 'Ошибка при активации предмета' });
  }
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
