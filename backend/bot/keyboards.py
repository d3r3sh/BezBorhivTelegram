from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton,
    WebAppInfo,
)


def main_menu(webapp_url: str) -> InlineKeyboardMarkup:
    """Inline keyboard with Web App button — shown on /start."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📱 Відкрити БезБоргів",
            web_app=WebAppInfo(url=webapp_url),
        )
    ]])


def main_reply_keyboard(webapp_url: str) -> ReplyKeyboardMarkup:
    """Persistent reply keyboard for quick actions."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Мої кредити"), KeyboardButton(text="💳 Внести платіж")],
            [KeyboardButton(text="➕ Додати кредит"), KeyboardButton(text="📱 Відкрити застосунок", web_app=WebAppInfo(url=webapp_url))],
        ],
        resize_keyboard=True,
        input_field_placeholder="Оберіть дію або введіть команду",
    )


def input_mode_keyboard() -> InlineKeyboardMarkup:
    """Choose between rate and monthly payment."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="📊 Ставку (% річних)", callback_data="mode:rate"),
        InlineKeyboardButton(text="💰 Суму платежу (₴)", callback_data="mode:payment"),
    ]])


def loans_keyboard(loans: list) -> InlineKeyboardMarkup:
    """
    Inline keyboard with one button per loan.
    loans: list of LoanOut with .id, .name, .current_balance
    """
    from backend.bot.utils import fmt_amount
    buttons = [
        [InlineKeyboardButton(
            text=f"{loan.name} — {fmt_amount(loan.current_balance)}",
            callback_data=f"loan:{str(loan.id)[:36]}",
        )]
        for loan in loans
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def payment_type_keyboard() -> InlineKeyboardMarkup:
    """Choose between regular and extra payment."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💳 Плановий", callback_data="ptype:regular"),
        InlineKeyboardButton(text="⚡ Дострокове", callback_data="ptype:extra"),
    ]])


def open_app_button(webapp_url: str) -> InlineKeyboardMarkup:
    """Single button to open the Mini App."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="📱 Відкрити застосунок", web_app=WebAppInfo(url=webapp_url))
    ]])
