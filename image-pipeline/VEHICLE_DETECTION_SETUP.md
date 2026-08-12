# Vehicle Detection Setup

The vehicle detection pipeline uses **YOLOv8** for real-time object detection.

## Prerequisites

### 1. Python 3.8+
Verify installation:
```bash
python --version
```

### 2. Install Python dependencies
```bash
pip install ultralytics opencv-python numpy
```

Verify:
```bash
python -c "from ultralytics import YOLO; print('✓ YOLOv8 ready')"
python -c "import cv2; print('✓ OpenCV ready')"
```

## Testing Vehicle Detection

### Step 1: Prepare test image
Place a multi-vehicle image (e.g., street scene with cars) at:
```
image-pipeline/test-vehicle-image.jpg
```

### Step 2: Run test
```bash
cd image-pipeline
node test-vehicle-detection.js
```

Expected output:
```json
{
  "vehicleCount": 2,
  "primaryVehicle": {
    "class_name": "car",
    "confidence": 0.94,
    "bbox": [100, 150, 600, 800],
    "area": 345000
  },
  "vehicles": [...]
}
```

## YOLO Classes (COCO dataset)
- `2` = car
- `3` = motorcycle  
- `5` = bus
- `7` = truck

Detection filters for `confidence > 0.3` and these classes only.

## Model Selection

Current: `yolov8n.pt` (nano - fastest, ~6MB)

Alternatives:
- `yolov8s.pt` (small - balanced)
- `yolov8m.pt` (medium - slower, more accurate)
- `yolov8l.pt` (large - slowest, most accurate)

To use a different model, edit `src/services/yolo-detect.py`:
```python
model = YOLO('yolov8s.pt')  # Change here
```

## Integration

Once test passes, vehicle detection will be added to the worker pipeline:

```
Image Analysis
  ↓
YOLO Detection (Stage 2)
  ↓
Select Primary Vehicle (Stage 3)
  ↓
Crop & OCR (Stages 4-5)
  ↓
Save results
```
