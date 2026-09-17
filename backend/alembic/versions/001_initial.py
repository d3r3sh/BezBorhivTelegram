"""Initial schema: users, loans, payments

Revision ID: 001
Revises:
Create Date: 2026-09-18
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("telegram_id", sa.BigInteger, unique=True, nullable=False),
        sa.Column("monthly_budget", sa.Numeric(14, 2), nullable=True),
        sa.Column("strategy", sa.String(20), nullable=False, server_default="none"),
        sa.Column("notify_day_of", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notify_1_day_before", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notify_3_days_before", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"])

    op.create_table(
        "loans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("initial_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("annual_rate", sa.Numeric(10, 4), nullable=False),
        sa.Column("monthly_payment", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_planned_payments", sa.Integer, nullable=False),
        sa.Column("first_payment_date", sa.Date, nullable=False),
        sa.Column("payment_day", sa.Integer, nullable=False),
        sa.Column("color_index", sa.Integer, nullable=False, server_default="1"),
        sa.Column("is_archived", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("archived_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_loans_user_id", "loans", ["user_id"])

    op.create_table(
        "payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("loan_id", sa.String(36), sa.ForeignKey("loans.id"), nullable=False),
        sa.Column("planned_date", sa.Date, nullable=True),
        sa.Column("planned_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("actual_date", sa.Date, nullable=True),
        sa.Column("actual_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("is_extra", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("principal_part", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("interest_part", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_payments_loan_id", "payments", ["loan_id"])


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("loans")
    op.drop_table("users")
