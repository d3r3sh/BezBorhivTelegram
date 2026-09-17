from fastapi import FastAPI

from backend.api import loans, payments, settings

app = FastAPI(title="БезБоргів API", version="0.1.0")

app.include_router(loans.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
