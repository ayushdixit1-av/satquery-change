import time

from agent.tools.base import Tool, ToolResult


class ChangeUnderstandingTool(Tool):
    name = "change_understanding"
    description = "Bi-temporal pair -> natural-language change description / change-VQA."
    inputs = "two co-registered images of the same area at different times"

    def available(self):
        return False

    def run(self, ctx):
        return ToolResult(
            tool=self.name,
            status="pending",
            detail={"message": "Component not trained yet — slot a CDVQA-trained change-understanding model here."},
            confidence=0.0,
            latency_ms=0.0,
            payload={"answer": None},
        )