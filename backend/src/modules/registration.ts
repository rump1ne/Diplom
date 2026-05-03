import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, withTransaction } from '../db';
import { authMiddleware, AuthRequest, requireRole } from './commonAuth';

export const registrationRouter = express.Router();

// ─────────────────────────────────────────────
// Схемы валидации
// ─────────────────────────────────────────────

const requestSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль минимум 6 символов'),
  nickname: z.string().min(2, 'Никнейм минимум 2 символа').max(50),
  position: z.string().min(2, 'Должность минимум 2 символа').max(100).optional()
});

const rejectSchema = z.object({
  reason: z.string().max(255).optional()
});

// ─────────────────────────────────────────────
// POST /api/registration/request
// Работник подаёт заявку на регистрацию
// ─────────────────────────────────────────────

registrationRouter.post('/request', async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? 'Invalid payload';
    return res.status(400).json({ error: message });
  }

  const { email, password, nickname, position } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // Проверяем нет ли уже активного пользователя с таким email
    const { rows: existingUsers } = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Проверяем нет ли уже ожидающей заявки
    const { rows: existingRequests } = await query(
      `SELECT id, status FROM registration_requests WHERE email = $1`,
      [email]
    );
    if (existingRequests.length > 0) {
      const existing = existingRequests[0] as { status: string };
      if (existing.status === 'PENDING') {
        return res.status(409).json({ error: 'Заявка с таким email уже отправлена и ожидает рассмотрения' });
      }
      if (existing.status === 'APPROVED') {
        return res.status(409).json({ error: 'Аккаунт с таким email уже создан' });
      }
      // REJECTED — позволяем подать повторно, обновляем заявку
      await query(
        `UPDATE registration_requests
         SET password_hash = $1,
             nickname = $2,
             position = $3,
             status = 'PENDING',
             rejection_reason = NULL,
             created_at = now(),
             reviewed_at = NULL,
             reviewed_by = NULL
         WHERE email = $4`,
        [passwordHash, nickname, position ?? null, email]
      );
      return res.status(200).json({ success: true, message: 'Заявка отправлена повторно' });
    }

    await query(
      `INSERT INTO registration_requests (email, password_hash, nickname, position)
       VALUES ($1, $2, $3, $4)`,
      [email, passwordHash, nickname, position ?? null]
    );

    res.status(201).json({ success: true, message: 'Заявка отправлена. Ожидайте одобрения администратором.' });
  } catch (e) {
    console.error('[REGISTRATION REQUEST ERROR]', e);
    res.status(500).json({ error: 'Ошибка при отправке заявки' });
  }
});

// ─────────────────────────────────────────────
// GET /api/registration/requests
// Список заявок для админа
// ─────────────────────────────────────────────

registrationRouter.get(
  '/requests',
  authMiddleware,
  requireRole(['ADMIN', 'HR']),
  async (_req, res) => {
    const { rows } = await query<{
      id: number;
      email: string;
      nickname: string;
      position: string | null;
      status: string;
      rejection_reason: string | null;
      created_at: string;
    }>(
      `SELECT id, email, nickname, position, status, rejection_reason, created_at
       FROM registration_requests
       WHERE status = 'PENDING'
       ORDER BY created_at ASC`,
      []
    );

    res.json({ requests: rows });
  }
);

// ─────────────────────────────────────────────
// POST /api/registration/requests/:id/approve
// Одобрить заявку — создаёт пользователя
// ─────────────────────────────────────────────

registrationRouter.post(
  '/requests/:id/approve',
  authMiddleware,
  requireRole(['ADMIN', 'HR']),
  async (req: AuthRequest, res) => {
    const requestId = Number(req.params.id);
    if (Number.isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    try {
      const newUserId = await withTransaction(async (client) => {
        const { rows } = await client.query<{
          id: number;
          email: string;
          password_hash: string;
          nickname: string;
          position: string | null;
          status: string;
        }>(
          'SELECT * FROM registration_requests WHERE id = $1 FOR UPDATE',
          [requestId]
        );

        const regRequest = rows[0];
        if (!regRequest) {
          throw Object.assign(new Error('Заявка не найдена'), { statusCode: 404 });
        }
        if (regRequest.status !== 'PENDING') {
          throw Object.assign(new Error('Заявка уже обработана'), { statusCode: 400 });
        }

        // Проверяем нет ли уже пользователя с таким email (race condition)
        const { rows: existing } = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [regRequest.email]
        );
        if (existing.length > 0) {
          throw Object.assign(
            new Error('Пользователь с таким email уже существует'),
            { statusCode: 409 }
          );
        }

        // Создаём пользователя
        const { rows: userRows } = await client.query<{ id: number }>(
          `INSERT INTO users (email, password_hash, nickname, position, role)
           VALUES ($1, $2, $3, $4, 'USER')
           RETURNING id`,
          [regRequest.email, regRequest.password_hash, regRequest.nickname, regRequest.position]
        );
        const userId = userRows[0].id;

        // Обновляем статус заявки
        await client.query(
          `UPDATE registration_requests
           SET status = 'APPROVED',
               reviewed_at = now(),
               reviewed_by = $2
           WHERE id = $1`,
          [requestId, req.userId ?? null]
        );

        return userId;
      });

      res.json({ success: true, userId: newUserId });
    } catch (e) {
      const err = e as { message?: string; statusCode?: number };
      res.status(err.statusCode ?? 500).json({ error: err.message || 'Approve failed' });
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/registration/requests/:id/reject
// Отклонить заявку
// ─────────────────────────────────────────────

registrationRouter.post(
  '/requests/:id/reject',
  authMiddleware,
  requireRole(['ADMIN', 'HR']),
  async (req: AuthRequest, res) => {
    const requestId = Number(req.params.id);
    if (Number.isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const parsed = rejectSchema.safeParse(req.body);
    const reason = parsed.success ? (parsed.data.reason ?? null) : null;

    const { rows } = await query(
      'SELECT id, status FROM registration_requests WHERE id = $1',
      [requestId]
    );
    const regRequest = rows[0] as { status: string } | undefined;

    if (!regRequest) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }
    if ((regRequest as { status: string }).status !== 'PENDING') {
      return res.status(400).json({ error: 'Заявка уже обработана' });
    }

    await query(
      `UPDATE registration_requests
       SET status = 'REJECTED',
           rejection_reason = $2,
           reviewed_at = now(),
           reviewed_by = $3
       WHERE id = $1`,
      [requestId, reason, req.userId ?? null]
    );

    res.json({ success: true });
  }
);
