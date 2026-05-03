import express from 'express';
import { authMiddleware, AuthRequest } from './commonAuth';
import { query, withTransaction } from '../db';

export const shopRouter = express.Router();

shopRouter.get('/items', async (_req, res) => {
  const { rows } = await query<{
    id: number;
    type: string;
    name: string;
    description: string;
    price_coins: number;
    rarity: string | null;
  }>(`
    SELECT id, type, name, description, price_coins, rarity
    FROM shop_items
    WHERE is_active = TRUE
      AND (rarity IS NULL OR rarity <> 'CURSE')
    ORDER BY id
  `);

  res.json({ items: rows });
});

shopRouter.post('/items/:id/purchase', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const itemId = Number(req.params.id);
  if (Number.isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid item id' });
  }

  try {
    const inventoryItemId = await withTransaction(async (client) => {
      const { rows: userRows } = await client.query<{
        id: number;
        balance: number;
        is_banned_from_shop: boolean;
      }>('SELECT id, balance, is_banned_from_shop FROM users WHERE id = $1 FOR UPDATE', [userId]);

      const user = userRows[0];
      if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
      if (user.is_banned_from_shop) {
        throw Object.assign(new Error('Покупки в магазине временно недоступны'), { statusCode: 403 });
      }

      const { rows: itemRows } = await client.query<{ id: number; price_coins: number }>(
        'SELECT id, price_coins FROM shop_items WHERE id = $1 AND is_active = TRUE',
        [itemId]
      );
      const item = itemRows[0];
      if (!item) throw Object.assign(new Error('Товар не найден'), { statusCode: 404 });

      if (user.balance < item.price_coins) {
        throw Object.assign(new Error('Недостаточно Крисс-коинов'), { statusCode: 400 });
      }

      await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [item.price_coins, userId]);

      const { rows: invRows } = await client.query<{ id: number }>(
        `INSERT INTO inventory_items (user_id, shop_item_id, status)
         VALUES ($1, $2, 'OWNED')
         RETURNING id`,
        [userId, itemId]
      );

      await client.query(
        `INSERT INTO transactions (user_id, amount, type, comment, meta)
         VALUES ($1, $2, 'SHOP_PURCHASE', $3, $4)`,
        [userId, -item.price_coins, 'Покупка в магазине', { itemId }]
      );

      return invRows[0].id;
    });

    res.json({ inventoryItemId });
  } catch (e) {
    const err = e as { message?: string; statusCode?: number };
    const status = err.statusCode ?? 500;
    res.status(status).json({ error: err.message || 'Purchase failed' });
  }
});
