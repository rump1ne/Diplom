import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

interface InventoryItem {
  id: number;
  status: string;
  acquired_at: string;
  name: string;
  description: string;
  type: string;
}

export const ProfilePage: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [promo, setPromo] = useState('');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const loadInventory = useCallback(async () => {
    if (!token) return;
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const data = await apiFetch<{ items: InventoryItem[] }>(
        '/api/users/me/inventory',
        {},
        token
      );
      setInventory(data.items);
    } catch (e) {
      setInventoryError(e instanceof Error ? e.message : 'Не удалось загрузить инвентарь');
    } finally {
      setInventoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Подписываемся на событие из ShopPage после покупки
  useEffect(() => {
    const handler = () => loadInventory();
    window.addEventListener('inventory:refresh', handler);
    return () => window.removeEventListener('inventory:refresh', handler);
  }, [loadInventory]);

  const handlePromo = async () => {
    if (!token || !promo.trim()) return;
    setPromoMessage(null);
    setPromoLoading(true);
    try {
      await apiFetch(
        '/api/users/me/promo',
        { method: 'POST', body: JSON.stringify({ code: promo.trim() }) },
        token
      );
      setPromoMessage('Промокод успешно активирован');
      setPromo('');
      await refreshUser().catch(() => undefined);
      await loadInventory();
    } catch (e) {
      setPromoMessage(e instanceof Error ? e.message : 'Ошибка активации промокода');
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Профиль</h1>
      <p className="page-subtitle">Ваш личный хаб в KrissQuest.</p>

      <div className="card-grid" style={{ marginBottom: 24 }}>
        <section className="card">
          <div className="card-title">Информация</div>
          <div className="card-meta">Аватар, никнейм, должность</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="avatar-circle" style={{ width: 48, height: 48, fontSize: 18 }}>
              {user?.nickname
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 500 }}>{user?.nickname}</div>
              <div className="card-meta">{user?.position ?? '—'}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-title">Статистика</div>
          <div className="card-meta">Суммарные Крисс-коины и квесты</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div className="card-meta">Всего заработано</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{user?.totalEarned ?? 0} KK</div>
            </div>
            <div>
              <div className="card-meta">Квестов выполнено</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{user?.completedQuests ?? 0}</div>
            </div>
          </div>
        </section>
      </div>

      <section style={{ marginBottom: 24 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Инвентарь</div>
          <div className="card-meta">Купленные, но ещё не активированные плюшки.</div>

          {inventoryLoading && <div className="card-meta">Загрузка инвентаря...</div>}

          {inventoryError && (
            <div className="card-meta" style={{ color: '#ff5252' }}>
              {inventoryError}
            </div>
          )}

          {!inventoryLoading && !inventoryError && inventory.length === 0 && (
            <div className="card-meta">Пока здесь пусто.</div>
          )}

          {!inventoryLoading && !inventoryError && inventory.length > 0 && (
            <div className="card-grid">
              {inventory.map((item) => (
                <div key={item.id} className="card">
                  <div className="card-title">{item.name}</div>
                  <div className="card-meta">{item.description}</div>
                  <div className="card-meta">Тип: {item.type}</div>
                  <div className="card-meta">
                    Получен: {new Date(item.acquired_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="card">
          <div className="card-title">Промокод</div>
          <div className="card-meta">Введите промокод, чтобы получить бонус или редкий предмет.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Введите промокод"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePromo()}
              disabled={promoLoading}
            />
            <button
              className="primary-button"
              onClick={handlePromo}
              disabled={promoLoading || !promo.trim()}
            >
              {promoLoading ? 'Активация...' : 'Активировать'}
            </button>
          </div>
          {promoMessage && (
            <div
              className="card-meta"
              style={{
                marginTop: 8,
                color: promoMessage.includes('успешно') ? '#66bb6a' : '#ff5252'
              }}
            >
              {promoMessage}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
