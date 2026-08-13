require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');

const imagesRouter = require('./routes/images');
// start worker
require('./queue/worker');

const app = express();
app.use(morgan('dev'));
app.use(express.json());

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