"""Handler: add loan is only available in the app."""

from __future__ import annotations

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message

from backend.bot.keyboards import open_app_inline
from backend.config import settings


def create_router() -> Router:
    router = Router()

    @router.message(Command("addloan"))
    @router.message(F.text == "➕ Додати кредит")
    async def cmd_add_loan(message: Message) -> None:
        await message.answer(
            "Додавання кредитів можливе лише в застосунку.",
            reply_markup=open_app_inline(settings.WEBAPP_URL),
        )

    return router
