# Image Processing Pipeline

> **Backend image-processing pipeline for vehicle detection, license-plate recognition, image-quality analysis, OCR, and duplicate detection.**

This project implements an asynchronous image-processing backend using **Node.js, Express, MongoDB, Redis, BullMQ, YOLOv8, Roboflow Workflows, and PaddleOCR**.

The system accepts an image, analyzes its quality, detects vehicles, detects license plates, selects the largest plate, extracts the registration number using OCR, and performs exact and perceptual duplicate detection.

---

## Features

- Image upload using Multer
- Image dimensions and MIME-type analysis
- Blur detection
- Brightness analysis
- MD5 hashing
- Perceptual hashing (pHash)
- Background processing using BullMQ and Redis
- Vehicle detection using YOLOv8
- License-plate detection using Roboflow Workflow
- Largest-license-plate selection
- OCR using PaddleOCR
- 4× OCR upscaling fallback for difficult plates
- Geometry-based OCR text selection
- Exact duplicate detection using MD5
- Similar-image duplicate detection using pHash and Hamming distance
- MongoDB persistence
- API endpoints for upload, status, and results
- Docker Compose support for MongoDB and Redis
- Production-oriented Docker setup for the complete application

---

# Architecture

```text
                         Client / Postman
                                |
                                | POST /api/images
                                v
                         +--------------+
                         |   Express    |
                         |     API      |
                         +------+-------+
                                |
                                v
                            Multer
                                |
                                v
                           MongoDB
                      (processing record)
                                |
                                v
                           BullMQ Queue
                                |
                                v
                             Redis
                                |
                                v
                          Background Worker
                                |
              +-----------------+------------------+
              |                 |                  |
              v                 v                  v
        Image Analysis     YOLOv8 Vehicle    Roboflow Workflow
              |              Detection        Plate Detection
              |                 |                  |
              |                 |                  v
              |                 |            Largest Plate
              |                 |                  |
              |                 |                  v
              |                 |          Original Image Crop
              |                 |                  |
              |                 |                  v
              |                 |             PaddleOCR
              |                 |                  |
              +-----------------+------------------+
                                |
                                v
                       Duplicate Detection
                         /             \
                       MD5             pHash
                                      +
                                 Hamming Distance
                                |
                                v
                             MongoDB
                                |
                                v
                         Results / Status API
```

---

# Processing Flow

The complete processing flow is:

```text
1. Client uploads image
2. Express receives multipart/form-data request
3. Multer validates and stores the image
4. MongoDB processing document is created
5. BullMQ job is created
6. Worker starts processing
7. Image quality analysis is performed
8. MD5 and pHash are generated
9. YOLOv8 detects vehicles
10. Primary vehicle is selected
11. Roboflow detects license plates
12. Largest plate is selected
13. Selected plate bbox is cropped from the original image
14. PaddleOCR processes the plate crop
15. Difficult OCR cases use a 4× upscaled fallback
16. OCR text regions are filtered using bounding-box geometry
17. Final license plate number is generated
18. Exact MD5 duplicate detection is performed
19. pHash similarity is checked when necessary
20. Final result is stored in MongoDB
21. Processing status becomes completed
```

---

# Tech Stack

## Backend

- Node.js
- Express
- MongoDB
- Mongoose
- Redis
- BullMQ
- Multer
- Sharp
- Axios
- Morgan
- UUID

## Computer Vision / OCR

- YOLOv8
- Ultralytics
- OpenCV
- NumPy
- Roboflow Workflows
- PaddleOCR
- PaddlePaddle
- Pillow

---

# Project Structure

```text
image-pipeline/
│
├── src/
│   │
│   ├── controllers/
│   │   └── imagesController.js
│   │
│   ├── middlewares/
│   │   └── upload.js
│   │
│   ├── models/
│   │   └── Image.js
│   │
│   ├── queue/
│   │   ├── queue.js
│   │   └── worker.js
│   │
│   ├── routes/
│   │   └── images.js
│   │
│   ├── services/
│   │   ├── cropUtils.js
│   │   ├── paddle-ocr.py
│   │   ├── paddleOCR.js
│   │   ├── plateDetection.js
│   │   ├── vehicleDetection.js
│   │   └── yolo-detect.py
│   │
│   ├── utils/
│   │   └── imageUtils.js
│   │
│   └── server.js
│
├── uploads/
│   ├── .gitkeep
│   └── crops/
│       └── .gitkeep
│
├── .dockerignore
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── package-lock.json
├── requirements.txt
├── requirements.lock.txt
├── test-full-pipeline.js
├── test-paddle-ocr.js
└── README.md
```

---

# Requirements

## Node.js

Install Node.js and npm.

Check installation:

```bash
node --version
npm --version
```

## Python

Python 3.11 is recommended for the OCR/ML environment.

Check:

```bash
python --version
```

or:

```bash
py -3.11 --version
```

## MongoDB

MongoDB is required for storing image-processing records and results.

## Redis

Redis is required by BullMQ for background job processing.

## Roboflow

A Roboflow API key and the configured license-plate workflow are required.

---

# Environment Variables

Create a `.env` file in the project root.

Example:

```env
PORT=4000

MONGO_URL=mongodb://localhost:27017/image_pipeline

REDIS_URL=redis://localhost:6379

UPLOAD_DIR=uploads

ROBOFLOW_API_KEY=your_roboflow_api_key

YOLO_PYTHON=python

PADDLE_PYTHON=python

YOLO_MODEL_PATH=
```

For a local Windows environment, Python paths can point to the actual Python executable:

```env
YOLO_PYTHON=C:\Projects\goGig\paddle-env\Scripts\python.exe

PADDLE_PYTHON=C:\Projects\goGig\paddle-env\Scripts\python.exe

YOLO_MODEL_PATH=C:\Projects\goGig\image-pipeline\src\services\yolov8n.pt
```

### Important

Do not commit `.env`.

Do not expose your real Roboflow API key in the repository.

Use `.env.example` as the configuration template.

---

# Installation

## 1. Clone the repository

```bash
git clone <repository-url>
cd image-pipeline
```

## 2. Install Node dependencies

```bash
npm install
```

## 3. Set up Python

Create or activate the Python 3.11 environment used by the ML services.

Example:

```powershell
C:\Projects\goGig\paddle-env\Scripts\Activate.ps1
```

Install the Python dependencies:

```powershell
python -m pip install -r requirements.txt
```

For the tested environment:

```powershell
python -m pip install -r requirements.lock.txt
```

---

# Running Locally

For normal development, MongoDB and Redis can run through Docker while Node.js and the Python ML services run locally.

Start MongoDB and Redis:

```bash
docker compose up -d
```

Check the containers:

```bash
docker compose ps
```

Then start the Node application:

```bash
npm run dev
```

The API runs on:

```text
http://localhost:4000
```

---

# API Endpoints

## Upload Image

```http
POST /api/images
```

### Request type

```text
multipart/form-data
```

### Form-data field

```text
image
```

Example in Postman:

```text
Body
└── form-data
    └── image → File → your-image.png
```

The upload field must be named `image`.

---

## Get Processing Status

```http
GET /api/images/:processingId/status
```

Example:

```http
GET /api/images/ab7c48fe-70ff-4950-8786-02ec4da407e7/status
```

---

## Get Processing Result

```http
GET /api/images/:processingId/results
```

Example:

```http
GET /api/images/ab7c48fe-70ff-4950-8786-02ec4da407e7/results
```

---

# Image Upload Rules

Only image files are accepted.

Multer rejects non-image files.

Maximum file size:

```text
10 MB
```

Uploaded images are stored in:

```text
uploads/
```

Generated OCR crops are stored in:

```text
uploads/crops/
```

Generated files are excluded from Git.

---

# Image Analysis

Each uploaded image is analyzed for:

### Dimensions

```text
width
height
```

### MIME type

Example:

```text
image/png
```

### Blur

A blur score is calculated and compared against a configured threshold.

Example:

```json
"blur": {
  "score": 651.02,
  "threshold": 100,
  "flagged": false
}
```

### Brightness

The average image brightness is calculated.

Example:

```json
"brightness": {
  "mean": 107.95,
  "flagged": false
}
```

---

# Vehicle Detection

YOLOv8 is used for vehicle detection.

The implementation uses the following COCO classes:

```text
2 → car
3 → motorcycle
5 → bus
7 → truck
```

Only detections with confidence greater than:

```text
0.3
```

are included.

Detected vehicles are sorted by bounding-box area.

The largest detected vehicle is selected as the primary vehicle.

Example:

```json
"vehicle": {
  "vehicleCount": 1,
  "primaryVehicle": {
    "class_id": 7,
    "class_name": "truck",
    "confidence": 0.8838,
    "bbox": [
      12.08,
      108.41,
      720,
      1167.19
    ],
    "area": 749527.34
  }
}
```

---

# License Plate Detection

License plate detection is handled by a Roboflow Workflow.

The workflow returns detected plate bounding boxes and confidence values.

When multiple plates are detected, the implementation selects the largest plate by bounding-box area.

Example:

```text
Detected plates
      |
      +--> Plate 0
      +--> Plate 1
      +--> Plate 2
                |
                v
         Calculate area
                |
                v
         Select largest
```

The plate detection is performed on the **original image**.

---

# OCR Crop Strategy

Once a plate is selected, its bounding box is used to crop the plate directly from the original image.

Example:

```text
Original image
      |
      v
Selected plate bbox
      |
      v
Crop selected region
      |
      v
OCR crop
```

This preserves more image information compared with repeatedly cropping from lower-resolution intermediate images.

---

# PaddleOCR

PaddleOCR is used for license-plate text recognition.

The OCR pipeline consists of several stages.

## Stage 1: Normal OCR

The original plate crop is passed to PaddleOCR.

```text
Plate crop
   |
   v
PaddleOCR
```

## Stage 2: 4× Upscaling Fallback

If the first OCR pass does not produce enough substantial text regions, a 4× upscaled version of the crop is generated.

For example:

```text
208 × 149
```

becomes:

```text
832 × 596
```

The enlarged image is then processed again by PaddleOCR.

```text
Original crop
     |
     v
OCR
     |
     | insufficient result
     v
4× upscale
     |
     v
OCR again
```

## Stage 3: Bounding-Box Based Selection

PaddleOCR returns text regions together with:

- text
- confidence
- bounding box
- width
- height
- area
- center coordinates

The implementation uses the bounding-box area to identify dominant text regions.

For example:

```text
Small auxiliary region
        ↓
ignored

Large registration row
        ↓
kept

Large registration row
        ↓
kept
```

The algorithm does not depend on hardcoded strings such as state codes or country markers.

Example:

```text
MH12K
R1145
```

becomes:

```text
MH12KR1145
```

---

# OCR Result Example

Example OCR output:

```json
{
  "plateNumber": "MH12KR1145",
  "rawText": "INDMH12KR1145",
  "lines": [
    {
      "text": "MH12K",
      "confidence": 0.9999
    },
    {
      "text": "R1145",
      "confidence": 0.9999
    }
  ]
}
```

`rawText` contains all recognized text regions.

`plateNumber` contains the selected registration text.

---

# Duplicate Detection

Duplicate detection uses two mechanisms.

## MD5

An MD5 hash is generated for every image.

If another completed image has the same MD5:

```text
MD5 match
```

the image is considered an exact duplicate.

Example:

```json
"duplicate": {
  "type": "md5",
  "matchProcessingId": "f6ae3699-2fea-4c1a-afec-b7b25ac4f660",
  "distance": 0
}
```

---

## pHash

If there is no exact MD5 match, pHash similarity is evaluated.

The Hamming distance between perceptual hashes is calculated.

Current threshold:

```text
distance <= 5
```

Images within the threshold are considered visually similar.

Example:

```json
"duplicate": {
  "type": "phash",
  "matchProcessingId": "...",
  "distance": 3
}
```

---

# Background Processing

The image-processing pipeline runs asynchronously.

BullMQ places processing jobs into Redis.

```text
Client
   |
   v
Express
   |
   v
MongoDB record
   |
   v
BullMQ
   |
   v
Redis
   |
   v
Worker
```

This prevents long-running YOLO and OCR operations from blocking the upload request.

The client receives a processing ID and can use the status/results endpoints to retrieve progress and results.

---

# Example MongoDB Result

A completed document can contain:

```json
{
  "_id": "6a7d3ce7c0a16bbd45fecb2b",
  "processingId": "ab7c48fe-70ff-4950-8786-02ec4da407e7",
  "status": "completed",
  "analysis": {
    "md5": "f58ab72cf6b9dc64fc93a46db74d7e75",
    "pHash": "fcfefefc9c808000",
    "width": 720,
    "height": 1280,
    "mime": "png",
    "vehicle": {
      "vehicleCount": 1,
      "primaryVehicle": {
        "class_name": "truck",
        "confidence": 0.8838
      }
    },
    "plate": {
      "plateCount": 1,
      "primaryPlate": {
        "confidence": 0.8906,
        "area": 13662
      },
      "ocr": {
        "plateNumber": "MH12KR1145"
      }
    },
    "duplicate": {
      "type": "md5",
      "distance": 0
    }
  }
}
```

---

# Testing

The pipeline was tested through both individual components and the actual API flow.

## Full Pipeline Test

```bash
node test-full-pipeline.js "path/to/image.png"
```

## PaddleOCR Test

```bash
node test-paddle-ocr.js "path/to/plate-crop.png"
```

## API Testing

The real workflow was tested through Postman:

```text
POST /api/images
        |
        v
BullMQ worker
        |
        v
Vehicle detection
        |
        v
Plate detection
        |
        v
PaddleOCR
        |
        v
MongoDB
```

Test coverage included:

- Image uploads
- Multiple image inputs
- Vehicle detection
- License-plate detection
- Multiple plate candidates
- Largest-plate selection
- OCR of single-line plates
- OCR of two-line plates
- OCR fallback using 4× upscaling
- MD5 duplicate detection
- pHash duplicate detection
- Invalid file handling
- File-size validation
- Invalid processing IDs
- Worker failure handling

---

# Local Development Architecture

For normal development, MongoDB and Redis can run inside Docker while Node.js and the Python ML services run locally.

```text
                 Windows
                    |
             npm run dev
                    |
              Node / Express
                    |
        +-----------+-----------+
        |                       |
        v                       v
     MongoDB                  Redis
       Docker                  Docker
        |                       |
        +-----------+-----------+
                    |
                  Worker
                    |
             +------+------+
             |             |
            YOLO        PaddleOCR
             |             |
             +-------------+
```

This development setup avoids rebuilding the large Python ML Docker environment after every source-code change.

---

# Docker

Docker Compose provides infrastructure services:

- MongoDB
- Redis

Start them:

```bash
docker compose up -d
```

Check:

```bash
docker compose ps
```

Stop:

```bash
docker compose down
```

The project also contains a Dockerfile for building the complete application environment.

Because YOLO and PaddleOCR depend on a large Python ML stack, the full image build can be significantly larger and slower than a standard Node.js application.

For day-to-day development, running MongoDB and Redis through Docker while running Node/Python locally is recommended.

---

# Docker Environment

When running the application completely inside Docker, service names should be used instead of localhost.

Example:

```env
MONGO_URL=mongodb://mongo:27017/image_pipeline
REDIS_URL=redis://redis:6379
UPLOAD_DIR=/app/uploads
YOLO_PYTHON=python
PADDLE_PYTHON=python
```

`localhost` inside a container refers to that container itself, not another Docker service.

---

# Security

The following files and directories are excluded from Git:

```text
.env
node_modules/
paddle-env/
uploads/
*.pt
*.onnx
google-credentials.json
```

Secrets such as:

```text
ROBOFLOW_API_KEY
```

must never be committed.

Use `.env.example` to document required configuration.

---

# Git Ignore Rules

Generated runtime files are excluded from version control.

The repository keeps empty upload directories using:

```text
uploads/.gitkeep
uploads/crops/.gitkeep
```

Model files are excluded using:

```text
*.pt
*.onnx
```

---

# Development Commands

Install Node dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Start production server locally:

```bash
npm start
```

Start MongoDB and Redis:

```bash
docker compose up -d
```

Stop MongoDB and Redis:

```bash
docker compose down
```

Check Docker services:

```bash
docker compose ps
```

---

# API Example

## Upload

```http
POST http://localhost:4000/api/images
```

Form-data:

```text
image = <file>
```

The server returns a processing identifier.

## Status

```http
GET http://localhost:4000/api/images/{processingId}/status
```

## Results

```http
GET http://localhost:4000/api/images/{processingId}/results
```

---

# Design Decisions

## Why BullMQ?

Vehicle detection and OCR are computationally expensive operations.

Using BullMQ allows these operations to run asynchronously in a background worker instead of blocking the upload request.

## Why Roboflow?

License-plate detection is handled by the configured Roboflow Workflow, removing the need to maintain a separate local license-plate detection model.

## Why YOLOv8?

YOLOv8 is used for fast vehicle detection and primary-vehicle selection.

## Why PaddleOCR?

PaddleOCR provides stronger OCR performance for the license-plate crops used by this pipeline than the original Tesseract implementation.

## Why crop from the original image?

The selected plate bounding box is applied directly to the original image so that OCR receives the highest-quality available crop.

## Why largest plate?

When multiple plate candidates are detected, the current heuristic selects the plate with the largest bounding-box area.

## Why MD5 and pHash?

MD5 detects exact duplicates efficiently.

pHash catches visually similar images even when the underlying file bytes are different.

---

# End-to-End Example

```text
                  IMAGE
                    |
                    v
               Image Upload
                    |
                    v
                 Multer
                    |
                    v
                MongoDB
                    |
                    v
              BullMQ / Redis
                    |
                    v
                 Worker
                    |
          +---------+---------+
          |                   |
          v                   v
    Image Analysis       YOLOv8
          |                   |
          |                   v
          |             Primary Vehicle
          |                   |
          |                   v
          |              Roboflow
          |                   |
          |                   v
          |              Plate Bboxes
          |                   |
          |                   v
          |            Largest Plate
          |                   |
          |                   v
          |           Original Image Crop
          |                   |
          |                   v
          |               PaddleOCR
          |                   |
          |                   v
          |            Registration Number
          |                   |
          +---------+---------+
                    |
                    v
            Duplicate Detection
                    |
             +------+------+
             |             |
            MD5           pHash
             |             |
             +------+------+
                    |
                    v
                 MongoDB
                    |
                    v
               API Results
```

---

# Current Status

The backend pipeline has been validated end-to-end.

Validated components include:

- Image upload
- Image analysis
- Vehicle detection
- License-plate detection
- Largest-plate selection
- OCR cropping
- PaddleOCR
- OCR fallback for difficult plates
- Geometry-based OCR filtering
- MD5 duplicate detection
- pHash duplicate detection
- BullMQ background processing
- MongoDB persistence
- Redis queueing
- Postman API flow

---

# Notes

- The current vehicle-selection strategy chooses the largest detected vehicle by bounding-box area.
- The current license-plate-selection strategy chooses the largest detected plate by bounding-box area.
- OCR uses a normal pass followed by a 4× upscaled fallback when the normal result is structurally insufficient.
- OCR text selection is based on bounding-box geometry instead of hardcoded country/state strings.
- Generated uploads and ML model files are intentionally excluded from version control.