"""Handler: add a new loan via multi-step conversation."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery

from backend.bot.states import AddLoan
from backend.bot.utils import run_db, parse_amount, parse_rate, parse_date, fmt_amount, fmt_date
from backend.bot.keyboards import input_mode_keyboard, main_reply_keyboard, open_app_button
from backend.config import settings
from backend.core.loan_calculator import add_months, InsufficientPaymentError
from backend.schemas.loan import LoanCreate
from backend.services.loan_service import create_loan

_CANCEL_HINT = "\n<i>Введіть /cancel щоб скасувати</i>"


def create_router() -> Router:
    router = Router()

    # ── Entry point ──────────────────────────────────────────────────────────

    @router.message(Command("addloan"))
    @router.message(F.text == "➕ Додати кредит")
    async def start_add_loan(message: Message, state: FSMContext) -> None:
        await state.set_state(AddLoan.name)
        await message.answer(
            f"Введіть <b>назву кредиту</b>:\n(Авто, Іпотека, Розстрочка…){_CANCEL_HINT}",
            parse_mode="HTML",
        )

    # ── Step 1: name ─────────────────────────────────────────────────────────

    @router.message(AddLoan.name)
    async def got_name(message: Message, state: FSMContext) -> None:
        name = message.text.strip()
        if not name or len(name) > 100:
            await message.answer("Введіть назву (до 100 символів):")
            return
        await state.update_data(name=name)
        await state.set_state(AddLoan.amount)
        await message.answer(
            f"<b>Сума кредиту</b> (₴):\nНаприклад: 150 000{_CANCEL_HINT}",
            parse_mode="HTML",
        )

    # ── Step 2: amount ───────────────────────────────────────────────────────

    @router.message(AddLoan.amount)
    async def got_amount(message: Message, state: FSMContext) -> None:
        amount = parse_amount(message.text)
        if amount is None:
            await message.answer("Не вдалося розпізнати суму. Введіть число, наприклад: 150000")
            return
        await state.update_data(amount=str(amount))
        await state.set_state(AddLoan.input_mode)
        await message.answer(
            "Що ви знаєте про цей кредит?",
            reply_markup=input_mode_keyboard(),
        )

    # ── Step 3: input mode ───────────────────────────────────────────────────

    @router.callback_query(AddLoan.input_mode, F.data.startswith("mode:"))
    async def got_input_mode(callback: CallbackQuery, state: FSMContext) -> None:
        mode = callback.data.split(":")[1]
        await state.update_data(input_mode=mode)
        await callback.answer()
        if mode == "rate":
            await state.set_state(AddLoan.rate)
            await callback.message.edit_text(
                f"<b>Річна ставка</b> (%):\nНаприклад: 24{_CANCEL_HINT}",
                parse_mode="HTML",
            )
        else:
            await state.set_state(AddLoan.monthly_payment)
            await callback.message.edit_text(
                f"<b>Щомісячний платіж</b> (₴):\nНаприклад: 5 000{_CANCEL_HINT}",
                parse_mode="HTML",
            )

    # ── Step 4a: rate ────────────────────────────────────────────────────────

    @router.message(AddLoan.rate)
    async def got_rate(message: Message, state: FSMContext) -> None:
        rate = parse_rate(message.text)
        if rate is None:
            await message.answer("Некоректна ставка. Введіть число ≥ 0, наприклад: 24")
            return
        await state.update_data(rate=str(rate))
        await state.set_state(AddLoan.payments_count)
        await _ask_count(message)

    # ── Step 4b: monthly payment ─────────────────────────────────────────────

    @router.message(AddLoan.monthly_payment)
    async def got_monthly_payment(message: Message, state: FSMContext) -> None:
        amount = parse_amount(message.text)
        if amount is None:
            await message.answer("Некоректна сума. Введіть число, наприклад: 5000")
            return
        await state.update_data(monthly_payment=str(amount))
        await state.set_state(AddLoan.payments_count)
        await _ask_count(message)

    async def _ask_count(message: Message) -> None:
        await message.answer(
            f"<b>Кількість платежів</b> (місяців):\nНаприклад: 36{_CANCEL_HINT}",
            parse_mode="HTML",
        )

    # ── Step 5: payments count ───────────────────────────────────────────────

    @router.message(AddLoan.payments_count)
    async def got_count(message: Message, state: FSMContext) -> None:
        try:
            count = int(message.text.strip())
            if count <= 0:
                raise ValueError
        except ValueError:
            await message.answer("Введіть ціле позитивне число, наприклад: 36")
            return
        await state.update_data(payments_count=count)
        await state.set_state(AddLoan.first_date)
        suggested = add_months(date.today(), 1)
        await message.answer(
            f"<b>Дата першого платежу</b>:\n"
            f"Формат: ДД.ММ.РРРР або РРРР-ММ-ДД\n"
            f"Наприклад: {suggested.strftime('%d.%m.%Y')}{_CANCEL_HINT}",
            parse_mode="HTML",
        )

    # ── Step 6: first date → create loan ─────────────────────────────────────

    @router.message(AddLoan.first_date)
    async def got_first_date(message: Message, state: FSMContext) -> None:
        first_date = parse_date(message.text)
        if first_date is None:
            await message.answer(
                "Не вдалося розпізнати дату.\nВведіть у форматі ДД.ММ.РРРР або РРРР-ММ-ДД"
            )
            return

        data = await state.get_data()
        await state.clear()

        loan_data = LoanCreate(
            name=data["name"],
            is_already_paying=False,
            initial_amount=Decimal(data["amount"]),
            total_planned_payments=data["payments_count"],
            input_mode=data["input_mode"],
            annual_rate=Decimal(data["rate"]) if data.get("rate") is not None else None,
            monthly_payment=Decimal(data["monthly_payment"]) if data.get("monthly_payment") is not None else None,
            first_payment_date=first_date,
        )

        telegram_id = message.from_user.id
        try:
            loan = await run_db(telegram_id, lambda db, user: create_loan(db, loan_data, user))
            await message.answer(
                f"✅ <b>Кредит додано!</b>\n\n"
                f"📌 {loan.name}\n"
                f"💰 Щомісячний платіж: <b>{fmt_amount(loan.monthly_payment)}</b>\n"
                f"📅 Перший платіж: {fmt_date(loan.first_payment_date)}\n"
                f"📊 Залишок: {fmt_amount(loan.current_balance)}",
                parse_mode="HTML",
                reply_markup=main_reply_keyboard(settings.WEBAPP_URL),
            )
        except InsufficientPaymentError:
            await message.answer(
                "❌ Платіж × кількість менший за суму кредиту.\n"
                "Перевірте дані і спробуйте /addloan знову."
            )
        except Exception as e:
            await message.answer(
                f"❌ Помилка: {e}\nСпробуйте /addloan знову.",
                reply_markup=open_app_button(settings.WEBAPP_URL),
            )

    return router
