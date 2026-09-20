class Tool:
    name = ""
    description = ""
    inputs = ""

    def available(self):
        return False

    def run(self, ctx):
        raise NotImplementedError


class ToolResult:
    def __init__(self, tool, status="ok", detail=None, confidence=0.0, latency_ms=0.0, payload=None):
        self.tool = tool
        self.status = status
        self.detail = detail or {}
        self.confidence = confidence
        self.latency_ms = latency_ms
        self.payload = payload or {}

    def to_dict(self):
        return {
            "tool": self.tool,
            "status": self.status,
            "detail": self.detail,
            "confidence": round(float(self.confidence), 3),
            "latency_ms": round(float(self.latency_ms), 1),
        }