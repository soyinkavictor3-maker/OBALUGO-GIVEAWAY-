# OBALUGO GIVEAWAY — online version

## What it does
- Public page: `/`
- Admin page: `/admin.html`
- Admin adds CPM giveaway credentials.
- Each successful claim atomically consumes the next available account, so two people cannot receive the same account.
- TikTok, WhatsApp Channel and WhatsApp Group links are already configured.

## Deploy
1. Install Node.js 20+.
2. Run `npm install`.
3. Set environment variables from `.env.example` (especially ADMIN_PASS and SESSION_SECRET).
4. Run `npm start`.
5. Put it behind HTTPS when publishing.
6. Keep `giveaway.db` on persistent storage.

## Important
This prototype intentionally does not verify TikTok follows or WhatsApp membership; visitors confirm completion themselves. Do not collect visitors' personal passwords. Only add CPM credentials that you are authorized to distribute.
