import sys
import json
import os
import gc
from pathlib import Path

try:
    import torch
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
except ImportError:
    torch = None

try:
    from ultralytics import YOLO
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "YOLOv8 not installed"
    }))
    sys.exit(1)


def get_model():
    configured_model = os.getenv("YOLO_MODEL_PATH", "").strip()

    if configured_model:
        model_path = Path(configured_model)

        if not model_path.exists():
            raise FileNotFoundError(
                f"YOLO model not found: {model_path}"
            )

        return YOLO(str(model_path))

    return YOLO("yolov8n.pt")


def detect_vehicles(image_path):
    try:
        model = get_model()

        results = model.predict(
            source=image_path,
            imgsz=320,
            device="cpu",
            conf=0.3,
            max_det=10,
            verbose=False
        )

        result = results[0]

        vehicle_classes = {2, 3, 5, 7}
        detections = []

        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            if class_id in vehicle_classes and confidence > 0.3:
                bbox = box.xyxy[0].cpu().numpy().tolist()

                x1, y1, x2, y2 = bbox

                area = (x2 - x1) * (y2 - y1)

                detections.append({
                    "class_id": class_id,
                    "class_name": result.names[class_id],
                    "confidence": round(confidence, 4),
                    "bbox": [round(x, 2) for x in bbox],
                    "area": round(area, 2)
                })

        detections.sort(
            key=lambda x: x["area"],
            reverse=True
        )

        response = {
            "success": True,
            "vehicleCount": len(detections),
            "vehicles": detections,
            "primaryVehicle": detections[0] if detections else None
        }

        del results
        del model
        gc.collect()

        if torch is not None:
            try:
                torch.cuda.empty_cache()
            except Exception:
                pass

        print(json.dumps(response))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Image path required"
        }))
        sys.exit(1)

    detect_vehicles(sys.argv[1])