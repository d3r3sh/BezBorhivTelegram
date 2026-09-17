"""
aiogram Router factory — creates a fresh Router per Dispatcher instance.
Using a factory avoids "Router is already included" errors when the
lifespan is invoked multiple times (e.g. in tests).
"""

from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

from backend.config import settings
from backend.bot.keyboards import main_menu


def create_router() -> Router:
    """Return a new Router with all command handlers registered."""
    router = Router()

    @router.message(CommandStart())
    async def cmd_start(message: Message) -> None:
        text = (
            "👋 <b>Вітаємо у БезБоргів!</b>\n\n"
            "Відстежуйте особисті кредити, фіксуйте платежі та оберіть стратегію "
            "погашення, щоб швидше стати вільними від боргів.\n\n"
            "Натисніть кнопку нижче, щоб відкрити застосунок:"
        )
        await message.answer(
            text,
            parse_mode="HTML",
            reply_markup=main_menu(settings.WEBAPP_URL),
        )

    return router
