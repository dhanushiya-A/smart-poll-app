// require('dotenv').config();
// const express = require('express');
// const path = require('path');
// const cors = require('cors');
// const { supabaseAdmin, supabaseAnon } = require('./utils/supabaseClient');
// const pollRoutes = require('./routes/pollRoutes');
// const questionRoutes = require('./routes/questionRoutes');
// const authRoutes = require('./routes/authRoutes');
// const aiRoutes = require('./routes/aiRoutes');

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use((req, res, next) => {
//   console.log(`Request: ${req.method} ${req.originalUrl}`);
//   next();
// });

// app.use(cors());
// app.use(express.json());
// app.set('supabaseAdmin', supabaseAdmin);
// app.set('supabaseAnon', supabaseAnon);
// app.use('/api/auth', authRoutes);
// app.use('/api/polls', pollRoutes);
// app.use('/api/questions', questionRoutes);
// app.use('/api/ai', aiRoutes);
// app.use(express.static(path.join(__dirname)));

// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'index.html'));
// });

// app.use((req, res) => {
//   res.status(404).json({ error: 'Route not found' });
// });

// app.use((err, req, res, next) => {
//   console.error('Unhandled error:', err);
//   res.status(500).json({ error: 'Internal server error' });
// });

// // app.listen(PORT, () => {
// //   console.log(`Server running on port ${PORT}`);
// // });//changed here

// if (process.env.NODE_ENV !== 'production') {
//   app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
//   });
// }

// module.exports = app;



require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { supabaseAdmin, supabaseAnon } = require('./utils/supabaseClient');
const pollRoutes = require('./routes/pollRoutes');
const questionRoutes = require('./routes/questionRoutes');
const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.originalUrl}`);
  next();
});

app.use(cors());
app.use(express.json());

app.set('supabaseAdmin', supabaseAdmin);
app.set('supabaseAnon', supabaseAnon);

app.use('/api/auth', authRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/ai', aiRoutes);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;