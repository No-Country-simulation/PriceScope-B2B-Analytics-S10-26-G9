"""add location to prices

Revision ID: 84f2d8fcbd79
Revises: 7fee66e1e715
Create Date: 2026-10-31 11:37:26.141655

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '84f2d8fcbd79'
down_revision: Union[str, Sequence[str], None] = '7fee66e1e715'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.add_column(
        "prices",
        sa.Column(
            "location_id",
            sa.Uuid(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_prices_location_id_store_locations",
        "prices",
        "store_locations",
        ["location_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_index(
        "ix_prices_location_captured_at",
        "prices",
        ["location_id", "captured_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_prices_location_captured_at",
        table_name="prices",
    )

    op.drop_constraint(
        "fk_prices_location_id_store_locations",
        "prices",
        type_="foreignkey",
    )

    op.drop_column("prices", "location_id")
