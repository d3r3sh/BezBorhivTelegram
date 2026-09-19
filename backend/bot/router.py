"""
aiogram Router factory.
Registers all command and conversation handlers.
"""

from __future__ import annotations

from aiogram import Router, F
from aiogram.filters import Command, CommandStart
from aiogram.fsm.state import default_state
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from backend.bot.keyboards import main_reply_keyboard
from backend.bot.handlers import add_loan, record_payment, my_loans
from backend.config import settings


def create_router() -> Router:
    router = Router()

    # ── /start ──────────────────────────────────────────────────────────────
    @router.message(CommandStart())
    async def cmd_start(message: Message) -> None:
        name = message.from_user.first_name or "друже"
        await message.answer(
            f"Привіт, {name}! 👋\n\n"
            "Я бот додатку БезБоргів — тут ти можеш швидко переглянути "
            "свої кредити та внести платіж.",
            reply_markup=main_reply_keyboard(settings.WEBAPP_URL),
        )

    # ── /cancel ─────────────────────────────────────────────────────────────
    @router.message(Command("cancel"))
    async def cmd_cancel(message: Message, state: FSMContext) -> None:
        current = await state.get_state()
        await state.clear()
        if current:
            await message.answer("❌ Скасовано.", reply_markup=main_reply_keyboard(settings.WEBAPP_URL))
        else:
            await message.answer("Немає активної дії.", reply_markup=main_reply_keyboard(settings.WEBAPP_URL))

    # ── Sub-routers ──────────────────────────────────────────────────────────
    router.include_router(my_loans.create_router())
    router.include_router(add_loan.create_router())
    router.include_router(record_payment.create_router())

    # ── Catch-all (last) ─────────────────────────────────────────────────────
    fallback = Router()

    @fallback.message(default_state, F.text, ~F.text.startswith("/"))
    async def cmd_unknown(message: Message) -> None:
        await message.answer(
            "Скористайтесь кнопками меню або:\n"
            "/loans — мої кредити\n"
            "/pay — внести платіж",
        )

    router.include_router(fallback)

    return router
