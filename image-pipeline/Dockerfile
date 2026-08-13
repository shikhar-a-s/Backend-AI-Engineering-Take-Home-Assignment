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
ENV PADDLE_PYTHON=python

# Limit CPU thread usage for the ML stack.
# This helps keep memory/CPU usage predictable
# on the Render instance.

ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1


# ==================================================
# Upload directory
# ==================================================

RUN mkdir -p /app/uploads/crops


# ==================================================
# Port
# ==================================================

EXPOSE 10000


# ==================================================
# Start application
# ==================================================

CMD ["npm", "start"]