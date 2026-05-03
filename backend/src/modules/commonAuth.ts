import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  userId?: number;
  role?: 'USER' | 'ADMIN' | 'HR';
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as unknown as {
      sub: number;
      role: 'USER' | 'ADMIN' | 'HR';
    };
    req.userId = decoded.sub;
    req.role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole =
  (roles: Array<'USER' | 'ADMIN' | 'HR'>) => (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };

