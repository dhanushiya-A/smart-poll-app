// DOM helpers: query elements when present (landing page may not have dashboard elements)
const $ = id => document.getElementById(id);
const pollSearch = $('pollSearch');
const pollList = $('pollList');
const questionList = $('questionList');
const pollForm = $('pollForm');
const pollTitle = $('pollTitle');
const pollOptions = $('pollOptions');
const pollDuration = $('pollDuration');
const questionForm = $('questionForm');
const questionText = $('questionText');
const askAiButton = $('askAiButton');
const aiResponse = $('aiResponse');
const categoryFilter = $('categoryFilter');
const pollCategory = $('pollCategory');
const trendingList = $('trendingList');
const landingTotalPolls = $('landingTotalPolls');
const landingTotalVotes = $('landingTotalVotes');
const landingTotalQuestions = $('landingTotalQuestions');
const questionCount = $('questionCount');
const pollTemplate = $('pollTemplate');
const questionTemplate = $('questionTemplate');

const apiBase = (() => {
  const isLocalDev = ['127.0.0.1', 'localhost', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
  if (isLocalDev) {
    const apiUrl = 'http://127.0.0.1:5000/api';
    console.log('Local development mode detected. Using backend API base:', apiUrl);
    return apiUrl;
  }
  const origin = `${window.location.protocol}//${window.location.host}`;
  return `${origin}/api`;
})();

let currentQuestions = [];
let timerIntervals = [];
let currentCategory = 'All';

function getStoredToken() {
  return localStorage.getItem('authToken');
}

function getAuthHeaders() {
  const token = getStoredToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'API request failed');
  }
  return response.json();
}

function formatCount(value) {
  return value.toLocaleString();
}

// Local storage helpers for guest voting persistence
function getVotedPolls() {
  try {
    const raw = localStorage.getItem('votedPolls');
    if (!raw) return [];
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

function hasLocallyVoted(pollId) {
  const list = getVotedPolls();
  return list.includes(pollId);
}

function addVotedPoll(pollId) {
  try {
    const list = getVotedPolls();
    if (!list.includes(pollId)) {
      list.push(pollId);
      localStorage.setItem('votedPolls', JSON.stringify(list));
    }
  } catch (e) {
    // ignore
  }
}

// Question vote tracking helpers
function getQuestionVote(questionId) {
  try {
    const votes = JSON.parse(localStorage.getItem('questionVotes') || '{}');
    return votes[questionId] || null; // returns 'upvote', 'downvote', or null
  } catch (e) {
    return null;
  }
}

function setQuestionVote(questionId, voteType) {
  try {
    const votes = JSON.parse(localStorage.getItem('questionVotes') || '{}');
    votes[questionId] = voteType;
    localStorage.setItem('questionVotes', JSON.stringify(votes));
  } catch (e) {
    // ignore
  }
}

function setAiResponse(message, isError = false) {
  if (!aiResponse) return;
  aiResponse.textContent = message;
  aiResponse.classList.toggle('error-message', isError);
}

async function askAiQuestion(question) {
  if (!question || !askAiButton) return;
  setAiResponse('');
  askAiButton.disabled = true;
  const originalText = askAiButton.textContent;
  askAiButton.textContent = 'Loading...';

  try {
    const data = await apiJson(`${apiBase}/ai/explain`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
    setAiResponse(data.answer || 'No answer returned.');
  } catch (error) {
    console.error('Ask AI error:', error);
    setAiResponse(error.message || 'AI request failed', true);
  } finally {
    askAiButton.disabled = false;
    askAiButton.textContent = originalText;
  }
}

function clearTimers() {
  timerIntervals.forEach(clearInterval);
  timerIntervals = [];
}

async function fetchPolls() {
  return apiJson(`${apiBase}/polls`, { method: 'GET' });
}

async function fetchQuestions() {
  return apiJson(`${apiBase}/questions`, { method: 'GET' });
}

function normalizePollClient(poll) {
  if (!poll) return poll;
  const rawOptions = poll.options || poll.poll_options || [];
  return {
    id: poll.id || poll._id,
    title: poll.title,
    options: rawOptions.map(o => ({ id: o.id || o._id, label: o.label, votes: o.votes || 0 })),
    duration: poll.duration,
    expiresAt: poll.expiresAt || poll.expires_at,
    createdAt: poll.createdAt || poll.created_at,
    category: poll.category || 'General',
  };
}

function normalizeQuestionClient(q) {
  if (!q) return q;
  return {
    id: q.id || q._id,
    text: q.text,
    votes: q.votes || 0,
    pinned: !!q.pinned,
    createdAt: q.createdAt || q.created_at,
  };
}

function handleApiError(error) {
  console.error(error);
}

async function votePoll(pollId, optionIndex) {
  try {
    await apiJson(`${apiBase}/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionIndex }),
    });
    // mark as voted for guest users (no auth token)
    if (!getStoredToken()) {
      addVotedPoll(pollId);
    }
    await updatePollCards(pollSearch ? pollSearch.value : '');
  } catch (error) {
    // If API returned already voted message, disable UI for that poll
    const msg = error.message || '';
    if (msg.includes('already voted')) {
      // ensure UI shows voted state
      addVotedPoll(pollId);
      await updatePollCards(pollSearch ? pollSearch.value : '');
      return;
    }
    handleApiError(error);
  }
}

async function pinQuestion(questionId) {
  try {
    await apiJson(`${apiBase}/questions/${questionId}/pin`, { method: 'POST' });
    await renderQuestions();
  } catch (error) {
    handleApiError(error);
  }
}

async function upvoteQuestion(questionId) {
  try {
    // Check if user already voted on this question
    const voteType = getQuestionVote(questionId);
    if (voteType) {
      alert('You have already voted on this question.');
      return;
    }
    await apiJson(`${apiBase}/questions/${questionId}/upvote`, { method: 'POST' });
    // Mark locally as voted
    setQuestionVote(questionId, 'upvote');
    await renderQuestions();
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('already voted')) {
      setQuestionVote(questionId, 'upvote');
      await renderQuestions();
      return;
    }
    handleApiError(error);
  }
}

async function downvoteQuestion(questionId) {
  try {
    // Check if user already voted on this question
    const voteType = getQuestionVote(questionId);
    if (voteType) {
      alert('You have already voted on this question.');
      return;
    }
    await apiJson(`${apiBase}/questions/${questionId}/downvote`, { method: 'POST' });
    // Mark locally as voted
    setQuestionVote(questionId, 'downvote');
    await renderQuestions();
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('already voted')) {
      setQuestionVote(questionId, 'downvote');
      await renderQuestions();
      return;
    }
    handleApiError(error);
  }
}

async function deleteQuestion(questionId) {
  try {
    const ok = window.confirm('Are you sure you want to delete this question?');
    if (!ok) return;
    await apiJson(`${apiBase}/questions/${questionId}`, { method: 'DELETE' });
    await renderQuestions();
  } catch (error) {
    handleApiError(error);
  }
}

function bindPollEvents(card, poll) {
  const optionButtons = card.querySelectorAll('.option-action button');
  const voted = poll.hasVoted || hasLocallyVoted(poll.id);
  optionButtons.forEach((button, index) => {
    button.addEventListener('click', () => votePoll(poll.id, index));
    button.disabled = voted;
  });
  // show message if already voted
  if (voted) {
    const winnerBadge = card.querySelector('.winner-badge');
    if (winnerBadge) winnerBadge.textContent = 'You already voted.';
  }
}

function makePollCard(poll) {
  const clone = pollTemplate.content.cloneNode(true);
  const card = clone.querySelector('.poll-card');
  card.querySelector('.poll-title').textContent = poll.title;
  card.querySelector('.poll-votes').textContent = `${poll.options.reduce((sum, option) => sum + option.votes, 0)} votes`;
  const timerEl = card.querySelector('.poll-timer');

  const optionList = card.querySelector('.options-list');
  optionList.innerHTML = '';

  const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0) || 1;

  poll.options.forEach(option => {
    const optionItem = document.createElement('div');
    optionItem.className = 'poll-option';
    optionItem.innerHTML = `
      <div class="option-label">
        <span>${option.label}</span>
        <small>${Math.round((option.votes / totalVotes) * 100)}%</small>
      </div>
      <div class="option-action">
        <button type="button">Vote</button>
      </div>
      <div class="option-progress"></div>`;

    const progressBar = optionItem.querySelector('.option-progress');
    const fill = document.createElement('div');
    fill.style.cssText = `position:absolute; inset:0; border-radius:inherit; background: linear-gradient(90deg, rgba(84, 181, 255, 0.92), rgba(60, 227, 179, 0.92)); width:${(option.votes / totalVotes) * 100}%; transition: width 0.5s ease;`;
    progressBar.appendChild(fill);
    optionList.appendChild(optionItem);
  });

  card.querySelector('.category-badge').textContent = poll.category || 'General';
  const winner = poll.options.reduce((best, option) => {
    if (!best || option.votes > best.votes) return option;
    return best;
  }, null);
  card.querySelector('.winner-badge').textContent = winner ? `Top answer: ${winner.label}` : 'No votes yet';

  const shareButton = card.querySelector('.share-button');
  const exportButton = card.querySelector('.export-button');

  shareButton.addEventListener('click', () => {
    const link = generateShareLink(poll.id);
    window.navigator.clipboard.writeText(link).catch(() => {});
  });

  exportButton.addEventListener('click', () => exportPollAsPDF(poll));
  bindPollEvents(card, poll);

  // Delete button
  const deleteButton = card.querySelector('.delete-button');
  if (deleteButton) {
    deleteButton.addEventListener('click', async () => {
      const ok = window.confirm('Are you sure you want to delete this poll?');
      if (!ok) return;
      try {
        await apiJson(`${apiBase}/polls/${poll.id}`, { method: 'DELETE' });
        // remove from UI and refresh
        await updatePollCards(pollSearch ? pollSearch.value : '');
      } catch (err) {
        handleApiError(err);
      }
    });
  }

  function updateTimer() {
    const remaining = Math.max(0, Math.round((new Date(poll.expiresAt) - Date.now()) / 1000));
    timerEl.textContent = remaining > 0 ? `Time remaining: ${remaining}s` : 'Poll closed';
    if (remaining <= 0) {
      card.querySelectorAll('.option-action button').forEach(btn => btn.disabled = true);
    }
  }

  updateTimer();
  timerIntervals.push(setInterval(updateTimer, 1000));
  return card;
}

function generateShareLink(pollId) {
  return `${window.location.origin}/poll/${pollId}`;
}

function exportPollAsPDF(poll) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(poll.title, 14, 22);
  doc.setFontSize(12);
  doc.text(`Category: ${poll.category || 'General'}`, 14, 32);
  doc.text(`Total votes: ${poll.options.reduce((sum, o) => sum + o.votes, 0)}`, 14, 40);
  poll.options.forEach((option, index) => {
    doc.text(`${index + 1}. ${option.label} — ${option.votes} votes`, 14, 50 + index * 8);
  });
  doc.save(`${poll.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'poll'}.pdf`);
}

async function updatePollCards(searchTerm = '') {
  clearTimers();
  if (!pollList) return;
  pollList.innerHTML = '';
  const pollsRaw = await fetchPolls();
  const polls = (pollsRaw || []).map(normalizePollClient);
  const filtered = polls
    .filter(poll => currentCategory === 'All' || poll.category === currentCategory)
    .filter(poll => poll.title.toLowerCase().includes(searchTerm.toLowerCase()));

  if (filtered.length === 0) {
    pollList.innerHTML = '<div class="poll-card"><p>No polls found.</p></div>';
  }

  filtered.forEach(poll => {
    const card = makePollCard(poll);
    pollList.appendChild(card);
  });

  if (landingTotalPolls || landingTotalVotes || landingTotalQuestions) {
    const questionsRaw = await fetchQuestions();
    const questions = (questionsRaw || []).map(normalizeQuestionClient);
    updateLandingAnalytics(polls, questions);
  }
}

function makeQuestionCard(question) {
  const clone = questionTemplate.content.cloneNode(true);
  const card = clone.querySelector('.question-card');
  card.querySelector('.question-text').textContent = question.text;
  card.querySelector('.vote-count').textContent = question.votes;
  const pinButton = card.querySelector('.pin-button');
  const upvote = card.querySelector('.upvote');
  const downvote = card.querySelector('.downvote');
  const deleteButton = card.querySelector('.delete-button');

  // Check if user already voted on this question
  const userVote = getQuestionVote(question.id);
  if (userVote) {
    upvote.disabled = true;
    downvote.disabled = true;
    card.querySelector('.vote-count').textContent += ' (You already voted)';
  }

  if (question.pinned) {
    card.classList.add('pinned');
    pinButton.textContent = 'Unpin';
  }

  pinButton.addEventListener('click', () => pinQuestion(question.id));
  upvote.addEventListener('click', () => upvoteQuestion(question.id));
  downvote.addEventListener('click', () => downvoteQuestion(question.id));
  
  if (deleteButton) {
    deleteButton.addEventListener('click', () => deleteQuestion(question.id));
  }

  return card;
}

async function renderQuestions() {
  const questionsRaw = await fetchQuestions();
  const questions = (questionsRaw || []).map(normalizeQuestionClient);
  currentQuestions = questions;
  if (questionList) questionList.innerHTML = '';

  const sorted = [...questions].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    return b.votes - a.votes;
  });

  sorted.forEach(question => {
    const card = makeQuestionCard(question);
    if (questionList) questionList.appendChild(card);
  });
  if (questionCount) questionCount.textContent = sorted.length;
}

async function renderTrendingPolls() {
  if (!trendingList) return;
  const pollsRaw = await fetchPolls();
  const polls = (pollsRaw || []).map(normalizePollClient);
  trendingList.innerHTML = '';

  const trending = [...polls]
    .sort((a, b) => b.options.reduce((sum, opt) => sum + opt.votes, 0) - a.options.reduce((sum, opt) => sum + opt.votes, 0))
    .slice(0, 5);

  trending.forEach(poll => {
    const li = document.createElement('li');
    li.textContent = `${poll.title} — ${poll.options.reduce((sum, option) => sum + option.votes, 0)} votes`;
    trendingList.appendChild(li);
  });
}

function updateLandingAnalytics(polls, questions) {
  const voteCount = polls.reduce((sum, poll) => sum + poll.options.reduce((optSum, option) => optSum + option.votes, 0), 0);
  if (landingTotalPolls) landingTotalPolls.textContent = polls.length;
  if (landingTotalVotes) landingTotalVotes.textContent = formatCount(voteCount);
  if (landingTotalQuestions) landingTotalQuestions.textContent = questions.length;
}

async function refreshLandingAnalytics() {
  const pollsRaw = await fetchPolls();
  const questionsRaw = await fetchQuestions();
  const polls = (pollsRaw || []).map(normalizePollClient);
  const questions = (questionsRaw || []).map(normalizeQuestionClient);
  updateLandingAnalytics(polls, questions);
}

if (categoryFilter) {
  categoryFilter.addEventListener('change', async event => {
    currentCategory = event.target.value;
    await updatePollCards(pollSearch ? pollSearch.value : '');
  });
}

if (pollSearch) {
  pollSearch.addEventListener('input', event => updatePollCards(event.target.value));
}

if (pollForm) {
  pollForm.addEventListener('submit', async event => {
    event.preventDefault();
    const title = (pollTitle?.value || '').trim();
    const options = (pollOptions?.value || '').split(',').map(o => o.trim()).filter(Boolean);
    const duration = Number(pollDuration?.value || 40);
    if (!title || options.length < 2 || duration < 10) {
      return;
    }
    try {
      await apiJson(`${apiBase}/polls`, { method: 'POST', body: JSON.stringify({ title, options, duration, category: pollCategory?.value || 'General' }) });
      pollForm.reset();
      updatePollCards(pollSearch ? pollSearch.value : '');
    } catch (error) {
      handleApiError(error);
    }
  });
}

if (questionForm) {
  questionForm.addEventListener('submit', async event => {
    event.preventDefault();
    const text = (questionText?.value || '').trim();
    if (!text) return;
    setAiResponse('');
    try {
      await apiJson(`${apiBase}/questions`, { method: 'POST', body: JSON.stringify({ text }) });
      if (questionText) questionText.value = '';
      renderQuestions();
    } catch (error) {
      handleApiError(error);
    }
  });
}

if (askAiButton) {
  askAiButton.addEventListener('click', async () => {
    const text = (questionText?.value || '').trim();
    if (!text) {
      setAiResponse('Please enter a question before asking AI.', true);
      return;
    }
    await askAiQuestion(text);
  });
}

function init() {
  if (pollList) updatePollCards();
  if (trendingList) renderTrendingPolls();
  if (questionList) renderQuestions();
  if (landingTotalPolls || landingTotalVotes || landingTotalQuestions) refreshLandingAnalytics();
}

document.addEventListener('DOMContentLoaded', init);
