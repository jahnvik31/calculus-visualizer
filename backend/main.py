"""FastAPI application for the calculus visualizer."""

from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.area_solver import solve_area_between_curves

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"

app = FastAPI(title="Calculus Visualizer", version="0.1.0")
app.mount("/assets", StaticFiles(directory=FRONTEND), name="assets")


class AreaRequest(BaseModel):
    first_function: Annotated[str, Field(min_length=1, max_length=128)]
    second_function: Annotated[str, Field(min_length=1, max_length=128)]
    lower_bound: float | None = None
    upper_bound: float | None = None


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(FRONTEND / "index.html")


@app.post("/api/solve")
def solve_area(request: AreaRequest) -> dict:
    try:
        return solve_area_between_curves(
            request.first_function,
            request.second_function,
            request.lower_bound,
            request.upper_bound,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
