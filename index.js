require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ================= DATABASE ================= */

const dbFile = "./database.json";

function loadDB() {
  return JSON.parse(fs.readFileSync(dbFile));
}

function saveDB(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function getUser(userId) {
  const db = loadDB();
  if (!db[userId]) {
    db[userId] = { balance: 0, lastDaily: 0 };
    saveDB(db);
  }
  return db[userId];
}

/* ================= ROLE CONFIG ================= */

const ROLES = {
  knight: { id: "1473625327879323730", price: 1000 },
  queen: { id: "1473625651486527488", price: 5000 },
  king: { id: "1473626042504577189", price: 10000 }
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

  const userId = interaction.user.id;
  const db = loadDB();
  const user = getUser(userId);

  /* ===== BALANCE ===== */
  if (interaction.commandName === "balance") {
    return interaction.reply(`💰 Saldo kamu: ${user.balance} coins`);
  }

  /* ===== DAILY ===== */
  if (interaction.commandName === "daily") {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;

    if (now - user.lastDaily < cooldown) {
      return interaction.reply({
        content: "❌ Kamu sudah claim daily hari ini.",
        ephemeral: true
      });
    }

    user.balance += 2000;
    user.lastDaily = now;
    saveDB(db);

    return interaction.reply("✅ Kamu dapat 2000 coins!");
  }

  /* ===== WORK ===== */
  if (interaction.commandName === "work") {
    const amount = Math.floor(Math.random() * 1000) + 500;
    user.balance += amount;
    saveDB(db);
    return interaction.reply(`💼 Kamu kerja dan dapat ${amount} coins`);
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
      return interaction.reply({ content: "Role tidak ada", ephemeral: true });

    if (user.balance < data.price)
      return interaction.reply({
        content: "❌ Saldo kamu tidak cukup!",
        ephemeral: true
      });

    const role = interaction.guild.roles.cache.get(data.id);
    if (!role)
      return interaction.reply({
        content: "Role tidak ditemukan di server",
        ephemeral: true
      });

    user.balance -= data.price;
    saveDB(db);

    await interaction.member.roles.add(role);

    interaction.reply(`✅ Berhasil beli role! Sisa saldo: ${user.balance}`);

    const logChannel =
      interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel)
      logChannel.send(
        `🧾 ${interaction.user.tag} membeli ${role.name} seharga ${data.price}`
      );
  }
});

client.login(process.env.TOKEN);
