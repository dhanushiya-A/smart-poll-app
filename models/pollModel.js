const { supabaseAdmin } = require('../utils/supabaseClient');

const normalizePoll = poll => {
  if (!poll) return poll;
  return {
    id: poll.id,
    title: poll.title,
    duration: poll.duration,
    expiresAt: poll.expires_at,
    createdAt: poll.created_at,
    category: poll.category || 'General',
    created_by: poll.created_by || null,
    options: (poll.poll_options || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(opt => ({
      id: opt.id,
      label: opt.label,
      votes: opt.votes,
      createdAt: opt.created_at,
    })),
  };
};

async function getAllPolls() {
  const { data, error } = await supabaseAdmin
    .from('polls')
    .select('*, poll_options(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(normalizePoll);
}

async function createPoll(title, options, duration, createdBy = null) {
  const expiresAt = new Date(Date.now() + duration * 1000).toISOString();
  const { data: poll, error: pollError } = await supabaseAdmin
    .from('polls')
    .insert({ title, duration, expires_at: expiresAt, created_by: createdBy })
    .select()
    .single();
  if (pollError) throw pollError;

  const optionInserts = options.map(label => ({ label, votes: 0, poll_id: poll.id }));
  const { data: insertedOptions, error: optionsError } = await supabaseAdmin
    .from('poll_options')
    .insert(optionInserts)
    .select();
  if (optionsError) throw optionsError;

  return normalizePoll({ ...poll, poll_options: insertedOptions });
}

async function votePoll(pollId, optionIndex, userId = null) {
  const { data: options, error: optionFetchError } = await supabaseAdmin
    .from('poll_options')
    .select('*')
    .eq('poll_id', pollId)
    .order('created_at', { ascending: true });
  if (optionFetchError) throw optionFetchError;

  if (!options || optionIndex < 0 || optionIndex >= options.length) return null;
  const option = options[optionIndex];

  // If authenticated user, ensure they haven't already voted for this poll
  if (userId) {
    const { data: existingVotes, error: voteCheckError } = await supabaseAdmin
      .from('votes')
      .select('*')
      .eq('poll_id', pollId)
      .eq('user_id', userId)
      .limit(1);
    if (voteCheckError) throw voteCheckError;
    if (existingVotes && existingVotes.length > 0) {
      const err = new Error('User has already voted');
      err.code = 'ALREADY_VOTED';
      throw err;
    }
  }

  const { data: updatedOption, error: updateError } = await supabaseAdmin
    .from('poll_options')
    .update({ votes: option.votes + 1 })
    .eq('id', option.id)
    .select()
    .single();
  if (updateError) throw updateError;

  const { error: insertVoteError } = await supabaseAdmin.from('votes').insert({ poll_id: pollId, option_id: option.id, user_id: userId });
  if (insertVoteError) console.warn('Failed to insert vote record', insertVoteError);

  const { data: pollData, error: pollFetchError } = await supabaseAdmin
    .from('polls')
    .select('*, poll_options(*)')
    .eq('id', pollId)
    .single();
  if (pollFetchError) throw pollFetchError;
  return normalizePoll(pollData);
}

async function deletePollById(id) {
  if (!id) throw new Error('id required');
  const { error: votesDelError } = await supabaseAdmin.from('votes').delete().eq('poll_id', id);
  if (votesDelError) throw votesDelError;
  const { error: optsDelError } = await supabaseAdmin.from('poll_options').delete().eq('poll_id', id);
  if (optsDelError) throw optsDelError;
  const { error: pollDelError } = await supabaseAdmin.from('polls').delete().eq('id', id);
  if (pollDelError) throw pollDelError;
  return true;
}

module.exports = {
  getAllPolls,
  createPoll,
  votePoll,
  deletePollById,
};
