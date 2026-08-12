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

def detect_plates(image_path, model_path='best.pt'):
    """
    Detect license plates in image using a plate-trained YOLO model
    
    Model should be trained on license plate detection dataset (e.g., from Roboflow)
    Download from: https://universe.roboflow.com/
    
    Search for: "license plate detection"
    """
    try:
        # Check if model file exists
        if not Path(model_path).exists():
            return {
                "success": False,
                "error": f"Model not found: {model_path}. Download a license-plate-trained YOLOv8 model from Roboflow.",
                "instructions": "1. Go to https://universe.roboflow.com/ and search 'license plate detection'\n2. Download YOLOv8 format\n3. Extract best.pt to src/services/\n4. Re-run this script"
            }
        
        # Load plate detection model (trained on license plates, not COCO)
        model = YOLO(model_path)
        
        # Run inference on the image
        results = model(image_path, verbose=False)
        result = results[0]
        
        # Extract detections
        detections = []
        
        for box in result.boxes:
            confidence = float(box.conf[0])
            
            # Filter by confidence (plates need high confidence)
            if confidence > 0.4:
                bbox = box.xyxy[0].cpu().numpy().tolist()
                area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                
                detections.append({
                    "confidence": round(confidence, 4),
                    "bbox": [round(x, 2) for x in bbox],  # [x1, y1, x2, y2]
                    "area": round(area, 2),
                    "width": round(bbox[2] - bbox[0], 2),
                    "height": round(bbox[3] - bbox[1], 2)
                })
        
        # Sort by confidence (highest first)
        detections.sort(key=lambda x: x["confidence"], reverse=True)
        
        # Prepare response
        response = {
            "success": True,
            "plateCount": len(detections),
            "plates": detections,
            "primaryPlate": detections[0] if detections else None
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
    model_path = sys.argv[2] if len(sys.argv) > 2 else 'best.pt'
    detect_plates(image_path, model_path)
