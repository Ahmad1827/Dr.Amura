require("dotenv").config();
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const nodemailer = require("nodemailer");

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripePublishable = process.env.STRIPE_PUBLISHABLE_KEY;
const stripe = require("stripe")(stripeSecret);

if (!admin.apps.length) {
  admin.initializeApp();
}

const mailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

exports.createPaymentIntent = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { caseId, amount, serviceType, parentEmail, childAge } = req.body;

      if (!stripeSecret) {
        return res.status(500).send({ error: "STRIPE_SECRET_KEY lipsă pe server." });
      }

      if (!caseId || !amount) {
        return res.status(400).send({ error: "Parametri lipsă (caseId, amount)." });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "ron",
        metadata: {
          caseId,
          serviceType: serviceType || "analize",
          parentEmail: parentEmail || "necunoscut",
          childAge: childAge || "necunoscut"
        }
      });

      return res.status(200).send({
        clientSecret: paymentIntent.client_secret,
        publishableKey: stripePublishable,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      return res.status(500).send({ error: error.message });
    }
  });
});

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const event = req.body;
  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const caseId = pi.metadata?.caseId;

      if (caseId) {
        const caseRef = admin.firestore().collection("consultations").doc(caseId);
        const caseSnap = await caseRef.get();
        const caseData = caseSnap.data() || {};

        await caseRef.update({
          status: "platit",
          isPaid: true,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentIntentId: pi.id
        });

        const profileSnap = await admin.firestore().collection("settings").doc("doctor_profile").get();
        const doctorEmail = profileSnap.exists && profileSnap.data()?.notificationEmail
          ? profileSnap.data().notificationEmail
          : "ahmadarnaoute1896@gmail.com";

        if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
          await mailTransport.sendMail({
            from: `"Dr. Bubbles Platform" <${process.env.GMAIL_USER}>`,
            to: doctorEmail,
            subject: `[Dr. Bubbles] Dosar nou achitat: ${caseData.contact || pi.metadata?.parentEmail}`,
            html: `
              <h2>Dosar nou confirmat și plătit</h2>
              <p><b>Serviciu:</b> ${caseData.serviceType || pi.metadata?.serviceType}</p>
              <p><b>Părinte:</b> ${caseData.contact || pi.metadata?.parentEmail}</p>
              <p><b>Vârstă copil:</b> ${caseData.childAge || pi.metadata?.childAge} | <b>Greutate:</b> ${caseData.childWeight || "Nespecificată"}</p>
              <p><b>Simptome / Notă:</b> ${caseData.symptoms || "Fără detalii"}</p>
              ${caseData.fileUrl ? `<p><b>Document atașat:</b> <a href="${caseData.fileUrl}">${caseData.fileName || "Vezi fișier"}</a></p>` : ""}
              <p><b>Suma achitată:</b> ${pi.amount / 100} RON</p>
            `
          });
        }
      }
    }
  } catch (error) {
    console.error("Webhook error:", error);
  }
  res.status(200).send("OK");
});

exports.sendDoctorEmailNotification = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { caseId, doctorEmail, caseDetails } = req.body;
      const targetEmail = doctorEmail || "ahmadarnaoute1896@gmail.com";

      if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        return res.status(200).send({ warning: "Configurația de e-mail nu este setată în functions/.env." });
      }

      await mailTransport.sendMail({
        from: `"Dr. Bubbles" <${process.env.GMAIL_USER}>`,
        to: targetEmail,
        subject: `[Dr. Bubbles] Dosar medical nou de la ${caseDetails.contact}`,
        html: `
          <h3>Dosar nou recepționat</h3>
          <p><b>Serviciu solicitat:</b> ${caseDetails.serviceType}</p>
          <p><b>Email părinte:</b> ${caseDetails.contact}</p>
          <p><b>Vârstă copil:</b> ${caseDetails.childAge}</p>
          <p><b>Greutate:</b> ${caseDetails.childWeight || "Nespecificată"}</p>
          <p><b>Mesaj / Simptome:</b> ${caseDetails.symptoms}</p>
          ${caseDetails.fileUrl ? `<p><a href="${caseDetails.fileUrl}">Descarcă documentul atașat (${caseDetails.fileName})</a></p>` : ""}
          <p><b>Sumă:</b> ${caseDetails.price} RON</p>
        `
      });

      return res.status(200).send({ success: true });
    } catch (err) {
      return res.status(500).send({ error: err.message });
    }
  });
});