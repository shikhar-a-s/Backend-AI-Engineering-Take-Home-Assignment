# Stage 4: License Plate Detection

## Overview

Before OCR, we need to detect and crop just the license plate region from the vehicle crop. This gives PaddleOCR a clean, focused image.

## Model Setup

The plate detection uses a **YOLOv8 model trained specifically on license plates** (not the standard COCO model).

### Step 1: Download the model

Go to: **https://universe.roboflow.com/**

Search for: **"license plate detection"**

Choose a model that:
- ✓ Supports YOLOv8 format
- ✓ Is trained on your region's plates (e.g., India for Tamil Nadu plates)
- ✓ Has good accuracy scores

Popular options:
- "License Plate Detection" by various creators
- Look for high-quality models with 90%+ mAP

### Step 2: Download YOLOv8 version

When you find a model:
1. Click "Download"
2. Select **"YOLOv8"** format
3. Download the ZIP file

### Step 3: Extract best.pt

From the downloaded ZIP:
```
roboflow-project/
└── weights/
    └── best.pt
```

Copy `best.pt` to:
```
image-pipeline/src/services/best.pt
```

Verify:
```bash
ls -la image-pipeline/src/services/best.pt
```

## Testing Plate Detection

### Prerequisites

1. Vehicle crop already created:
   ```
   uploads/crops/primary-vehicle.png
   ```
   (From `node test-crop.js`)

2. Model downloaded and placed at:
   ```
   src/services/best.pt
   ```

### Run the test

```bash
cd image-pipeline

# Using the vehicle crop from previous step
node test-plate-detection.js "uploads/crops/primary-vehicle.png"
```

### Expected output

```
License Plate Detection Test

Input: uploads/crops/primary-vehicle.png

Step 1: Detecting license plates...
✓ Plate detection complete
  - Plates detected: 1
  - Primary plate confidence: 0.95
  - Plate bbox: [150.5, 720.3, 420.8, 800.2]
  - Plate size: 270x80px

Step 2: Cropping license plate...
✓ Plate crop complete
  - Output: uploads/crops/license-plate.png
  - Dimensions: 270x80

Summary:
  ✓ License plate detected and cropped
  ✓ Plate crop saved to: uploads/crops/license-plate.png
```

## Evaluation

### Open the plate crop

```
image-pipeline/uploads/crops/license-plate.png
```

**Checklist:**
- [ ] Crop contains ONLY the license plate
- [ ] Plate text is clearly visible
- [ ] No background clutter
- [ ] Plate is not rotated/distorted
- [ ] Numbers/letters are readable

### Quality assessment

**Good plate crop:**
```
┌────────────────────┐
│   TN 05 BT 7549   │
└────────────────────┘
```

**Bad plate crop:**
- Includes vehicle body
- Plate is rotated/upside-down
- Too dark/bright
- Very small or pixelated

## If plate detection fails

**Problem:** "No license plates detected"

**Possible causes:**
1. Model not found at `src/services/best.pt`
2. Model is for wrong region (e.g., US plates vs India plates)
3. Plate is at extreme angle in vehicle crop
4. Confidence threshold too high
5. Image quality is poor

**Solutions:**
1. Verify model path: `ls src/services/best.pt`
2. Try different model from Roboflow (search region-specific)
3. Lower confidence threshold in `yolo-plate-detect.py` (change `0.4` to `0.3`)
4. Verify vehicle crop contains visible plate: `uploads/crops/primary-vehicle.png`

## Files

- `src/services/yolo-plate-detect.py` — Plate detection script
- `src/services/plateDetection.js` — Node.js wrapper
- `test-plate-detection.js` — Test harness

## Next: OCR Stage

Once plate crop quality is confirmed:

```
license-plate.png
        ↓
PaddleOCR
        ↓
"TN05BT7549"
        ↓
Plate validation
```
