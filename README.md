# gigVision

AI-assisted vehicle image and license plate analysis pipeline.

gigVision accepts a vehicle image, processes it asynchronously using computer vision and OCR, and displays the analysis through a React dashboard.

## Live Demo

**Frontend:**  
https://gigvision-frontend.vercel.app/

**Backend:**  
https://backend-ai-engineering-take-home-a4k7.onrender.com

---

## Features

- Vehicle and license plate detection
- License plate cropping
- RapidOCR-based registration extraction
- Indian plate validation
- Detection and OCR confidence scores
- Brightness and sharpness analysis
- Duplicate image detection
- Asynchronous processing with Redis/BullMQ
- MongoDB result persistence
- Responsive React dashboard
- REST API
- Docker support

---

## Architecture

```text
React + Vite
     │
     ▼
Express API
     │
     ├── MongoDB
     │
     ▼
Redis / BullMQ
     │
     ▼
Background Worker
     │
     ├── Vehicle Detection
     ├── Plate Detection
     ├── Plate Crop
     ├── RapidOCR
     ├── Validation
     └── Image Analysis
     │
     ▼
MongoDB
     │
     ▼
React Dashboard

The upload API creates a processing job and returns a processingId.
The worker performs the expensive processing asynchronously, while the frontend checks the processing status and displays the final result.

Processing Flow
Upload
  ↓
Create Job
  ↓
BullMQ Queue
  ↓
Vehicle Detection
  ↓
Plate Detection
  ↓
Plate Crop
  ↓
OCR
  ↓
Validation + Image Analysis
  ↓
MongoDB
  ↓
Results
Tech Stack

Frontend

React
Vite
JavaScript
CSS

Backend

Node.js
Express
MongoDB / Mongoose
Redis
BullMQ

AI / Image Processing

Vehicle detection
License plate detection
RapidOCR
Image processing and validation

Deployment

Vercel
Render
Docker
API
Health Check
GET /health
Upload Image
POST /api/images

Example:

curl -X POST \
  -F "image=@vehicle.jpg" \
  https://backend-ai-engineering-take-home-a4k7.onrender.com/api/images
Processing Status
GET /api/images/:processingId/status
Results
GET /api/images/:processingId/results
Running Locally
Backend
cd image-pipeline
npm install
pip install -r requirements.txt

Configure .env:

PORT=4000
MONGO_URL=<mongodb-url>
REDIS_URL=<redis-url>

Then:

npm run dev

Backend:

http://localhost:4000
Frontend
cd frontend
npm install

Create .env:

VITE_API_BASE_URL=http://localhost:4000

Then:

npm run dev
AI Usage Disclosure

AI tools were used during development for code exploration, debugging, implementation suggestions, deployment troubleshooting, and documentation.

AI-generated code was validated through local execution, Git diffs, API testing, browser testing, CORS preflight checks, pipeline tests, and end-to-end production testing.

AI suggestions were not treated as authoritative. Several issues, including CORS, static image serving, port conflicts, and deployment configuration, required verification and correction against the actual application.

Design Decisions & Trade-offs
Asynchronous Processing

Image detection and OCR can be expensive, so processing is moved to a BullMQ background worker instead of blocking the upload request.

MongoDB

MongoDB provides a flexible document structure for storing detection, OCR, image-quality, and processing results.

Local Image Storage

  
Uploaded originals and OCR crops are stored in ImageKit (durable object storage). The backend persists ImageKit URLs in MongoDB so assets remain available even if the server restarts. Ensure the IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT environment variables are configured for local and deployed environments.

Authentication

Authentication and multi-user authorization are outside the take-home scope. A production version should associate scans with authenticated users and restrict access to their images/results.

CORS

CORS is currently permissive to support the separately deployed frontend and backend. Production CORS should be restricted to known frontend origins.

Limitations
OCR and detection accuracy depend on image quality.
Blurry, small, or partially hidden plates may produce unreliable results.
Local filesystem storage is not suitable for horizontal scaling.
Full authentication and authorization are not implemented.
Advanced queue retry/dead-letter handling can be added.
Future Improvements
Object storage for uploaded images
Authentication and authorization
Queue retries and dead-letter queues
Rate limiting
Structured logging and monitoring
Automated integration tests
Worker scaling
Stricter production CORS
Project Structure
goGig/
├── frontend/
│   └── src/
│
├── image-pipeline/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── queue/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── render.yaml
│
└── README.md
Result

A typical successful analysis returns information such as:

Registration: MH12KR1145
Detection Confidence: 89.06%
OCR Confidence: ~99.84%
Brightness Mean: 108.0
Sharpness Score: 651
Resolution: 720 × 1280
Format: PNG

Values vary depending on the input image.
