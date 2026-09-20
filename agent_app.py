import io
import time

import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from agent.controller import build_controller

app = FastAPI(title="SatQuery AI — Agentic Remote-Sensing Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

controller = build_controller()


@app.get("/")
async def root():
    return {
        "name": "SatQuery AI agent",
        "actions": {
            "/query": "POST multipart: 'query' text + up to 2 image files (GeoTIFF/TIFF/PNG/JPEG)",
            "/tools": "GET — registry of specialist tools and their availability",
            "/health": "GET — server/model status",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok", "tools": len(controller.registry.names()), "started": True}


@app.get("/tools")
async def tools():
    return {"tools": controller.tools()}


@app.post("/query")
async def query(query: str = Form(...), image: list[UploadFile] = File(...)):
    t0 = time.time()
    resp = controller.process(query, image)
    resp["run_ms"] = round((time.time() - t0) * 1000.0, 1)
    return JSONResponse(resp)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)