const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// Set once with:
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_APP_PASSWORD   (a Gmail "app password", not your login password)
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
// The GitHub Pages URL this site is served from, e.g. https://giamat13.github.io/Kidlearn
const SITE_URL = defineString("SITE_URL", { default: "https://giamat13.github.io/Kidlearn" });

exports.sendFamilyMessage = onCall(
  { secrets: [GMAIL_USER, GMAIL_APP_PASSWORD] },
  async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid) throw new HttpsError("unauthenticated", "צריך להתחבר קודם");

    const { contactId, subject, body } = request.data || {};
    if (!contactId || !body) throw new HttpsError("invalid-argument", "חסר תוכן להודעה");

    const contactSnap = await db.collection("users").doc(uid).collection("contacts").doc(contactId).get();
    if (!contactSnap.exists) throw new HttpsError("not-found", "איש הקשר לא נמצא");
    const contact = contactSnap.data();

    const userSnap = await db.collection("users").doc(uid).get();
    const fromUsername = (userSnap.data() || {}).username || "ילד/ה מ-KidLearn";

    const messageRef = db.collection("messages").doc();
    await messageRef.set({
      fromUid: uid,
      fromUsername,
      toName: contact.name,
      toEmail: contact.email,
      subject: subject || "הודעה חדשה מ-KidLearn",
      body,
      replied: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const replyLink = `${SITE_URL.value()}/family-mail/reply.html?id=${messageRef.id}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() },
    });

    await transporter.sendMail({
      from: `KidLearn <${GMAIL_USER.value()}>`,
      to: contact.email,
      subject: subject || `הודעה חדשה מ-${fromUsername} ב-KidLearn`,
      text: `${body}\n\nלענות: ${replyLink}`,
      html: `<div dir="rtl" style="font-family:sans-serif;font-size:16px;line-height:1.6">
        <p>${String(body).replace(/\n/g, "<br>")}</p>
        <p><a href="${replyLink}" style="display:inline-block;padding:10px 20px;background:#FF6B9D;color:#fff;border-radius:8px;text-decoration:none">לענות ל-${fromUsername}</a></p>
      </div>`,
    });

    return { messageId: messageRef.id };
  }
);
