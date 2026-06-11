const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ─────────────────────────────────────────────────────────────────
// PASSPORT GOOGLE STRATEGY
// ─────────────────────────────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly']
  },
  (accessToken, refreshToken, profile, done) => {
    const user = {
      id: profile.id,
      name: profile.displayName,
      email: profile.emails?.[0]?.value || '',
      avatar: profile.photos?.[0]?.value || '',
      accessToken
    };
    return done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ─────────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────────
app.get('/api/auth/google',
  passport.authenticate('google', {
    scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
    accessType: 'online',
    prompt: 'select_account'
  })
);

app.get('/api/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}?auth=error`
  }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  }
);

app.get('/api/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

app.get('/api/me', requireAuth, (req, res) => {
  const { name, email, avatar } = req.user;
  res.json({ name, email, avatar });
});

app.get('/api/emails', requireAuth, async (req, res) => {
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ access_token: req.user.accessToken });

    const gmail = google.gmail({ version: 'v1', auth });

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 40,
      labelIds: ['INBOX']
    });

    const messages = listRes.data.messages || [];

    const emailDetails = await Promise.all(
      messages.map(async ({ id }) => {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date']
          });
          return parseMessage(msg.data);
        } catch (e) {
          return null;
        }
      })
    );

    const valid = emailDetails.filter(Boolean);
    const categorized = categorizeEmails(valid);

    res.json({ total: valid.length, categorized });
  } catch (err) {
    console.error('Gmail API error:', err.message);
    if (err.code === 401) {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────
// EMAIL HELPERS
// ─────────────────────────────────────────────────────────────────
function parseMessage(msg) {
  const headers = msg.payload?.headers || [];
  const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const from = get('From');
  const subject = get('Subject') || '(no subject)';
  const date = get('Date');

  const fromName = from.includes('<')
    ? from.split('<')[0].trim().replace(/^"|"$/g, '')
    : from.split('@')[0];

  const dateObj = date ? new Date(date) : new Date();
  const now = new Date();
  const isToday = dateObj.toDateString() === now.toDateString();
  const timeStr = isToday
    ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return {
    id: msg.id,
    from: fromName || from,
    fromFull: from,
    subject,
    time: timeStr,
    body: msg.snippet || '',
    labels: msg.labelIds || []
  };
}

function categorizeEmails(emails) {
  const categories = { Primary: [], Social: [], Updates: [], Forums: [], Promotions: [] };
  const socialDomains = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'x.com', 'reddit'];
  const promoKeywords = ['deal', 'offer', 'sale', 'discount', 'promo', 'coupon', 'unsubscribe', '%off'];
  const updateDomains = ['github', 'notion', 'jira', 'slack', 'trello', 'google', 'apple', 'microsoft', 'amazon'];
  const forumDomains = ['stackoverflow', 'quora', 'medium', 'substack', 'indiehackers'];

  emails.forEach(email => {
    const combined = `${email.fromFull} ${email.subject} ${email.body}`.toLowerCase();
    const labels = email.labels;

    if (labels.includes('CATEGORY_SOCIAL')) { categories.Social.push(email); return; }
    if (labels.includes('CATEGORY_PROMOTIONS')) { categories.Promotions.push(email); return; }
    if (labels.includes('CATEGORY_UPDATES')) { categories.Updates.push(email); return; }
    if (labels.includes('CATEGORY_FORUMS')) { categories.Forums.push(email); return; }

    if (socialDomains.some(d => combined.includes(d))) { categories.Social.push(email); return; }
    if (forumDomains.some(d => combined.includes(d))) { categories.Forums.push(email); return; }
    if (updateDomains.some(d => combined.includes(d))) { categories.Updates.push(email); return; }
    if (promoKeywords.some(k => combined.includes(k))) { categories.Promotions.push(email); return; }

    categories.Primary.push(email);
  });

  Object.keys(categories).forEach(k => {
    if (categories[k].length === 0) delete categories[k];
  });

  return categories;
}

// ─────────────────────────────────────────────────────────────────
// EXPORT for Vercel serverless
// ─────────────────────────────────────────────────────────────────
module.exports = app;
