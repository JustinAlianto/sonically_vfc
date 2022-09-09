const functions = require("firebase-functions");
const express = require("express");
const fetch = require("node-fetch");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const realtime = admin.database();
const app = express();

app.get("/", async (req, res) => {
  const snapshot = await db.collection('users').get();

  let users = [];

  snapshot.forEach(doc => {
    let id = doc.id;
    let data = doc.data();

    users.push({ id, ...data });
  })

  res.status(200).send(JSON.stringify(users));
})

app.get("/:id", async (req, res) => {
  const snapshot = await db.collection('users').doc(req.params.id).get();

  const userId = snapshot.id;
  const userData = snapshot.data();

  res.status(200).send(JSON.stringify({ id: userId, ...userData }));
})

app.post("/", async (req, res) => {
  const user = req.body;

  await db.collection('users').add(user);

  res.status(201).send();
})

app.get("/:id/:tokenType/:accessToken", async (req, res) => {
  const tokenType = req.params.tokenType;
  const accessToken = req.params.accessToken;

  fetch('https://discord.com/api/users/@me', {
    headers: {
      authorization: `${tokenType} ${accessToken}`,
    },
  })
    .then(result => result.json())
    .then(async (response) => {
      // Get the user's Discord basic information
      const { username, email, id } = response;

      const dt = new Date();

      // Adds the discord information to Sonically database
      const docRef = db.collection('users').doc(req.params.id);
      const docSnap = await docRef.get();

      if (typeof docSnap.data().discordID !== 'undefined') {
        await docRef.update({
          discordUsername: username,
          discordEmail: email,
          discordID: id,
          last_login: dt
        });
      } else {
        await docRef.set({
          discordUsername: username,
          discordEmail: email,
          discordID: id,
          last_login: dt
        }, { merge: true });
      }

      const realtimeRef = realtime.ref("discordSignUp/" + req.params.id);

      realtimeRef.set({
        discordUsername: username,
        discordEmail: email,
        discordID: id,
      });
    })
    .catch(console.error);

  const snapshot = await db.collection('users').doc(req.params.id).get();

  const userId = snapshot.id;
  const userData = snapshot.data();

  // res.status(200).send(JSON.stringify(accessToken));
  res.status(200).send(JSON.stringify({ id: userId, ...userData }));
})

app.delete("/:id", async (req, res) => {
  await db.collection('users').doc(req.params.id).delete();

  res.status(200).send();
})

exports.user = functions.https.onRequest(app);
