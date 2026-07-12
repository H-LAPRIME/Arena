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
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const { exec } = require("child_process");

const configPath = path.join(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("Missing config.json. Copy config.example.json and fill it first.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const sessions = {};
const SESSION_TTL_MS = 15 * 60 * 1000;
const botSentMessageIds = new Set(); // IDs des messages envoyes PAR le bot (pour ne pas les re-traiter)

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
  const url = `${config.backendUrl}/api/bot/matches`;
  const params = { phone, league_id: config.leagueId || undefined };
  log(`DEBUG - appel GET ${url} params=${JSON.stringify(params)}`);
  const response = await axios.get(url, {
    headers: botHeaders(),
    params,
  });
  return response.data;
}

function formatMatchList(matches) {
  return matches
    .map((match, index) => `*${index + 1}.* 🗓️ MJ${match.match_day} — *${match.home_player_name}* 🏠 vs *${match.away_player_name}* ✈️`)
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
      log("QR recu. Ouverture de l'image qr.png...");
      const qrPath = path.join(__dirname, "qr.png");
      QRCode.toFile(qrPath, qr, { width: 500 }, (err) => {
        if (err) {
          log("Impossible de generer qr.png, affichage ASCII en secours:", err.message);
          qrcodeTerminal.generate(qr, { small: true });
          return;
        }
        log(`QR sauvegarde: ${qrPath} — ouverture automatique...`);
        // Ouvre l'image avec la visionneuse par defaut (Windows/Mac/Linux)
        const opener = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
        exec(`${opener} "${qrPath}"`, { shell: true }, () => {});
      });
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
        if (!msg.message) continue;

        // On ignore uniquement les messages que LE BOT lui-meme a envoyes
        // (ses propres reponses automatiques), pas ceux tapes a la main
        // depuis ce meme compte (l'admin peut donc utiliser /matche aussi).
        if (msg.key.fromMe && botSentMessageIds.has(msg.key.id)) {
          botSentMessageIds.delete(msg.key.id);
          continue;
        }

        log(`DEBUG - message recu, fromMe: ${msg.key.fromMe}, jid: ${msg.key.remoteJid}`);

        const jid = msg.key.remoteJid || "";
        if (!jid.endsWith("@g.us")) continue;

        const groupMeta = await sock.groupMetadata(jid);
        log(`DEBUG - groupe "${groupMeta.subject}" (attendu: "${config.groupName}")`);
        if (groupMeta.subject !== config.groupName) continue;

        const imageMsg = msg.message.imageMessage;
        const textOnly = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const caption = imageMsg ? imageMsg.caption || "" : "";
        // Si le message vient de toi-meme (fromMe), on utilise ton numero
        // configure dans config.json (plus fiable que sock.user.id, qui
        // peut renvoyer un LID technique au lieu du vrai numero).
        const senderJid = msg.key.fromMe
          ? null
          : (msg.key.participant || msg.key.remoteJid);
        let phone = msg.key.fromMe
          ? (config.adminPhone || "").replace(/\D/g, "")
          : senderJid.split("@")[0].split(":")[0];

        // WhatsApp masque parfois le vrai numero derriere un LID (identifiant
        // technique interne). Si on a une correspondance connue dans
        // config.json ("lidMap"), on la resout vers le vrai numero.
        if (config.lidMap && config.lidMap[phone]) {
          log(`DEBUG - LID ${phone} resolu vers ${config.lidMap[phone]} via lidMap`);
          phone = config.lidMap[phone];
        }

        if (msg.key.fromMe && !phone) {
          log("DEBUG - message de toi-meme mais 'adminPhone' n'est pas defini dans config.json, ignore.");
          continue;
        }

        const reply = async (text) => {
          const sent = await sock.sendMessage(jid, { text });
          if (sent?.key?.id) botSentMessageIds.add(sent.key.id);
        };

        if (/^\/?(annuler|annule|cancel|stop)\b/i.test(textOnly)) {
          const hadSession = !!getSession(phone);
          resetSession(phone);
          if (hadSession) {
            await reply('❌ *Annulé.* Renvoie ta capture avec `/matche` en légende pour recommencer.');
          }
          continue;
        }

        if (imageMsg && /^\/matche?s?\b/i.test(caption)) {
          let matches;
          try {
            matches = await getPendingMatches(phone);
          } catch (err) {
            const status = err.response?.status;
            const detail = err.response?.data?.detail || "";
            log("DEBUG - erreur brute:", status, JSON.stringify(err.response?.data), err.message);
            if (status === 404 && String(detail).toLowerCase().includes("lie")) {
              await reply(`⚠️ *Numéro non lié.*\nVa dans ton profil Arena et enregistre ce numéro :\n\`${phone}\``);
              continue;
            }
            await reply(`❌ *Erreur API (${status || "?"})*\n${detail || err.message}\n\n_Vérifie backendUrl/leagueId/botSecret dans config.json._`);
            continue;
          }

          if (matches.length === 0) {
            await reply("✅ Aucun match en attente pour toi pour le moment.");
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

          await reply(`📋 *TES MATCHS EN ATTENTE*\n\n${formatMatchList(matches)}\n\n👉 Réponds avec le *numéro* du match.\n_(ou \`/annuler\` pour arrêter)_`);
          continue;
        }

        if (imageMsg) continue;

        const session = getSession(phone);
        if (!session) continue;

        if (session.step === "select_match") {
          const index = parseInt(textOnly.trim(), 10);
          if (!index || !session.matches[index - 1]) {
            await reply(`⚠️ Numéro invalide. Réponds avec un numéro entre *1* et *${session.matches.length}*.`);
            continue;
          }

          session.selectedMatch = session.matches[index - 1];
          session.step = "enter_score";
          session.expiresAt = Date.now() + SESSION_TTL_MS;

          await reply(
            `✅ *Match choisi :*\n🏠 *${session.selectedMatch.home_player_name}*  vs  *${session.selectedMatch.away_player_name}* ✈️\n\n✍️ Envoie le score, ex: \`3-1\`\n_(gauche = home, droite = away)_\n_(ou \`/annuler\` pour arrêter)_`
          );
          continue;
        }

        if (session.step === "enter_score") {
          const score = parseScore(textOnly);
          if (!score) {
            await reply('⚠️ Format invalide. Envoie le score comme ceci: `3-1`.');
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
            `🎉 *CLAIM ENVOYÉ* 🎉\n\n🗓️ MJ${match.match_day}\n🏠 *${match.home_player_name}*  *${score.home} - ${score.away}*  *${match.away_player_name}* ✈️\n\n⏳ _En attente d'approbation admin._`
          );
          log("Claim created:", claim.id);
          resetSession(phone);
        }
      } catch (err) {
        const detail = err.response?.data?.detail || err.message;
        log("Message handling error:", detail);
        try {
          await sock.sendMessage(msg.key.remoteJid, { text: `❌ *Erreur:* ${detail}` });
        } catch (_) {}
      }
    }
  });
}

main();