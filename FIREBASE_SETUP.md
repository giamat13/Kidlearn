# Firebase + EmailJS setup for KidLearn accounts + family-mail

No Cloud Functions, no Blaze plan needed — everything runs on Firebase's free
Spark plan plus EmailJS's free tier (200 emails/month, sent from your own Gmail).

## 1. Firebase project (done)
`shared/kidlearn-firebase-config.js` is already filled in.

## 2. Enable Auth (done if you finished step 2)
Authentication → Sign-in method → **Email/Password** enabled.

## 3. Create Firestore + publish the rules
1. Firebase console → Build → Firestore Database → **Create database** → production mode → pick a region (e.g. `eur3` or `europe-west1`).
2. Firestore Database → **Rules** tab → paste in the entire contents of this repo's `firestore.rules` → **Publish**.
   (No CLI needed for this — if you'd rather use the CLI: `npm install -g firebase-tools && firebase login && firebase use --add && firebase deploy --only firestore:rules`.)

The "Missing or insufficient permissions" error you're seeing happens because there's no Firestore database yet / no rules published yet — this step fixes it.

## 4. EmailJS (replaces the Gmail/Cloud Function step - no Blaze required)
1. Sign up free at https://www.emailjs.com
2. Email Services → Add New Service → **Gmail** → connect the Gmail account that should send the letters (yours or a dedicated one) → note the **Service ID**.
3. Email Templates → Create New Template. Use these variables in the template (map them into subject/body however you like):
   `{{to_email}}`, `{{to_name}}`, `{{from_username}}`, `{{subject}}`, `{{message}}`, `{{reply_link}}`
   Example body:
   ```
   הודעה מ-{{from_username}} דרך KidLearn:

   {{message}}

   לענות: {{reply_link}}
   ```
   Set the template's "To email" field to `{{to_email}}`. Note the **Template ID**.
4. Account → General → copy the **Public Key**.
5. Paste all three into `shared/kidlearn-emailjs-config.js`.

## 5. Done
Push to GitHub Pages. Kids create a KidLearn account (username + password, no
email needed) via the "התחברות" button, then use "מכתב למשפחה" to add family
contacts and send them real emails with a reply link back to a Firestore-backed
reply page.

Nothing secret lives in the repo — the Firebase config and EmailJS public key
are both meant to be public (EmailJS enforces its own sending limits/allowed
domains server-side); Firestore rules are the actual access control.
