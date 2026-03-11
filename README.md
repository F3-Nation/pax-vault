# 🧠📊 PAX Vault

**PAX Vault** is a data platform and analytics application built to help F3 regions, AOs, and leaders better understand participation, leadership, and engagement over time—without guesswork, spreadsheets, or folklore.

> **Data clarity for F3 leadership. Less guesswork. More signal.**

This is not a social network.  
This is not a leaderboard gimmick.  
This is an observability system for the F3 ecosystem.

---

## ❓ Why PAX Vault Exists

F3 generates a significant amount of data:

- 📍 Who shows up
- 📍 Where they post
- 📍 Who leads
- 📍 How often
- 📍 How regions grow, stall, or drift

Historically, that data lived in scattered places:

- 🗂️ CSV exports
- 🗂️ Google Sheets
- 🗂️ Manual tallies
- 🗂️ Memory and anecdotes (the least reliable database)

PAX Vault exists to answer real questions with **real data**, consistently and transparently.

Examples:

- Are we actually growing, or just reshuffling attendance?
- Who is carrying leadership load—and who isn’t?
- Which AOs are thriving, stagnating, or quietly dying?
- Are new PAX sticking around past their first few weeks?
- Are we burning out the same leaders over and over?

If you can’t measure it, you can’t lead it.

---

## 🧭 Core Principles

### 📈 Data over vibes

Stories matter—but leadership decisions should be grounded in reality.  
PAX Vault prioritizes verifiable data, repeatable queries, and auditable logic.

### 🌎 Region-first, Nation-aware

Most leadership decisions are regional.  
PAX don’t live in silos—travel, posts, and Qs cross boundaries.

PAX Vault intentionally supports:

- Region-scoped metrics
- Cross-region (“Nation”) rollups
- Side-by-side comparisons

### 🔒 Read-only truth

PAX Vault does **not** mutate source data.  
It reflects what happened, not what we wish happened.

No scorekeeping edits.  
No “cleaning up” awkward numbers.  
Reality, warts and all.

### 💸 Cost-conscious by design

BigQuery isn’t free, and waste scales fast.

The system is designed to:

- Minimize redundant scans
- Reuse shared datasets
- Avoid “query-per-card” anti-patterns
- Trade latency for sustainability where it makes sense

Efficiency is a feature, not an afterthought.

---

## ⚖️ What PAX Vault Is (and Is Not)

### It **is**:

- ✅ An analytics and reporting layer on top of F3 data
- ✅ A leadership decision-support tool
- ✅ A historical record of participation and leadership
- ✅ A platform for asking better questions

### It **is not**:

- 🚫 A judgment engine
- 🚫 A replacement for local leadership
- 🚫 A recruiting scoreboard
- 🚫 A surveillance tool

Numbers inform conversations—they don’t replace them.

---

## 🧩 Key Concepts

### 📅 Events

Posts at an AO on a given date, including attendance and Q data.

### 🧑‍🤝‍🧑 PAX

Individuals, tracked over time across regions and AOs.

### 🏋️ Leadership Metrics

Posts, Qs, streaks, frequency, and load distribution—both regionally and nationally.

### 🎛️ Filters Matter

Almost every metric can be sliced by:

- Date ranges
- Region
- AO
- Status (active, drifting, new, etc.)

If a number doesn’t respect filters, it’s lying.

---

## 🏗️ Architecture (High-Level)

- Frontend: Next.js (App Router)
- Backend: Server-side APIs and data fetching
- Data Store: Google BigQuery
- Authentication: Firebase (email-based)
- Hosting: Cloud-native, stateless, scalable

The system favors:

- Server-side computation
- Parameterized queries
- Explicit data flows
- Fewer “magic” abstractions

Boring architecture is reliable architecture.

---

## 👥 Who This Is For

- Regional leadership teams
- Weasel Shakers and Site Qs
- Data-curious PAX
- Developers who want to contribute responsibly
- Anyone tired of arguing from anecdotes

---

> “I _feel_ like attendance is down…”

---

## 🚧 Status

PAX Vault is an evolving system.  
Expect iteration, refactors, opinionated decisions, and continuous improvement.

Stability matters—but stagnation kills usefulness.

---

## 🧠 Final Thought

PAX Vault doesn’t tell you **what to do**.  
It tells you **what is happening**.

Leadership still requires wisdom, context, and courage.  
This just removes the fog.

📡 **PAX Vault removes the fog so leaders can do the hard human work—better informed.**

# Setting up a development environment

1. Clone the repo
2. Install dependencies

```bash
npm install
```

1. Run the app

```bash
npm run dev
```

> You will be asked to accept a self-signed certificate so the app can run as https locally. Accept.
> Logs will show you a URL you can connect to to see the app. Should be https://localhost:3001