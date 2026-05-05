from app.db.base import Base
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)

    listings = relationship("Listing", back_populates="category")