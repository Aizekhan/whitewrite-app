# WhiteWrite Deployment Guide

## ✅ Current Status

**Live URL:** https://whitewrite-app.web.app

**Deployment:** Firebase Hosting
- Project: `whitewrite-app`
- Region: Auto (CDN worldwide)
- Build: 165.5 kB bundle, 28 files

---

## 🌐 Connect Custom Domain (whitewrite.com)

### Step 1: Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/whitewrite-app/hosting)
2. Click **Hosting** in left menu
3. Click **Add custom domain**
4. Enter: `whitewrite.com`
5. Click **Continue**

### Step 2: Verify Ownership

Firebase will ask you to verify ownership via TXT record:

1. Copy the TXT record value shown (e.g., `google-site-verification=XXXX...`)
2. Go to your domain registrar (GoDaddy/Namecheap/Cloudflare/etc.)
3. Add DNS TXT record:
   - **Type:** TXT
   - **Name:** `@` or blank
   - **Value:** paste the verification code
4. Wait 5-15 minutes, then click **Verify** in Firebase

### Step 3: Point Domain to Firebase

After verification, Firebase will show you DNS records to add:

**Option A: A Records (recommended)**
Add these A records at your registrar:
```
Type: A
Name: @
Value: 151.101.1.195

Type: A
Name: @
Value: 151.101.65.195
```

**Option B: CNAME (if A records not supported)**
```
Type: CNAME
Name: whitewrite.com
Value: whitewrite-app.web.app
```

### Step 4: Add `www` subdomain (optional)

Also add for `www.whitewrite.com`:
```
Type: CNAME
Name: www
Value: whitewrite-app.web.app
```

### Step 5: Wait for Propagation

- DNS changes take 1-24 hours to propagate
- Firebase auto-provisions SSL certificate (Let's Encrypt)
- Your site will be live at https://whitewrite.com

---

## 🔄 Future Deployments

To deploy updates:

```bash
npm run build
firebase deploy --only hosting
```

Or deploy everything (hosting + firestore rules):
```bash
npm run build
firebase deploy
```

---

## 📊 Monitoring

- **Firebase Console:** https://console.firebase.google.com/project/whitewrite-app
- **Hosting Dashboard:** See traffic, bandwidth, errors
- **Performance:** Enable Firebase Performance Monitoring (optional)

---

## 🚀 Production Checklist

- ✅ Vite + React + TypeScript
- ✅ Firebase Auth + Firestore
- ✅ Canon types + deriveMemory
- ✅ Landing page (1:1 from prototype)
- ✅ Firebase Hosting deployed
- ⏳ Custom domain whitewrite.com (waiting for DNS)

---

## 🔐 Environment Variables

For production API keys (when needed):

1. Create `.env.production`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   ```
2. Update `src/firebase/config.ts` to use `import.meta.env.VITE_*`
3. Add `.env.production` to `.gitignore`

Currently using hardcoded config (okay for public Firebase web keys).

---

## 📝 Next Steps

1. **Connect whitewrite.com** (follow steps above)
2. **Build Projects page** (CRUD for projects)
3. **Add Auth UI** (login/signup modals)
4. **Implement Guided Mode** (Scene Intent → AI generation)
5. **Build Книга/Всесвіт/Режисер** views (three pillars)

---

**Greenfield complete!** 🎉
Фундамент готовий. Canon-aware система на місці.
