from pydantic import BaseModel


class AdBase(BaseModel):
    title: str
    description: str


class AdCreate(AdBase):
    category_id: int
    price: float
