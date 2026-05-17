import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

interface InventoryItem {
  id: number;
  status: string;
  acquired_at: string;
  activated_at: string | null;
  expires_at: string | null;
  name: string;
  description: string;
  type: string;
  image_url: string | null;
  rarity: string | null;
}

export const ProfilePage: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [promo, setPromo] = useState('');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const loadInventory = async () => {
    if (!token) return;
    setInventoryLoading(true);
    try {
      const data = await apiFetch<{ items: InventoryItem[] }>(
        '/api/users/me/inventory',
        {},
        token
      );
      setInventory(data.items);
    } catch {
      // ignore
    } finally {
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
    const handleRefresh = () => loadInventory();
    window.addEventListener('inventory:refresh', handleRefresh);
    return () => window.removeEventListener('inventory:refresh', handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handlePromo = async () => {
    if (!token || !promo.trim()) return;
    setPromoMessage(null);
    setPromoLoading(true);
    try {
      await apiFetch(
        '/api/users/me/promo',
        {
          method: 'POST',
          body: JSON.stringify({ code: promo.trim() })
        },
        token
      );
      setPromoMessage('Промокод успешно активирован');
      setPromo('');
      await refreshUser();
      await loadInventory();
    } catch (e) {
      setPromoMessage(e instanceof Error ? e.message : 'Ошибка при активации промокода');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleActivate = async (itemId: number) => {
    if (!token) return;
    try {
      await apiFetch(`/api/users/me/inventory/${itemId}/activate`, { method: 'POST' }, token);
      await loadInventory();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка при активации предмета');
    }
  };

  const getRarityColor = (rarity: string | null) => {
    if (!rarity) return 'var(--color-muted)';
    switch (rarity.toUpperCase()) {
      case 'COMMON':
        return '#9e9e9e';
      case 'RARE':
        return '#2196f3';
      case 'EPIC':
        return '#9c27b0';
      case 'LEGENDARY':
        return '#ff9800';
      default:
        return 'var(--color-muted)';
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
              <div className="card-meta">{user?.position}</div>
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
          <div className="card-meta">Купленные предметы и привилегии.</div>
          {inventoryLoading ? (
            <div className="card-meta">Загрузка...</div>
          ) : inventory.length === 0 ? (
            <div className="card-meta">Пока здесь пусто.</div>
          ) : (
            <div className="card-grid">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    borderColor: getRarityColor(item.rarity),
                    borderWidth: 2
                  }}
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 12,
                        marginBottom: 8
                      }}
                    />
                  )}
                  <div className="card-title">{item.name}</div>
                  <div className="card-meta">{item.description}</div>
                  <div className="card-meta">Тип: {item.type}</div>
                  {item.rarity && (
                    <div className="card-meta" style={{ color: getRarityColor(item.rarity) }}>
                      {item.rarity}
                    </div>
                  )}
                  <div
                    className="card-meta"
                    style={{
                      marginTop: 4,
                      color: item.status === 'ACTIVATED' ? '#66bb6a' : 'var(--color-muted)'
                    }}
                  >
                    {item.status === 'ACTIVATED' ? '✅ Активировано' : '📦 В инвентаре'}
                  </div>
                  {item.activated_at && (
                    <div className="card-meta">
                      Активировано: {new Date(item.activated_at).toLocaleDateString()}
                    </div>
                  )}
                  {item.expires_at && (
                    <div className="card-meta">
                      Истекает: {new Date(item.expires_at).toLocaleDateString()}
                    </div>
                  )}
                  {item.status === 'OWNED' && item.type !== 'MERCH' && (
                    <button
                      className="primary-button"
                      style={{ width: '100%', marginTop: 8 }}
                      onClick={() => handleActivate(item.id)}
                    >
                      Активировать
                    </button>
                  )}
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
          {promoMessage && <div className="card-meta" style={{ marginTop: 8 }}>{promoMessage}</div>}
        </div>
      </section>
    </div>
  );
};
