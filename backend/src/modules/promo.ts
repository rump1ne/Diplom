import express from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from './commonAuth';
import { query } from '../db';

export const promoRouter = express.Router();

const redeemSchema = z.object({
  code: z.string().min(3)
});

export async function redeemPromoForUser(
  userId: number,
  code: string
): Promise<{ addedCoins: number; grantedItemId: number | null }> {
  const { rows: promoRows } = await query<{
    id: number;
    reward_type: 'COINS' | 'ITEM';
    reward_coins: number | null;
    reward_item_id: number | null;
    max_usages: number | null;
    used_count: number;
  }>(
    `SELECT id, reward_type, reward_coins, reward_item_id, max_usages, used_count
     FROM promo_codes
     WHERE code = $1
       AND is_active = TRUE
       AND (expires_at IS NULL OR expires_at > now())`,
    [code]
  );

  const promo = promoRows[0];
  if (!promo) {
    throw new Error('Промокод не найден или истёк');
  }

  if (promo.max_usages !== null && promo.used_count >= promo.max_usages) {
    throw new Error('Лимит активаций промокода исчерпан');
  }

  const { rows: usageRows } = await query<{ id: number }>(
    'SELECT id FROM promo_code_user_usages WHERE promo_code_id = $1 AND user_id = $2',
    [promo.id, userId]
  );
  if (usageRows.length > 0) {
    throw new Error('Вы уже активировали этот промокод');
  }

  let addedCoins = 0;
  let grantedItemId: number | null = null;

  if (promo.reward_type === 'COINS' && promo.reward_coins && promo.reward_coins > 0) {
    addedCoins = promo.reward_coins;
    await query('UPDATE users SET balance = balance + $1, total_earned = total_earned + $1 WHERE id = $2', [
      addedCoins,
      userId
    ]);
    await query(
      `INSERT INTO transactions (user_id, amount, type, comment, meta)
       VALUES ($1, $2, 'PROMO', $3, $4)`,
      [userId, addedCoins, 'Промокод', { code }]
    );
  }

  if (promo.reward_type === 'ITEM' && promo.reward_item_id) {
    grantedItemId = promo.reward_item_id;
    await query(
      `INSERT INTO inventory_items (user_id, shop_item_id, status)
       VALUES ($1, $2, 'OWNED')`,
      [userId, grantedItemId]
    );
  }

  await query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [promo.id]);
  await query(
    `INSERT INTO promo_code_user_usages (promo_code_id, user_id)
     VALUES ($1, $2)`,
    [promo.id, userId]
  );

  return { addedCoins, grantedItemId };
}

promoRouter.post('/redeem', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const parsed = redeemSchema.safeParse(req.body);
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

