import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

interface Submission {
  id: number;
  user_id: number;
  quest_id: number;
  proof_url: string | null;
  comment: string | null;
  submitted_at: string | null;
}

interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  type: string;
  comment: string | null;
  created_at: string;
}

export const AdminPage: React.FC = () => {
  const { token } = useAuth();

  const [penaltyUserId, setPenaltyUserId] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyReason, setPenaltyReason] = useState('');
  const [banUserId, setBanUserId] = useState('');
  const [banToggle, setBanToggle] = useState(true);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminMessageOk, setAdminMessageOk] = useState(false);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const [filterUserId, setFilterUserId] = useState('');
  const [filterType, setFilterType] = useState('');

  const setMsg = (text: string, ok = false) => {
    setAdminMessage(text);
    setAdminMessageOk(ok);
  };

  const loadSubmissions = async () => {
    if (!token) return;
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const data = await apiFetch<{ submissions: Submission[] }>(
        '/api/admin/quests/submissions',
        {},
        token
      );
      setSubmissions(data.submissions);
    } catch (e) {
      setSubmissionsError(e instanceof Error ? e.message : 'Не удалось загрузить заявки');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!token) return;
    setTransactionsLoading(true);
    setTransactionsError(null);
    const params = new URLSearchParams();
    if (filterUserId) params.append('userId', filterUserId);
    if (filterType) params.append('type', filterType);
    try {
      const data = await apiFetch<{ transactions: Transaction[] }>(
        `/api/admin/transactions?${params.toString()}`,
        {},
        token
      );
      setTransactions(data.transactions);
    } catch (e) {
      setTransactionsError(e instanceof Error ? e.message : 'Не удалось загрузить транзакции');
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handlePenalty = async () => {
    if (!token) return;
    setAdminMessage(null);
    try {
      await apiFetch(
        '/api/admin/penalty',
        {
          method: 'POST',
          body: JSON.stringify({
            userId: Number(penaltyUserId),
            amount: Number(penaltyAmount),
            reason: penaltyReason
          })
        },
        token
      );
      setMsg('Штраф применён', true);
      setPenaltyAmount('');
      setPenaltyReason('');
      loadTransactions();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не удалось применить штраф');
    }
  };

  const handleBanToggle = async () => {
    if (!token) return;
    setAdminMessage(null);
    try {
      await apiFetch(
        '/api/admin/ban',
        {
          method: 'POST',
          body: JSON.stringify({ userId: Number(banUserId), banned: banToggle })
        },
        token
      );
      setMsg('Статус бана обновлён', true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не удалось изменить статус бана');
    }
  };

  const handleApprove = async (id: number) => {
    if (!token) return;
    try {
      await apiFetch(`/api/admin/quests/submissions/${id}/approve`, { method: 'POST' }, token);
      await loadSubmissions();
      await loadTransactions();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка при одобрении');
    }
  };

  const handleReject = async (id: number) => {
    if (!token) return;
    try {
      await apiFetch(`/api/admin/quests/submissions/${id}/reject`, { method: 'POST' }, token);
      await loadSubmissions();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка при отклонении');
    }
  };

  return (
    <div>
      <h1 className="page-title">Админ-панель</h1>
      <p className="page-subtitle">
        Раздел для HR / администратора: штрафы, бан магазина, модерация квестов и история транзакций.
      </p>

      {adminMessage && (
        <div
          className="card-meta"
          style={{ marginBottom: 12, color: adminMessageOk ? '#66bb6a' : '#ff5252' }}
        >
          {adminMessage}
        </div>
      )}

      <div className="card-grid" style={{ marginBottom: 24 }}>
        {/* Наказания */}
        <section className="card">
          <div className="card-title">Наказания</div>
          <div className="card-meta">Штрафы и бан магазина для пользователя.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="input"
              placeholder="ID пользователя"
              value={penaltyUserId}
              onChange={(e) => setPenaltyUserId(e.target.value)}
            />
            <input
              className="input"
              placeholder="Сумма штрафа, KK"
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
            />
            <input
              className="input"
              placeholder="Причина"
              value={penaltyReason}
              onChange={(e) => setPenaltyReason(e.target.value)}
            />
            <button
              className="primary-button"
              onClick={handlePenalty}
              disabled={!penaltyUserId || !penaltyAmount || !penaltyReason}
            >
              Применить штраф
            </button>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input
                type="checkbox"
                id="ban-toggle"
                checked={banToggle}
                onChange={(e) => setBanToggle(e.target.checked)}
              />
              <label htmlFor="ban-toggle" className="card-meta" style={{ marginBottom: 0 }}>
                Включить бан магазина
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="ID пользователя"
                value={banUserId}
                onChange={(e) => setBanUserId(e.target.value)}
              />
              <button
                className="primary-button-outline"
                onClick={handleBanToggle}
                disabled={!banUserId}
              >
                Сохранить
              </button>
            </div>
          </div>
        </section>

        {/* Модерация квестов */}
        <section className="card">
          <div className="card-title">Модерация квестов</div>
          <div className="card-meta">Заявки, ожидающие проверки.</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {submissionsLoading && <div className="card-meta">Загрузка заявок...</div>}
            {submissionsError && (
              <div className="card-meta" style={{ color: '#ff5252' }}>
                {submissionsError}
              </div>
            )}
            {!submissionsLoading && !submissionsError && submissions.length === 0 && (
              <div className="card-meta">Нет заявок в статусе IN_REVIEW.</div>
            )}
            {submissions.map((s) => (
              <div key={s.id} className="card">
                <div className="card-meta">Заявка #{s.id}</div>
                <div className="card-meta">Пользователь ID: {s.user_id}</div>
                <div className="card-meta">Квест ID: {s.quest_id}</div>
                {s.submitted_at && (
                  <div className="card-meta">
                    Подана: {new Date(s.submitted_at).toLocaleString()}
                  </div>
                )}
                {s.proof_url && (
                  <div className="card-meta">
                    Доказательство:{' '}
                    <a href={s.proof_url} target="_blank" rel="noreferrer">
                      {s.proof_url}
                    </a>
                  </div>
                )}
                {s.comment && <div className="card-meta">Комментарий: {s.comment}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="primary-button" onClick={() => handleApprove(s.id)}>
                    Одобрить
                  </button>
                  <button className="primary-button-outline" onClick={() => handleReject(s.id)}>
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* История транзакций */}
      <section className="card">
        <div className="card-title">История транзакций</div>
        <div className="card-meta">Фильтрация по пользователю и типу операции.</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="ID пользователя"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
          />
          <input
            className="input"
            placeholder="Тип (P2P_SEND, SHOP_PURCHASE...)"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          />
          <button className="primary-button-outline" onClick={loadTransactions}>
            Обновить
          </button>
        </div>

        {transactionsLoading && <div className="card-meta">Загрузка транзакций...</div>}
        {transactionsError && (
          <div className="card-meta" style={{ color: '#ff5252' }}>
            {transactionsError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {!transactionsLoading && !transactionsError && transactions.length === 0 && (
            <div className="card-meta">Нет транзакций по заданным фильтрам.</div>
          )}
          {transactions.map((t) => (
            <div key={t.id} className="card">
              <div className="card-meta">
                #{t.id} • {new Date(t.created_at).toLocaleString()} • {t.type} •{' '}
                <span style={{ color: t.amount > 0 ? '#66bb6a' : '#ff5252' }}>
                  {t.amount > 0 ? '+' : ''}{t.amount} KK
                </span>
              </div>
              {t.comment && <div className="card-meta">Описание: {t.comment}</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
