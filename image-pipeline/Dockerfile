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
# Application
# ==================================================

COPY . .


# ==================================================
# Environment
# ==================================================

ENV NODE_ENV=production

# RapidOCR uses ONNX Runtime.
# Use a single thread to keep CPU/memory usage predictable
# on the Render instance.

ENV RAPIDOCR_PYTHON=python
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1


# ==================================================
# Temporary working directory for crops
# ==================================================

RUN mkdir -p /app/tmp/crops


# ==================================================
# Port
# ==================================================

EXPOSE 10000


# ==================================================
# Start application
# ==================================================

CMD ["npm", "start"]