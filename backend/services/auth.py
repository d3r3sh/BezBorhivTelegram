"""
Telegram WebApp initData validation — SRS auth requirements.
Algorithm: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Optional
from urllib.parse import unquote, parse_qsl

from fastapi import HTTPException, status


def _build_data_check_string(params: dict) -> str:
    """Sort params (excluding 'hash') and join as key=value\\n."""
    pairs = sorted(
        (k, v) for k, v in params.items() if k != "hash"
    )
    return "\n".join(f"{k}={v}" for k, v in pairs)


def validate_init_data(init_data: str, bot_token: str, max_age: int = 86400) -> dict:
    """
    Validate Telegram WebApp initData string.
    Returns parsed user dict on success.
    Raises HTTP 401 on invalid signature or expired data.
    """
    params = dict(parse_qsl(init_data, keep_blank_values=True))

    if "hash" not in params:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing hash")

    data_check_string = _build_data_check_string(params)

    secret_key = hmac.new(
        b"WebAppData",
        bot_token.encode(),
        hashlib.sha256,
    ).digest()

    expected_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, params["hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    if max_age > 0 and "auth_date" in params:
        age = int(time.time()) - int(params["auth_date"])
        if age > max_age:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Expired initData")

    user_json = params.get("user", "{}")
    return json.loads(unquote(user_json))


def validate_telegram_widget(data: dict, bot_token: str, max_age: int = 86400) -> None:
    """
    Validate Telegram Login Widget data.
    https://core.telegram.org/widgets/login#checking-authorization

    Key difference from initData: secret_key = SHA256(bot_token), not HMAC.
    Raises HTTP 401 on invalid signature or expired data.
    """
    received_hash = data.get("hash")
    if not received_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing hash")

    # Exclude hash and None values — Telegram only signs fields that are present
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data.items()) if k != "hash" and v is not None
    )

    secret_key = hashlib.sha256(bot_token.encode()).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    if max_age > 0 and "auth_date" in data:
        age = int(time.time()) - int(data["auth_date"])
        if age > max_age:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Expired auth data")


def generate_test_widget_data(bot_token: str, telegram_id: int) -> dict:
    """Generate valid widget data for testing — NOT for production use."""
    auth_date = str(int(time.time()))
    data = {
        "id": str(telegram_id),
        "first_name": "Test",
        "username": "testuser",
        "auth_date": auth_date,
    }
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    data["hash"] = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    data["id"] = telegram_id  # back to int for the Pydantic model
    return data


def generate_test_init_data(bot_token: str, telegram_id: int) -> str:
    """Generate valid initData for testing — NOT for production use."""
    import json
    from urllib.parse import urlencode

    user = json.dumps({"id": telegram_id, "first_name": "Test", "username": "testuser"})
    auth_date = str(int(time.time()))

    params: dict = {
        "auth_date": auth_date,
        "query_id": "test_query_id",
        "user": user,
    }

    data_check_string = _build_data_check_string(params)
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    params["hash"] = h
    return urlencode(params)
