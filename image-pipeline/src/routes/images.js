const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const controller = require('../controllers/imagesController');

router.post('/', upload.single('image'), controller.uploadImage);
router.get('/:processingId/status', controller.getStatus);
router.get('/:processingId/results', controller.getResults);

module.exports = router;
