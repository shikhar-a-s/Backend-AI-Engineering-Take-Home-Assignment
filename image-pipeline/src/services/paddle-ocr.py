import sys
import json
import os
import tempfile
from pathlib import Path
from contextlib import redirect_stdout

from PIL import Image
from paddleocr import PaddleOCR


def clean_text(text):
    """
    Keep only alphanumeric characters.
    """
    return "".join(
        ch
        for ch in str(text).upper()
        if ch.isalnum()
    )


def extract_bbox(result_data, index):
    """
    Extract [x1, y1, x2, y2] from PaddleOCR rec_boxes.
    """
    try:
        boxes = result_data.get("rec_boxes", [])

        if index >= len(boxes):
            return None

        box = boxes[index]

        if hasattr(box, "tolist"):
            box = box.tolist()

        if len(box) != 4:
            return None

        return [
            int(box[0]),
            int(box[1]),
            int(box[2]),
            int(box[3])
        ]

    except Exception:
        return None


def run_ocr(ocr, image_path):
    """
    Run PaddleOCR and return all detected text regions
    with confidence and geometry.
    """
    results = ocr.predict(image_path)

    lines = []

    for result in results:
        data = result.json

        if callable(data):
            data = data()

        res = data.get("res", {})

        texts = res.get("rec_texts", [])
        scores = res.get("rec_scores", [])

        for index, text in enumerate(texts):
            text = str(text).strip()

            if not text:
                continue

            cleaned = clean_text(text)

            if not cleaned:
                continue

            confidence = (
                float(scores[index])
                if index < len(scores)
                else 0.0
            )

            bbox = extract_bbox(
                res,
                index
            )

            width = None
            height = None
            center_x = None
            center_y = None
            area = 0

            if bbox:
                x1, y1, x2, y2 = bbox

                width = x2 - x1
                height = y2 - y1

                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2

                area = width * height

            lines.append({
                "text": text,
                "cleanText": cleaned,
                "confidence": round(
                    confidence,
                    4
                ),
                "bbox": bbox,
                "width": width,
                "height": height,
                "area": area,
                "centerX": center_x,
                "centerY": center_y
            })

    # Top-to-bottom, left-to-right
    lines.sort(
        key=lambda item: (
            item["centerY"]
            if item["centerY"] is not None
            else float("inf"),

            item["centerX"]
            if item["centerX"] is not None
            else float("inf")
        )
    )

    return lines


def build_result(lines, pass_name):
    """
    Build a result object from OCR lines.
    """
    raw_text = "".join(
        line["cleanText"]
        for line in lines
    )

    return {
        "pass": pass_name,
        "text": clean_text(raw_text),
        "rawText": raw_text,
        "lines": lines
    }


def create_upscaled_image(image_path):
    """
    Create a 4x upscaled copy for fallback OCR.
    """
    image = Image.open(
        image_path
    ).convert("RGB")

    width, height = image.size

    upscaled = image.resize(
        (
            width * 4,
            height * 4
        ),
        Image.Resampling.LANCZOS
    )

    temp_file = tempfile.NamedTemporaryFile(
        suffix=".png",
        delete=False
    )

    temp_path = temp_file.name
    temp_file.close()

    upscaled.save(
        temp_path,
        format="PNG"
    )

    return temp_path


def is_result_useful(result):
    """
    Decide whether the original OCR pass has enough
    substantial text regions.

    No hardcoded words or plate formats.
    """
    lines = result["lines"]

    if not lines:
        return False

    substantial = [
        line
        for line in lines
        if (
            (line["width"] or 0) >= 40
            and
            (line["height"] or 0) >= 15
        )
    ]

    # One substantial region may mean another
    # registration row was missed.
    if len(substantial) < 2:
        return False

    return True


def select_registration_lines(lines):
    """
    Select the dominant OCR regions that are likely to
    belong to the registration number.

    Uses only bounding-box geometry.
    Does NOT hardcode:
      - IND
      - state codes
      - country
      - plate format
    """
    if not lines:
        return []

    # Make sure area exists
    for line in lines:
        if line.get("area") is None:
            line["area"] = (
                (line.get("width") or 0) *
                (line.get("height") or 0)
            )

    largest_area = max(
        line["area"]
        for line in lines
    )

    if largest_area <= 0:
        return []

    # Keep text regions that are at least 45%
    # as large as the largest region.
    candidates = [
        line
        for line in lines
        if line["area"] >= largest_area * 0.45
    ]

    # Top -> bottom, then left -> right
    candidates.sort(
        key=lambda line: (
            line["centerY"]
            if line["centerY"] is not None
            else float("inf"),

            line["centerX"]
            if line["centerX"] is not None
            else float("inf")
        )
    )

    return candidates


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Image path required"
        }))
        sys.exit(1)

    image_path = sys.argv[1]

    if not Path(image_path).exists():
        print(json.dumps({
            "success": False,
            "error": f"Image not found: {image_path}"
        }))
        sys.exit(1)

    temp_upscaled = None

    try:
        # Keep PaddleOCR/runtime logs out of stdout.
        # Node expects stdout to contain JSON.
        with open(
            "nul",
            "w",
            encoding="utf-8"
        ) as devnull:

            with redirect_stdout(devnull):

                # ----------------------------------------
                # Initialize OCR
                # ----------------------------------------

                ocr = PaddleOCR(
                    lang="en",
                    device="cpu",

                    # Plate is not a document.
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,

                    # More room for small text.
                    text_det_limit_side_len=960
                )

                # ----------------------------------------
                # PASS 1: ORIGINAL
                # ----------------------------------------

                normal_lines = run_ocr(
                    ocr,
                    image_path
                )

                normal_result = build_result(
                    normal_lines,
                    "original"
                )

                # ----------------------------------------
                # PASS 2: 4x UPSCALE FALLBACK
                # ----------------------------------------

                if is_result_useful(
                    normal_result
                ):
                    final_result = normal_result
                    fallback_result = None

                else:
                    temp_upscaled = (
                        create_upscaled_image(
                            image_path
                        )
                    )

                    upscaled_lines = run_ocr(
                        ocr,
                        temp_upscaled
                    )

                    fallback_result = build_result(
                        upscaled_lines,
                        "upscaled_4x"
                    )

                    # Prefer the pass with more
                    # recognized characters.
                    if (
                        len(
                            fallback_result["text"]
                        )
                        >
                        len(
                            normal_result["text"]
                        )
                    ):
                        final_result = (
                            fallback_result
                        )
                    else:
                        final_result = (
                            normal_result
                        )

        # --------------------------------------------
        # Generic registration-line selection
        # --------------------------------------------

        registration_lines = (
            select_registration_lines(
                final_result["lines"]
            )
        )

        # If the geometry filter found nothing,
        # keep the final OCR output rather than
        # returning an empty result.
        if registration_lines:
            plate_text = "".join(
                line["cleanText"]
                for line in registration_lines
            )
        else:
            plate_text = final_result["text"]

        # --------------------------------------------
        # Final response
        # --------------------------------------------

        response = {
            "success": True,

            "text": plate_text,

            "rawText": final_result["rawText"],

            "pass": final_result["pass"],

            "lines": registration_lines,

            "allLines": final_result["lines"],

            "debug": {
                "normal": normal_result,
                "upscaled": fallback_result
            }
        }

        print(
            json.dumps(
                response,
                ensure_ascii=False
            )
        )

    except Exception as e:
        print(
            json.dumps({
                "success": False,
                "error": str(e)
            })
        )
        sys.exit(1)

    finally:
        if temp_upscaled:
            try:
                os.remove(
                    temp_upscaled
                )
            except OSError:
                pass


if __name__ == "__main__":
    main()