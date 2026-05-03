-- ============================================================
-- Миграция 002: исправления и улучшения схемы
-- Применять ПОСЛЕ 001_init.sql
-- ============================================================

-- 1. Уникальность: один пользователь — одна заявка на квест
ALTER TABLE user_quests
  ADD CONSTRAINT uq_user_quest UNIQUE (user_id, quest_id);

-- 2. Баланс не может уйти в минус на уровне БД
ALTER TABLE users
  ADD CONSTRAINT chk_balance_non_negative CHECK (balance >= 0);

-- 3. Вес приза должен быть положительным
ALTER TABLE gacha_prizes
  ADD CONSTRAINT chk_gacha_weight_positive CHECK (weight > 0);

-- 4. Удаляем мёртвое поле (лимит считается через транзакции, не здесь)
ALTER TABLE users
  DROP COLUMN IF EXISTS monthly_p2p_limit_used;

-- 5. Индексы на горячие запросы
CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_quests_user_id
  ON user_quests (user_id);

CREATE INDEX IF NOT EXISTS idx_user_quests_in_review
  ON user_quests (status)
  WHERE status = 'IN_REVIEW';

CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id
  ON inventory_items (user_id);

CREATE INDEX IF NOT EXISTS idx_gacha_spins_user_id
  ON gacha_spins (user_id);

CREATE INDEX IF NOT EXISTS idx_promo_code_usages_user
  ON promo_code_user_usages (user_id);
