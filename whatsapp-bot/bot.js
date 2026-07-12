const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");

const configPath = path.join(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("Missing config.json. Copy config.example.json and fill it first.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const sessions = {};
const SESSION_TTL_MS = 15 * 60 * 1000;

function log(...args) {
  console.log(new Date().toISOString(), "-", ...args);
}

function resetSession(phone) {
  delete sessions[phone];
}

function getSession(phone) {
  const session = sessions[phone];
  if (session && session.expiresAt < Date.now()) {
    resetSession(phone);
    return null;
  }
  return session || null;
}

function botHeaders() {
  return { "X-Bot-Secret": config.botSecret };
}

async function getPendingMatches(phone) {
  const response = await axios.get(`${config.backendUrl}/api/bot/matches`, {
    headers: botHeaders(),
    params: { phone, league_id: config.leagueId || undefined },
  });
  return response.data;
}

function formatMatchList(matches) {
  return matches
    .map((match, index) => `${index + 1}. MJ${match.match_day}: ${match.home_player_name} (home) vs ${match.away_player_name} (away)`)
    .join("\n");
}

function parseScore(text) {
  const match = (text || "").trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return null;
  return { home: parseInt(match[1], 10), away: parseInt(match[2], 10) };
}

async function submitClaim({ phone, matchId, homeScore, awayScore, imageBuffer, filename, mimetype }) {
  const form = new FormData();
  form.append("phone", phone);
  form.append("match_id", matchId);
  form.append("home_score", String(homeScore));
  form.append("away_score", String(awayScore));
  form.append("screenshot", imageBuffer, { filename, contentType: mimetype });

  const response = await axios.post(`${config.backendUrl}/api/bot/claims`, form, {
    headers: { ...form.getHeaders(), ...botHeaders() },
  });
  return response.data;
}

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, "auth"));

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      log("Scan this QR code with WhatsApp (Linked devices):");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      log("Connection closed.", shouldReconnect ? "Reconnecting..." : "Logged out.");
      if (shouldReconnect) main();
    } else if (connection === "open") {
      log("WhatsApp bot connected");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;

        const jid = msg.key.remoteJid || "";
        if (!jid.endsWith("@g.us")) continue;

        const groupMeta = await sock.groupMetadata(jid);
        if (groupMeta.subject !== config.groupName) continue;

        const imageMsg = msg.message.imageMessage;
        const textOnly = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const caption = imageMsg ? imageMsg.caption || "" : "";
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const phone = senderJid.split("@")[0];
        const reply = (text) => sock.sendMessage(jid, { text });

        if (/^\/annuler\b/i.test(textOnly)) {
          resetSession(phone);
          await reply('Annule. Renvoie ta capture avec "/matche" pour recommencer.');
          continue;
        }

        if (imageMsg && /^\/matche?s?\b/i.test(caption)) {
          let matches;
          try {
            matches = await getPendingMatches(phone);
          } catch (err) {
            if (err.response?.status === 404) {
              await reply(`Ton numero WhatsApp n'est pas encore lie a ton compte. Va dans ton profil Arena et enregistre ce numero: ${phone}.`);
              continue;
            }
            throw err;
          }

          if (matches.length === 0) {
            await reply("Aucun match en attente pour toi.");
            continue;
          }

          const buffer = await downloadMediaMessage(msg, "buffer", {});
          const mimetype = imageMsg.mimetype || "image/jpeg";

          sessions[phone] = {
            step: "select_match",
            imageBuffer: buffer,
            mimetype,
            matches,
            expiresAt: Date.now() + SESSION_TTL_MS,
          };

          await reply(`Tes matchs en attente:\n${formatMatchList(matches)}\n\nReponds avec le numero du match.`);
          continue;
        }

        if (imageMsg) continue;

        const session = getSession(phone);
        if (!session) continue;

        if (session.step === "select_match") {
          const index = parseInt(textOnly.trim(), 10);
          if (!index || !session.matches[index - 1]) {
            await reply(`Numero invalide. Reponds avec un numero entre 1 et ${session.matches.length}.`);
            continue;
          }

          session.selectedMatch = session.matches[index - 1];
          session.step = "enter_score";
          session.expiresAt = Date.now() + SESSION_TTL_MS;

          await reply(
            `Match choisi: ${session.selectedMatch.home_player_name} (home) vs ${session.selectedMatch.away_player_name} (away)\nEnvoie le score, ex: "3-1" (gauche = home, droite = away).`
          );
          continue;
        }

        if (session.step === "enter_score") {
          const score = parseScore(textOnly);
          if (!score) {
            await reply('Format invalide. Envoie le score comme ceci: "3-1".');
            continue;
          }

          const match = session.selectedMatch;
          const ext = session.mimetype.includes("png") ? "png" : "jpg";
          const claim = await submitClaim({
            phone,
            matchId: match.id,
            homeScore: score.home,
            awayScore: score.away,
            imageBuffer: session.imageBuffer,
            filename: `claim_${phone}_${Date.now()}.${ext}`,
            mimetype: session.mimetype,
          });

          await reply(
            `Claim envoye: MJ${match.match_day} ${match.home_player_name} ${score.home}-${score.away} ${match.away_player_name}\nEn attente d'approbation admin.`
          );
          log("Claim created:", claim.id);
          resetSession(phone);
        }
      } catch (err) {
        const detail = err.response?.data?.detail || err.message;
        log("Message handling error:", detail);
        try {
          await sock.sendMessage(msg.key.remoteJid, { text: `Erreur: ${detail}` });
        } catch (_) {}
      }
    }
  });
}

main();