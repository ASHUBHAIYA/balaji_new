# ☁️ Deploying Shree Balaji Associates to Cloudflare Pages / Workers + D1

This project is now **100% Cloudflare Pages, Cloudflare Workers & Cloudflare D1 (SQLite) ready** with zero external native C++ dependencies and full multi-financial year support.

---

## 🚀 Quick Step-by-Step Deployment (Under 3 Minutes)

### Step 1: Install Wrangler & Log In
If you don't have the Cloudflare CLI installed:
```bash
npm install -g wrangler
wrangler login
```

---

### Step 2: Create Your Cloudflare D1 SQLite Database
Run the following command in your terminal:
```bash
wrangler d1 create balaji-tracker-d1
```
This command will output your `database_id`, for example:
```
[[d1_databases]]
binding = "DB"
database_name = "balaji-tracker-d1"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

### Step 3: Update `wrangler.toml` with your Database ID
Open `wrangler.toml` and paste your `database_id`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "balaji-tracker-d1"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

### Step 4: Initialize the Database Schema
Run:
```bash
wrangler d1 execute balaji-tracker-d1 --file=./schema.sql
```
*(Or use `npm run d1:init`)*

---

### Step 5 (Optional): Migrate Your Existing Data
To export your current local transactions, users, and ledgers into D1:
1. Run `npm run d1:seed` or click **"⚡ Download Cloudflare D1 SQL Dump"** in the app's **🗄️ Backup & Restore** modal.
2. Execute the generated SQL file into your live D1 database:
```bash
wrangler d1 execute balaji-tracker-d1 --file=./d1_seed.sql
```

---

### Step 6: Deploy to Cloudflare

#### Option A: Deploy to Cloudflare Pages (Recommended)
```bash
npm run deploy:pages
```
Or connect your GitHub repository to Cloudflare Pages:
- **Build command:** `npm run build`
- **Build output directory:** `.`
- **D1 Binding:** In Cloudflare Dashboard -> Pages -> Settings -> Functions -> D1 Database Bindings -> Variable name: `DB` -> select `balaji-tracker-d1`.

#### Option B: Deploy to Cloudflare Workers
```bash
npm run deploy:worker
```

---

## 🔑 Default Login Credentials
- **Administrator:** `admin` / `12346`
- **Data Operator:** `user` / `1234`
