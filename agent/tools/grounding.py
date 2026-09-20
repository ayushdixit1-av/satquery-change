import time

from agent.tools.base import Tool, ToolResult


class GroundingTool(Tool):
    name = "grounding"
    description = "Text-guided region grounding: highlight objects/regions (e.g. water body) with bounding boxes."
    inputs = "one optical image + a noun phrase to locate"

    def available(self):
        return False

    def run(self, ctx):
        return ToolResult(
            tool=self.name,
            status="pending",
            detail={"message": "Component not trained yet — slot a GeoChat-style RS grounding model here."},
            confidence=0.0,
            latency_ms=0.0,
            payload={"boxes": []},
        )