import React from 'react';
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useTheme } from './theme/ThemeProvider';
import { ProfilePage } from './pages/ProfilePage';
import { ShopPage } from './pages/ShopPage';
import { QuestsPage } from './pages/QuestsPage';
import { GachaPage } from './pages/GachaPage';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './pages/AuthPage';
import { RegisterPage } from './pages/RegisterPage';
import { useAuth } from './auth/AuthContext';

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return children;
};

const RequireAdmin: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuth();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'HR')) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const isAdmin = (role?: string) => role === 'ADMIN' || role === 'HR';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="logo">KrissQuest</div>
        <div className="layout-header-right">
          {user && (
            <div className="balance-badge">
              <span>Баланс</span>
              <strong>{user.balance} KK</strong>
            </div>
          )}
          <button className="primary-button-outline" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {user ? (
            <>
              <div className="avatar-circle">
                {user.nickname
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <button className="primary-button-outline" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <div className="avatar-circle">?</div>
          )}
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Профиль
            </NavLink>
            <NavLink
              to="/shop"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Магазин
            </NavLink>
            <NavLink
              to="/quests"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Квесты
            </NavLink>
            <NavLink
              to="/gacha"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Гача
            </NavLink>
            {/* Ссылка видна только ADMIN и HR */}
            {isAdmin(user?.role) && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                Админ
              </NavLink>
            )}
          </nav>
        </aside>

        <main className="main-content">
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/shop"
              element={
                <RequireAuth>
                  <ShopPage />
                </RequireAuth>
              }
            />
            <Route
              path="/quests"
              element={
                <RequireAuth>
                  <QuestsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/gacha"
              element={
                <RequireAuth>
                  <GachaPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <AdminPage />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};
