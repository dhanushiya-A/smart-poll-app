const express = require('express');
const router = express.Router();
const pollController = require('../controllers/pollController');

router.get('/', pollController.getPolls);
router.post('/', pollController.createPoll);
router.post('/:pollId/vote', pollController.votePoll);
router.delete('/:id', pollController.deletePoll);

module.exports = router;
