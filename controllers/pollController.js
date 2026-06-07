const { supabaseAdmin } = require('../utils/supabaseClient');

const SUPABASE_QUERY_TIMEOUT_MS = 10000;

const runSupabaseQuery = async query => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_QUERY_TIMEOUT_MS);

  try {
    return await query.abortSignal(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const normalizePoll = poll => {
  if (!poll) return poll;
  return {
    id: poll.id,
    title: poll.title,
    duration: poll.duration,
    expires_at: poll.expires_at,
    expiresAt: poll.expires_at,
    created_at: poll.created_at,
    createdAt: poll.created_at,
    category: poll.category || 'General',
    created_by: poll.created_by,
    options: (poll.poll_options || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(option => ({
      id: option.id,
      label: option.label,
      votes: option.votes || 0,
      created_at: option.created_at,
      createdAt: option.created_at,
    })),
    poll_options: (poll.poll_options || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(option => ({
      id: option.id,
      label: option.label,
      votes: option.votes || 0,
      created_at: option.created_at,
    })),
  };
};

exports.getPolls = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('polls')
      .select('*, poll_options(*)')
      .order('created_at', { ascending: false });
    if (error) {
      throw error;
    }
    let polls = data.map(normalizePoll);
    // If authenticated, fetch which polls the user already voted on and mark them
    const voterId = req.user?.id || null;
    if (voterId) {
      const { data: votesData, error: votesError } = await supabaseAdmin
        .from('votes')
        .select('poll_id')
        .eq('user_id', voterId);
      if (votesError) throw votesError;
      const votedSet = new Set((votesData || []).map(v => v.poll_id));
      polls = polls.map(p => ({ ...p, hasVoted: votedSet.has(p.id) }));
    } else {
      polls = polls.map(p => ({ ...p, hasVoted: false }));
    }
    res.json(polls);
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ error: 'Unable to fetch polls' });
  }
};

exports.createPoll = async (req, res) => {
  try {
    const { title, options, duration } = req.body;
    if (!title || !Array.isArray(options) || options.length < 2 || duration < 10) {
      return res.status(400).json({ error: 'Invalid poll payload' });
    }

    const expiresAt = new Date(Date.now() + duration * 1000).toISOString();
    const createdBy = req.user?.id || null;

    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .insert({ title, duration, expires_at: expiresAt, created_by: createdBy })
      .select()
      .single();

    if (pollError || !poll) {
      throw pollError || new Error('Unable to create poll');
    }

    const optionInserts = options.map(label => ({
      label,
      votes: 0,
      poll_id: poll.id,
    }));

    const { data: insertedOptions, error: optionsError } = await supabaseAdmin
      .from('poll_options')
      .insert(optionInserts)
      .select();

    if (optionsError) {
      throw optionsError;
    }

    res.status(201).json({
      ...poll,
      poll_options: insertedOptions,
    });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Unable to create poll' });
  }
};

exports.votePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { optionIndex } = req.body;
    if (typeof optionIndex !== 'number') {
      return res.status(400).json({ error: 'optionIndex is required' });
    }

    const { data: options, error: optionFetchError } = await supabaseAdmin
      .from('poll_options')
      .select('*')
      .eq('poll_id', pollId)
      .order('created_at', { ascending: true });

    if (optionFetchError) {
      throw optionFetchError;
    }

    if (!options || optionIndex < 0 || optionIndex >= options.length) {
      return res.status(404).json({ error: 'Poll or option not found' });
    }

    const option = options[optionIndex];

    // If authenticated, ensure the user hasn't already voted on this poll
    const voterId = req.user?.id || null;
    if (voterId) {
      const { data: existingVotes, error: voteCheckError } = await supabaseAdmin
        .from('votes')
        .select('*')
        .eq('poll_id', pollId)
        .eq('user_id', voterId)
        .limit(1);
      if (voteCheckError) throw voteCheckError;
      if (existingVotes && existingVotes.length > 0) {
        return res.status(400).json({ message: 'You have already voted on this poll.' });
      }
    }

    const { data: updatedOption, error: updateError } = await supabaseAdmin
      .from('poll_options')
      .update({ votes: option.votes + 1 })
      .eq('id', option.id)
      .select()
      .single();

    if (updateError || !updatedOption) {
      throw updateError || new Error('Unable to update vote');
    }

    // Record vote in votes table for auditing / enforcement (user_id may be null for guests)
    const { error: insertVoteError } = await supabaseAdmin.from('votes').insert({
      poll_id: pollId,
      option_id: option.id,
      user_id: voterId,
    });
    if (insertVoteError) {
      console.warn('Warning: failed to record vote in votes table', insertVoteError);
    }

    const { data: pollData, error: pollFetchError } = await supabaseAdmin
      .from('polls')
      .select('*, poll_options(*)')
      .eq('id', pollId)
      .single();

    if (pollFetchError || !pollData) {
      throw pollFetchError || new Error('Unable to fetch updated poll');
    }

    res.json(normalizePoll(pollData));
  } catch (error) {
    console.error('Vote poll error:', error);
    res.status(500).json({ error: 'Unable to vote on poll' });
  }
};

exports.deletePoll = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting poll ID:', id);
    if (!id) return res.status(400).json({ error: 'Poll id is required' });

    const { data: existingPoll, error: pollFetchError } = await runSupabaseQuery(
      supabaseAdmin
        .from('polls')
        .select('id')
        .eq('id', id)
        .maybeSingle()
    );
    if (pollFetchError) throw pollFetchError;
    if (!existingPoll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const { error: votesDelError } = await runSupabaseQuery(
      supabaseAdmin
        .from('votes')
        .delete()
        .eq('poll_id', id)
    );
    if (votesDelError) {
      console.error('Votes delete error:', votesDelError);
      throw votesDelError;
    }

    const { error: optionsDelError } = await runSupabaseQuery(
      supabaseAdmin
        .from('poll_options')
        .delete()
        .eq('poll_id', id)
    );
    if (optionsDelError) {
      console.error('Options delete error:', optionsDelError);
      throw optionsDelError;
    }

    const { data: deletedPoll, error: pollDelError } = await runSupabaseQuery(
      supabaseAdmin
        .from('polls')
        .delete()
        .eq('id', id)
        .select('id')
    );
    if (pollDelError) {
      console.error('Poll delete error:', pollDelError);
      throw pollDelError;
    }
    if (!deletedPoll || deletedPoll.length === 0) {
      return res.status(500).json({ error: 'Poll delete was blocked or did not affect any rows' });
    }

    res.json({ message: 'Poll deleted', id: deletedPoll[0].id });
  } catch (error) {
    console.error('Delete poll error:', error);
    res.status(500).json({ error: 'Unable to delete poll' });
  }
};
