<div align="center">
   <img src="public/collect-ag-mark.svg" alt="COLLECT-AG" width="80" />
   <h1>COLLECT-AG</h1>
  <p><strong>Free, open-source fee management for tutors, coaching centres, and small businesses.</strong></p>
  <p>Your data lives in your Google Drive. No servers. No subscriptions. No ads.</p>
   <p>DEVELOPED BY PRIME</p>
  <a href="https://primeag1.github.io/COLLECT-AG/">Live app →</a>
</div>

---

## What is COLLECT-AG?

COLLECT-AG is a web app that helps tutors, coaching centres, gyms, and any small business that collects recurring fees from members or students.

You can:
- Build a **custom student/member database** with the fields you need
- Organise members into **batches or groups**
- **Record payments** and generate **PDF receipts** instantly
- Send **WhatsApp reminders** for outstanding dues
- See a **dashboard** of your collections at a glance
- Export reports to **CSV**

Everything runs in your browser. Your data is stored in a folder called `COLLECT-AG` inside **your own Google Drive** — we never see it, store it, or have access to it. The first sync after upgrading renames the existing app data folder in place, preserving your files.

---

## Key features

| Feature | Details |
|---|---|
| 🧑‍🎓 Custom member fields | Dates, amounts, phone numbers, WhatsApp numbers, membership expiry, and more — all configurable |
| 🗂️ Groups & batches | Group members by batch, class, subject, or any label you define |
| 💸 Fast payment entry | Search member → enter amount → save → receipt generated |
| 🧾 PDF receipts | Generated in your browser, saved to your Drive, shareable via WhatsApp |
| 📲 WhatsApp reminders | Pre-filled message templates with outstanding dues, sent directly to member's WhatsApp |
| 📊 Dashboard | Monthly collections, payment mode breakdown, batch-wise summary |
| ⚙️ Full customisation | Fields, receipt layout, fee frequency, tax rates, business branding — all in Settings |
| 🔒 Your data, your Drive | Uses `drive.file` scope — only files COLLECT-AG creates |
| 📱 PWA | Install on Android or iPhone, works offline |
| 🆓 Free & open source | MIT licence. No ads. No tracking. Fork it, self-host it, change it. |

---

## How to use it

1. **Go to [primeag1.github.io/COLLECT-AG](https://primeag1.github.io/COLLECT-AG/)**
2. Click **Continue with Google** — sign in with any Google account
3. Complete the **one-time setup wizard**:
   - Enter your business name, logo, address, GSTIN
   - Configure the fields you want to collect for your members
   - Set up receipt numbering and layout
4. **Add members** — fill in their details using your configured fields
5. **Receive a payment** — search the member, enter amount, select mode, save
6. **Share the receipt** — download PDF or share via WhatsApp instantly

That's it. All data syncs to your Google Drive automatically.

---

## Settings you can configure

- **Business profile** — name, logo, address, GSTIN, tax rates
- **Member fields** — add/remove/rename fields; supported types: text, number, phone, WhatsApp number, date, amount, email, dropdown, multi-select, yes/no, URL
- **Groups & batches** — create custom groups; assign members
- **Fee frequency** — monthly, quarterly, half-yearly, annually, one-time, custom instalments
- **Due dates** — set collection due dates per member or per batch
- **Payment modes** — Cash, UPI, Bank Transfer, Card, Cheque, Other (configurable)
- **Receipt layout** — choose which fields appear on receipts, add footer/terms/signature
- **Receipt numbering** — set prefix, year, month, series number format
- **WhatsApp message template** — define your reminder message; COLLECT-AG fills in the member name and outstanding amount automatically

---

## For developers — self-hosting or forking

### Requirements
- A Google Cloud project with the **Google Drive API** enabled
- An **OAuth 2.0 Client ID** (Web application type)
- A GitHub account (for Pages hosting) or any static hosting

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/primeag1/COLLECT-AG.git
cd COLLECT-AG

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and add your VITE_GOOGLE_CLIENT_ID

# 4. Run locally
npm run dev

# 5. Build for production
npm run build
```

### Google Cloud setup (5 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **Google Drive API**
3. APIs & Services → OAuth consent screen → External → fill in app name + email
4. APIs & Services → Credentials → Create OAuth Client ID → Web application
5. Add authorised origins:
   - `http://localhost:5173` (local dev)
   - `https://primeag1.github.io` (production)
6. Add the authorised redirect URI `https://primeag1.github.io/COLLECT-AG/` for the installed-PWA sign-in flow.
7. Copy the Client ID → paste into `.env.local` as `VITE_GOOGLE_CLIENT_ID`

### Deploying to GitHub Pages

1. In Google Cloud Console, open **APIs & Services → Credentials** and create or select an OAuth 2.0 Client ID with application type **Web application**.
2. Add the deployed site's origin to **Authorised JavaScript origins**:
   - `https://primeag1.github.io` for this repository's published app.
3. Add `https://primeag1.github.io/COLLECT-AG/` to **Authorised redirect URIs** for the installed-PWA sign-in flow, then save.
4. Copy the OAuth **Client ID** (it ends in `.apps.googleusercontent.com`).
5. In your GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**.
6. Set the secret name to exactly `VITE_GOOGLE_CLIENT_ID`, paste the Client ID as its value, and save. Add it as a **repository secret** so the build job can read it; a secret scoped only to the `github-pages` environment is not available to the build job.
7. Open **Actions → Deploy to GitHub Pages → Run workflow** and deploy from `main` (or push a commit to `main`). The workflow now stops with a clear error if the Client ID is missing, rather than deploying a broken sign-in page.
8. When the deployment finishes successfully, reload `https://primeag1.github.io/COLLECT-AG/`. If Google rejects sign-in, confirm that the authorized origin and redirect URI above exactly match the deployed URL.

The app will be live at `https://primeag1.github.io/COLLECT-AG/`

---

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Local storage**: IndexedDB (via Dexie) — fast local queries
- **Cloud storage**: User's Google Drive (`drive.file` scope only)
- **PDF generation**: Browser-native (no third-party PDF service)
- **Auth**: Google Identity Services (no passwords stored)
- **Hosting**: GitHub Pages (static, no server required)
- **Backend**: None

Data flow:
```
Browser (IndexedDB)  ←→  Google Drive (user's own)
         ↑
      React UI
```

---

## Licence

MIT — free to use, fork, modify, and distribute. No attribution required, but appreciated.

---

## Contributing

Pull requests welcome. Please open an issue first for significant changes.
