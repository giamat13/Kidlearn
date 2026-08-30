# Firebase setup for KidLearn accounts + family-mail

Manual, one-time setup — none of this can be done from the repo itself.

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com → Add project → name it (e.g. `kidlearn`).
2. Google Analytics: keep it enabled during creation (this gives you Analytics for free).
3. Project settings → General → "Your apps" → Add app → Web (`</>`). Register it (no hosting needed, you use GitHub Pages).
4. Copy the `firebaseConfig` object it shows you into `shared/kidlearn-firebase-config.js`, replacing the `PASTE_ME` placeholders. These values are public and safe to commit.

## 2. Enable Auth + Firestore
1. Build → Authentication → Get started → Sign-in method → enable **Email/Password**.
2. Build → Firestore Database → Create database → start in production mode, pick a region.
3. Deploy the security rules from this repo:
   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick your project
   firebase deploy --only firestore:rules
   ```

## 3. Gmail app password (for sending the family emails)
1. On the Gmail account that should send the mail, turn on 2-Step Verification: https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords → app "Mail" → generate. Copy the 16-character password.

## 4. Deploy the Cloud Function
Requires the **Blaze (pay-as-you-go)** plan — Cloud Functions don't run on the free Spark plan. Gmail SMTP sending itself is free; Blaze only means you pay if you exceed the generous free tier (essentially $0 for family-scale usage).

```
firebase functions:secrets:set GMAIL_USER            # paste the sending Gmail address
firebase functions:secrets:set GMAIL_APP_PASSWORD    # paste the 16-char app password from step 3
cd functions && npm install && cd ..
firebase deploy --only functions
```

If your GitHub Pages URL isn't `https://giamat13.github.io/Kidlearn`, set it explicitly so reply links in emails point to the right place:
```
firebase deploy --only functions --set-params SITE_URL="https://your-actual-url"
```

## 5. Done
Push to GitHub Pages as usual. Any kid can now tap "התחברות" to create a KidLearn account (username + password, no email needed), and use "מכתב למשפחה" to add family contacts and send them real emails with a reply link.

Nothing secret lives in the repo: `shared/kidlearn-firebase-config.js` holds only public identifiers, and the Gmail password lives only in Firebase's secret manager (set via the CLI command above, never committed).
