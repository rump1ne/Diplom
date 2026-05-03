import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db';
import { config } from '../config';
import { authMiddleware, AuthRequest } from './commonAuth';

export const authRouter = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  nickname: z.string().min(2),
  position: z.string().min(2).optional()
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const { email, password, nickname, position } = parsed.data;

  const hashed = await bcrypt.hash(password, 10);

  try {
    const { rows } = await query<{ id: number }>(
      `INSERT INTO users (email, password_hash, nickname, position, role)
       VALUES ($1, $2, $3, $4, 'USER')
       RETURNING id`,
      [email, hashed, nickname, position ?? null]
    );
    const userId = rows[0].id;
    const token = jwt.sign({ sub: userId, role: 'USER' }, config.jwtSecret, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        nickname,
        position: position ?? null,
        role: 'USER'
      }
    });
  } catch (e) {
    // PostgreSQL unique violation
    if (e instanceof Error && 'code' in e && (e as unknown as { code: string }).code === '23505') {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }
    res.status(400).json({ error: 'Ошибка регистрации' });
  }
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const { email, password } = parsed.data;

  const { rows } = await query<{ id: number; password_hash: string; role: string; nickname: string; position: string }>(
    'SELECT id, password_hash, role, nickname, position FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });

  res.json({
    token,
    user: {
      id: user.id,
      email,
      nickname: user.nickname,
      position: user.position,
      role: user.role
    }
  });
});

authRouter.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  res.json({ userId: req.userId, role: req.role });
});
