# KrissQuest — геймифицированная бонусная платформа

Веб-приложение для мотивации сотрудников с квестами, внутренней валютой **«Крисс-коины»**, магазином бонусов, P2P-переводами и админ-панелью.

## Стек

- **Frontend**: React + TypeScript, Vite, React Router.
- **Backend**: Node.js + Express.
- **База данных**: PostgreSQL.

## Структура проекта

- `frontend` — SPA-клиент (страницы профиля, магазина, квестов, гачи, админ-панели).
- `backend` — REST API (auth, пользователи, квесты, магазин, P2P, промокоды, гача, админ-инструменты).

### Основные сущности БД

- `users` — сотрудники, баланс, роль (USER / ADMIN / HR), флаги бана.
- `quests`, `user_quests` — квесты и статусы выполнения (AVAILABLE, IN_REVIEW, COMPLETED, REJECTED).
- `shop_items`, `inventory_items` — товары магазина и инвентарь пользователя.
- `transactions` — история всех начислений/списаний Крисс-коинов.
- `promo_codes` — промокоды и их использование.
- `gacha_prizes`, `gacha_spins` — конфигурация Gacha Box и история круток.

## Быстрый старт

### 1. Установка зависимостей

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Настройка окружения

В папке `backend` создайте файл `.env`:

```bash
cp .env.example .env
```

И укажите параметры подключения к PostgreSQL и секреты JWT.

### 3. Миграции БД

В файле `backend/migrations/001_init.sql` описана схема таблиц.
Выполните SQL-скрипт в своей базе PostgreSQL (через pgAdmin, DBeaver или psql).

### 4. Запуск приложений

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

После запуска frontend-приложение будет доступно по адресу, указанному Vite (обычно `http://localhost:5173`), а backend — по `http://localhost:4000`.

### Тестовые данные

После применения миграций создайте хотя бы одного пользователя вручную, например:

```sql
INSERT INTO users (email, password_hash, nickname, position, role, balance, total_earned)
VALUES (
  'user@example.com',
  '$2a$10$y4V5XQqzPZyU3x9o7xgZ2u3xQGvVqYvZ8p2J0FQ5o7P1JqZPjv6yK', -- bcrypt-хэш пароля "password"
  'Kriss Dev',
  'Frontend Developer',
  'ADMIN',
  1000,
  1000
);
```

Затем можно войти в приложение по логину `user@example.com` и паролю `password`.

## Основные разделы

- **Профиль сотрудника** — аватар, никнейм, должность, статистика, инвентарь, промокоды.
- **Магазин бонусов** — мерч, привилегии, обучение.
- **Квесты** — вкладки Daily / Event, отправка доказательств, статус выполнения.
- **Гача** — крутка за фиксированную цену, случайные награды.
- **P2P-переводы** — перевод Крисс-коинов коллегам с комментарием «Спасибо!» и месячным лимитом.
- **Админ-панель** — штрафы, бан магазина, модерация квестов, история транзакций.

## Архитектура и API

- **Frontend**
  - `App.tsx` — layout с Header, навигацией и маршрутами.
  - `auth/AuthContext.tsx` — хранение текущего пользователя и JWT, login/logout.
  - Страницы:
    - `ProfilePage` — запросы `/api/users/me`, `/api/users/me/inventory`, `/api/users/me/promo`.
    - `ShopPage` — витрина `/api/shop/items`, покупки `/api/shop/items/:id/purchase`.
    - `QuestsPage` — списки квестов `/api/quests?type=DAILY|EVENT`, отправка доказательств `/api/quests/:id/submit`.
    - `GachaPage` — конфигурация `/api/gacha/config`, крутка `/api/gacha/spin`.
    - `AdminPage` — штрафы `/api/admin/penalty`, бан `/api/admin/ban`, модерация `/api/admin/quests/submissions`, история `/api/admin/transactions`.

- **Backend**
  - `modules/auth` — `/api/auth/login`, `/api/auth/register`, `/api/auth/me`.
  - `modules/users` — профиль и инвентарь пользователя.
  - `modules/quests` — получение квестов и отправка на модерацию.
  - `modules/shop` — товары и покупки.
  - `modules/p2p` — P2P-переводы с месячным лимитом.
  - `modules/promo` — активация промокодов.
  - `modules/gacha` — конфигурация и проведение крутки.
  - `modules/admin` — штрафы, бан, модерация квестов и просмотр транзакций.

Эти разделы можно использовать как основу дипломного описания: диаграммы классов/сущностей, последовательности запросов (sequence diagrams) и пользовательские сценарии (user flows) строятся поверх приведённой структуры.

