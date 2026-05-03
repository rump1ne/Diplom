CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  full_name TEXT,
  position TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'HR')),
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  is_banned_from_shop BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_p2p_limit_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quests (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DAILY', 'EVENT')),
  reward_coins INTEGER NOT NULL,
  difficulty TEXT,
  deadline TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  auto_check_type TEXT NOT NULL DEFAULT 'NONE' CHECK (auto_check_type IN ('NONE', 'JIRA', 'GITHUB', 'CRM'))
);

CREATE TABLE IF NOT EXISTS user_quests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  quest_id INTEGER NOT NULL REFERENCES quests(id),
  status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'IN_REVIEW', 'COMPLETED', 'REJECTED')),
  proof_url TEXT,
  proof_screenshot_path TEXT,
  comment TEXT,
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS shop_items (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('MERCH', 'PRIVILEGE', 'EDUCATION')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_coins INTEGER NOT NULL,
  rarity TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  shop_item_id INTEGER NOT NULL REFERENCES shop_items(id),
  status TEXT NOT NULL CHECK (status IN ('OWNED', 'ACTIVATED', 'EXPIRED')),
  acquired_at TIMESTAMP NOT NULL DEFAULT now(),
  activated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('QUEST_REWARD', 'SHOP_PURCHASE', 'P2P_SEND', 'P2P_RECEIVE', 'PENALTY', 'PROMO', 'GACHA')),
  related_user_id INTEGER REFERENCES users(id),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  meta JSONB
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('COINS', 'ITEM')),
  reward_coins INTEGER,
  reward_item_id INTEGER REFERENCES shop_items(id),
  max_usages INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS promo_code_user_usages (
  id SERIAL PRIMARY KEY,
  promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  used_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, user_id)
);

CREATE TABLE IF NOT EXISTS gacha_prizes (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('NOTHING', 'COINS', 'ITEM')),
  coins_amount INTEGER,
  item_id INTEGER REFERENCES shop_items(id),
  weight INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gacha_spins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  prize_id INTEGER REFERENCES gacha_prizes(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

