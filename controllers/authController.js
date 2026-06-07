const { supabaseAdmin, supabaseAnon } = require('../utils/supabaseClient');

const createOrUpdateProfile = async (userId, email, name) => {
  const profile = {
    id: userId,
    email: email.toLowerCase(),
    name: name || email,
    created_at: new Date().toISOString(),
  };
  await supabaseAdmin.from('users').upsert(profile, { onConflict: 'id' });
};

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true,
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    await createOrUpdateProfile(createdUser.id, email, name);

    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      return res.status(400).json({ error: signInError?.message || 'Registration succeeded, but login failed.' });
    }

    res.status(201).json({
      token: signInData.session.access_token,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        name: name || createdUser.user_metadata?.name || createdUser.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Unable to register at this time.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return res.status(401).json({ error: error?.message || 'Invalid credentials.' });
    }

    const user = data.user;
    const profileResponse = await supabaseAdmin.from('users').select('name').eq('id', user.id).single();
    const name = profileResponse.data?.name || user.user_metadata?.name || email;

    if (!profileResponse.error) {
      await createOrUpdateProfile(user.id, email, name);
    }

    res.json({
      token: data.session.access_token,
      user: {
        id: user.id,
        email: user.email,
        name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Unable to login at this time.' });
  }
};

exports.logout = async (req, res) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Unable to logout at this time.' });
  }
};

exports.me = async (req, res) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = authData.user;
    const profileResponse = await supabaseAdmin.from('users').select('name, created_at').eq('id', user.id).single();
    const profile = profileResponse.data || {};
    res.json({
      id: user.id,
      email: user.email,
      name: profile.name || user.user_metadata?.name || user.email,
      createdAt: profile.created_at || user.created_at,
      recentActivity: [],
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Unable to fetch profile at this time.' });
  }
};
