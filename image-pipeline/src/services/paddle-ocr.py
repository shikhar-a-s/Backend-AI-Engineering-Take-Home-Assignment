import sys
import json
from pathlib import Path

from paddleocr import PaddleOCR


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

    try:
        # CPU for now.
        # This is also easier to deploy.
        ocr = PaddleOCR(
            lang="en",
            device="cpu"
        )

        results = ocr.predict(image_path)

        lines = []

        for result in results:
            data = result.json

            if callable(data):
                data = data()

            res = data.get("res", {})

            texts = res.get("rec_texts", [])
            scores = res.get("rec_scores", [])

            for text, score in zip(texts, scores):
                text = str(text).strip()

                if not text:
                    continue

                lines.append({
                    "text": text,
                    "confidence": round(
                        float(score), 4
                    )
                })

        # Combine OCR lines
        raw_text = "".join(
            line["text"]
            for line in lines
        )

        # Remove spaces, dots, hyphens, etc.
        cleaned_text = "".join(
            ch for ch in raw_text.upper()
            if ch.isalnum()
        )

        response = {
            "success": True,
            "text": cleaned_text,
            "rawText": raw_text,
            "lines": lines
        }

        print(json.dumps(response))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()