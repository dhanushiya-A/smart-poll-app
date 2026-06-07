const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/explain', aiController.explainQuestion);

module.exports = router;
