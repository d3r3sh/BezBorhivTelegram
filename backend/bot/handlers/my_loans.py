"""Handler: show list of active loans."""

from __future__ import annotations

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message

from backend.bot.utils import run_db, fmt_amount, fmt_date
from backend.bot.keyboards import open_app_button
from backend.config import settings
from backend.services.loan_service import get_loans


def create_router() -> Router:
    router = Router()

    @router.message(Command("loans"))
    @router.message(F.text == "📋 Мої кредити")
    async def cmd_my_loans(message: Message) -> None:
        telegram_id = message.from_user.id
        loans = await run_db(telegram_id, lambda db, user: get_loans(db, user, archived=False))

        if not loans:
            await message.answer(
                "У вас поки немає активних кредитів.\n"
                "Натисніть «➕ Додати кредит» щоб додати перший.",
            )
            return

        lines = ["📋 <b>Ваші кредити:</b>\n"]
        for i, loan in enumerate(loans, 1):
            status = "🔴 Прострочено" if loan.is_overdue else "🟢"
            next_info = ""
            if loan.next_payment_date:
                next_info = (
                    f"\n   ↳ Наступний: "
                    f"{fmt_amount(loan.next_payment_amount or loan.monthly_payment)} "
                    f"· {fmt_date(loan.next_payment_date)}"
                )
            lines.append(
                f"{i}. {status} <b>{loan.name}</b>\n"
                f"   Залишок: {fmt_amount(loan.current_balance)}"
                f"{next_info}"
            )

        await message.answer(
            "\n".join(lines),
            parse_mode="HTML",
            reply_markup=open_app_button(settings.WEBAPP_URL),
        )

    return router
