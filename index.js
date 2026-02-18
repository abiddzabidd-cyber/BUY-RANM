require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  Routes,
  REST,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");

/* ================= CONFIG ================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const LOG_CHANNEL_ID = "1473628722870358181";

const ROLES = {
  knight: { id: "1473625327879323730", price: 5000, name: "Knight" },
  queen: { id: "1473625651486527488", price: 15000, name: "Power Queen" },
  king: { id: "1473626042504577189", price: 30000, name: "The Invincible King" }
};

const DB_FILE = "./database.json";
let db = {};

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE));
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(id) {
  if (!db[id]) {
    db[id] = {
      coins: 0,
      xp: 0,
      level: 1,
      lastDaily: 0,
      lastXP: 0
    };
  }
  return db[id];
}

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder().setName("balance").setDescription("Cek balance kamu"),

  new SlashCommandBuilder().setName("daily").setDescription("Ambil daily reward"),

  new SlashCommandBuilder().setName("store").setDescription("Lihat daftar rank"),

  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Beli rank")
    .addStringOption(option =>
      option.setName("rank")
        .setDescription("Pilih rank")
        .setRequired(true)
        .addChoices(
          { name: "Knight", value: "knight" },
          { name: "Power Queen", value: "queen" },
          { name: "The Invincible King", value: "king" }
        )
    ),

  new SlashCommandBuilder()
    .setName("addmoney")
    .setDescription("Admin: Tambah coin")
    .addUserOption(option =>
      option.setName("user").setDescription("Target user").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("amount").setDescription("Jumlah coin").setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ================= READY ================= */

client.once("clientReady", async () => {
  console.log(`Bot online sebagai ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
});

/* ================= SLASH HANDLER ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userData = getUser(interaction.user.id);

  /* BALANCE */
  if (interaction.commandName === "balance") {
    return interaction.reply({
      content: `💰 Coins: ${userData.coins}\n📊 Level: ${userData.level}\n⭐ XP: ${userData.xp}/${userData.level * 100}`,
      ephemeral: true
    });
  }

  /* DAILY */
  if (interaction.commandName === "daily") {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;

    if (now - userData.lastDaily < cooldown) {
      return interaction.reply({ content: "⏳ Daily sudah diambil!", ephemeral: true });
    }

    userData.coins += 1000;
    userData.lastDaily = now;
    saveDB();

    return interaction.reply("✅ Kamu mendapat 1000 coins!");
  }

  /* STORE */
  if (interaction.commandName === "store") {
    const embed = new EmbedBuilder()
      .setTitle("🛒 ROYAL STORE")
      .setDescription(
        `👑 Knight — 5000 coins\n` +
        `👑 Power Queen — 15000 coins\n` +
        `👑 The Invincible King — 30000 coins\n\n` +
        `Gunakan /buy untuk membeli`
      )
      .setColor("Gold");

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  /* BUY */
  if (interaction.commandName === "buy") {
    const rank = interaction.options.getString("rank");
    const roleData = ROLES[rank];

    if (userData.coins < roleData.price) {
      return interaction.reply({ content: "❌ Coin tidak cukup!", ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (member.roles.cache.has(roleData.id)) {
      return interaction.reply({ content: "❌ Kamu sudah punya rank ini!", ephemeral: true });
    }

    userData.coins -= roleData.price;
    await member.roles.add(roleData.id);
    saveDB();

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`🛒 ${interaction.user.tag} membeli ${roleData.name}`);
    }

    return interaction.reply(`👑 Berhasil membeli ${roleData.name}!`);
  }

  /* ADDMONEY */
  if (interaction.commandName === "addmoney") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Hanya admin!", ephemeral: true });
    }

    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    const targetData = getUser(target.id);
    targetData.coins += amount;
    saveDB();

    return interaction.reply(`✅ ${amount} coins ditambahkan ke ${target.tag}`);
  }
});

/* ================= XP SYSTEM ================= */

client.on("messageCreate", message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.content.length < 5) return;

  const userData = getUser(message.author.id);
  const now = Date.now();

  if (now - userData.lastXP < 60000) return;

  const xpGain = Math.floor(Math.random() * 16) + 10;
  userData.xp += xpGain;
  userData.lastXP = now;

  const requiredXP = userData.level * 100;

  if (userData.xp >= requiredXP) {
    userData.xp -= requiredXP;
    userData.level += 1;
    userData.coins += 200;

    message.channel.send(
      `🎉 ${message.author} naik ke Level ${userData.level} dan mendapat 200 coins!`
    );
  }

  saveDB();
});

client.login(TOKEN);
