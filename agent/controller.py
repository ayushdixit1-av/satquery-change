import time

from agent.intent import allowed_tools_for, classify_intent, intent_label
from agent.registry import build_registry
from agent.tools.change_detect import ChangeDetectionTool
from agent.tools.change_vqa import ChangeUnderstandingTool
from agent.tools.grounding import GroundingTool
from agent.tools.sar_fusion import OpticalSARTool
from agent.tools.scene import SceneDescriptionTool
from agent.tools.vqa import VQATool
from agent.validate import validate_inputs


class AgentResponse:
    def __init__(self, task, answer, confidence, trace, warnings, evidence, payload, models):
        self.task = task
        self.answer = answer
        self.confidence = confidence
        self.trace = trace
        self.warnings = warnings
        self.evidence = evidence
        self.payload = payload
        self.models = models

    def to_dict(self):
        return {
            "task": intent_label(self.task),
            "task_id": self.task,
            "answer": self.answer,
            "confidence": round(float(self.confidence), 3),
            "evidence": self.evidence,
            "warnings": self.warnings,
            "models": self.models,
            "payload": self.payload,
            "trace": self.trace,
        }


def build_controller():
    return AgentController(
        build_registry(
            ChangeDetectionTool(),
            SceneDescriptionTool(),
            VQATool(),
            GroundingTool(),
            OpticalSARTool(),
            ChangeUnderstandingTool(),
        )
    )


class AgentController:
    def __init__(self, registry):
        self.registry = registry

    def tools(self):
        return self.registry.describe_all()

    def process(self, query, files):
        t0 = time.time()
        result = validate_inputs(files)
        if not result.ok:
            return AgentResponse("invalid_input", "; ".join(result.errors), 0.0, [], result.errors, {}, {}, [])

        images = result.images
        ctx = {"query": query, "images": images, "size": 512}

        intent = classify_intent(query, images)
        candidates = allowed_tools_for(intent)

        trace = []
        payload_combined = {}
        weights = []
        confidences = []
        models = []
        evidence = {}
        answers = []

        for name in candidates:
            tool = self.registry.get(name)
            if tool is None:
                continue
            entry = {"step": len(trace) + 1, "tool": name, "status": "pending", "params": {}, "detail": None}
            try:
                t1 = time.time()
                res = tool.run(ctx)
                entry["status"] = res.status
                entry["params"] = {"images": len(images), "size": ctx["size"]}
                entry["detail"] = res.detail
                entry["latency_ms"] = round(res.latency_ms, 1)
                payload_combined[name] = res.payload
                if res.status == "ok":
                    confidences.append(res.confidence)
                    models.append({"tool": name, "available": tool.available(), "status": res.status})
                if "mask" in res.payload:
                    evidence["mask"] = res.payload["mask"]
                if "prob_map" in res.payload:
                    evidence["prob_map"] = res.payload["prob_map"]
                if "boxes" in res.payload and res.payload["boxes"]:
                    evidence["boxes"] = res.payload["boxes"]
                if res.payload.get("text"):
                    answers.append(res.payload["text"])
                if res.status == "ok":
                    weights.append(res.confidence)
            except Exception as exc:
                entry["status"] = "error"
                entry["detail"] = {"error": str(exc)}
            trace.append(entry)

        confidence = float(sum(confidences) / len(confidences)) if confidences else 0.0
        total_ms = (time.time() - t0) * 1000.0

        answer = self._compose_answer(intent, answers, payload_combined)

        return AgentResponse(
            task=intent,
            answer=answer,
            confidence=confidence,
            trace=trace,
            warnings=result.warnings,
            evidence=evidence,
            payload={k: v for k, v in payload_combined.items()},
            models=models,
        ).to_dict()

    def _compose_answer(self, intent, answers, payload):
        if intent == "change_detection":
            cd = payload.get("change_detection", {})
            if "changed_pct" in cd:
                ncc = cd.get("alignment_ncc", 0)
                trust = "" if ncc >= 0.75 else " Caution: the pair may not be co-registered (alignment score low)."
                return (
                    f"{cd.get('changed_pct', 0):.1f}% of the scene changed between the two dates"
                    f" (auto threshold {cd.get('auto_threshold', 0):.2f}, alignment NCC {ncc:.2f}).{trust}"
                )
        if "scene_description" in payload and (payload["scene_description"].get("text")):
            return payload["scene_description"]["text"]
        if answers:
            return " ".join(answers).strip()
        pending = [v for k, v in payload.items() if "answer" in v and v["answer"] is None]
        if pending:
            return "This specialist model is not trained yet. Architecture is wired — the answer will appear once the VLM component is slotted in."
        return "No specialist model produced an answer for this query."