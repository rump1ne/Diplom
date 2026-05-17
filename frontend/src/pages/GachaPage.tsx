import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

interface GachaPrize {
  id: number;
  label: string;
  kind: 'NOTHING' | 'COINS' | 'ITEM';
  weight: number;
}

interface GachaConfig {
  cost: number;
  prizes: GachaPrize[];
  totalWeight: number;
}

interface SpinResult {
  prize: {
    id: number;
    label: string;
    kind: string;
    rewardCoins: number;
    inventoryItemId: number | null;
  };
}

export const GachaPage: React.FC = () => {
  const { token, refreshUser } = useAuth();
  const [config, setConfig] = useState<GachaConfig | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<GachaPrize | null>(null);

  const probabilities = useMemo(() => {
    if (!config || !config.totalWeight) return [];
    return config.prizes.map((p) => ({
      id: p.id,
      label: p.label,
      kind: p.kind,
      weight: p.weight,
      percent: (p.weight / config.totalWeight) * 100
    }));
  }, [config]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<GachaConfig>('/api/gacha/config');
        setConfig(data);
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleSpin = async () => {
    if (!token || !config) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setWonPrize(null);

    try {
      const data = await apiFetch<SpinResult>('/api/gacha/spin', { method: 'POST' }, token);
      
      // Начинаем анимацию
      setSpinning(true);
      
      // Генерируем фейковую рулетку с призами
      const tempPrizes = Array(20).fill(null).map(() => 
        config.prizes[Math.floor(Math.random() * config.prizes.length)]
      );
      
      // Вставляем выигранный приз в конец
      const wonPrizeData = config.prizes.find(p => p.id === data.prize.id) || config.prizes[0];
      tempPrizes.push(wonPrizeData);
      
      setWonPrize(wonPrizeData);

      // Анимация 3 секунды
      setTimeout(async () => {
        setSpinning(false);
        
        await refreshUser();
        window.dispatchEvent(new CustomEvent('inventory:refresh'));

        if (data.prize.kind === 'NOTHING') {
          setResult('Ничего не выпало. Попробуйте ещё раз!');
        } else if (data.prize.kind === 'COINS') {
          setResult(`🎉 Вы выиграли ${data.prize.rewardCoins} KK`);
        } else {
          setResult(`🎁 Вы получили предмет: ${data.prize.label}`);
        }
      }, 3000);
    } catch (e) {
      setSpinning(false);
      setError(e instanceof Error ? e.message : 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const getPrizeColor = (kind: string) => {
    switch (kind) {
      case 'NOTHING':
        return '#666';
      case 'COINS':
        return '#ffd700';
      case 'ITEM':
        return '#9c27b0';
      default:
        return '#999';
    }
  };

  return (
    <div>
      <h1 className="page-title">Gacha Box</h1>
      <p className="page-subtitle">
        Испытай удачу: фиксированная стоимость крутки, случайные награды и редкие предметы.
      </p>

      <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="card-title">Крутка за {config?.cost ?? 50} KK</div>
        <div className="card-meta" style={{ marginBottom: 12 }}>
          Вероятности зависят от конфигурации gacha-призов.
        </div>

        {/* Рулетка */}
        {spinning && config && (
          <div
            style={{
              overflow: 'hidden',
              height: 120,
              position: 'relative',
              marginBottom: 16,
              borderRadius: 12,
              background: 'var(--color-bg-elevated)',
              border: '2px solid var(--color-border)'
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '8px 0',
                animation: 'gacha-spin 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards'
              }}
            >
              {Array(30).fill(null).map((_, i) => {
                const prize = config.prizes[i % config.prizes.length];
                return (
                  <div
                    key={i}
                    style={{
                      minWidth: 100,
                      height: 100,
                      borderRadius: 8,
                      background: getPrizeColor(prize.kind),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 12,
                      textAlign: 'center',
                      padding: 8,
                      border: '2px solid rgba(255,255,255,0.3)'
                    }}
                  >
                    {prize.label}
                  </div>
                );
              })}
            </div>
            {/* Указатель */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 4,
                height: '100%',
                background: '#ff5252',
                zIndex: 10,
                pointerEvents: 'none'
              }}
            />
          </div>
        )}

        <button
          className="primary-button"
          style={{ width: '100%', marginBottom: 8 }}
          onClick={handleSpin}
          disabled={loading || spinning}
        >
          {spinning ? 'Крутим...' : loading ? 'Подождите...' : 'Крутить'}
        </button>

        {result && (
          <div
            className="card-meta"
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'var(--color-bg-elevated)',
              textAlign: 'center',
              fontSize: 16,
              fontWeight: 500
            }}
          >
            {result}
          </div>
        )}
        {error && (
          <div className="card-meta" style={{ color: '#ff5252' }}>
            {error}
          </div>
        )}
      </div>

      {probabilities.length > 0 && (
        <div style={{ marginTop: 24, maxWidth: 600, margin: '24px auto 0' }}>
          <h2 className="card-title">Шансы выпадения призов</h2>
          <div className="card-meta" style={{ marginBottom: 8 }}>
            Значения приблизительные, зависят от весов конфигурации.
          </div>
          <div className="card">
            <ul className="card-meta" style={{ listStyle: 'none', padding: 0 }}>
              {probabilities.map((p) => (
                <li
                  key={p.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>{p.label}</span>
                  <span style={{ color: getPrizeColor(p.kind), fontWeight: 600 }}>
                    {p.percent.toFixed(2)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <style>{`
        @keyframes gacha-spin {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-100px * 20 - 8px * 20));
          }
        }
      `}</style>
    </div>
  );
};
