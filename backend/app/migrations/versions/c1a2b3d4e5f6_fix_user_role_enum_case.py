"""fix_user_role_enum_case

Revision ID: c1a2b3d4e5f6
Revises: b2d4f77e9a11
Create Date: 2026-05-27 14:36:00.000000
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, None] = "b2d4f77e9a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Normalize enum labels for SQLAlchemy Enum(UserRole) which stores names (USER/ADMIN).
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'user_role' AND e.enumlabel = 'user'
            ) THEN
                ALTER TYPE user_role RENAME VALUE 'user' TO 'USER';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'user_role' AND e.enumlabel = 'admin'
            ) THEN
                ALTER TYPE user_role RENAME VALUE 'admin' TO 'ADMIN';
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'user_role' AND e.enumlabel = 'USER'
            ) THEN
                ALTER TYPE user_role RENAME VALUE 'USER' TO 'user';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'user_role' AND e.enumlabel = 'ADMIN'
            ) THEN
                ALTER TYPE user_role RENAME VALUE 'ADMIN' TO 'admin';
            END IF;
        END $$;
        """
    )
