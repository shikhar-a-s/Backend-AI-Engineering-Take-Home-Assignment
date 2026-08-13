# Stage 2-3: Vehicle Cropping & Inspection

## Overview

Before integrating OCR, we need to visually inspect that YOLO's bounding box produces a clean crop suitable for text recognition.

## Testing the Crop

### Step 1: Run the crop test
```bash
cd image-pipeline

# Crop your test image
node test-crop.js "C:\Users\shikh\Downloads\image (1).png"
```

Or without arguments (uses default test-vehicle-image.jpg):
```bash
node test-crop.js
```

### Expected Output
```
Vehicle Crop Test

Input image: C:\Users\shikh\Downloads\image (1).png

Step 1: Detecting vehicles...
✓ Detection complete
  - Vehicles found: 1
  - Primary: truck
  - Confidence: 0.5848
  - Bbox: [37.73, 119.41, 900.72, 986.57]

Step 2: Cropping primary vehicle...
✓ Crop complete
  - Output: uploads/crops/primary-vehicle.png
  - Dimensions: 863x867
  - Aspect ratio: 0.99

Summary:
  ✓ Primary vehicle crop saved to:
    uploads/crops/primary-vehicle.png
```

### Step 2: Inspect the crop

Open the saved crop image:
```
image-pipeline/uploads/crops/primary-vehicle.png
```

**Checklist:**
- [ ] Does the crop contain the full vehicle?
- [ ] Is the vehicle clearly visible (not rotated/distorted)?
- [ ] Is there visible text/plate area?
- [ ] Is there excessive background clutter?
- [ ] Would OCR be able to read text in this region?

### Step 3: Evaluate Quality

**Good crop:**
- Vehicle fills most of the image
- Minimal background noise
- Plate region is visible and legible
- Aspect ratio is reasonable (0.5 - 2.0)

**Bad crop:**
- Vehicle is partially cut off
- Heavy background/shadows
- Plate is obscured or at extreme angle
- Extreme aspect ratio (very wide/tall)

### Step 4: If crop looks good

Proceed to **Stage 4: PaddleOCR Integration**

The crop will be fed to PaddleOCR for license plate text extraction.

## Files

- `src/services/cropUtils.js` — Cropping utility (sharp-based)
- `test-crop.js` — Test script for visual inspection

## Next: OCR Stage

Once crop quality is confirmed, we'll add:
- PaddleOCR on the cropped region
- Plate text extraction
