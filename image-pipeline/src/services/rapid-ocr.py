import sys
import json
import os
import tempfile
from pathlib import Path
from contextlib import redirect_stdout

from PIL import Image
from rapidocr import RapidOCR


# ============================================================
# TEXT CLEANING
# ============================================================

def clean_text(text):
    """
    Keep only alphanumeric characters.
    """

    return "".join(
        ch
        for ch in str(text).upper()
        if ch.isalnum()
    )


# ============================================================
# BBOX CONVERSION
# ============================================================

def extract_bbox(box):
    """
    Convert RapidOCR's 4-point polygon:

        [top-left, top-right, bottom-right, bottom-left]

    into:

        [x1, y1, x2, y2]
    """

    try:

        if box is None:
            return None

        points = (
            box.tolist()
            if hasattr(box, "tolist")
            else box
        )

        if len(points) != 4:
            return None

        xs = [
            float(point[0])
            for point in points
        ]

        ys = [
            float(point[1])
            for point in points
        ]

        return [
            int(min(xs)),
            int(min(ys)),
            int(max(xs)),
            int(max(ys))
        ]

    except Exception:

        return None


# ============================================================
# RUN RAPIDOCR
# ============================================================

def run_ocr(ocr, image_path):
    """
    Run RapidOCR and return all detected text regions.
    """

    result = ocr(
        image_path
    )

    lines = []

    if result is None:
        return lines

    boxes = getattr(
        result,
        "boxes",
        None
    )

    texts = getattr(
        result,
        "txts",
        None
    )

    scores = getattr(
        result,
        "scores",
        None
    )

    if texts is None:
        return lines

    if boxes is None:
        boxes = []

    if scores is None:
        scores = []

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

        bbox = (
            extract_bbox(boxes[index])
            if index < len(boxes)
            else None
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

            center_x = (
                x1 + x2
            ) / 2

            center_y = (
                y1 + y2
            ) / 2

            area = (
                width * height
            )

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


    # ========================================================
    # SORT TOP -> BOTTOM, LEFT -> RIGHT
    # ========================================================

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


# ============================================================
# BUILD RESULT
# ============================================================

def build_result(lines, pass_name):

    raw_text = "".join(
        line["cleanText"]
        for line in lines
    )

    return {

        "pass": pass_name,

        "text": clean_text(
            raw_text
        ),

        "rawText": raw_text,

        "lines": lines
    }


# ============================================================
# CREATE 4X UPSCALED IMAGE
# ============================================================

def create_upscaled_image(image_path):

    image = (
        Image.open(image_path)
        .convert("RGB")
    )

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


# ============================================================
# CHECK IF ORIGINAL RESULT IS USEFUL
# ============================================================

def is_result_useful(result):

    lines = result["lines"]

    if not lines:
        return False

    # Consider a line "substantial" if it has reasonable width/height.
    # Lower the thresholds slightly to accommodate narrow license plate crops
    # that contain a single substantial line.
    substantial = [

        line

        for line in lines

        if (
            (line["width"] or 0) >= 30
            and
            (line["height"] or 0) >= 12
        )
    ]

    # Accept a single substantial line as useful (many plates are single-line).
    if len(substantial) < 1:
        return False

    return True


# ============================================================
# 45% OCR REGION RULE
# ============================================================

def select_registration_lines(lines):

    if not lines:
        return []


    # Make sure every line has an area.

    for line in lines:

        if line.get("area") is None:

            line["area"] = (
                (line.get("width") or 0)
                *
                (line.get("height") or 0)
            )


    # Find largest OCR region.

    largest_area = max(
        line["area"]
        for line in lines
    )


    if largest_area <= 0:
        return []


    # --------------------------------------------------------
    # 45% RULE
    #
    # Keep only regions whose area is at least
    # 45% of the largest OCR region.
    #
    # This prevents small regions such as "IND"
    # from being accidentally included.
    # --------------------------------------------------------

    candidates = [

        line

        for line in lines

        if line["area"]
        >= largest_area * 0.45
    ]


    # Top -> bottom
    # Left -> right

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


# ============================================================
# MAIN
# ============================================================

def main():

    if len(sys.argv) < 2:

        print(
            json.dumps({
                "success": False,
                "error": "Image path required"
            })
        )

        sys.exit(1)


    image_path = sys.argv[1]


    if not Path(image_path).exists():

        print(
            json.dumps({
                "success": False,
                "error":
                    f"Image not found: {image_path}"
            })
        )

        sys.exit(1)


    temp_upscaled = None


    try:

        # ====================================================
        # INITIALIZE RAPIDOCR
        # ====================================================

        with open(
            os.devnull,
            "w",
            encoding="utf-8"
        ) as devnull:

            with redirect_stdout(devnull):

                ocr = RapidOCR()


                # ============================================
                # PASS 1: ORIGINAL
                # ============================================

                normal_lines = run_ocr(
                    ocr,
                    image_path
                )


                normal_result = build_result(
                    normal_lines,
                    "original"
                )


                # ============================================
                # PASS 2: 4X UPSCALE FALLBACK
                # ============================================

                if is_result_useful(
                    normal_result
                ):

                    final_result = (
                        normal_result
                    )

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


                    fallback_result = (
                        build_result(
                            upscaled_lines,
                            "upscaled_4x"
                        )
                    )


                    # Choose the result containing
                    # more recognized characters.

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


        # ====================================================
        # APPLY 45% REGISTRATION RULE
        # ====================================================

        registration_lines = (
            select_registration_lines(
                final_result["lines"]
            )
        )


        # If no regions pass the geometry filter,
        # keep the complete OCR result.

        if registration_lines:

            plate_text = "".join(

                line["cleanText"]

                for line in
                registration_lines
            )

        else:

            plate_text = (
                final_result["text"]
            )


        # ====================================================
        # FINAL JSON RESPONSE
        # ====================================================

        response = {

            "success": True,

            "text": plate_text,

            "rawText":
                final_result["rawText"],

            "pass":
                final_result["pass"],

            "lines":
                registration_lines,

            "allLines":
                final_result["lines"],

            "debug": {

                "normal":
                    normal_result,

                "upscaled":
                    fallback_result
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