from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo


def main_menu(webapp_url: str) -> InlineKeyboardMarkup:
    """Keyboard with a single Web App button that opens the Mini App."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="Відкрити БезБоргів",
            web_app=WebAppInfo(url=webapp_url),
        )
    ]])
