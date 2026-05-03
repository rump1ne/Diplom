import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiUrl } from '../lib/api';

type Tab = 'daily' | 'event';

interface Quest {
  id: number;
  title: string;
  description: string;
  type: string;
  reward_coins: number;
  deadline: string | null;
  status: string | null;
}

export const QuestsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('daily');
  const { token } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Состояние формы подачи: questId -> proofUrl
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [proofInputs, setProofInputs] = useState<Record<number, string>>({});

  const loadQuests = async (currentTab: Tab, authToken: string | null) => {
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/quests?type=${currentTab === 'daily' ? 'DAILY' : 'EVENT'}`), {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) {
        setError('Не удалось загрузить квесты');
        return;
      }
      const data = (await res.json()) as { quests: Quest[] };
      setQuests(data.quests);
    } catch {
      setError('Ошибка сети при загрузке квестов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuests(tab, token || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token]);

  const handleSubmitQuest = async (id: number) => {
    if (!token) return;
    const proofUrl = proofInputs[id]?.trim() || undefined;
    setMessage(null);
    setSubmitting(id);
    try {
      const res = await fetch(apiUrl(`/api/quests/${id}/submit`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ proofUrl, comment: proofUrl })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error || 'Не удалось отправить на проверку');
      } else {
        setMessage('Заявка отправлена на модерацию');
        setProofInputs((prev) => ({ ...prev, [id]: '' }));
        loadQuests(tab, token);
      }
    } catch {
      setMessage('Ошибка сети');
    } finally {
      setSubmitting(null);
    }
  };

  const canSubmit = (q: Quest) =>
    q.status === null || q.status === 'AVAILABLE' || q.status === 'REJECTED';

  return (
    <div>
      <h1 className="page-title">Квесты</h1>
      <p className="page-subtitle">Ежедневные и событийные задания для накопления Крисс-коинов.</p>

      <div className="tabs">
        <button
          className={`tab ${tab === 'daily' ? 'tab-active' : ''}`}
          onClick={() => setTab('daily')}
        >
          Daily
        </button>
        <button
          className={`tab ${tab === 'event' ? 'tab-active' : ''}`}
          onClick={() => setTab('event')}
        >
          Event
        </button>
      </div>

      {message && (
        <div className="card-meta" style={{ marginBottom: 12 }}>
          {message}
        </div>
      )}

      {loading && <div className="card-meta">Загрузка...</div>}

      {error && (
        <div className="card-meta" style={{ color: '#ff5252', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card-grid">
        {quests.map((q) => (
          <div key={q.id} className="card">
            <div className="card-title">{q.title}</div>
            <div className="card-meta" style={{ marginBottom: 8 }}>
              {q.description}
            </div>
            {q.deadline && (
              <div className="card-meta" style={{ marginBottom: 8 }}>
                Дедлайн: {new Date(q.deadline).toLocaleString()}
              </div>
            )}
            <div className="card-meta" style={{ marginBottom: 8 }}>
              Статус: {q.status || 'AVAILABLE'}
            </div>

            {canSubmit(q) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <input
                  className="input"
                  placeholder="Ссылка на доказательство (GitHub, Jira...)"
                  value={proofInputs[q.id] ?? ''}
                  onChange={(e) =>
                    setProofInputs((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-meta">+{q.reward_coins} KK</span>
              {canSubmit(q) && (
                <button
                  className="primary-button"
                  onClick={() => handleSubmitQuest(q.id)}
                  disabled={submitting === q.id}
                >
                  {submitting === q.id ? 'Отправка...' : 'Выполнить'}
                </button>
              )}
              {q.status === 'IN_REVIEW' && (
                <span className="card-meta" style={{ color: '#ffa726' }}>
                  На модерации
                </span>
              )}
              {q.status === 'COMPLETED' && (
                <span className="card-meta" style={{ color: '#66bb6a' }}>
                  Выполнено ✓
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
