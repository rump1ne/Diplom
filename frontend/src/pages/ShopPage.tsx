import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

interface ShopItem {
  id: number;
  type: string;
  name: string;
  description: string;
  price_coins: number;
  rarity: string | null;
}

export const ShopPage: React.FC = () => {
  const { token, refreshUser } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ items: ShopItem[] }>('/api/shop/items');
        setItems(data.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить товары');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleBuy = async (id: number) => {
    if (!token) return;
    setMessage(null);
    setBuyingId(id);
    try {
      await apiFetch<{ inventoryItemId: number }>(
        `/api/shop/items/${id}/purchase`,
        { method: 'POST' },
        token
      );
      setMessage('Покупка успешно совершена');
      await refreshUser().catch(() => undefined);
      // Уведомляем ProfilePage что инвентарь нужно обновить
      window.dispatchEvent(new CustomEvent('inventory:refresh'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось купить товар');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Магазин бонусов</h1>
      <p className="page-subtitle">Тратьте Крисс-коины на мерч, привилегии и обучение.</p>

      {message && (
        <div
          className="card-meta"
          style={{
            marginBottom: 12,
            color: message.includes('успешно') ? '#66bb6a' : '#ff5252'
          }}
        >
          {message}
        </div>
      )}

      {loading && <div className="card-meta">Загрузка товаров...</div>}

      {error && (
        <div className="card-meta" style={{ color: '#ff5252', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="card-meta">Товаров пока нет.</div>
      )}

      <div className="card-grid">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div className="card-meta">{item.type}</div>
            <div className="card-title">{item.name}</div>
            <div className="card-meta" style={{ marginBottom: 12 }}>
              {item.description}
            </div>
            {item.rarity && (
              <div className="card-meta" style={{ marginBottom: 8 }}>
                Редкость: {item.rarity}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-meta">{item.price_coins} KK</span>
              <button
                className="primary-button"
                onClick={() => handleBuy(item.id)}
                disabled={buyingId === item.id}
              >
                {buyingId === item.id ? 'Покупка...' : 'Приобрести'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
