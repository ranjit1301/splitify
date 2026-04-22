# ✈️ Splitify — Real-Time Database Setup Guide

Everyone sees the same data live. No data loss. Works across all phones.

---

## What you need
- Your existing Vercel deployment (splitify-amber.vercel.app)
- A free Supabase account → supabase.com
- Your Anthropic API key (already set up)

---

## Step 1 — Create Supabase Project

1. Go to https://supabase.com → Sign Up (free)
2. Click "New Project"
3. Name: splitify, pick Singapore region, set a password
4. Click "Create new project" — wait 1 minute

---

## Step 2 — Run the Database Script

1. In Supabase → click "SQL Editor" in left sidebar
2. Click "New query"
3. Open supabase-setup.sql from this folder
4. Copy ALL the SQL → paste into editor
5. Click "Run" — should show "Success"

---

## Step 3 — Get your Supabase Keys

1. Supabase → Settings (gear icon) → API
2. Copy: Project URL (https://xxxxx.supabase.co)
3. Copy: anon/public key (starts with eyJ...)

---

## Step 4 — Add to Vercel

Go to vercel.com → splitify project → Settings → Environment Variables

Add these two:
  VITE_SUPABASE_URL        = your Project URL
  VITE_SUPABASE_ANON_KEY   = your anon key

Save each one.

---

## Step 5 — Upload new code to GitHub

1. Go to github.com → your splitify repo → src/ folder
2. Upload/replace App.jsx with the new one from this zip
3. Upload the new supabase.js file into src/ folder
4. Vercel will auto-redeploy in ~1 minute

---

## Done! Share with friends

Link: https://splitify-amber.vercel.app

Now when anyone adds an expense or member, everyone sees it instantly on their phone in real time. Data is stored in Supabase database — never lost.

---

## Free tier limits
- Supabase: 500MB, 50,000 rows, unlimited realtime — more than enough
- Vercel: free
- Anthropic AI: ~0.10-0.50 rupees per request
