require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const path = require('path');

const imagesRouter = require('./routes/images');
// start worker
require('./queue/worker');

const app = express();
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/images', imagesRouter);

const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGO_URL || 'mongodb://localhost:27017/image_pipeline';

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Mongo connected'))
  .catch(err => console.error('Mongo connect error', err));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
