"""Run the NTAXCO FastAPI backend for local Windows/Linux/macOS development."""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
