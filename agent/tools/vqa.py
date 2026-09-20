import time

from agent.tools.base import Tool, ToolResult


class VQATool(Tool):
    name = "rs_vqa"
    description = "Single-image remote-sensing visual question answering (fine-tuned RS VLM)."
    inputs = "one optical/multispectral/SAR image + a natural-language question"

    def available(self):
        return False

    def run(self, ctx):
        return ToolResult(
            tool=self.name,
            status="pending",
            detail={"message": "Component not trained yet — slot a BigEarthNet/RSVQA fine-tuned VLM here."},
            confidence=0.0,
            latency_ms=(time.time() - time.time()) * 1000.0,
            payload={"answer": None},
        )