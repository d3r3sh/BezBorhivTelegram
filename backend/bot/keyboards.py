from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton,
    WebAppInfo,
)


def main_reply_keyboard(webapp_url: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Мої кредити"), KeyboardButton(text="💳 Внести платіж")],
            [KeyboardButton(text="➕ Додати кредит"), KeyboardButton(text="📱 Відкрити застосунок", web_app=WebAppInfo(url=webapp_url))],
        ],
        resize_keyboard=True,
        input_field_placeholder="Оберіть дію або введіть команду",
    )


def open_app_inline(webapp_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="📱 Відкрити застосунок", web_app=WebAppInfo(url=webapp_url))
    ]])


def loans_select_keyboard(loans: list, webapp_url: str) -> InlineKeyboardMarkup:
    from backend.bot.utils import fmt_amount
    buttons = [
        [InlineKeyboardButton(
            text=f"{loan.name} — {fmt_amount(loan.current_balance)}",
            callback_data=f"loan:{str(loan.id)[:36]}",
        )]
        for loan in loans
    ]
    buttons.append([InlineKeyboardButton(
        text="📱 Відкрити застосунок", web_app=WebAppInfo(url=webapp_url)
    )])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def payment_type_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💳 Плановий", callback_data="ptype:regular"),
        InlineKeyboardButton(text="⚡ Достроковий", callback_data="ptype:extra"),
    ]])


def payment_amount_keyboard(recommended: str, minimum: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"✅ Внести рекомендовану ({recommended})", callback_data="amount:recommended")],
        [InlineKeyboardButton(text=f"Внести мінімальну ({minimum})", callback_data="amount:minimum")],
        [InlineKeyboardButton(text="✏️ Ввести свою суму", callback_data="amount:custom")],
    ])
