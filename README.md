# Smart Email Sorter

A Gmail-connected email management tool with Google OAuth, real inbox fetching, and AI-powered categorization. Frontend on GitHub Pages, backend on Render (free tier).

---

## Repository Structure

```
smart-email-sorter/
├── index.html          ← GitHub Pages frontend (your app)
├── backend/
│   ├── server.js       ← Express + OAuth backend
│   ├── package.json
│   └── .env.example    ← Copy to .env and fill in values
├── .gitignore
└── README.md
```

---

## Step 1 — Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it: `smart-email-sorter`
3. Set to **Public** (required for free GitHub Pages)
4. **Do not** initialize with README (you'll push existing files)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-email-sorter.git
git push -u origin main
```

---

## Step 2 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Click **Save**
5. Your frontend will be live at:
   `https://YOUR_USERNAME.github.io/smart-email-sorter/`

---

## Step 3 — Google Cloud Console Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project → name it `SmartEmailSorter`
3. **APIs & Services → Enable APIs** → enable **Gmail API**
4. **APIs & Services → OAuth Consent Screen**
   - Choose **External**
   - App name: `Smart Email Sorter`
   - Support email: your email
   - Scopes: add `gmail.readonly`, `email`, `profile`, `openid`
   - Test users: add your Gmail address
5. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Name: `Smart Email Sorter Web`
   - **Authorized JavaScript origins:** (leave empty for now)
   - **Authorized redirect URIs:**
     ```
     https://your-app-name.onrender.com/auth/google/callback
     ```
     *(Add this after Step 4 — you'll know the Render URL)*
6. Copy **Client ID** and **Client Secret** — you'll need them in Step 4

---

## Step 4 — Deploy Backend on Render (Free)

1. Go to [render.com](https://render.com) → Sign up with GitHub
2. **New → Web Service**
3. Connect your `smart-email-sorter` repository
4. Settings:
   - **Name:** `smart-email-sorter-backend`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. **Environment Variables** — add all of these:

   | Key | Value |
   |-----|-------|
   | `GOOGLE_CLIENT_ID` | from Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
   | `SESSION_SECRET` | any random 32+ char string |
   | `BACKEND_URL` | `https://your-app-name.onrender.com` |
   | `FRONTEND_URL` | `https://YOUR_USERNAME.github.io/smart-email-sorter` |
   | `NODE_ENV` | `production` |

6. Click **Create Web Service**
7. Wait ~2 mins for deploy. Note your Render URL: `https://your-app-name.onrender.com`

---

## Step 5 — Update Frontend with Your Backend URL

In `index.html`, find this line near the bottom (inside `<script>`):

```javascript
const CONFIG = {
  BACKEND_URL: 'https://your-backend.onrender.com' // ← change this
};
```

Replace with your actual Render URL:

```javascript
const CONFIG = {
  BACKEND_URL: 'https://smart-email-sorter-backend.onrender.com'
};
```

Commit and push:

```bash
git add index.html
git commit -m "Set backend URL"
git push
```

---

## Step 6 — Update Google Redirect URI

Go back to Google Cloud Console → Credentials → your OAuth Client:

Add the Render callback URL to **Authorized redirect URIs**:
```
https://your-app-name.onrender.com/auth/google/callback
```

Save.

---

## Step 7 — Test It

1. Open `https://YOUR_USERNAME.github.io/smart-email-sorter/`
2. Click **Sign in with Google** (sidebar or auth page)
3. Complete Google consent
4. You'll be redirected back — logged in ✅
5. Click **Sync Inbox** or **Run Smart Sweep** to load real emails

---

## Local Development

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env — set BACKEND_URL=http://localhost:3000
# Set FRONTEND_URL=http://localhost:5500 (or your local server port)
npm install
npm start

# Frontend — serve index.html with any static server
# e.g. VS Code Live Server on port 5500
# or: npx serve . -p 5500
```

---

## How OAuth Flow Works

```
User clicks "Sign in with Google"
  → Frontend redirects to: https://your-backend.onrender.com/auth/google
  → Backend redirects to Google consent screen
  → User approves
  → Google redirects to: https://your-backend.onrender.com/auth/google/callback
  → Backend stores user + token in session
  → Backend redirects to: https://YOUR_USERNAME.github.io/smart-email-sorter/?auth=success
  → Frontend detects ?auth=success, calls /api/me, updates UI
```

---

## Notes

- **Free Render tier** spins down after 15 mins of inactivity. First login after idle takes ~30s.
- **Gmail tokens** are short-lived. If sync fails, sign out and sign back in.
- App is in **Google OAuth test mode** — only test users (added in step 3.4) can log in until you publish the consent screen.
- To allow any Gmail user to log in: submit your app for Google verification (takes a few days).
