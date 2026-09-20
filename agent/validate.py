import os

ALLOWED_FORMAT_NAMES = {".tif", ".tiff", ".geotiff", ".png", ".jpg", ".jpeg", ".jp2"}
GEOTIFF_NAMES = {".tif", ".tiff"}


class InputImage:
    def __init__(self, filename, bytes_, index):
        self.name = filename or f"image_{index}"
        self.bytes = bytes_
        self.ext = (os.path.splitext(self.name)[1] or ".png").lower()
        self.is_geotiff = self.ext in GEOTIFF_NAMES
        self.modality = self._guess_modality()

    def _guess_modality(self):
        low = self.name.lower()
        if any(k in low for k in ("sar", "risat", "radar", "niasar", "slc", "grd")):
            return "sar"
        if any(k in low for k in ("t1", "before", "2020", "earlier")):
            return "optical"
        if any(k in low for k in ("t2", "after", "2024", "later")):
            return "optical"
        return "optical"


class ValidationResult:
    def __init__(self, ok, images=None, warnings=None, errors=None):
        self.ok = ok
        self.images = images or []
        self.warnings = warnings or []
        self.errors = errors or []


def validate_inputs(files):
    if not files or len(files) == 0:
        return ValidationResult(False, errors=["No images provided. Expected 1 (single-image) or 2 (pair)."])
    if len(files) > 2:
        return ValidationResult(False, errors=[f"Expected 1 or 2 images, got {len(files)}."])

    warnings = []
    images = []
    for i, f in enumerate(files):
        img = InputImage(f.filename, f.file.read() if hasattr(f, "file") else f.bytes, i)
        if img.ext not in ALLOWED_FORMAT_NAMES:
            return ValidationResult(False, errors=[f"Unsupported format '{img.ext or 'unknown'}' for {img.name}. Allowed: GeoTIFF/TIFF, PNG, JPEG."])
        if not img.is_geotiff:
            warnings.append(f"{img.name}: admitted as PNG/JPEG benchmark-style input (GeoTIFF preferred for ISRO/SAC data).")
        images.append(img)

    if len(images) == 2:
        n_sar = sum(1 for im in images if im.modality == "sar")
        if n_sar == 1:
            warnings.append("Cross-modal pair detected (optical + SAR) — routing to optical/SAR fusion.")
        elif n_sar == 2:
            warnings.append("Pair of SAR images — use change analysis if bi-temporal, else check compatibility.")
        else:
            warnings.append("Bi-temporal optical pair assumed — routing to change understanding.")

    return ValidationResult(True, images=images, warnings=warnings)