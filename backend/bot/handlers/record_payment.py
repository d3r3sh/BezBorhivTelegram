"""Handler: record a payment via multi-step conversation."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery

from backend.bot.states import RecordPayment
from backend.bot.utils import run_db, parse_amount, fmt_amount, fmt_date
from backend.bot.keyboards import loans_keyboard, payment_type_keyboard, main_reply_keyboard, open_app_button
from backend.config import settings
from backend.schemas.payment import PaymentCreate
from backend.services.loan_service import get_loans, get_loan
from backend.services.payment_service import record_payment

_CANCEL_HINT = "\n<i>Введіть /cancel щоб скасувати</i>"


def create_router() -> Router:
    router = Router()

    # ── Entry point ──────────────────────────────────────────────────────────

    @router.message(Command("pay"))
    @router.message(F.text == "💳 Внести платіж")
    async def start_record_payment(message: Message, state: FSMContext) -> None:
        telegram_id = message.from_user.id
        loans = await run_db(telegram_id, lambda db, user: get_loans(db, user, archived=False))

        active = [l for l in loans if not l.is_archived]
        if not active:
            await message.answer(
                "У вас немає активних кредитів.\n"
                "Спочатку додайте кредит через «➕ Додати кредит»."
            )
            return

        await state.set_state(RecordPayment.choose_loan)
        await message.answer(
            f"Оберіть кредит:{_CANCEL_HINT}",
            parse_mode="HTML",
            reply_markup=loans_keyboard(active),
        )

    # ── Step 1: choose loan ──────────────────────────────────────────────────

    @router.callback_query(RecordPayment.choose_loan, F.data.startswith("loan:"))
    async def chose_loan(callback: CallbackQuery, state: FSMContext) -> None:
        loan_id_str = callback.data.split(":", 1)[1]
        await state.update_data(loan_id=loan_id_str)
        await callback.answer()

        telegram_id = callback.from_user.id
        try:
            loan = await run_db(
                telegram_id,
                lambda db, user: get_loan(db, UUID(loan_id_str), user),
            )
        except Exception:
            await callback.message.edit_text("❌ Не вдалося завантажити кредит. Спробуйте ще раз /pay")
            await state.clear()
            return

        hint_lines = [f"📌 <b>{loan.name}</b>"]
        if loan.next_payment_date:
            if loan.is_overdue:
                hint_lines.append(f"🔴 Прострочено! Платіж {fmt_amount(loan.next_payment_amount or loan.monthly_payment)}")
            else:
                hint_lines.append(
                    f"Наступний платіж: <b>{fmt_amount(loan.next_payment_amount or loan.monthly_payment)}</b> "
                    f"· {fmt_date(loan.next_payment_date)}"
                )
        hint_lines.append(f"Залишок: {fmt_amount(loan.current_balance)}")

        await state.update_data(
            loan_name=loan.name,
            next_payment_amount=str(loan.next_payment_amount or loan.monthly_payment),
            next_payment_date=str(loan.next_payment_date) if loan.next_payment_date else None,
            monthly_payment=str(loan.monthly_payment),
        )

        await state.set_state(RecordPayment.choose_type)
        await callback.message.edit_text(
            "\n".join(hint_lines) + f"\n\nТип платежу:{_CANCEL_HINT}",
            parse_mode="HTML",
            reply_markup=payment_type_keyboard(),
        )

    # ── Step 2: choose payment type ──────────────────────────────────────────

    @router.callback_query(RecordPayment.choose_type, F.data.startswith("ptype:"))
    async def chose_type(callback: CallbackQuery, state: FSMContext) -> None:
        ptype = callback.data.split(":")[1]
        await state.update_data(ptype=ptype)
        await callback.answer()

        data = await state.get_data()
        await state.set_state(RecordPayment.amount)

        if ptype == "regular":
            hint = f"Рекомендована сума: <b>{fmt_amount(data['next_payment_amount'])}</b>"
        else:
            hint = "Введіть суму дострокового погашення:"

        await callback.message.edit_text(
            f"{hint}\n\n<b>Введіть суму платежу</b> (₴):{_CANCEL_HINT}",
            parse_mode="HTML",
        )

    # ── Step 3: amount → record payment ─────────────────────────────────────

    @router.message(RecordPayment.amount)
    async def got_payment_amount(message: Message, state: FSMContext) -> None:
        amount = parse_amount(message.text)
        if amount is None:
            await message.answer("Некоректна сума. Введіть число, наприклад: 7869.24")
            return

        data = await state.get_data()
        await state.clear()

        telegram_id = message.from_user.id
        is_extra = data["ptype"] == "extra"

        payment_data = PaymentCreate(
            actual_date=date.today(),
            actual_amount=amount,
            is_extra=is_extra,
            planned_date=date.fromisoformat(data["next_payment_date"]) if data.get("next_payment_date") and not is_extra else None,
            planned_amount=Decimal(data["next_payment_amount"]) if not is_extra else None,
        )

        try:
            await run_db(
                telegram_id,
                lambda db, user: record_payment(db, UUID(data["loan_id"]), payment_data, user),
            )

            ptype_label = "Дострокове погашення" if is_extra else "Плановий платіж"
            await message.answer(
                f"✅ <b>{ptype_label} зафіксовано!</b>\n\n"
                f"📌 {data['loan_name']}\n"
                f"💰 Сума: <b>{fmt_amount(amount)}</b>\n"
                f"📅 Дата: {fmt_date(date.today())}",
                parse_mode="HTML",
                reply_markup=main_reply_keyboard(),
            )
        except Exception as e:
            await message.answer(
                f"❌ Помилка при збереженні платежу: {e}\n"
                "Спробуйте ще раз /pay або відкрийте застосунок.",
                reply_markup=open_app_button(settings.WEBAPP_URL),
            )

    return router
