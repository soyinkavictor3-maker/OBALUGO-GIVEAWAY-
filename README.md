# OBALUGO GIVEAWAY Telegram Bot

A separate Telegram bot for managing CPM giveaway accounts.

## Local setup

1. Install Node.js 18+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put your BotFather token in `BOT_TOKEN`.
5. Keep `ADMIN_ID=8856264158`.
6. Run `npm start`.

## Render setup

Create a new Web Service from this project.

- Build Command: `npm install`
- Start Command: `npm start`

Environment variables:
- `BOT_TOKEN` = your private BotFather token
- `ADMIN_ID` = `8856264158`
- `TIKTOK_URL` = your TikTok URL
- `WHATSAPP_GROUP_URL` = your group URL
- `WHATSAPP_CHANNEL_URL` = your channel URL

Do not upload `.env` to GitHub.

## Important

The bot stores account data in SQLite. On normal free hosting, local disk can be ephemeral, so a later version should use persistent storage if you need accounts to survive redeploys/restarts.

The current claim gate uses manual confirmation. Automated TikTok/WhatsApp membership verification is not implemented in this first version.
