"""chat_and_listing_quantities

Revision ID: b2d4f77e9a11
Revises: 5a7d1f8c2b11
Create Date: 2026-05-24 13:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2d4f77e9a11"
down_revision: Union[str, None] = "5a7d1f8c2b11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "listings",
        sa.Column("quantity_total", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "listings",
        sa.Column("quantity_available", sa.Integer(), nullable=False, server_default="1"),
    )

    op.create_table(
        "chat_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("buyer_id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["buyer_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["seller_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("listing_id", "buyer_id", "seller_id", name="uq_chat_listing_buyer_seller"),
    )
    op.create_index(op.f("ix_chat_conversations_buyer_id"), "chat_conversations", ["buyer_id"], unique=False)
    op.create_index(op.f("ix_chat_conversations_id"), "chat_conversations", ["id"], unique=False)
    op.create_index(op.f("ix_chat_conversations_listing_id"), "chat_conversations", ["listing_id"], unique=False)
    op.create_index(op.f("ix_chat_conversations_seller_id"), "chat_conversations", ["seller_id"], unique=False)
    op.create_index(op.f("ix_chat_conversations_updated_at"), "chat_conversations", ["updated_at"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["chat_conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_messages_conversation_id"), "chat_messages", ["conversation_id"], unique=False)
    op.create_index(op.f("ix_chat_messages_created_at"), "chat_messages", ["created_at"], unique=False)
    op.create_index(op.f("ix_chat_messages_id"), "chat_messages", ["id"], unique=False)
    op.create_index(op.f("ix_chat_messages_sender_id"), "chat_messages", ["sender_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_messages_sender_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_created_at"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_conversation_id"), table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index(op.f("ix_chat_conversations_updated_at"), table_name="chat_conversations")
    op.drop_index(op.f("ix_chat_conversations_seller_id"), table_name="chat_conversations")
    op.drop_index(op.f("ix_chat_conversations_listing_id"), table_name="chat_conversations")
    op.drop_index(op.f("ix_chat_conversations_id"), table_name="chat_conversations")
    op.drop_index(op.f("ix_chat_conversations_buyer_id"), table_name="chat_conversations")
    op.drop_table("chat_conversations")

    op.drop_column("listings", "quantity_available")
    op.drop_column("listings", "quantity_total")
