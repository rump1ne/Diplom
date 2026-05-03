import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/krissquest',
  jwtSecret: process.env.NODE_ENV === 'production' ? requireEnv('JWT_SECRET') : (process.env.JWT_SECRET || 'dev_secret'),
  p2pMonthlyLimit: Number(process.env.P2P_MONTHLY_LIMIT) || 1000
};
