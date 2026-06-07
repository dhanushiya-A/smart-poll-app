const { supabaseAdmin } = require('../utils/supabaseClient');

async function getAllQuestions() {
  const { data, error } = await supabaseAdmin
    .from('questions')
    .select('*')
    .order('pinned', { ascending: false })
    .order('votes', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(q => ({ id: q.id, text: q.text, votes: q.votes, pinned: q.pinned, createdAt: q.created_at }));
}

async function createQuestion(text, createdBy = null) {
  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .insert({ text: text.trim(), votes: 0, pinned: false, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return { id: question.id, text: question.text, votes: question.votes, pinned: question.pinned, createdAt: question.created_at };
}

async function upvoteQuestion(questionId) {
  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();
  if (error || !question) return null;
  const { data: updatedQuestion, error: updateError } = await supabaseAdmin
    .from('questions')
    .update({ votes: question.votes + 1 })
    .eq('id', questionId)
    .select()
    .single();
  if (updateError) throw updateError;
  return { id: updatedQuestion.id, text: updatedQuestion.text, votes: updatedQuestion.votes, pinned: updatedQuestion.pinned, createdAt: updatedQuestion.created_at };
}

async function downvoteQuestion(questionId) {
  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();
  if (error || !question) return null;
  const { data: updatedQuestion, error: updateError } = await supabaseAdmin
    .from('questions')
    .update({ votes: Math.max(0, question.votes - 1) })
    .eq('id', questionId)
    .select()
    .single();
  if (updateError) throw updateError;
  return { id: updatedQuestion.id, text: updatedQuestion.text, votes: updatedQuestion.votes, pinned: updatedQuestion.pinned, createdAt: updatedQuestion.created_at };
}

async function togglePin(questionId) {
  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();
  if (error || !question) return null;
  const { data: updatedQuestion, error: updateError } = await supabaseAdmin
    .from('questions')
    .update({ pinned: !question.pinned })
    .eq('id', questionId)
    .select()
    .single();
  if (updateError) throw updateError;
  return { id: updatedQuestion.id, text: updatedQuestion.text, votes: updatedQuestion.votes, pinned: updatedQuestion.pinned, createdAt: updatedQuestion.created_at };
}

module.exports = {
  getAllQuestions,
  createQuestion,
  upvoteQuestion,
  downvoteQuestion,
  togglePin,
};
