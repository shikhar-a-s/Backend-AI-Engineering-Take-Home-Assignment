import sys
import json
import os
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "OpenCV not installed"
    }))
    sys.exit(1)

try:
    from ultralytics import YOLO
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "YOLOv8 not installed. Install with: pip install ultralytics"
    }))
    sys.exit(1)


def get_model():
    """
    Load the YOLO model.

    Behavior:
    1. If YOLO_MODEL_PATH points to an existing .pt file,
       use that file.
    2. Otherwise use 'yolov8n.pt'.
       Ultralytics will download it automatically if needed.
    """

    configured_model = os.getenv(
        "YOLO_MODEL_PATH",
        ""
    ).strip()

    # ----------------------------------------------
    # Explicit model path
    # ----------------------------------------------

    if configured_model:
        model_path = Path(
            configured_model
        )

        if model_path.exists():
            return YOLO(
                str(model_path)
            )

    # ----------------------------------------------
    # Default YOLOv8 nano model
    #
    # Ultralytics automatically downloads the model
    # if it does not already exist.
    # ----------------------------------------------

    return YOLO(
        "yolov8n.pt"
    )


def detect_vehicles(image_path):
    """
    Detect vehicles in an image using YOLOv8.
    """

    try:

        # ----------------------------------------------
        # Load model
        # ----------------------------------------------

        model = get_model()

        # ----------------------------------------------
        # Run inference
        # ----------------------------------------------

        results = model(
            image_path,
            verbose=False
        )

        result = results[0]

        # ----------------------------------------------
        # Vehicle classes from COCO
        #
        # 2 = car
        # 3 = motorcycle
        # 5 = bus
        # 7 = truck
        # ----------------------------------------------

        vehicle_classes = {
            2,
            3,
            5,
            7
        }

        detections = []

        for box in result.boxes:

            class_id = int(
                box.cls[0]
            )

            confidence = float(
                box.conf[0]
            )

            # ------------------------------------------
            # Filter vehicle classes
            # ------------------------------------------

            if (
                class_id in vehicle_classes
                and confidence > 0.3
            ):

                bbox = (
                    box.xyxy[0]
                    .cpu()
                    .numpy()
                    .tolist()
                )

                x1, y1, x2, y2 = bbox

                area = (
                    (x2 - x1)
                    *
                    (y2 - y1)
                )

                detections.append({
                    "class_id":
                        class_id,

                    "class_name":
                        result.names[
                            class_id
                        ],

                    "confidence":
                        round(
                            confidence,
                            4
                        ),

                    "bbox": [
                        round(
                            value,
                            2
                        )
                        for value in bbox
                    ],

                    "area":
                        round(
                            area,
                            2
                        )
                })

        # ----------------------------------------------
        # Largest vehicle first
        # ----------------------------------------------

        detections.sort(
            key=lambda item:
                item["area"],
            reverse=True
        )

        # ----------------------------------------------
        # Build response
        # ----------------------------------------------

        response = {
            "success": True,

            "vehicleCount":
                len(detections),

            "vehicles":
                detections,

            "primaryVehicle":
                detections[0]
                if detections
                else None
        }

        # IMPORTANT:
        # stdout contains only JSON.
        print(
            json.dumps(response)
        )

    except Exception as e:

        print(
            json.dumps({
                "success": False,
                "error": str(e)
            })
        )

        sys.exit(1)


if __name__ == "__main__":

    if len(sys.argv) < 2:

        print(
            json.dumps({
                "success": False,
                "error":
                    "Image path required"
            })
        )

        sys.exit(1)

    image_path = sys.argv[1]

    if not Path(
        image_path
    ).exists():

        print(
            json.dumps({
                "success": False,
                "error":
                    f"Image not found: {image_path}"
            })
        )

        sys.exit(1)

    detect_vehicles(
        image_path
    )