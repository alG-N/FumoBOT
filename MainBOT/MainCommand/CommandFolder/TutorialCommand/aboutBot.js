const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    SlashCommandBuilder,
    ButtonStyle
} = require('discord.js');
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
const { maintenance, developerID } = require("../../Configuration/maintenanceConfig");
const { isBanned } = require('../../Administrator/BannedList/BanUtils');
module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot || (message.content !== '.credit' && !message.content.startsWith('.credit ') && message.content !== '.cr' && !message.content.startsWith('.cr '))) return;
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

        const embed = new EmbedBuilder()
            .setColor("#00BFFF")
            .setTitle("🤖 About FumoBOT")
            .setDescription(
                `**FumoBOT** is a custom-made Discord bot designed with love and chaos, built for collecting, enhancing, and interacting with mysterious items in a world full of lore and possibilities.\n\n` +
                `Whether you're farming fumo slots, using weird grass under the moonlight, or holding onto that one legendary shard — this bot's got a surprise for everyone.`
            )
            .addFields(
                {
                    name: "📦 Features", value:
                        "- Inspect items with `.itemInfo <item>`\n" +
                        "- Discover many new command with `.tutorial`\n" +
                        "- Get an extra feature this bot offers — maybe it's lore, maybe it's a trap? Try .otherCMD !!!\n" +
                        "- Read lore and strategize for upgrades\n" +
                        "- More features to come — PvE? Crafting? 👀"
                },
                {
                    name: "👥 Credits", value:
                        "**Main Developer:** alterGolden (@golden_exist) 💛\n" +
                        "**Co-Dev & Code Assistant:** ChatGPT by OpenAI 🤖\n" +
                        "**Beta-Tester:** normalguy592, ho_suh, quiliphoth."
                },
                {
                    name: "🛠 Tech Stack", value:
                        "- Node.js + discord.js\n- Pure imagination and way too many lines of code\n- Mainly use Javascript :D"
                },
                {
                    name: "📅 Status", value:
                        "Still under active development. Expect lore. Expect chaos. Expect fun."
                }
            )
            .setFooter({ text: "Made by alterGolden & ChatGPT — keep dreaming, nothing is impossible." })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    });
};