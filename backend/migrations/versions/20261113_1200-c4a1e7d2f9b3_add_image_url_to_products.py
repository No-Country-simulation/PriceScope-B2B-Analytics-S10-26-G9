"""add image url to listings and canonical products

Revision ID: c4a1e7d2f9b3
Revises: b9bf7bf19011
Create Date: 2026-11-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4a1e7d2f9b3'
down_revision: Union[str, Sequence[str], None] = 'b9bf7bf19011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listings', sa.Column('image_url', sa.String(length=500), nullable=True))
    op.add_column('canonical_products', sa.Column('image_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('canonical_products', 'image_url')
    op.drop_column('listings', 'image_url')
