require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const Database = require("better-sqlite3");
const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || "8856264158");

if (!TOKEN) {
  console.error("BOT_TOKEN is missing. Add it in your environment variables.");
  process.exit(1);
}

fs.mkdirSync("./data", { recursive: true });
const db = new Database("./data/obalugo.db");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  claimed_by INTEGER,
  claimed_at TEXT
);
`);

const bot = new TelegramBot(TOKEN, { polling: true });

const sessions = new Map();

const userKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🎁 Giveaways", callback_data: "giveaways" }],
      [{ text: "🎯 Claim Account", callback_data: "claim" }],
      [{ text: "📦 Available Accounts", callback_data: "available" }],
      [{ text: "ℹ️ How It Works", callback_data: "how" }]
    ]
  }
};

function isAdmin(id) {
  return String(id) === ADMIN_ID;
}

function saveUser(user) {
  db.prepare(`
    INSERT INTO users (id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name
  `).run(user.id, user.username || "", user.first_name || "");
}

function availableCount() {
  return db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE status='available'").get().n;
}

function adminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Add Account", callback_data: "admin_add" }],
        [{ text: "📥 Add Many Accounts", callback_data: "admin_bulk" }],
        [{ text: "📦 Inventory", callback_data: "admin_inventory" }],
        [{ text: "👥 Users", callback_data: "admin_users" }],
        [{ text: "📊 Statistics", callback_data: "admin_stats" }],
        [{ text: "🎁 Create Giveaway", callback_data: "admin_giveaway" }]
      ]
    }
  };
}

function requirementsKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎵 Follow TikTok", url: process.env.TIKTOK_URL || "https://www.tiktok.com/@obalugo" }],
        [{ text: "📢 Join WhatsApp Channel", url: process.env.WHATSAPP_CHANNEL_URL }],
        [{ text: "👥 Join WhatsApp Group", url: process.env.WHATSAPP_GROUP_URL }],
        [{ text: "✅ I've completed them", callback_data: "check_requirements" }]
      ]
    }
  };
}

bot.onText(/^\/start$/, (msg) => {
  saveUser(msg.from);
  const name = msg.from.first_name || "friend";
  bot.sendMessage(
    msg.chat.id,
    `🎁 *OBALUGO GIVEAWAY*\\n\\nWelcome, ${name}!\\n\\nChoose an option below 👇`,
    { parse_mode: "Markdown", ...userKeyboard }
  );
});

bot.onText(/^\/admin$/, (msg) => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, "⛔ Admin only.");
  bot.sendMessage(msg.chat.id, "🔐 *OBALUGO ADMIN PANEL*\\n\\nChoose an action:", {
    parse_mode: "Markdown",
    ...adminKeyboard()
  });
});

bot.onText(/^\/cancel$/, (msg) => {
  sessions.delete(msg.from.id);
  bot.sendMessage(msg.chat.id, "❌ Cancelled.");
});

bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;
  saveUser(q.from);
  await bot.answerCallbackQuery(q.id);

  switch (q.data) {
    case "giveaways":
      return bot.sendMessage(chatId, "🎁 *Giveaways*\\n\\nThere are no active giveaways yet.", { parse_mode: "Markdown" });

    case "claim":
      if (availableCount() < 1) {
        return bot.sendMessage(chatId, "😔 There are currently no accounts available.");
      }
      return bot.sendMessage(
        chatId,
        "Before claiming, complete the required steps below. Then press *I've completed them*.",
        { parse_mode: "Markdown", ...requirementsKeyboard() }
      );

    case "check_requirements":
      return bot.sendMessage(
        chatId,
        "⚠️ This first version uses a manual confirmation button. We can add automated Telegram membership verification later. TikTok and WhatsApp membership also need provider/API support for true automatic verification.\\n\\nIf you have completed the steps, press the button below.",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🎯 Claim My Account", callback_data: "final_claim" }]]
          }
        }
      );

    case "final_claim": {
      const row = db.prepare("SELECT * FROM accounts WHERE status='available' ORDER BY id LIMIT 1").get();
      if (!row) return bot.sendMessage(chatId, "😔 Sorry, all accounts have been claimed.");

      const result = db.prepare(`
        UPDATE accounts
        SET status='claimed', claimed_by=?, claimed_at=CURRENT_TIMESTAMP
        WHERE id=? AND status='available'
      `).run(userId, row.id);

      if (!result.changes) return bot.sendMessage(chatId, "Please try again.");
      return bot.sendMessage(
        chatId,
        `🎉 *Account claimed successfully!*\\n\\n📧 Email: \`${row.email}\`\\n🔑 Password: \`${row.password}\`\\n\\nPlease keep these details safe.`,
        { parse_mode: "Markdown" }
      );
    }

    case "available":
      return bot.sendMessage(chatId, `📦 Available accounts: *${availableCount()}*`, { parse_mode: "Markdown" });

    case "how":
      return bot.sendMessage(chatId, "ℹ️ *How it works*\\n\\n1. Complete the required giveaway steps.\\n2. Press the confirmation button.\\n3. Claim one available CPM account.\\n4. Each account is automatically marked as claimed.", { parse_mode: "Markdown" });

    case "admin_add":
      if (!isAdmin(userId)) return bot.sendMessage(chatId, "⛔ Admin only.");
      sessions.set(userId, { type: "add_one" });
      return bot.sendMessage(chatId, "Send the account in this format:\\n\\n`email@example.com | password`\\n\\nSend /cancel to stop.", { parse_mode: "Markdown" });

    case "admin_bulk":
      if (!isAdmin(userId)) return bot.sendMessage(chatId, "⛔ Admin only.");
      sessions.set(userId, { type: "bulk" });
      return bot.sendMessage(chatId, "Send multiple accounts, one per line:\\n\\n`email@example.com | password`\\n`another@example.com | password2`\\n\\nSend /cancel to stop.", { parse_mode: "Markdown" });

    case "admin_inventory":
      if (!isAdmin(userId)) return bot.sendMessage(chatId, "⛔ Admin only.");
      return bot.sendMessage(chatId, `📦 *Inventory*\\n\\n🟢 Available: ${availableCount()}\\n🔴 Claimed: ${db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE status='claimed'").get().n}\\n📊 Total: ${db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n}`, { parse_mode: "Markdown" });

    case "admin_users":
      if (!isAdmin(userId)) return bot.sendMessage(chatId, "⛔ Admin only.");
      return bot.sendMessage(chatId, `👥 Registered users: *${db.prepare("SELECT COUNT(*) AS n FROM users").get().n}*`, { parse_mode: "Markdown" });

    case "admin_stats":
      if (!isAdmin(userId)) return bot.sendMessage(chatId, "⛔ Admin only.");
      return bot.sendMessage(chatId, `📊 *Statistics*\\n\\nUsers: ${db.prepare("SELECT COUNT(*) AS n FROM users").get().n}\\nTotal accounts: ${db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n}\\nAvailable: ${availableCount()}\\nClaimed: ${db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE status='claimed'").get().n}`, { parse_mode: "Markdown" });

    case "admin_giveaway":
      if (!isAdmin(userId)) return bot.sendMessage(chatId, "⛔ Admin only.");
      return bot.sendMessage(chatId, "🎁 Giveaway creation is prepared for the next version. We'll add title, rules, start/end time and winner/claim settings.");
  }
});

bot.on("message", (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const session = sessions.get(msg.from.id);
  if (!session || !isAdmin(msg.from.id)) return;

  if (session.type === "add_one") {
    const parts = msg.text.split("|").map(x => x.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return bot.sendMessage(msg.chat.id, "❌ Format incorrect. Use: `email@example.com | password`", { parse_mode: "Markdown" });
    }
    db.prepare("INSERT INTO accounts (email, password) VALUES (?, ?)").run(parts[0], parts[1]);
    sessions.delete(msg.from.id);
    return bot.sendMessage(msg.chat.id, "✅ Account added successfully.", adminKeyboard());
  }

  if (session.type === "bulk") {
    const lines = msg.text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    let added = 0, skipped = 0;
    const insert = db.prepare("INSERT INTO accounts (email, password) VALUES (?, ?)");
    const transaction = db.transaction((rows) => {
      for (const line of rows) {
        const parts = line.split("|").map(x => x.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          insert.run(parts[0], parts[1]);
          added++;
        } else skipped++;
      }
    });
    transaction(lines);
    sessions.delete(msg.from.id);
    return bot.sendMessage(msg.chat.id, `✅ Bulk import complete.\\n\\nAdded: ${added}\\nSkipped: ${skipped}`, adminKeyboard());
  }
});

bot.on("polling_error", (err) => console.error("Polling error:", err.message));
console.log("OBALUGO GIVEAWAY bot is running...");
