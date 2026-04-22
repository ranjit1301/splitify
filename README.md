# ✈️ Trip Expense Splitter — Deployment Guide

Share this app with your friends in **10 minutes**, completely free.

---

## What you need
- A free **GitHub** account → github.com
- A free **Vercel** account → vercel.com
- Your **Anthropic API key** → console.anthropic.com

---

## Step 1 — Get your Anthropic API Key

1. Go to **https://console.anthropic.com**
2. Sign up / log in
3. Click **"API Keys"** in the left sidebar
4. Click **"Create Key"** → copy the key (starts with `sk-ant-...`)
5. Save it somewhere safe — you'll need it in Step 4

---

## Step 2 — Upload code to GitHub

1. Go to **https://github.com** and sign in
2. Click the **"+"** button (top right) → **"New repository"**
3. Name it: `trip-expense-splitter`
4. Set it to **Public**, click **"Create repository"**
5. On the next page, click **"uploading an existing file"**
6. Drag and drop **ALL files and folders** from this zip into the uploader
7. Click **"Commit changes"**

---

## Step 3 — Deploy on Vercel

1. Go to **https://vercel.com** and sign in with your GitHub account
2. Click **"Add New Project"**
3. Find `trip-expense-splitter` in the list → click **"Import"**
4. Under **Framework Preset**, select **"Vite"**
5. Leave everything else as default
6. Click **"Deploy"** — wait ~1 minute

---

## Step 4 — Add your API Key (secret, stays on server)

1. Once deployed, go to your project on Vercel dashboard
2. Click **"Settings"** tab → **"Environment Variables"**
3. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** paste your key (`sk-ant-...`)
4. Click **"Save"**
5. Go to **"Deployments"** tab → click the 3 dots on your latest deployment → **"Redeploy"**

---

## Step 5 — Share with friends! 🎉

Your app is now live at a URL like:
```
https://trip-expense-splitter-yourname.vercel.app
```

- **Send this link to anyone** — works on iPhone & Android browsers
- They don't need to install anything
- **To install as an app on mobile:** open the link in Chrome/Safari → tap Share → "Add to Home Screen"

---

## Folder structure (for reference)

```
trip-expense-splitter/
├── api/
│   └── claude.js        ← Secure server-side API proxy (hides your API key)
├── src/
│   ├── main.jsx         ← React entry point
│   └── App.jsx          ← Main app code
├── public/
│   └── manifest.json    ← Makes it installable as a mobile app
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

---

## How the API key stays safe

Your Anthropic API key is stored in Vercel's **Environment Variables** (server-side only).  
When the app needs AI features, it calls `/api/claude` — a serverless function running on Vercel's servers — which adds the key and forwards the request to Anthropic.  
**The key never reaches anyone's browser.** ✅

---

## Troubleshooting

| Problem | Fix |
|---|---|
| AI features don't work | Check that `ANTHROPIC_API_KEY` is set in Vercel → Settings → Environment Variables, then redeploy |
| Page not found on refresh | Make sure `vercel.json` was uploaded |
| Build fails | Make sure all files were uploaded including `vite.config.js` and `package.json` |

---

## Cost

- **Vercel hosting:** Free (Hobby plan)
- **Anthropic API:** Pay per use — receipt scanning + chat costs roughly ₹0.10–₹0.50 per request, very cheap for personal use
