from fastapi import APIRouter

router = APIRouter(prefix="/ads", tags=["ads"])


@router.get("/hello")
def hello():
    return {"msg" : "ok"}