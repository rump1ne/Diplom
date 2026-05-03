import express from 'express';
import { authMiddleware, AuthRequest } from './commonAuth';
import { query, withTransaction } from '../db';

export const gachaRouter = express.Router();

const SPIN_COST = 50;

gachaRouter.get('/config', async (_req, res) => {
  const { rows } = await query<{
    id: number;
    label: string;
    kind: 'NOTHING' | 'COINS' | 'ITEM';
    weight: number;
  }>(
    `SELECT id, label, kind, weight
     FROM gacha_prizes
     ORDER BY id`,
    []
  );

  const totalWeight = rows.reduce((acc, p) => acc + p.weight, 0);

  res.json({
    cost: SPIN_COST,
    prizes: rows,
    totalWeight
  });
});

gachaRouter.post('/spin', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const prize = await withTransaction(async (client) => {
      const { rows: userRows } = await client.query<{
        id: number;
        balance: number;
        is_banned_from_shop: boolean;
      }>('SELECT id, balance, is_banned_from_shop FROM users WHERE id = $1 FOR UPDATE', [userId]);

      const user = userRows[0];
      if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
      if (user.is_banned_from_shop) {
        throw Object.assign(new Error('Доступ к гаче заблокирован'), { statusCode: 403 });
      }
      if (user.balance < SPIN_COST) {
        throw Object.assign(new Error('Недостаточно Крисс-коинов'), { statusCode: 400 });
      }

      const { rows: prizeRows } = await client.query<{
        id: number;
        label: string;
        kind: 'NOTHING' | 'COINS' | 'ITEM';
        weight: number;
        coins_amount: number | null;
        item_id: number | null;
      }>('SELECT id, label, kind, weight, coins_amount, item_id FROM gacha_prizes', []);

      if (prizeRows.length === 0) {
        throw Object.assign(new Error('Gacha is not configured'), { statusCode: 500 });
      }

      await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [SPIN_COST, userId]);
      await client.query(
        `INSERT INTO transactions (user_id, amount, type, comment)
         VALUES ($1, $2, 'GACHA', $3)`,
        [userId, -SPIN_COST, 'Крутка Gacha Box']
      );

      const totalWeight = prizeRows.reduce((acc, p) => acc + p.weight, 0);
      const rnd = Math.random() * totalWeight;
      let acc = 0;
      let selected = prizeRows[0];
      for (const p of prizeRows) {
        acc += p.weight;
        if (rnd <= acc) {
          selected = p;
          break;
        }
      }

      let rewardCoins = 0;
      let inventoryItemId: number | null = null;

      if (selected.kind === 'COINS' && selected.coins_amount && selected.coins_amount > 0) {
        rewardCoins = selected.coins_amount;
        await client.query(
          'UPDATE users SET balance = balance + $1, total_earned = total_earned + $1 WHERE id = $2',
          [rewardCoins, userId]
        );
        await client.query(
          `INSERT INTO transactions (user_id, amount, type, comment, meta)
           VALUES ($1, $2, 'GACHA', $3, $4)`,
          [userId, rewardCoins, 'Выигрыш в Gacha', { prizeId: selected.id }]
        );
      }

      if (selected.kind === 'ITEM' && selected.item_id) {
        const { rows: invRows } = await client.query<{ id: number }>(
          `INSERT INTO inventory_items (user_id, shop_item_id, status)
           VALUES ($1, $2, 'OWNED')
           RETURNING id`,
          [userId, selected.item_id]
        );
        inventoryItemId = invRows[0].id;
      }

      await client.query(
        `INSERT INTO gacha_spins (user_id, prize_id)
         VALUES ($1, $2)`,
        [userId, selected.id]
      );

      return {
        id: selected.id,
        label: selected.label,
        kind: selected.kind,
        rewardCoins,
        inventoryItemId
      };
    });

    res.json({ prize });
  } catch (e) {
    const err = e as { message?: string; statusCode?: number };
    const status = err.statusCode ?? 500;
    res.status(status).json({ error: err.message || 'Spin failed' });
  }
});
