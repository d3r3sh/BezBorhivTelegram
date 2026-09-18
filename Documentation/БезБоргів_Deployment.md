# БезБоргів — Документація деплою

## Архітектура

```
Telegram (користувач)
    ↓  відкриває Mini App
Vercel (frontend — React/Vite)
    ↓  REST API запити
Railway (backend — FastAPI + aiogram + APScheduler)
    ↓  SQLAlchemy ORM
Railway PostgreSQL (база даних)
    ↕  бот polling
Telegram Bot API → нагадування у Telegram
```

---

## Сервіси

### 1. GitHub
**Репозиторій:** https://github.com/d3r3sh/BezBorhivTelegram  
**Видимість:** публічний  
**Гілка:** `main`

Обидва сервіси (Railway і Vercel) підключені до GitHub і **автоматично деплоять** кожен push у `main`.

---

### 2. Railway — Backend + База даних
**URL:** https://railway.app  
**Проєкт:** courteous-motivation  
**Backend URL:** `https://bezborhivtelegram-production.up.railway.app`  
**Health check:** `https://bezborhivtelegram-production.up.railway.app/api/health`

#### Сервіси в проєкті
| Сервіс | Тип | Статус |
|---|---|---|
| BezBorhivTelegram | Web Service (Docker) | Online |
| Postgres | PostgreSQL Database | Online |

#### Environment Variables (BezBorhivTelegram)
| Змінна | Значення | Опис |
|---|---|---|
| `DATABASE_URL` | авто від Railway Postgres | PostgreSQL connection string |
| `BOT_TOKEN` | `<токен від @BotFather>` | Токен Telegram бота |
| `WEBAPP_URL` | `https://bez-borhiv-telegram.vercel.app` | URL фронтенду для кнопки бота |
| `AUTH_MAX_AGE` | `86400` | Час валідності Telegram auth (сек) |
| `SCHEDULER_TIMEZONE` | `Europe/Kyiv` | Часовий пояс для нотифікацій |

#### Як деплоїть
1. Push у GitHub `main` → Railway автоматично будує Docker образ
2. `Dockerfile` запускає: `alembic upgrade head` → `uvicorn backend.main:app`
3. Міграції застосовуються автоматично при кожному деплої

#### Ціна
~$5-8/міс (Hobby план + PostgreSQL usage)

---

### 3. Vercel — Frontend
**URL:** https://vercel.com  
**Проєкт:** bez-borhiv-telegram  
**Frontend URL:** `https://bez-borhiv-telegram.vercel.app`

#### Налаштування
| Параметр | Значення |
|---|---|
| Root Directory | `frontend` |
| Framework | Vite (автодетект) |
| Build Command | `npm run build` |
| Output Directory | `dist` |

#### Environment Variables
| Змінна | Значення | Опис |
|---|---|---|
| `VITE_API_URL` | `https://bezborhivtelegram-production.up.railway.app` | URL Railway backend |

#### Як деплоїть
Push у GitHub `main` → Vercel запускає `tsc && vite build` → публікує статичний сайт

#### Ціна
Безкоштовно (Hobby план, публічний репозиторій)

---

### 4. Telegram Bot
**Бот:** `@bezborhivbot`  
**Управління:** через `@BotFather`

#### Налаштування зроблені
- Menu Button → Web App → `https://bez-borhiv-telegram.vercel.app`
- Назва кнопки: `БезБоргів`

#### Корисні команди @BotFather
```
/mybots                    — список твоїх ботів
/setmenubutton             — змінити кнопку/URL Mini App
/setdescription            — опис бота
/setuserpic                — аватар бота
```

---

## Локальна розробка

### Backend
```bash
# З кореневої папки проєкту
.venv/bin/python -m uvicorn backend.main:app --reload
# або
cd backend && uvicorn backend.main:app --reload
```
Потребує `.env` файл (скопіюй з `.env.example`):
```
DATABASE_URL=sqlite:///./bezborhiv.db
BOT_TOKEN=test_token_placeholder
WEBAPP_URL=http://localhost:5173
```

### Frontend
```bash
cd frontend && npm run dev
# Vite proxy /api → http://localhost:8000
```

### Тести
```bash
# Backend (108 тестів)
.venv/bin/python -m pytest backend/tests/ -q

# Frontend (62 тести)
cd frontend && npm test -- --run
```

---

## Оновлення в продакшені

Будь-який `git push origin main` автоматично деплоїть обидва сервіси.

```bash
# Звичайний workflow
git add .
git commit -m "feat: опис змін"
git push
# → Railway починає build (~3 хв)
# → Vercel починає build (~1 хв)
```

---

## Troubleshooting

| Проблема | Де дивитись |
|---|---|
| Backend не відповідає | Railway → BezBorhivTelegram → Deployments → View Logs |
| Міграції не пройшли | Початок логів Railway — шукай `alembic upgrade head` |
| Frontend не оновився | Vercel → Deployments → перевір статус білду |
| Бот не відповідає | Перевір `BOT_TOKEN` в Railway Variables |
| CORS помилка | Перевір `VITE_API_URL` в Vercel (без `/` в кінці) |
| 500 на `/api/loans` | Перевір логи Railway — можлива проблема з БД |

---

## Важливі нюанси

1. **GUID тип** — `models.py` використовує `VARCHAR(36)` для UUID на всіх базах даних (і SQLite, і PostgreSQL). Не міняти на native UUID — це зламає порівняння в PostgreSQL.

2. **pytz** — потрібен для APScheduler. Є в `requirements.txt`.

3. **Telegram auth у браузері** — при відкритті `vercel.app` напряму в браузері (не через Telegram) буде 422 помилка — це нормально. Застосунок працює тільки всередині Telegram.

4. **`WEBAPP_URL` в Railway** — має збігатися з реальним Vercel URL. При зміні домену Vercel — оновити цю змінну.
