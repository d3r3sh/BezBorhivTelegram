# БезБоргів — Документація бази даних

## Підключення

**Тип:** PostgreSQL (Railway)  
**Підключення через DBeaver:** Railway CLI тунель
```bash
railway connect Postgres --tunnel-only
# → Tunnel open: localhost:XXXXX
# DBeaver: Host=localhost, Port=XXXXX, DB=railway, User=postgres
# Password: Railway → Postgres → Variables → PGPASSWORD
```

---

## Таблиці

### `users` — Користувачі

Один рядок = один користувач Telegram. Створюється автоматично при першому відкритті Mini App.

| Колонка | Тип | Опис |
|---|---|---|
| `id` | Integer PK | Внутрішній числовий ID |
| `telegram_id` | BigInteger UNIQUE | ID користувача в Telegram |
| `monthly_budget` | Numeric(14,2) | Бюджет на місяць, грн (null = не задано) |
| `strategy` | String(20) | Стратегія: `none` / `avalanche` / `snowball` |
| `notify_day_of` | Boolean | Нагадування в день платежу (default true) |
| `notify_1_day_before` | Boolean | Нагадування за 1 день (default true) |
| `notify_3_days_before` | Boolean | Нагадування за 3 дні (default false) |
| `created_at` | DateTime | Дата першого входу |

---

### `loans` — Кредити

Один рядок = один кредит користувача.

| Колонка | Тип | Опис |
|---|---|---|
| `id` | VARCHAR(36) PK | UUID кредиту |
| `user_id` | Integer FK → users.id | Власник кредиту |
| `name` | String(255) | Назва («Авто», «iPhone», тощо) |
| `initial_amount` | Numeric(14,2) | Початкова сума / залишок при додаванні |
| `annual_rate` | Numeric(10,4) | Річна ставка % (0 = розстрочка) |
| `monthly_payment` | Numeric(14,2) | Щомісячний платіж (не змінюється) |
| `total_planned_payments` | Integer | Кількість платежів при створенні |
| `first_payment_date` | Date | Дата першого платежу (задає день для всього графіку) |
| `payment_day` | Integer (1-31) | День місяця платежу (зберігається окремо для clamping) |
| `color_index` | Integer (1-10) | Колір кредиту в календарі |
| `is_archived` | Boolean | Чи закритий кредит (default false) |
| `archived_at` | DateTime | Коли архівували (null = активний) |
| `created_at` | DateTime | Коли додали кредит |

---

### `payments` — Фактичні платежі

Один рядок = один внесений платіж. Зберігаються тільки ФАКТИЧНІ платежі — планові обчислюються на льоту.

| Колонка | Тип | Опис |
|---|---|---|
| `id` | VARCHAR(36) PK | UUID платежу |
| `loan_id` | VARCHAR(36) FK → loans.id | До якого кредиту |
| `planned_date` | Date | Планова дата за графіком (null для позапланових) |
| `planned_amount` | Numeric(14,2) | Планова сума (default 0) |
| `actual_date` | Date | Реальна дата коли внесли |
| `actual_amount` | Numeric(14,2) | Реальна сума (може відрізнятись від планової) |
| `is_extra` | Boolean | true = позаплановий платіж (дострокове погашення) |
| `principal_part` | Numeric(14,2) | Частка що пішла на тіло кредиту |
| `interest_part` | Numeric(14,2) | Частка що пішла на відсотки |
| `created_at` | DateTime | Коли зафіксували в застосунку |

---

### `alembic_version` — Службова

| Колонка | Опис |
|---|---|
| `version_num` | Поточна версія міграції (`001`) |

Alembic використовує цю таблицю щоб знати які міграції вже застосовані до БД.

---

## Ключові принципи

### Single Source of Truth
Графік майбутніх платежів **не зберігається** в БД. Він обчислюється на льоту кожен раз:
```
initial_amount + annual_rate + monthly_payment + всі фактичні payments
→ loan_calculator.recalculate_schedule()
→ список майбутніх платежів
```

### Поточний залишок кредиту
```
balance = initial_amount
для кожного actual_payment (хронологічно):
    якщо is_extra → balance -= actual_amount          (весь платіж на тіло)
    інакше        → interest = balance * (rate/12/100)
                    balance -= (actual_amount - interest)
```

### payment_day vs first_payment_date
`payment_day` зберігається окремо від `first_payment_date` навмисно. Якщо день = 31, а в місяці 28 днів — платіж переноситься на 28-е, але `payment_day` залишається 31 і у наступному місяці з 31 днем знову буде 31-е.

---

## Зв'язки між таблицями

```
users (1)
  └── loans (N)   [user_id → users.id]
        └── payments (N)   [loan_id → loans.id]
```

При видаленні `user` → каскадно видаляються всі його `loans` і їх `payments`.  
При видаленні `loan` → каскадно видаляються всі його `payments`.

---

## Корисні SQL запити

```sql
-- Всі активні кредити користувача
SELECT * FROM loans
WHERE user_id = (SELECT id FROM users WHERE telegram_id = 123456789)
  AND is_archived = false;

-- Всі платежі по конкретному кредиту
SELECT * FROM payments
WHERE loan_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
ORDER BY actual_date;

-- Статистика по користувачах
SELECT COUNT(*) as users,
       COUNT(CASE WHEN strategy != 'none' THEN 1 END) as with_strategy
FROM users;

-- Загальна кількість кредитів і платежів
SELECT
  (SELECT COUNT(*) FROM loans WHERE is_archived = false) as active_loans,
  (SELECT COUNT(*) FROM loans WHERE is_archived = true) as archived_loans,
  (SELECT COUNT(*) FROM payments) as total_payments;
```
