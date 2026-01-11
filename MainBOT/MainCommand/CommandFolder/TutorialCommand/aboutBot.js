const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.content.match(/^\.(?:credit|cr)(?:\s|$)/i)) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const sourceButton = new ButtonBuilder()
            .setLabel('📂 Source Code')
            .setStyle(ButtonStyle.Link)
            .setURL('https://github.com/alG-N/FumoBOT');

        const row = new ActionRowBuilder().addComponents(sourceButton);

        const embed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle('🤖 About FumoBOT')
            .setDescription(
                '**FumoBOT** is a custom-made Discord bot designed with love and chaos, built for collecting, enhancing, and interacting with mysterious items in a world full of lore and possibilities.\n\n' +
                'Whether you\'re farming fumo slots, using weird grass under the moonlight, or holding onto that one legendary shard — this bot\'s got a surprise for everyone.'
            )
            .addFields(
                {
                    name: '📦 Features',
                    value:
                        '• Inspect items with `.itemInfo <item>`\n' +
                        '• Discover many new commands with `.tutorial`\n' +
                        '• Get extra features this bot offers — maybe it\'s lore, maybe it\'s a trap?\n' +
                        '• Read lore and strategize for upgrades\n' +
                        '• More features to come — PvE? Crafting? 👀'
                },
                {
                    name: '👥 Development Team',
                    value:
                        '**Main Developer:** @golden_exist (alterGolden) 💛\n' +
                        '**Side Developer:** @frusito (fruist), @zephrish (Xeth) 🌟\n' +
                        '**AI Assistants:** Claude AI & ChatGPT 🤖\n' +
                        '**Beta Testers:** normalguy592, nerdy_man'
                },
                {
                    name: '🛠 Tech Stack',
                    value:
                        '• **Runtime:** Node.js\n' +
                        '• **Library:** discord.js and MUCH MORE...\n' +
                        '• **Language:** JavaScript\n' +
                        '• **Database:** SQLite3'
                },
                {
                    name: '📅 Status',
                    value: '🚀 Active Development | 🎮 Open Beta'
                }
            )
            .setFooter({ text: 'Made by alterGolden & fruist — Keep dreaming, nothing is impossible.' })
            .setTimestamp();

        message.channel.send({ embeds: [embed], components: [row] });
    });
};