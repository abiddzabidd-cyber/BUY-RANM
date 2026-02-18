require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ================= DATABASE ================= */

const dbFile = "./database.json";

function loadDB() {
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, "{}");
  }
  return JSON.parse(fs.readFileSync(dbFile));
}

function saveDB(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function ensureUser(db, userId) {
  if (!db[userId]) {
    db[userId] = {
      balance: 0,
      lastDaily: 0
    };
  }
}

/* ================= ROLE CONFIG ================= */

const ROLES = {
  knight: { id: "1473625327879323730", price: 1000, name: "Knight" },
  queen: { id: "1473625651486527488", price: 5000, name: "Power Queen" },
  king: { id: "1473626042504577189", price: 10000, name: "The Invincible King" }
};

const LOG_CHANNEL_ID = "1473628722870358181";

/* ================= SLASH COMMAND ================= */

const commands = [
  { name: "balance", description: "Cek saldo kamu" },
  { name: "daily", description: "Claim koin harian" },
  { name: "work", description: "Kerja untuk dapat koin" },
  { name: "store", description: "Lihat role store" },
  {
    name: "buy",
    description: "Beli role",
    options: [
      {
        name: "role",
        description: "Pilih role",
        type: 3,
        required: true,
        choices: [
          { name: "Knight", value: "knight" },
          { name: "Power Queen", value: "queen" },
          { name: "The Invincible King", value: "king" }
        ]
      }
    ]
  },
  {
    name: "addmoney",
    description: "Tambah saldo user (Admin only)",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: "user",
        description: "User target",
        type: 6,
        required: true
      },
      {
        name: "amount",
        description: "Jumlah koin",
        type: 4,
        required: true
      }
    ]
  }
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );
})();

/* ================= READY ================= */

client.once("clientReady", () => {
  console.log(`Bot online sebagai ${client.user.tag}`);
});

/* ================= INTERACTION ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const db = loadDB();
  const userId = interaction.user.id;

  ensureUser(db, userId);

  /* ===== BALANCE ===== */
  if (interaction.commandName === "balance") {
    return interaction.reply(
      `💰 Saldo kamu: ${db[userId].balance} coins`
    );
  }

  /* ===== DAILY ===== */
  if (interaction.commandName === "daily") {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;

    if (now - db[userId].lastDaily < cooldown) {
      const remaining =
        cooldown - (now - db[userId].lastDaily);

      const hours = Math.floor(remaining / (1000 * 60 * 60));

      return interaction.reply({
        content: `❌ Daily sudah di-claim. Coba lagi ${hours} jam lagi.`,
        ephemeral: true
      });
    }

    db[userId].balance += 2000;
    db[userId].lastDaily = now;
    saveDB(db);

    return interaction.reply("✅ Kamu dapat 2000 coins!");
  }

  /* ===== WORK ===== */
  if (interaction.commandName === "work") {
    const amount = Math.floor(Math.random() * 1000) + 500;
    db[userId].balance += amount;
    saveDB(db);

    return interaction.reply(
      `💼 Kamu kerja dan dapat ${amount} coins`
    );
  }

  /* ===== STORE ===== */
  if (interaction.commandName === "store") {
    return interaction.reply(
      `🛒 STORE:\n` +
      `Knight - ${ROLES.knight.price}\n` +
      `Power Queen - ${ROLES.queen.price}\n` +
      `The Invincible King - ${ROLES.king.price}`
    );
  }

  /* ===== BUY ===== */
  if (interaction.commandName === "buy") {
    const choice = interaction.options.getString("role");
    const data = ROLES[choice];

    if (!data)
      return interaction.reply({
        content: "Role tidak ditemukan",
        ephemeral: true
      });

    const role = interaction.guild.roles.cache.get(data.id);

    if (interaction.member.roles.cache.has(data.id)) {
      return interaction.reply({
        content: "❌ Kamu sudah punya role ini!",
        ephemeral: true
      });
    }

    if (db[userId].balance < data.price) {
      return interaction.reply({
        content: "❌ Saldo tidak cukup!",
        ephemeral: true
      });
    }

    db[userId].balance -= data.price;
    saveDB(db);

    await interaction.member.roles.add(role);

    interaction.reply(
      `✅ Berhasil beli ${data.name}. Sisa saldo: ${db[userId].balance}`
    );

    const logChannel =
      interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

    if (logChannel) {
      logChannel.send(
        `🧾 ${interaction.user.tag} membeli ${data.name}`
      );
    }
  }

  /* ===== ADDMONEY (ADMIN) ===== */
  if (interaction.commandName === "addmoney") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Hanya admin yang bisa pakai command ini.",
        ephemeral: true
      });
    }

    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    ensureUser(db, target.id);

    db[target.id].balance += amount;
    saveDB(db);

    interaction.reply(
      `✅ Berhasil menambahkan ${amount} coins ke ${target.tag}`
    );
  }
});

client.login(process.env.TOKEN);
