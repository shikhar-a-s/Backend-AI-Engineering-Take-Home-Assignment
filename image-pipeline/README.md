# Image Pipeline (minimal scaffold)

This is a minimal backend scaffold for the take-home assignment: accepts image uploads, queues processing, and provides status/results APIs.

Endpoints:
- POST /api/images  (multipart form field `image`)
- GET  /api/images/:processingId/status
- GET  /api/images/:processingId/results

Worker checks implemented in this scaffold:
- MD5 (exact duplicate)
- pHash (visual hash, simple aHash)
- blur (approx Laplacian variance)
- brightness (average luminance)

Run locally:

1. Install dependencies

```bash
cd image-pipeline
npm install
```

2. Start Redis & MongoDB locally (Docker Compose recommended)

3. Start server

```bash
npm run dev
```
