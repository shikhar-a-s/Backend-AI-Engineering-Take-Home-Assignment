FROM python:3.11-slim

# ==================================================
# System packages
# ==================================================

RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*


# ==================================================
# Application directory
# ==================================================

WORKDIR /app


# ==================================================
# Node dependencies
# ==================================================

COPY package*.json ./

RUN npm ci --omit=dev


# ==================================================
# Python dependencies
# ==================================================

COPY requirements.lock.txt ./

RUN pip install \
    --no-cache-dir \
    -r requirements.lock.txt


# ==================================================
# Application source
# ==================================================

COPY . .


# ==================================================
# Environment
# ==================================================

ENV NODE_ENV=production

ENV YOLO_PYTHON=python
ENV PADDLE_PYTHON=python

# Leave empty so yolo-detect.py uses yolov8n.pt
# and allows Ultralytics to download it automatically.
ENV YOLO_MODEL_PATH=""


# ==================================================
# Upload directory
# ==================================================

RUN mkdir -p /app/uploads/crops


# ==================================================
# Port
# ==================================================

EXPOSE 4000


# ==================================================
# Start application
# ==================================================

CMD ["npm", "start"]