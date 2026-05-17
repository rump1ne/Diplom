-- ============================================================
-- Миграция 004: улучшения товаров и инвентаря
-- ============================================================

-- Добавляем изображения для товаров
ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER;

-- Добавляем expires_at для активированных предметов
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Комментарии для понимания:
-- duration_days: сколько дней действует привилегия после активации (NULL = вечно)
-- expires_at: когда истекает срок действия активированного предмета
