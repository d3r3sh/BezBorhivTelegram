"""
aiogram Router factory.
Registers all command and conversation handlers.
"""

from __future__ import annotations

from aiogram import Router, F
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from backend.bot.keyboards import main_menu, main_reply_keyboard
from backend.bot.handlers import add_loan, record_payment, my_loans
from backend.config import settings


def create_router() -> Router:
    """Return a new Router with all handlers registered."""
    router = Router()

    # Include sub-routers (each call returns a fresh Router instance)
    router.include_router(my_loans.create_router())
    router.include_router(add_loan.create_router())
    router.include_router(record_payment.create_router())

    # ── /start ──────────────────────────────────────────────────────────────
    @router.message(CommandStart())
    async def cmd_start(message: Message) -> None:
        name = message.from_user.first_name or "друже"
        await message.answer(
            f"👋 <b>Вітаємо, {name}!</b>\n\n"
            "БезБоргів допоможе відстежувати кредити та виплати.\n\n"
            "<b>Що можна зробити прямо тут:</b>\n"
            "📋 Переглянути свої кредити\n"
            "➕ Додати новий кредит\n"
            "💳 Зафіксувати платіж\n\n"
            "🎯 Стратегія та детальна аналітика — у застосунку:",
            parse_mode="HTML",
            reply_markup=main_reply_keyboard(),
        )
        await message.answer(
            "Відкрити повний застосунок:",
            reply_markup=main_menu(settings.WEBAPP_URL),
        )

    # ── Відкрити застосунок ──────────────────────────────────────────────────
    @router.message(F.text == "📱 Відкрити застосунок")
    async def cmd_open_app(message: Message) -> None:
        await message.answer(
            "Натисніть кнопку нижче:",
            reply_markup=main_menu(settings.WEBAPP_URL),
        )

    # ── /cancel ─────────────────────────────────────────────────────────────
    @router.message(Command("cancel"))
    async def cmd_cancel(message: Message, state: FSMContext) -> None:
        current = await state.get_state()
        await state.clear()
        if current:
            await message.answer("❌ Скасовано.", reply_markup=main_reply_keyboard())
        else:
            await message.answer("Немає активної дії.", reply_markup=main_reply_keyboard())

    # ── /help ────────────────────────────────────────────────────────────────
    @router.message(Command("help"))
    async def cmd_help(message: Message) -> None:
        await message.answer(
            "<b>Команди бота:</b>\n\n"
            "/loans — переглянути кредити\n"
            "/addloan — додати кредит\n"
            "/pay — зафіксувати платіж\n"
            "/cancel — скасувати поточну дію\n\n"
            "🎯 Обрати стратегію погашення можна лише у застосунку.",
            parse_mode="HTML",
        )

    return router
