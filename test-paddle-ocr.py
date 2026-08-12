from paddleocr import PaddleOCR
import sys
import json
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print('python test-paddle-ocr.py "path/to/image.png"')
        sys.exit(1)

    image_path = sys.argv[1]

    if not Path(image_path).exists():
        print(f"Image not found: {image_path}")
        sys.exit(1)

    print("Initializing PaddleOCR...")

    # English OCR, CPU
    ocr = PaddleOCR(
        lang="en",
        device="cpu"
    )

    print("Running OCR...")
    print(f"Input: {image_path}")
    print()

    result = ocr.predict(image_path)

    print("========== RAW RESULT ==========")
    print(result)

    print()
    print("========== OCR TEXT ==========")

    found = False

    for res in result:
        data = res.json

        if callable(data):
            data = data()

        # PaddleOCR 3.x result structure
        rec_texts = data.get("res", {}).get("rec_texts", [])
        rec_scores = data.get("res", {}).get("rec_scores", [])

        for text, score in zip(rec_texts, rec_scores):
            found = True
            print(
                f"Text: {text} | "
                f"Confidence: {float(score):.4f}"
            )

    if not found:
        print("No text detected.")


if __name__ == "__main__":
    main()