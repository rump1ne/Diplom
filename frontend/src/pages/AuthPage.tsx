import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const AuthPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось войти';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h1 className="page-title">Вход в KrissQuest</h1>
      <p className="page-subtitle">Используйте корпоративный email и пароль.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        <input
          className="input"
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        {error && (
          <div className="card-meta" style={{ color: '#ff5252' }}>
            {error}
          </div>
        )}
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Вход...' : 'Войти'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <Link to="/register" className="card-meta" style={{ color: 'inherit' }}>
            Нет аккаунта? Подать заявку на регистрацию
          </Link>
        </div>
      </form>
    </div>
  );
};
