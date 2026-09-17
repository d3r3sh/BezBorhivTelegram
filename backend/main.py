"""
FastAPI application entry point.
Lifespan starts the Telegram bot (long polling) and APScheduler
only when BOT_TOKEN looks like a real token (contains ':').
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI

from backend.api import loans, payments
from backend.api import settings as settings_router
from backend.config import settings

logger = logging.getLogger(__name__)


def _bot_token_valid() -> bool:
    """A real Telegram token always contains exactly one ':' separator."""
    return ":" in settings.BOT_TOKEN


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = None
    polling_task: Optional[asyncio.Task] = None

    if _bot_token_valid():
        from aiogram import Bot, Dispatcher
        from aiogram.client.default import DefaultBotProperties
        from aiogram.enums import ParseMode

        from backend.bot.router import create_router
        from backend.notifications.scheduler import create_scheduler

        bot = Bot(
            token=settings.BOT_TOKEN,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML),
        )
        dp = Dispatcher()
        dp.include_router(create_router())

        scheduler = create_scheduler(bot)
        scheduler.start()
        logger.info("APScheduler started")

        # handle_signals=False: signal handlers require main thread;
        # graceful shutdown is handled by the lifespan cancel instead.
        polling_task = asyncio.create_task(
            dp.start_polling(bot, handle_signals=False)
        )
        logger.info("Bot polling started")
    else:
        logger.warning(
            "BOT_TOKEN not set — bot polling and scheduler are disabled"
        )

    yield

    if scheduler is not None:
        scheduler.shutdown(wait=False)
    if polling_task is not None:
        polling_task.cancel()
        try:
            await polling_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="БезБоргів API", version="0.1.0", lifespan=lifespan)

app.include_router(loans.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
