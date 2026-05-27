from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    listing_id: int = Field(..., ge=1)
    reason: str = Field(default="", max_length=1000)


class ReportCreateResponse(BaseModel):
    message: str
