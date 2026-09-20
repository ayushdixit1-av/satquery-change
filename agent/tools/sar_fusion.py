import time

from agent.tools.base import Tool, ToolResult


class OpticalSARTool(Tool):
    name = "optical_sar_fusion"
    description = "Co-registered optical + SAR pair -> joint information extraction (built-up, water, structure)."
    inputs = "a co-registered optical/multispectral image and a SAR image of the same area"

    def available(self):
        return False

    def run(self, ctx):
        return ToolResult(
            tool=self.name,
            status="pending",
            detail={"message": "Component not trained yet — slot a BigEarthNet-MM optical/SAR fusion head here."},
            confidence=0.0,
            latency_ms=0.0,
            payload={"regions": []},
        )