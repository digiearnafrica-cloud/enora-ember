# 🖤✨ ENORA EMBER — Shop Web App

**Elegant · Luxurious · Timeless**

A full-featured online shop for Enora Ember with:
- Real-time product catalog viewable from any device
- WhatsApp-based ordering for customers
- Secure admin login from any phone or computer
- Cloud image storage for product photos
- Free hosting on Netlify with your Namecheap domain

---

## 📦 Tech Stack

| Layer       | Service         | Cost   |
|-------------|-----------------|--------|
| Frontend    | React + Vite    | Free   |
| Hosting     | Netlify         | Free   |
| Database    | Firebase Firestore | Free (Spark plan) |
| Image Storage | Firebase Storage | Free (5 GB) |
| Auth        | Firebase Auth   | Free   |
| Domain      | Namecheap       | ~$10/yr |

---

## 🚀 SETUP GUIDE (Step by Step)

### STEP 1 — Create a Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Name it: `enora-ember`
4. Disable Google Analytics (not needed) → Click **"Create project"**

---

### STEP 2 — Enable Firestore Database

1. In your Firebase project, click **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Select **"Start in production mode"** → Click **Next**
4. Choose a location (e.g., `europe-west1`) → Click **Enable**
5. Go to the **"Rules"** tab and paste this, then click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null;
    }
  }
}
```

---

### STEP 3 — Enable Firebase Storage

1. Click **"Storage"** in the left sidebar
2. Click **"Get started"**
3. Select **"Start in production mode"** → Click **Next** → **Done**
4. Go to the **"Rules"** tab and paste this, then click **Publish**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{imageFile} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

### STEP 4 — Enable Email/Password Authentication

1. Click **"Authentication"** in the left sidebar
2. Click **"Get started"**
3. Click **"Email/Password"** → Toggle it **ON** → Click **Save**
4. Go to the **"Users"** tab → Click **"Add user"**
5. Enter YOUR email and a strong password (this is the admin login for the shop)
6. Click **"Add user"** — save these credentials somewhere safe!

---

### STEP 5 — Get Your Firebase Config Keys

1. Click the **gear icon** (⚙️) next to "Project Overview" → **Project settings**
2. Scroll down to **"Your apps"** → Click the **Web icon** (`</>`)
3. Register app name: `enora-ember-web` → Click **"Register app"**
4. Copy the config values — you'll need them in Step 7

---

### STEP 6 — Deploy to Netlify

1. Go to **https://app.netlify.com** → Sign up for free
2. Click **"Add new site"** → **"Deploy manually"**
3. Zip the entire `enora-ember` folder on your computer
4. Drag and drop the zip onto the Netlify deploy page
5. Your site will be live at a random URL like `amazing-ember-123.netlify.app`

**OR (better — auto-deploy from GitHub):**
1. Push this folder to a GitHub repository
2. In Netlify: "Add new site" → "Import from Git" → Connect GitHub → Select repo
3. Build command: `npm run build` | Publish directory: `dist`

---

### STEP 7 — Add Environment Variables in Netlify

1. In Netlify, go to **Site settings → Environment variables**
2. Click **"Add a variable"** for each of the following:

| Variable Name                    | Value (from Firebase config)     |
|----------------------------------|----------------------------------|
| `VITE_FB_API_KEY`                | Your `apiKey` value              |
| `VITE_FB_AUTH_DOMAIN`            | Your `authDomain` value          |
| `VITE_FB_PROJECT_ID`             | Your `projectId` value           |
| `VITE_FB_STORAGE_BUCKET`         | Your `storageBucket` value       |
| `VITE_FB_MESSAGING_SENDER_ID`    | Your `messagingSenderId` value   |
| `VITE_FB_APP_ID`                 | Your `appId` value               |

3. After adding all 6 variables → **Trigger a new deploy** (Deploys tab → "Trigger deploy")

---

### STEP 8 — Connect Your Namecheap Domain

**In Netlify:**
1. Go to **Domain management** → Click **"Add a domain"**
2. Enter your domain (e.g., `enoraember.com`) → Click **Verify**
3. Netlify will show you DNS records to add

**In Namecheap:**
1. Log in → Go to **Domain List** → Click **Manage** next to your domain
2. Go to **Advanced DNS**
3. Delete any existing A records and CNAME records for `@` and `www`
4. Add these records from Netlify:
   - **A Record** → Host: `@` → Value: Netlify's IP (e.g., `75.2.60.5`)
   - **CNAME Record** → Host: `www` → Value: your Netlify subdomain (e.g., `amazing-ember-123.netlify.app`)
5. Save → Wait up to 24 hours for DNS to propagate (usually < 1 hour)

---

## 👩‍💼 HOW TO USE AS ADMIN

1. Open your shop website
2. Scroll to the bottom of the page
3. Tap **"Admin"** (small text in the footer)
4. Sign in with the email + password you created in Step 4
5. You can now:
   - ➕ Add new products with photos, descriptions, and prices
   - ✏️ Edit any existing product
   - 🗑️ Delete products
   - 🖼️ Upload product photos from your phone or computer
   - All changes appear **instantly** for all customers!

---

## 🛍️ HOW CUSTOMERS ORDER

1. Customer opens your website on their phone
2. Browses products, taps **"Add to Cart"** on items they want
3. Taps the cart 🛍️ button at the top
4. Reviews their order, enters their delivery address
5. Taps **"Send Order via WhatsApp"**
6. Gets redirected to WhatsApp with a pre-filled message sent to your number

---

## 🔧 LOCAL DEVELOPMENT (for developers)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file and fill in your Firebase keys
cp .env.example .env

# 3. Start development server
npm run dev

# 4. Build for production
npm run build
```

---

## 📞 Support

WhatsApp: +233 24 559 4900
Website: www.enoraember.com
Social: @ENORA EMBER
