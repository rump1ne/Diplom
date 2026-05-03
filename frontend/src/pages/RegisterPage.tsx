import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    nickname: '',
    position: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.passwordConfirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (form.password.length < 6) {
      setError('Пароль минимум 6 символов');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/registration/request', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          nickname: form.nickname.trim(),
          position: form.position.trim() || undefined
        })
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при отправке заявки');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', textAlign: 'center' }}>
        <h1 className="page-title">Заявка отправлена</h1>
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div className="card-title">Ожидайте одобрения</div>
          <p className="card-meta">
            Ваша заявка на регистрацию отправлена администратору. После одобрения вы сможете
            войти в систему с указанными email и паролем.
          </p>
          <button
            className="primary-button"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => navigate('/auth')}
          >
            Перейти ко входу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto' }}>
      <h1 className="page-title">Заявка на регистрацию</h1>
      <p className="page-subtitle">
        Заполните форму. После одобрения администратором вы получите доступ к KrissQuest.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div>
          <label className="card-meta" style={{ display: 'block', marginBottom: 4 }}>
            Email *
          </label>
          <input
            className="input"
            type="email"
            name="email"
            placeholder="your@company.com"
            value={form.email}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="card-meta" style={{ display: 'block', marginBottom: 4 }}>
            Никнейм *
          </label>
          <input
            className="input"
            type="text"
            name="nickname"
            placeholder="Иван Иванов"
            value={form.nickname}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="card-meta" style={{ display: 'block', marginBottom: 4 }}>
            Должность
          </label>
          <input
            className="input"
            type="text"
            name="position"
            placeholder="Frontend Developer"
            value={form.position}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div>
          <label className="card-meta" style={{ display: 'block', marginBottom: 4 }}>
            Пароль * (минимум 6 символов)
          </label>
          <input
            className="input"
            type="password"
            name="password"
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="card-meta" style={{ display: 'block', marginBottom: 4 }}>
            Повторите пароль *
          </label>
          <input
            className="input"
            type="password"
            name="passwordConfirm"
            placeholder="••••••••"
            value={form.passwordConfirm}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        {error && (
          <div className="card-meta" style={{ color: '#ff5252' }}>
            {error}
          </div>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={loading || !form.email || !form.password || !form.nickname}
        >
          {loading ? 'Отправка...' : 'Отправить заявку'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <Link to="/auth" className="card-meta" style={{ color: 'inherit' }}>
            Уже есть аккаунт? Войти
          </Link>
        </div>
      </form>
    </div>
  );
};
