"""Handler: show list of active loans."""

from __future__ import annotations

from decimal import Decimal

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message

from backend.bot.utils import run_db, fmt_amount
from backend.bot.keyboards import open_app_inline
from backend.config import settings
from backend.services.loan_service import get_loans


def create_router() -> Router:
    router = Router()

    @router.message(Command("loans"))
    @router.message(F.text == "📋 Мої кредити")
    async def cmd_my_loans(message: Message) -> None:
        telegram_id = message.from_user.id
        loans = await run_db(telegram_id, lambda db, user: get_loans(db, user, archived=False))
        active = [l for l in loans if not l.is_archived]

        if not active:
            await message.answer(
                "У вас ще немає кредиту. Ви можете додати кредит у застосунку.",
                reply_markup=open_app_inline(settings.WEBAPP_URL),
            )
            return

        total = sum(Decimal(str(loan.current_balance)) for loan in active)
        lines = ["📋 <b>Мої кредити</b>\n"]
        for loan in active:
            lines.append(f"• {loan.name} — {fmt_amount(loan.current_balance)}")
        lines.append(f"\n<b>Загальний борг: {fmt_amount(total)}</b>")

        await message.answer(
            "\n".join(lines),
            parse_mode="HTML",
            reply_markup=open_app_inline(settings.WEBAPP_URL),
        )

    return router
