"""Handler: record a payment — 4-step FSM conversation."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery

from backend.bot.states import RecordPayment
from backend.bot.utils import run_db, parse_amount, fmt_amount
from backend.bot.keyboards import (
    loans_select_keyboard, payment_type_keyboard,
    payment_amount_keyboard, open_app_inline,
)
from backend.config import settings
from backend.schemas.payment import PaymentCreate
from backend.services.loan_service import get_loans, get_loan
from backend.services.payment_service import record_payment


def create_router() -> Router:
    router = Router()

    # ── Entry: choose loan ───────────────────────────────────────────────────

    @router.message(Command("pay"))
    @router.message(F.text == "💳 Внести платіж")
    async def start_record_payment(message: Message, state: FSMContext) -> None:
        telegram_id = message.from_user.id
        loans = await run_db(telegram_id, lambda db, user: get_loans(db, user, archived=False))
        active = [l for l in loans if not l.is_archived]

        if not active:
            await message.answer(
                "У вас ще немає кредиту. Ви можете додати кредит у застосунку.",
                reply_markup=open_app_inline(settings.WEBAPP_URL),
            )
            return

        await state.set_state(RecordPayment.choose_loan)
        await message.answer(
            "💳 <b>Оберіть кредит:</b>",
            parse_mode="HTML",
            reply_markup=loans_select_keyboard(active, settings.WEBAPP_URL),
        )

    # ── Step 1 → choose type ─────────────────────────────────────────────────

    @router.callback_query(RecordPayment.choose_loan, F.data.startswith("loan:"))
    async def chose_loan(callback: CallbackQuery, state: FSMContext) -> None:
        loan_id_str = callback.data.split(":", 1)[1]
        await callback.answer()

        try:
            loan = await run_db(
                callback.from_user.id,
                lambda db, user: get_loan(db, UUID(loan_id_str), user),
            )
        except Exception:
            await callback.message.edit_text("❌ Не вдалося завантажити кредит. Спробуйте /pay знову.")
            await state.clear()
            return

        await state.update_data(
            loan_id=loan_id_str,
            loan_name=loan.name,
            current_balance=str(loan.current_balance),
            next_payment_amount=str(loan.next_payment_amount or loan.monthly_payment),
            monthly_payment=str(loan.monthly_payment),
            next_payment_date=str(loan.next_payment_date) if loan.next_payment_date else None,
        )
        await state.set_state(RecordPayment.choose_type)
        await callback.message.edit_text(
            "Оберіть тип платежу:",
            reply_markup=payment_type_keyboard(),
        )

    # ── Step 2 → choose amount ───────────────────────────────────────────────

    @router.callback_query(RecordPayment.choose_type, F.data.startswith("ptype:"))
    async def chose_type(callback: CallbackQuery, state: FSMContext) -> None:
        ptype = callback.data.split(":")[1]
        await callback.answer()
        await state.update_data(ptype=ptype)

        data = await state.get_data()
        monthly = Decimal(data["monthly_payment"])
        next_amount = Decimal(data["next_payment_amount"])
        current_balance = Decimal(data["current_balance"])

        if ptype == "regular":
            recommended = next_amount
            minimum = monthly
        else:
            recommended = current_balance
            minimum = monthly

        await state.update_data(recommended=str(recommended), minimum=str(minimum))
        await state.set_state(RecordPayment.choose_amount)

        ptype_label = "Плановий" if ptype == "regular" else "Достроковий"
        await callback.message.edit_text(
            f"💰 <b>Кредит: {data['loan_name']}</b>\n"
            f"Тип: {ptype_label}\n"
            f"Рекомендована сума: <b>{fmt_amount(recommended)}</b>\n"
            f"Мінімальна сума: <b>{fmt_amount(minimum)}</b>",
            parse_mode="HTML",
            reply_markup=payment_amount_keyboard(fmt_amount(recommended), fmt_amount(minimum)),
        )

    # ── Step 3a: preset amount ───────────────────────────────────────────────

    @router.callback_query(RecordPayment.choose_amount, F.data.startswith("amount:"))
    async def chose_amount(callback: CallbackQuery, state: FSMContext) -> None:
        choice = callback.data.split(":")[1]
        await callback.answer()

        if choice == "custom":
            data = await state.get_data()
            await state.set_state(RecordPayment.enter_amount)
            await callback.message.edit_text(
                f"Введіть суму платежу (₴):\n"
                f"Не більше: {fmt_amount(data['current_balance'])}",
            )
            return

        data = await state.get_data()
        amount = Decimal(data["recommended"] if choice == "recommended" else data["minimum"])
        await _save_and_reply(
            telegram_id=callback.from_user.id,
            state=state,
            data=data,
            amount=amount,
            reply=callback.message.edit_text,
        )

    # ── Step 3b: custom amount ───────────────────────────────────────────────

    @router.message(RecordPayment.enter_amount)
    async def got_custom_amount(message: Message, state: FSMContext) -> None:
        data = await state.get_data()
        amount = parse_amount(message.text)
        current_balance = Decimal(data["current_balance"])

        if amount is None:
            await message.answer("Введіть коректну суму (число більше 0):")
            return
        if amount > current_balance:
            await message.answer(
                f"Сума не може перевищувати залишок боргу {fmt_amount(current_balance)}.\n"
                "Введіть суму ще раз:"
            )
            return

        await _save_and_reply(
            telegram_id=message.from_user.id,
            state=state,
            data=data,
            amount=amount,
            reply=message.answer,
        )

    # ── Helper ───────────────────────────────────────────────────────────────

    async def _save_and_reply(telegram_id, state, data, amount, reply):
        is_extra = data["ptype"] == "extra"
        payment_data = PaymentCreate(
            actual_date=date.today(),
            actual_amount=amount,
            is_extra=is_extra,
            planned_date=date.fromisoformat(data["next_payment_date"]) if data.get("next_payment_date") and not is_extra else None,
            planned_amount=Decimal(data["next_payment_amount"]) if not is_extra else None,
        )
        await state.clear()

        try:
            await run_db(
                telegram_id,
                lambda db, user: record_payment(db, UUID(data["loan_id"]), payment_data, user),
            )
            await reply(
                f"✅ Платіж <b>{fmt_amount(amount)}</b> на кредит «{data['loan_name']}» внесено!",
                parse_mode="HTML",
                reply_markup=open_app_inline(settings.WEBAPP_URL),
            )
        except Exception as e:
            await reply(f"❌ Помилка: {e}\nСпробуйте ще раз /pay")

    return router
