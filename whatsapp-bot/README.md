# eFootball Arena WhatsApp Bot

This bot listens to your WhatsApp group. When a player sends a screenshot with
the caption `/matche`, it finds the player by the WhatsApp number saved on their
Arena profile, asks which pending match the screenshot belongs to, asks for the
score, then submits a normal pending claim for admin approval.

## Backend setup

Set the same secret in the backend environment and in `config.json`:

```bash
BOT_SHARED_SECRET=<long-random-secret>
```

Run the migration once from `backend/`:

```bash
python scripts/add_whatsapp_phone.py
```

Each player can save their WhatsApp number from the profile settings page.
Use country code plus number, digits only, for example `212612345678`.

## Bot setup

```bash
cd whatsapp-bot
npm install
copy config.example.json config.json
npm start
```

On first start, scan the QR code with WhatsApp linked devices. The session is
stored in `auth/`, which is intentionally ignored by Git.

## In the group

1. Send the match screenshot with caption `/matche`.
2. Reply with the match number the bot lists.
3. Reply with the score, for example `3-1`.

Send `/annuler` to reset your current flow.
