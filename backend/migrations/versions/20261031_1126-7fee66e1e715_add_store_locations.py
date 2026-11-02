"""add store locations

Revision ID: 7fee66e1e715
Revises: a3f1c9e27b40
Create Date: 2026-10-31 11:26:46.738926

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7fee66e1e715'
down_revision: Union[str, Sequence[str], None] = 'a3f1c9e27b40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.create_table(
        "store_locations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("store_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("province", sa.String(length=100), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column(
            "fulfillment_mode",
            sa.String(length=10),
            nullable=False,
        ),
        sa.Column(
            "external_reference",
            sa.String(length=120),
            nullable=True,
        ),
        sa.Column(
            "region_id",
            sa.String(length=150),
            nullable=True,
        ),
        sa.Column(
            "sales_channel",
            sa.String(length=20),
            nullable=True,
        ),
        sa.Column(
            "active",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "fulfillment_mode IN ('pickup', 'delivery')",
            name="fulfillment_mode_valid",
        ),
        sa.ForeignKeyConstraint(
            ["store_id"],
            ["stores.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "store_id",
            "code",
            name="uq_store_locations_store_code",
        ),
    )


def downgrade() -> None:
    op.drop_table("store_locations")

