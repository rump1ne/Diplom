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

export const GachaPage: React.FC = () => {
  const { token, refreshUser } = useAuth();
  const [config, setConfig] = useState<GachaConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      setConfigLoading(true);
      setConfigError(null);
      try {
        const data = await apiFetch<GachaConfig>('/api/gacha/config');
        setConfig(data);
      } catch (e) {
        setConfigError(e instanceof Error ? e.message : 'Не удалось загрузить конфиг гачи');
      } finally {
        setConfigLoading(false);
      }
    })();
  }, []);

  const handleSpin = async () => {
    if (!token) return;
    setLoading(true);
    setSpinError(null);
    setResult(null);
    try {
      const data = await apiFetch<{
        prize: { label: string; kind: string; rewardCoins: number; inventoryItemId: number | null };
      }>('/api/gacha/spin', { method: 'POST' }, token);

      await refreshUser().catch(() => undefined);

      if (data.prize.kind === 'NOTHING') {
        setResult('Ничего не выпало. Попробуйте ещё раз!');
      } else if (data.prize.kind === 'COINS') {
        setResult(`🎉 Вы выиграли ${data.prize.rewardCoins} KK`);
      } else {
        setResult(`🎁 Вы получили предмет: ${data.prize.label}`);
      }
    } catch (e) {
      setSpinError(e instanceof Error ? e.message : 'Не удалось выполнить крутку');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Gacha Box</h1>
      <p className="page-subtitle">
        Испытай удачу: фиксированная стоимость крутки, случайные награды и редкие предметы.
      </p>

      {configLoading && <div className="card-meta">Загрузка...</div>}

      {configError && (
        <div className="card-meta" style={{ color: '#ff5252', marginBottom: 12 }}>
          {configError}
        </div>
      )}

      {!configLoading && !configError && (
        <div className="card" style={{ maxWidth: 520 }}>
          <div className="card-title">Крутка за {config?.cost ?? 50} KK</div>
          <div className="card-meta" style={{ marginBottom: 12 }}>
            Вероятности зависят от конфигурации gacha-призов.
          </div>
          <button
            className="primary-button"
            style={{ width: '100%', marginBottom: 8 }}
            onClick={handleSpin}
            disabled={loading}
          >
            {loading ? 'Крутим...' : 'Крутить'}
          </button>
          {result && (
            <div className="card-meta" style={{ color: '#66bb6a' }}>
              {result}
            </div>
          )}
          {spinError && (
            <div className="card-meta" style={{ color: '#ff5252' }}>
              {spinError}
            </div>
          )}
        </div>
      )}

      {probabilities.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 className="card-title">Шансы выпадения призов</h2>
          <div className="card-meta" style={{ marginBottom: 8 }}>
            Значения рассчитаны по весам конфигурации.
          </div>
          <div className="card">
            <ul className="card-meta" style={{ margin: 0, paddingLeft: 16 }}>
              {probabilities.map((p) => (
                <li key={p.id}>
                  {p.label} — {p.percent.toFixed(2)}%
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
