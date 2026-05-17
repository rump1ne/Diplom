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
  image_url: string | null;
}

export const ShopPage: React.FC = () => {
  const { token, refreshUser } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ items: ShopItem[] }>('/api/shop/items');
        setItems(data.items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleBuy = async (id: number) => {
    if (!token) return;
    setMessage(null);
    setPurchasing(id);
    try {
      await apiFetch(`/api/shop/items/${id}/purchase`, { method: 'POST' }, token);
      setMessage('Покупка успешно совершена');
      await refreshUser();
      window.dispatchEvent(new CustomEvent('inventory:refresh'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось купить товар');
    } finally {
      setPurchasing(null);
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
      <h1 className="page-title">Магазин бонусов</h1>
      <p className="page-subtitle">Тратьте Крисс-коины на мерч, привилегии и обучение.</p>

      {message && <div className="card-meta" style={{ marginBottom: 12 }}>{message}</div>}

      {loading ? (
        <div className="card-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="card" style={{ minHeight: 200 }}>
              <div className="card-meta">Загрузка...</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-grid">
          {items.map((item) => (
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
                    height: 160,
                    objectFit: 'cover',
                    borderRadius: 12,
                    marginBottom: 8
                  }}
                />
              )}
              <div className="card-meta">{item.type}</div>
              <div className="card-title">{item.name}</div>
              <div className="card-meta" style={{ marginBottom: 12 }}>
                {item.description}
              </div>
              {item.rarity && (
                <div className="card-meta" style={{ color: getRarityColor(item.rarity), marginBottom: 8 }}>
                  {item.rarity}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-meta">{item.price_coins} KK</span>
                <button
                  className="primary-button"
                  onClick={() => handleBuy(item.id)}
                  disabled={purchasing !== null}
                >
                  {purchasing === item.id ? 'Покупка...' : 'Приобрести'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
