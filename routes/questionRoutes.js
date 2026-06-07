const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

router.get('/', questionController.getQuestions);
router.post('/', questionController.createQuestion);
router.post('/:questionId/upvote', questionController.upvoteQuestion);
router.post('/:questionId/downvote', questionController.downvoteQuestion);
router.post('/:questionId/pin', questionController.togglePinQuestion);
router.delete('/:id', questionController.deleteQuestion);

module.exports = router;
