"""Handler: prompt user to open the app for adding a loan."""

from __future__ import annotations

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message

from backend.bot.keyboards import open_app_button
from backend.config import settings


def create_router() -> Router:
    router = Router()

    @router.message(Command("addloan"))
    @router.message(F.text == "➕ Додати кредит")
    async def cmd_add_loan(message: Message) -> None:
        await message.answer(
            "Додавання кредиту доступне у застосунку.\n"
            "Натисніть кнопку нижче, щоб відкрити його:",
            reply_markup=open_app_button(settings.WEBAPP_URL),
        )

    return router
