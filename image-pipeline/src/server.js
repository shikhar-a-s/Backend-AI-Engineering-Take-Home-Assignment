require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const imagesRouter = require('./routes/images');
// start worker — allow disabling during local development when Redis isn't available
if (process.env.DISABLE_WORKER !== 'true') {
  try {
    require('./queue/worker');
  } catch (err) {
    // Log and continue — this prevents the whole server from exiting when Redis isn't available during development.
    console.warn('Worker not started or failed to initialize:', err && err.message ? err.message : err);
  }
} else {
  console.log('Worker start skipped (DISABLE_WORKER=true)');
}

const app = express();
app.use(morgan('dev'));

// Enable CORS so that the frontend (running on a different origin during development)
// can POST uploads and fetch results. This is permissive (allows all origins).
// For stricter security, replace with a specific origin list.
app.use(cors());

app.use(express.json());

app.use(
  '/uploads',
  express.static(
    path.join(__dirname, '..', 'uploads')
  )
);

// Health Check Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'Image Processing Pipeline API is running.'
  });
});

app.use('/api/images', imagesRouter);

const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGO_URL || 'mongodb://localhost:27017/image_pipeline';

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Mongo connected'))
  .catch(err => console.error('Mongo connect error', err));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

// Server-side reaper for stale processing jobs
const Image = require('./models/Image');
const STALE_THRESHOLD = parseInt(process.env.STALE_THRESHOLD || '600', 10); // seconds
const REAPER_INTERVAL = parseInt(process.env.REAPER_INTERVAL || '60', 10); // seconds

const runReaper = async () => {
  try {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD * 1000);
    const res = await Image.updateMany(
      {
        status: 'processing',
        processingStartedAt: { $lt: cutoff }
      },
      {
        $set: {
          status: 'timed_out',
          error: 'Processing timed out (server-side reaper)',
          completedAt: new Date()
        }
      }
    );

    if (res && res.modifiedCount > 0) {
      console.log(`Reaper: marked ${res.modifiedCount} processing job(s) as timed_out (older than ${STALE_THRESHOLD}s)`);
    }
  } catch (err) {
    console.error('Reaper error:', err);
  }
};

// Start periodic reaper
const reaperHandle = setInterval(runReaper, REAPER_INTERVAL * 1000);

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
  });

  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('Mongoose connection closed.');
    }
  } catch (err) {
    console.error('Error closing Mongoose connection:', err);
  }

  try {
    const { connection: redisConnection } = require('./queue/queue');
    const worker = require('./queue/worker');

    if (worker && typeof worker.close === 'function') {
      await worker.close();
      console.log('BullMQ Worker closed.');
    }

    if (redisConnection && typeof redisConnection.quit === 'function') {
      await redisConnection.quit();
      console.log('Redis connection closed.');
    }
  } catch (err) {
    console.error('Error closing Redis/Worker connections:', err);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
