"""
APScheduler setup — daily 10:00 Kyiv time notification job.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.config import settings

if TYPE_CHECKING:
    from aiogram import Bot

logger = logging.getLogger(__name__)


def create_scheduler(bot: "Bot") -> AsyncIOScheduler:
    """
    Build AsyncIOScheduler with the daily notification job.
    The job sends messages at 10:00 SCHEDULER_TIMEZONE every day.
    """
    tz = pytz.timezone(settings.SCHEDULER_TIMEZONE)
    scheduler = AsyncIOScheduler(timezone=tz)

    async def _send_daily_notifications() -> None:
        """Fetch all users from DB and dispatch notifications via bot."""
        from datetime import date

        from sqlalchemy.orm import joinedload

        from backend.db.models import Loan, User
        from backend.db.session import SessionLocal
        from backend.notifications.sender import build_notifications

        db = SessionLocal()
        try:
            users = (
                db.query(User)
                .options(joinedload(User.loans).joinedload(Loan.payments))
                .all()
            )
            items = build_notifications(users, date.today())
            for item in items:
                try:
                    await bot.send_message(item.user_telegram_id, item.text)
                    logger.debug("Notification sent to %s", item.user_telegram_id)
                except Exception as exc:
                    logger.warning(
                        "Failed to send notification to %s: %s",
                        item.user_telegram_id,
                        exc,
                    )
        finally:
            db.close()

    scheduler.add_job(
        _send_daily_notifications,
        CronTrigger(hour=10, minute=0, timezone=tz),
        id="daily_notifications",
        replace_existing=True,
        misfire_grace_time=3600,  # run up to 1 hour late if server was down
    )

    return scheduler
