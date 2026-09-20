class ToolRegistry:
    def __init__(self):
        self._tools = {}

    def register(self, tool):
        self._tools[tool.name] = tool
        return tool

    def get(self, name):
        return self._tools.get(name)

    def names(self):
        return list(self._tools.keys())

    def describe_all(self):
        return [
            {
                "name": t.name,
                "description": t.description,
                "inputs": t.inputs,
                "available": t.available(),
                "status": "ready" if t.available() else "pending",
            }
            for t in self._tools.values()
        ]


def build_registry(change_detect, scene, vqa, grounding, sar, change_vqa):
    reg = ToolRegistry()
    for t in (change_detect, scene, vqa, grounding, sar, change_vqa):
        reg.register(t)
    return reg