import sys
import json
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    print(json.dumps({"error": "OpenCV not installed"}))
    sys.exit(1)

try:
    from ultralytics import YOLO
except ImportError:
    print(json.dumps({"error": "YOLOv8 not installed. Install with: pip install ultralytics"}))
    sys.exit(1)

def detect_vehicles(image_path):
    """Detect vehicles in image using YOLOv8"""
    try:
        # Load YOLOv8 model (nano version for speed)
        model = YOLO('yolov8n.pt')
        
        # Run inference
        results = model(image_path, verbose=False)
        result = results[0]
        
        # Extract detections
        detections = []
        vehicle_classes = {2, 3, 5, 7}  # car, motorcycle, bus, truck in COCO
        
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            
            # Only include vehicle classes
            if class_id in vehicle_classes and confidence > 0.3:
                bbox = box.xyxy[0].cpu().numpy().tolist()
                area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                
                detections.append({
                    "class_id": class_id,
                    "class_name": result.names[class_id],
                    "confidence": round(confidence, 4),
                    "bbox": [round(x, 2) for x in bbox],  # [x1, y1, x2, y2]
                    "area": round(area, 2)
                })
        
        # Sort by area (largest first)
        detections.sort(key=lambda x: x["area"], reverse=True)
        
        # Prepare response
        response = {
            "success": True,
            "vehicleCount": len(detections),
            "vehicles": detections,
            "primaryVehicle": detections[0] if detections else None
        }
        
        print(json.dumps(response))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Image path required"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    detect_vehicles(image_path)
