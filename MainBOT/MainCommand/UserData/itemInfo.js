const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../Database/db');
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
client.setMaxListeners(150);
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig"); //ignore this, will add later
const { isBanned } = require('../Banned/BanUtils');
const itemDescriptions = {
    //common
    "UniqueRock(C)": "A skyfallen fragment, rare yet oddly common.",
    "Books(C)": "Dusty old books filled with strange, playful stories.",
    "Wool(C)": "Soft, fluffy wool. Warm and surprisingly durable.",
    "Wood(C)": "Basic, sturdy wood — nothing fancy, just useful.",
    "ForgottenBook(C)": "A blank-looking book that hums with hidden power.",
    "DailyTicket(C)": "",
    "Dice(C)": "",

    //rare
    "FragmentOf1800s(R)": "A relic from a grim era, heavy with history. Boosts Fumo slot farming.",
    "WeirdGrass(R)": "Grass bathed in moonlight. Grants a random buff—or a strange curse.",
    "FumoTrait(R)": "",
    "PrayTicket(R)": "",

    //epic
    "EnhancedScroll(E)": "A scroll enhanced beyond safe limits. Its energy shifts constantly, making it powerful but unpredictable.",
    "RustedCore(E)": "Once the heart of a great machine, now just a rusty husk. Still emits a faint, rhythmic hum—as if it remembers something.",
    "AncientRelic(E)": "A mysterious artifact from a forgotten age. It drastically lowers sell value by 60%, but in return, floods you with fortune—boosting coins, gems, and luck far beyond normal limits.",
    "FragmentOfTime(E)": "",
    "FumoChangeToken(E)": "",

    //legendary
    "RedShard(L)": "A shard that burns with inner fire. Thought to be a remnant of a volcanic deity’s armor.",
    "BlueShard(L)": "Cold and unyielding, this shard is linked to an ancient water spirit. It hums softly when submerged.",
    "YellowShard(L)": "Crackling with static energy. Believed to have been created during a storm that split the sky.",
    "WhiteShard(L)": "Pure and celestial. Rumored to be a sliver of a fallen star, used in divine rituals.",
    "DarkShard(L)": "Drenched in shadow. Created in the depths of the Abyss during the Eclipse War.",
    "HakureiTicket(L)": "A ticket that allowed you to re-visit the Hakurei Shrine...",
    "SFumoTrait(L)": "",
    "TimeClock-Broken(L)": "",
    "TimeClock(L)": "",

    //mythical
    "ChromaShard(M)": "A vibrant shard reflecting every color—said to hold the balance between chaos and order.",
    "MonoShard(M)": "A colorless shard born from light and dark canceling out. It hums with quiet power.",
    "EquinoxAlloy(M)": "Forged only during a perfect equinox. Said to harmonize nature’s opposing forces.",
    "StarShard(M)": "Gifted by Marisa after 10 donations. Needed for an ultimate blessing—but its true purpose is still unclear.",
    "FantasyBook(M)": "A strange book that lets you summon a Fumo from another world. Only works once... maybe.",
    "Lumina(M)": "Formed from 10 StarShards. Every 10th roll while holding it boosts your luck by 5×.",
    "MysteriousShard(M)": "",
    "PocketWatch(M)": "",
    "MysteriousCube(M)": "",
    "MysticOrb(M)": "",
    "MysteriousDice(M)": "",

    //???
    "GoldenSigil(?)": "Forged by an ancestor of AlterGolden, this sigil once brought immense fortune. How it was crafted remains a mystery lost to time.",
    "Undefined(?)": "Its name flickers in and out of comprehension. Scholars say it was never meant to be named—used in forbidden rituals.",
    "Null?(?)": "An item with no origin, no weight, and no presence—yet here it is. Whispers say it’s a relic from an erased dimension.",
    "Nullified(?)": "A strange object said to freeze fate itself. Balances your next roll—no rarity chance, just pure neutrality. Resets after each use.",
    "S!gil?(?)": "Forged from twisted reality and layered time. Boosts coins, luck, and sell value based on GoldenSigils. Converts 10 daily rolls into nullified form. All boosts are disabled. Duplicate ASTRAL+ drops are blocked.",
};

const rarityMap = {
    "C": "Common",
    "R": "Rare",
    "E": "Epic",
    "L": "Legendary",
    "M": "Mythical",
    "?": "???"
};

module.exports = async (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;

        const content = message.content.trim().toLowerCase();

        // /itemInfo [itemName]
        if (content.startsWith('.iteminfo') && (content === '.iteminfo' || content.startsWith('.iteminfo '))
            || content.startsWith('.it') && (content === '.it' || content.startsWith('.it '))) {
            // Check for maintenance mode or ban
            const banData = isBanned(message.author.id);
            if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
                let description = '';
                let footerText = '';

                if (maintenance === "yes" && message.author.id !== developerID) {
                    description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
                    footerText = "Thank you for your patience";
                } else if (banData) {
                    description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

                    if (banData.expiresAt) {
                        const remaining = banData.expiresAt - Date.now();
                        const seconds = Math.floor((remaining / 1000) % 60);
                        const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                        const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

                        const timeString = [
                            days ? `${days}d` : '',
                            hours ? `${hours}h` : '',
                            minutes ? `${minutes}m` : '',
                            seconds ? `${seconds}s` : ''
                        ].filter(Boolean).join(' ');

                        description += `\n**Time Remaining:** ${timeString}`;
                    } else {
                        description += `\n**Ban Type:** Permanent`;
                    }

                    footerText = "Ban enforced by developer";
                }

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                    .setDescription(description)
                    .setFooter({ text: footerText })
                    .setTimestamp();

                console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);

                return message.reply({ embeds: [embed] });
            }

            const args = message.content.split(/ +/);
            const query = args.slice(1).join(" ").trim();

            if (!query) {
                const embed = new EmbedBuilder()
                    .setTitle("📘 How to Use `.itemInfo`")
                    .setColor("#2ecc71")
                    .setDescription("Use this command to get info about an item!\n\n**Usage:**\n`.itemInfo <ItemName>`\n`.itemList <Rarity>`\n`.randomItem`\n\n**Examples:**\n`.itemInfo CoinPotion-Tier1(R)`\n`.itemInfo Rare`")
                    .setFooter({ text: "FumoBOT - Item Info System" })
                    .setTimestamp();
                return message.reply({ embeds: [embed] });
            }

            const matchedKey = Object.keys(itemDescriptions).find(
                key => key.toLowerCase() === query.toLowerCase() || key.toLowerCase().includes(query.toLowerCase())
            );

            if (!matchedKey) {
                const embed = new EmbedBuilder()
                    .setColor("#e74c3c")
                    .setTitle("❌ Item Not Found")
                    .setDescription("That item does not exist or isn't in the database. Please double-check the name.");
                return message.reply({ embeds: [embed] });
            }

            const description = itemDescriptions[matchedKey];
            const match = matchedKey.match(/\(([^)]+)\)$/);
            const rarityCode = match ? match[1] : null;
            const rarity = rarityMap[rarityCode] || "Unknown";

            const embed = new EmbedBuilder()
                .setTitle(`📘 Item Info: ${matchedKey}`)
                .setDescription(description)
                .addFields({ name: "🧾 Rarity", value: rarity, inline: true })
                .setColor("#3498db")
                .setFooter({ text: `Requested by ${message.author.tag}` })
                .setTimestamp();

            console.log(`[ItemInfo] ${message.author.tag} requested info for "${matchedKey}"`);

            return message.channel.send({ embeds: [embed] });
        }

        // /itemList <rarity>
        if (content.startsWith(".itemlist") || content.startsWith(".il")) {
            const args = message.content.split(/ +/);
            const queryRarity = args[1]?.toLowerCase();

            if (!queryRarity) {
                return message.reply("❌ Please specify a rarity. Example: `/itemList Mythical`");
            }

            const matchedItems = Object.keys(itemDescriptions).filter(key => {
                const match = key.match(/\(([^)]+)\)$/);
                const rarityCode = match ? match[1] : null;
                const fullRarity = rarityMap[rarityCode]?.toLowerCase();
                return fullRarity === queryRarity;
            });

            if (!matchedItems.length) {
                return message.reply(`❌ No items found for rarity: **${queryRarity}**`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`📦 Items of Rarity: ${queryRarity.charAt(0).toUpperCase() + queryRarity.slice(1)}`)
                .setDescription(matchedItems.join("\n"))
                .setColor("#f1c40f")
                .setFooter({ text: `Requested by ${message.author.tag}` })
                .setTimestamp();

            return message.channel.send({ embeds: [embed] });
        }

        // /randomItem
        if (content === ".randomitem" || content.startsWith(".ri")) {
            const keys = Object.keys(itemDescriptions);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            const description = itemDescriptions[randomKey];
            const match = randomKey.match(/\(([^)]+)\)$/);
            const rarityCode = match ? match[1] : null;
            const rarity = rarityMap[rarityCode] || "Unknown";

            const embed = new EmbedBuilder()
                .setTitle(`🎲 Random Item: ${randomKey}`)
                .setDescription(description)
                .addFields({ name: "🧾 Rarity", value: rarity, inline: true })
                .setColor("#9b59b6")
                .setFooter({ text: `Requested by ${message.author.tag}` })
                .setTimestamp();

            return message.channel.send({ embeds: [embed] });
        }
    });
};