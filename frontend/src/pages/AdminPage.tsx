import React, { useCallback, useEffect, useState } from 'react';
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

interface RegistrationRequest {
  id: number;
  email: string;
  nickname: string;
  position: string | null;
  created_at: string;
}

interface ShopItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  kind: 'PRIVILEGE' | 'MERCH';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  image_url: string | null;
  duration_days: number | null;
  stock: number | null;
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

  const [regRequests, setRegRequests] = useState<RegistrationRequest[]>([]);
  const [regLoading, setRegLoading] = useState(true);
  const [regError, setRegError] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const [filterUserId, setFilterUserId] = useState('');
  const [filterType, setFilterType] = useState('');

  // Состояние для управления товарами
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopLoading, setShopLoading] = useState(true);
  const [shopError, setShopError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    kind: 'PRIVILEGE' as 'PRIVILEGE' | 'MERCH',
    rarity: 'COMMON' as 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY',
    image_url: '',
    duration_days: '',
    stock: ''
  });

  const setMsg = (text: string, ok = false) => {
    setAdminMessage(text);
    setAdminMessageOk(ok);
  };

  const loadRegRequests = useCallback(async () => {
    if (!token) return;
    setRegLoading(true);
    setRegError(null);
    try {
      const data = await apiFetch<{ requests: RegistrationRequest[] }>(
        '/api/registration/requests', {}, token
      );
      setRegRequests(data.requests);
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Не удалось загрузить заявки на регистрацию');
    } finally {
      setRegLoading(false);
    }
  }, [token]);

  const loadSubmissions = useCallback(async () => {
    if (!token) return;
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const data = await apiFetch<{ submissions: Submission[] }>(
        '/api/admin/quests/submissions', {}, token
      );
      setSubmissions(data.submissions);
    } catch (e) {
      setSubmissionsError(e instanceof Error ? e.message : 'Не удалось загрузить заявки');
    } finally {
      setSubmissionsLoading(false);
    }
  }, [token]);

  const loadTransactions = useCallback(async () => {
    if (!token) return;
    setTransactionsLoading(true);
    setTransactionsError(null);
    const params = new URLSearchParams();
    if (filterUserId) params.append('userId', filterUserId);
    if (filterType) params.append('type', filterType);
    try {
      const data = await apiFetch<{ transactions: Transaction[] }>(
        `/api/admin/transactions?${params.toString()}`, {}, token
      );
      setTransactions(data.transactions);
    } catch (e) {
      setTransactionsError(e instanceof Error ? e.message : 'Не удалось загрузить транзакции');
    } finally {
      setTransactionsLoading(false);
    }
  }, [token, filterUserId, filterType]);

  const loadShopItems = useCallback(async () => {
    if (!token) return;
    setShopLoading(true);
    setShopError(null);
    try {
      const data = await apiFetch<{ items: ShopItem[] }>('/api/shop/items', {}, token);
      setShopItems(data.items);
    } catch (e) {
      setShopError(e instanceof Error ? e.message : 'Не удалось загрузить товары');
    } finally {
      setShopLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRegRequests();
    loadSubmissions();
    loadTransactions();
    loadShopItems();
  }, [loadRegRequests, loadSubmissions, loadTransactions, loadShopItems]);

  const handleApproveReg = async (id: number) => {
    if (!token) return;
    try {
      await apiFetch(`/api/registration/requests/${id}/approve`, { method: 'POST' }, token);
      setMsg('Аккаунт создан — сообщите сотруднику что он может войти', true);
      await loadRegRequests();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка при одобрении');
    }
  };

  const handleRejectReg = async (id: number) => {
    if (!token) return;
    const reason = rejectReasons[id]?.trim() || undefined;
    try {
      await apiFetch(
        `/api/registration/requests/${id}/reject`,
        { method: 'POST', body: JSON.stringify({ reason }) },
        token
      );
      setMsg('Заявка отклонена', true);
      setRejectReasons((prev) => { const n = { ...prev }; delete n[id]; return n; });
      await loadRegRequests();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка при отклонении');
    }
  };

  const handlePenalty = async () => {
    if (!token) return;
    setAdminMessage(null);
    try {
      await apiFetch('/api/admin/penalty', {
        method: 'POST',
        body: JSON.stringify({
          userId: Number(penaltyUserId),
          amount: Number(penaltyAmount),
          reason: penaltyReason
        })
      }, token);
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
      await apiFetch('/api/admin/ban', {
        method: 'POST',
        body: JSON.stringify({ userId: Number(banUserId), banned: banToggle })
      }, token);
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

  const handleCreateItem = async () => {
    if (!token) return;
    setAdminMessage(null);
    
    if (!newItem.name || !newItem.price) {
      setMsg('Укажите название и цену товара');
      return;
    }

    try {
      await apiFetch('/api/shop/items', {
        method: 'POST',
        body: JSON.stringify({
          name: newItem.name,
          description: newItem.description || null,
          price_coins: Number(newItem.price),
          type: newItem.kind,
          rarity: newItem.rarity,
          image_url: newItem.image_url || null,
          duration_days: newItem.duration_days ? Number(newItem.duration_days) : null,
          stock: newItem.stock ? Number(newItem.stock) : null
        })
      }, token);
      setMsg('Товар создан', true);
      setNewItem({
        name: '',
        description: '',
        price: '',
        kind: 'PRIVILEGE',
        rarity: 'COMMON',
        image_url: '',
        duration_days: '',
        stock: ''
      });
      await loadShopItems();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка при создании товара');
    }
  };

  const handleUpdateItem = async (item: ShopItem) => {
    if (!token) return;
    setAdminMessage(null);
    
    try {
      await apiFetch(`/api/shop/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: item.name,
          description: item.description,
          price_coins: item.price,
          type: item.kind,
          rarity: item.rarity,
          image_url: item.image_url,
          duration_days: item.duration_days,
          stock: item.stock
        })
      }, token);
      setMsg('Товар обновлён', true);
      setEditingItem(null);
      await loadShopItems();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка при обновлении товара');
    }
  };

  return (
    <div>
      <h1 className="page-title">Админ-панель</h1>
      <p className="page-subtitle">
        Раздел для HR / администратора: регистрации, штрафы, модерация квестов, транзакции.
      </p>

      {adminMessage && (
        <div className="card-meta" style={{ marginBottom: 12, color: adminMessageOk ? '#66bb6a' : '#ff5252' }}>
          {adminMessage}
        </div>
      )}

      {/* ── Заявки на регистрацию ── */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Заявки на регистрацию</div>
        <div className="card-meta">Новые сотрудники ожидают одобрения.</div>

        {regLoading && <div className="card-meta">Загрузка...</div>}
        {regError && <div className="card-meta" style={{ color: '#ff5252' }}>{regError}</div>}
        {!regLoading && !regError && regRequests.length === 0 && (
          <div className="card-meta">Нет новых заявок.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {regRequests.map((r) => (
            <div key={r.id} className="card">
              <div className="card-title">{r.nickname}</div>
              <div className="card-meta">{r.email}</div>
              {r.position && <div className="card-meta">Должность: {r.position}</div>}
              <div className="card-meta">
                Подана: {new Date(r.created_at).toLocaleString()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                <input
                  className="input"
                  placeholder="Причина отклонения (необязательно)"
                  value={rejectReasons[r.id] ?? ''}
                  onChange={(e) =>
                    setRejectReasons((prev) => ({ ...prev, [r.id]: e.target.value }))
                  }
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="primary-button" onClick={() => handleApproveReg(r.id)}>
                    Одобрить
                  </button>
                  <button className="primary-button-outline" onClick={() => handleRejectReg(r.id)}>
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="card-grid" style={{ marginBottom: 24 }}>
        {/* ── Наказания ── */}
        <section className="card">
          <div className="card-title">Наказания</div>
          <div className="card-meta">Штрафы и бан магазина для пользователя.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input className="input" placeholder="ID пользователя" value={penaltyUserId}
              onChange={(e) => setPenaltyUserId(e.target.value)} />
            <input className="input" placeholder="Сумма штрафа, KK" value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)} />
            <input className="input" placeholder="Причина" value={penaltyReason}
              onChange={(e) => setPenaltyReason(e.target.value)} />
            <button className="primary-button" onClick={handlePenalty}
              disabled={!penaltyUserId || !penaltyAmount || !penaltyReason}>
              Применить штраф
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input type="checkbox" id="ban-toggle" checked={banToggle}
                onChange={(e) => setBanToggle(e.target.checked)} />
              <label htmlFor="ban-toggle" className="card-meta" style={{ marginBottom: 0 }}>
                Включить бан магазина
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="ID пользователя" value={banUserId}
                onChange={(e) => setBanUserId(e.target.value)} />
              <button className="primary-button-outline" onClick={handleBanToggle}
                disabled={!banUserId}>
                Сохранить
              </button>
            </div>
          </div>
        </section>

        {/* ── Модерация квестов ── */}
        <section className="card">
          <div className="card-title">Модерация квестов</div>
          <div className="card-meta">Заявки, ожидающие проверки.</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {submissionsLoading && <div className="card-meta">Загрузка...</div>}
            {submissionsError && <div className="card-meta" style={{ color: '#ff5252' }}>{submissionsError}</div>}
            {!submissionsLoading && !submissionsError && submissions.length === 0 && (
              <div className="card-meta">Нет заявок в статусе IN_REVIEW.</div>
            )}
            {submissions.map((s) => (
              <div key={s.id} className="card">
                <div className="card-meta">Заявка #{s.id} • Пользователь ID: {s.user_id} • Квест ID: {s.quest_id}</div>
                {s.submitted_at && (
                  <div className="card-meta">Подана: {new Date(s.submitted_at).toLocaleString()}</div>
                )}
                {s.proof_url && (
                  <div className="card-meta">
                    Доказательство: <a href={s.proof_url} target="_blank" rel="noreferrer">{s.proof_url}</a>
                  </div>
                )}
                {s.comment && <div className="card-meta">Комментарий: {s.comment}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="primary-button" onClick={() => handleApprove(s.id)}>Одобрить</button>
                  <button className="primary-button-outline" onClick={() => handleReject(s.id)}>Отклонить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Управление товарами магазина ── */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Управление товарами магазина</div>
        <div className="card-meta">Добавление, редактирование и просмотр товаров.</div>

        {/* Форма создания нового товара */}
        <div className="card" style={{ marginTop: 12, background: 'var(--color-bg-elevated)' }}>
          <div className="card-title" style={{ fontSize: 16 }}>Добавить новый товар</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <input
              className="input"
              placeholder="Название товара"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            />
            <textarea
              className="input"
              placeholder="Описание (необязательно)"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              rows={3}
            />
            <input
              className="input"
              type="number"
              placeholder="Цена в KK"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select
                className="input"
                value={newItem.kind}
                onChange={(e) => setNewItem({ ...newItem, kind: e.target.value as 'PRIVILEGE' | 'MERCH' })}
              >
                <option value="PRIVILEGE">Привилегия</option>
                <option value="MERCH">Мерч</option>
              </select>
              <select
                className="input"
                value={newItem.rarity}
                onChange={(e) => setNewItem({ ...newItem, rarity: e.target.value as any })}
              >
                <option value="COMMON">Обычный</option>
                <option value="RARE">Редкий</option>
                <option value="EPIC">Эпический</option>
                <option value="LEGENDARY">Легендарный</option>
              </select>
            </div>
            <input
              className="input"
              placeholder="URL изображения (необязательно)"
              value={newItem.image_url}
              onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                className="input"
                type="number"
                placeholder="Длительность (дней)"
                value={newItem.duration_days}
                onChange={(e) => setNewItem({ ...newItem, duration_days: e.target.value })}
              />
              <input
                className="input"
                type="number"
                placeholder="Остаток (необязательно)"
                value={newItem.stock}
                onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
              />
            </div>
            <button className="primary-button" onClick={handleCreateItem}>
              Создать товар
            </button>
          </div>
        </div>

        {/* Список товаров */}
        {shopLoading && <div className="card-meta" style={{ marginTop: 12 }}>Загрузка...</div>}
        {shopError && <div className="card-meta" style={{ color: '#ff5252', marginTop: 12 }}>{shopError}</div>}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {shopItems.map((item) => (
            <div key={item.id} className="card" style={{ background: 'var(--color-bg-elevated)' }}>
              {editingItem?.id === item.id ? (
                // Режим редактирования
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    className="input"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                  <textarea
                    className="input"
                    value={editingItem.description || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    rows={2}
                  />
                  <input
                    className="input"
                    type="number"
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                  />
                  <input
                    className="input"
                    placeholder="URL изображения"
                    value={editingItem.image_url || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      className="input"
                      type="number"
                      placeholder="Длительность (дней)"
                      value={editingItem.duration_days || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, duration_days: e.target.value ? Number(e.target.value) : null })}
                    />
                    <input
                      className="input"
                      type="number"
                      placeholder="Остаток"
                      value={editingItem.stock || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, stock: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="primary-button" onClick={() => handleUpdateItem(editingItem)}>
                      Сохранить
                    </button>
                    <button className="primary-button-outline" onClick={() => setEditingItem(null)}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                // Режим просмотра
                <>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="card-title" style={{ fontSize: 16 }}>{item.name}</div>
                      <div className="card-meta">{item.description}</div>
                      <div className="card-meta" style={{ marginTop: 4 }}>
                        <span style={{ fontWeight: 600 }}>{item.price} KK</span> • {item.kind === 'PRIVILEGE' ? 'Привилегия' : 'Мерч'} • {item.rarity}
                      </div>
                      {item.duration_days && (
                        <div className="card-meta">Длительность: {item.duration_days} дней</div>
                      )}
                      {item.stock !== null && (
                        <div className="card-meta">Остаток: {item.stock}</div>
                      )}
                    </div>
                  </div>
                  <button
                    className="primary-button-outline"
                    style={{ marginTop: 8 }}
                    onClick={() => setEditingItem(item)}
                  >
                    Редактировать
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── История транзакций ── */}
      <section className="card">
        <div className="card-title">История транзакций</div>
        <div className="card-meta">Фильтрация по пользователю и типу операции.</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input className="input" placeholder="ID пользователя" value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)} />
          <input className="input" placeholder="Тип (P2P_SEND, SHOP_PURCHASE...)" value={filterType}
            onChange={(e) => setFilterType(e.target.value)} />
          <button className="primary-button-outline" onClick={loadTransactions}>Обновить</button>
        </div>
        {transactionsLoading && <div className="card-meta">Загрузка...</div>}
        {transactionsError && <div className="card-meta" style={{ color: '#ff5252' }}>{transactionsError}</div>}
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
