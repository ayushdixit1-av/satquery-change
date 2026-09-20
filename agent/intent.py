CHANGE_TOKENS = ["change", "changed", "changes", "difference", "different", "compare", "before", "after", "t1", "t2"]
CHANGE_DIR_TOKENS = ["increase", "increased", "decrease", "decreased", "grew", "grown", "shrank", "unchanged", "remaining", "buildings", "built-up", "built up"]
SAR_TOKENS = ["sar", "radar", "risat", "cross-mod", "optical and sar", "optical+radar", "multi-sensor"]
GROUNDING_TOKENS = ["highlight", "locate", "where is", "where's", "find ", "ground", "bounding", "point to", "box ", "point out", "region where", "outline"]
VQA_TOKENS = ["what is", "what's", "how many", "how much", "which", "count", "is there", "are there", "exists", "present", "? "]
CAPTION_TOKENS = ["describe", "caption", "explain", "what do you see", "what does this", "land cover", "scene", "what is in", "contents"]


def classify_intent(query, images):
    q = (query or "").lower()
    n = len(images)
    mods = {im.modality for im in images}

    is_sar_asked = any(t in q for t in SAR_TOKENS)
    has_sar = "sar" in mods

    if n == 2 and (is_sar_asked or has_sar) and ("optical" in mods or len(mods) == 1):
        return "optical_sar_fusion"

    if n == 2 or any(t in q for t in CHANGE_TOKENS):
        if any(t in q for t in CHANGE_DIR_TOKENS):
            return "change_vqa"
        if any(t in q for t in ("describe", "description", "what changed", "tell", "caption", "why")):
            return "change_vqa"
        return "change_detection"

    if any(t in q for t in GROUNDING_TOKENS):
        return "grounding"

    if any(t in q for t in CAPTION_TOKENS):
        return "scene_description"

    return "rs_vqa"


def allowed_tools_for(intent):
    return {
        "change_detection": ["change_detection", "change_understanding"],
        "change_vqa": ["change_understanding", "change_detection"],
        "optical_sar_fusion": ["optical_sar_fusion"],
        "grounding": ["grounding", "scene_description"],
        "scene_description": ["scene_description"],
        "rs_vqa": ["rs_vqa", "scene_description"],
    }.get(intent, [])


def intent_label(intent):
    return {
        "change_detection": "Bi-temporal change analysis",
        "change_vqa": "Change understanding / question answering",
        "optical_sar_fusion": "Optical–SAR joint analysis",
        "grounding": "Text-guided region grounding",
        "scene_description": "Single-image description / land-cover readout",
        "rs_vqa": "Remote-sensing visual question answering",
    }.get(intent, intent)