const { supabaseAdmin } = require('../utils/supabaseClient');

exports.getQuestions = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('*')
      .order('pinned', { ascending: false })
      .order('votes', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    res.json(data);
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Unable to fetch questions' });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Question text is required' });
    }

    const { data: question, error } = await supabaseAdmin
      .from('questions')
      .insert({
        text: text.trim(),
        votes: 0,
        pinned: false,
        created_by: req.user?.id || null,
      })
      .select()
      .single();

    if (error || !question) {
      throw error || new Error('Unable to create question');
    }

    res.status(201).json(question);
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Unable to create question' });
  }
};

exports.upvoteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const { data: question, error } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const { data: updatedQuestion, error: updateError } = await supabaseAdmin
      .from('questions')
      .update({ votes: question.votes + 1 })
      .eq('id', questionId)
      .select()
      .single();

    if (updateError || !updatedQuestion) {
      throw updateError || new Error('Unable to update question vote');
    }

    res.json(updatedQuestion);
  } catch (error) {
    console.error('Upvote question error:', error);
    res.status(500).json({ error: 'Unable to upvote question' });
  }
};

exports.downvoteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const { data: question, error } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const { data: updatedQuestion, error: updateError } = await supabaseAdmin
      .from('questions')
      .update({ votes: Math.max(0, question.votes - 1) })
      .eq('id', questionId)
      .select()
      .single();

    if (updateError || !updatedQuestion) {
      throw updateError || new Error('Unable to update question vote');
    }

    res.json(updatedQuestion);
  } catch (error) {
    console.error('Downvote question error:', error);
    res.status(500).json({ error: 'Unable to downvote question' });
  }
};

exports.togglePinQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { data: question, error } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const { data: updatedQuestion, error: updateError } = await supabaseAdmin
      .from('questions')
      .update({ pinned: !question.pinned })
      .eq('id', questionId)
      .select()
      .single();

    if (updateError || !updatedQuestion) {
      throw updateError || new Error('Unable to toggle pin');
    }

    res.json(updatedQuestion);
  } catch (error) {
    console.error('Toggle pin question error:', error);
    res.status(500).json({ error: 'Unable to pin/unpin question' });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Question id is required' });

    const { data: deletedQuestions, error: questionDelError } = await supabaseAdmin
      .from('questions')
      .delete()
      .eq('id', id)
      .select('id');
    if (questionDelError) throw questionDelError;
    if (!deletedQuestions || deletedQuestions.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ message: 'Question deleted', id: deletedQuestions[0].id });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Unable to delete question' });
  }
};
