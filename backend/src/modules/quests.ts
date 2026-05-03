import express from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from './commonAuth';
import { query } from '../db';

export const questsRouter = express.Router();

questsRouter.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = req.query.type === 'EVENT' ? 'EVENT' : 'DAILY';

  const { rows } = await query<{
    id: number;
    title: string;
    description: string;
    type: string;
    reward_coins: number;
    deadline: string | null;
    status: string | null;
  }>(
    `SELECT q.id,
            q.title,
            q.description,
            q.type,
            q.reward_coins,
            q.deadline,
            uq.status
     FROM quests q
     LEFT JOIN user_quests uq
       ON uq.quest_id = q.id AND uq.user_id = $1
     WHERE q.type = $2 AND q.is_active = TRUE
     ORDER BY q.id`,
    [userId, type]
  );

  res.json({ quests: rows });
});

const submitSchema = z.object({
  proofUrl: z.string().url().optional(),
  comment: z.string().max(500).optional()
});

questsRouter.post('/:id/submit', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const questId = Number(req.params.id);
  if (Number.isNaN(questId)) {
    return res.status(400).json({ error: 'Invalid quest id' });
  }

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const { proofUrl, comment } = parsed.data;

  const { rows: existingRows } = await query<{ id: number; status: string }>(
    `SELECT id, status FROM user_quests WHERE user_id = $1 AND quest_id = $2`,
    [userId, questId]
  );

  if (existingRows.length === 0) {
    await query(
      `INSERT INTO user_quests (user_id, quest_id, status, proof_url, comment, submitted_at)
       VALUES ($1, $2, 'IN_REVIEW', $3, $4, now())`,
      [userId, questId, proofUrl ?? null, comment ?? null]
    );
  } else {
    const current = existingRows[0];
    if (current.status === 'IN_REVIEW') {
      return res.status(400).json({ error: 'Заявка уже на модерации' });
    }
    await query(
      `UPDATE user_quests
       SET status = 'IN_REVIEW',
           proof_url = $3,
           comment = $4,
           submitted_at = now()
       WHERE id = $1`,
      [current.id, questId, proofUrl ?? null, comment ?? null]
    );
  }

  res.json({ success: true });
});

