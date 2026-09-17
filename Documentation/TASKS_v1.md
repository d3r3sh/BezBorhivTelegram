# Tasks — «БезБоргів»
Зведення всіх задач v1.0 та v1.1.
Останнє оновлення: 2026-09-12. **Всі задачі виконано.**

---

# v1.0 — Первинна реалізація

| # | Задача | Статус |
|---|---|---|
| 1 | Лічильник платежів оновлюється після внесення | ✅ Done |
| 2 | Головний екран: мінімальні/рекомендовані, залишок місяця, дата | ✅ Done |
| 3 | Вкладка «План» — 4 стани з онбординг-попапом | ✅ Done |
| 4 | Фіксація платежу: рекомендована сума, дві кнопки-підказки | ✅ Done |
| 5 | Формат чисел: пробіли тисяч, кома копійок — всюди | ✅ Done |
| 6 | Блок «щомісячний платіж» умовно видимий | ✅ Done |
| 7 | Поле «Платежів залишилось» у режимі «Вже плачу» | ✅ Done |
| 8 | Поле «Наступний платіж» у режимі «Вже плачу» | ✅ Done |
| 9 | Кнопка «Готово» над клавіатурою | ✅ Done |
| 10 | Білі краї на головному екрані (порожній стан) | ✅ Done |
| 11 | Заголовок першого онбордингу «Що вміє цей додаток» | ✅ Done |

## Фаза 1 — Логіка розрахунків (після рев'ю)

| # | Задача | Статус |
|---|---|---|
| F1 | `paymentDay` губився при `recalculateSchedule` через лютий | ✅ Done |
| F2 | TC-CALC-11: snowball не тестував інші пріоритети | ✅ Done |
| F3 | Мертва змінна `ns` у SmokeTests | ✅ Done |
| F4 | `simulateToClose`: звільнений платіж → наступний місяць | ✅ Done |
| F5 | `balance()`: детермінований порядок однаководатних платежів | ✅ Done |
| F6 | Тест-таргет IPHONEOS_DEPLOYMENT_TARGET 17.0 → 26.0 | ✅ Done |
| TC-14 | Тест `paymentDay=31` зберігається після перерахунку через лютий | ✅ Added |

## Фаза 2 — Відповідність SRS

| # | Задача | Статус |
|---|---|---|
| G1 | `makeSnapshots()`: `initialAmount` → `currentBalance()` | ✅ Done |
| G2 | Лічильник платежів: `totalPlannedPayments` → `schedule.count` | ✅ Done |
| G3 | Архів: деталі (sheet) і видалення з підтвердженням | ✅ Done |
| G4 | «Свій порядок»: drag & drop у плані | ✅ Done |
| G5 | LoanCard: `loan.monthlyPayment` → `nextPaymentDate` зі schedule | — accept |
| G6 | Дві кнопки «Змінити бюджет» і «Обрати іншу стратегію» — одне й те саме | — accept |

## Фаза 3 — Дані і стан

| # | Задача | Статус |
|---|---|---|
| H1 | Нотифікації: `firstPaymentDate` → реальна наступна дата | ✅ Done |
| H2 | Нотифікації перепланувались після платежів/змін | ✅ Done |
| H3 | `LoanCardView` дублює `HomeViewModel.remainingSchedule` | ✅ → `buildScheduleMap` |
| H4 | `try? context.save()` мовчки ковтає помилки | — accept for v1 |
| H6 | Dead `ScheduleRowView.swift` | ✅ Deleted |

## Фази 4–5 — UI/UX і якість коду

| # | Задача | Статус |
|---|---|---|
| I1–I5 | Дрібний UI: тексти, масштабування, lineLimit | ✅ Done |
| J1–J5 | Dead code, force-unwrap, дублювання makeActuals | ✅ Done |
| K1–K2 | O(N) через `buildScheduleMap(for:)` | ✅ Done |
| L1–L5 | Dead методи, синхронізація StrategyPlanner | ✅ Done |

---

# v1.1 — Виправлення після тестування (2026-09-12)

Задачі з бази Notion «Tasks for v.1.0» (база даних у Notion).
Комміти: `61d798d`, `7c21050`, `9606f45`, `9337767`, `195bae2`, `0e51ff2`.

## Фінансова логіка

| Notion # | Задача | Файли | Статус |
|---|---|---|---|
| #4 | «Загальний борг» та «Тіло кредиту» однакові для нового кредиту | `LoanDetailView.swift` | ✅ Done |
| #5 | Некоректний перерахунок після внесення платежу | `LoanDetailView.swift` | ✅ Done |
| #7 | Часткові платежі: логіка відображення та розрахунків | `HomeViewModel`, `LoanDetailView`, `LoanCardView` | ✅ Done |
| #9 | «Залишилось цього місяця» не оновлюється після нового кредиту | `HomeView`, `HomeViewModel` | ✅ Done |
| #14 | «Залишилось цього місяця» враховує кредити без платежу цього місяця | `HomeViewModel` | ✅ Done |

### Деталі розрахунків

**Загальний борг** (і на головному екрані, і в деталях):
```
totalDebt = schedule.reduce(0) { $0 + $1.totalAmount }  // тіло + всі майбутні відсотки
```

**Тіло кредиту** (в деталях кредиту):
```
balance = loan.currentBalance()  // тільки залишок основного боргу
```

**Залишилось цього місяця** — per-loan, тільки кредити з платежем у поточному або минулому місяці, за платіжним **періодом** (nextDueDate − 1 місяць):
```
dueLoans = loans.filter { nextPaymentDate($0).month <= now.month }
remaining = Σ max(0, loan.monthlyPayment - paidForCurrentPeriod(loan))
```

**Частковий прогрес** — показується коли `0 < внесено < мінімальний`:
- На картці (HomeView): `350,00 ₴ / 1 000,00 ₴ · 10 жовт.`
- В деталях кредиту: рядок «Внесено цього місяця: 350,00 ₴ / 1 000,00 ₴»

## UI / UX

| Notion # | Задача | Файли | Статус |
|---|---|---|---|
| #2 | Неактивні dots онбордингу невидимі | `OnboardingView.swift` | ✅ Done |
| #6 | Білий квадрат під кнопками навігації в деталях кредиту | `LoanDetailView.swift` | ✅ Done |
| #8 | «Оплачено» → «Внести платіж»; прибрати «+ Додатково» | `LoanDetailView.swift`, `RecordPaymentView.swift`, `RecordPaymentViewModel.swift` | ✅ Done |
| #10 | Оновити кнопки на екрані «План» | `StrategyView.swift` | ✅ Done |
| #11 | Показувати рік у графіку платежів | `LoanDetailView.swift` | ✅ Done |
| #12 | «Підставити» → «Рекомендований платіж»; «мінімальний» → «мінімальний платіж» | `RecordPaymentView.swift` | ✅ Done |
| #13 | Білі рамки в архіві | `ArchiveView.swift` | ✅ Done |

### Деталі UI змін

- **#2:** `Circle().fill(Color.dsSecondary.opacity(0.3))` замість `Color.dsBg` для неактивних dots
- **#6:** `.toolbarBackground(Color.dsBg, for: .navigationBar)` + `.toolbarBackground(.visible, for: .navigationBar)`
- **#8:** Кнопка «Внести платіж» відкриває regular-режим (або extra якщо немає scheduled); всередині RecordPaymentView — `Picker("Тип платежу", selection: $vm.isExtra)` з сегментами «Плановий / Додатковий»
- **#10:** Кнопка «Обрати стратегію» (акцентна) замінює «Обрати іншу стратегію»; після тапу — `alert("Стратегію обрано")`
- **#11:** `fullDate()` з форматом `"d MMMM yyyy 'року'"` (uk_UA)
- **#13:** Прибрано `.clipped()` зі ZStack в ArchiveRowView — світла тінь `dsNLight` більше не обрізається у рамку

## Стратегія

| Notion # | Задача | Файли | Статус |
|---|---|---|---|
| #15 | «Оберіть стратегію» при 1 кредиті | `HomeView.swift` | ✅ Done |
| #16 | Кредити в «Цього місяця» не за пріоритетом | `StrategyPlanner.swift` | ✅ Done |
| #17 | При «Свій варіант» 6 з 7 кредитів | `StrategyView.swift` | ✅ Done |

- **#15:** `activeLoans.count >= 2` (було `!activeLoans.isEmpty`)
- **#16:** `let sortedRecs = indices.map { recs[$0] }` — рекомендації у порядку пріоритету
- **#17:** `makeSnapshots()` — `valid + missing` гарантує всі активні кредити навіть при розсинхронізованому `manualOrder`

## Інший

| Notion # | Задача | Файли | Статус |
|---|---|---|---|
| #3 | 5 варіантів плейсхолдера для поля «Назва» без «Напр.» | `AddLoanView.swift` | ✅ Done |
| #1 | Іконка застосунку деформована | `Assets.xcassets/AppIcon.appiconset/` | ✅ Done |

- **#3:** `@State private var namePlaceholder = ["Кредит на авто", "Іпотека", "Кредит на ремонт", "Кредит на техніку", "Позика від банку"].randomElement()!`
- **#1:** 1024×1024 PNG, sRGB (sips), квадратний crop з `design/DebtFree.jpg`

## Технічні виправлення (не в Notion)

| Задача | Файли | Статус |
|---|---|---|
| Заморозка UI — `payment.loan?.id` lazy-load на main thread | `HomeViewModel.swift` | ✅ Done |
| `BezBorhivTests` не мав залежності від `BezBorhiv` → паралельна збірка → "unable to resolve module" | `project.pbxproj` | ✅ Done |
| `ASSETCATALOG_COMPILER_APPICON_NAME` відсутній у Debug конфіг → іконка тільки в Release | `project.pbxproj` | ✅ Done |
| `XCTAssertEqual` з `accuracy:` для `Decimal` (не підтримується) | `PersistenceTests.swift` | ✅ Done |

### Деталі project.pbxproj

```
// Додано PBXContainerItemProxy + PBXTargetDependency:
BezBorhivTests.dependencies = (AA000000000000000000902A)
// → BezBorhiv будується перед BezBorhivTests при BuildIndependentTargetsInParallel = 1

// Додано в Debug build config (AA000000000000000000011A):
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
```

---

# Прийняті рішення (не реалізовано, acceptable)

| Питання | Рішення |
|---|---|
| `try? context.save()` мовчки ковтає помилки | Прийнято для v1; план — SwiftUI `.environment(\.modelContext)` error boundary у v2 |
| Остання скоригована сума платежу на картці кредиту | Картка показує `loan.monthlyPayment`, деталі — точну суму зі schedule |
| `principalPart`/`interestPart` застарівають після редагування ставки | Не використовуються для розрахунку балансу (є `historicalPrincipal`); прийнято |
| `EarlyRepaymentView.simulation` — 2 schedule на кожен keystroke | Acceptable для v1; оптимізація через debounce у v2 |
