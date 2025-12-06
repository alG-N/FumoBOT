const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const tutorialCommands = require('../../Service/TutorialCommandService/helpCMD');

function createEmbed(category, timeRemaining) {
    return new EmbedBuilder()
        .setTitle(`📚 FumoBOT v2.3 - ${category.charAt(0).toUpperCase() + category.slice(1)}`)
        .setDescription('Embark on your adventure with FumoBOT!')
        .addFields(tutorialCommands[category])
        .setColor('#0099ff')
        .setImage('https://preview.redd.it/do-you-guys-think-fumos-are-equivalent-to-the-funko-pops-v0-xi2av2hg1umb1.jpg?width=640&crop=smart&auto=webp&s=edb968ff6d6604ef605fe3a0742661a767b9d3f3')
        .setFooter({ text: `Deleting in ${timeRemaining}s` })
        .setTimestamp();
}

function createButtons(selectedCategory, userId) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tutorial_${userId}`)
            .setLabel('Tutorial')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(selectedCategory === 'tutorial'),
        new ButtonBuilder()
            .setCustomId(`information_${userId}`)
            .setLabel('Information')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(selectedCategory === 'information'),
        new ButtonBuilder()
            .setCustomId(`gamble_${userId}`)
            .setLabel('Gamble')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(selectedCategory === 'gamble')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`shop_${userId}`)
            .setLabel('Shop')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(selectedCategory === 'shop'),
        new ButtonBuilder()
            .setCustomId(`capitalism_${userId}`)
            .setLabel('Capitalism')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(selectedCategory === 'capitalism'),
        new ButtonBuilder()
            .setCustomId(`misc_${userId}`)
            .setLabel('MISC')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(selectedCategory === 'misc')
    );

    return [row1, row2];
}

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot) return;
        if (!message.content.match(/^\.(?:help|h)(?:\s|$)/i)) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        let selectedCategory = 'tutorial';
        const userId = message.author.id;
        let timeRemaining = 60;

        const embedMessage = await message.channel.send({
            embeds: [createEmbed(selectedCategory, timeRemaining)],
            components: createButtons(selectedCategory, userId)
        });

        const interval = setInterval(async () => {
            timeRemaining--;
            if (timeRemaining > 0) {
                await embedMessage.edit({
                    embeds: [createEmbed(selectedCategory, timeRemaining)],
                    components: createButtons(selectedCategory, userId)
                }).catch(() => clearInterval(interval));
            }
        }, 1000);

        const collector = embedMessage.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 60000
        });

        collector.on('collect', async interaction => {
            if (interaction.user.id !== userId) {
                return interaction.reply({
                    content: '🚫 This isn\'t your help menu! Use `.help` to start your own.',
                    ephemeral: true
                });
            }

            selectedCategory = interaction.customId.split('_')[0];

            await interaction.update({
                embeds: [createEmbed(selectedCategory, timeRemaining)],
                components: createButtons(selectedCategory, userId)
            });
        });

        collector.on('end', () => {
            clearInterval(interval);
            embedMessage.delete().catch(() => {});
        });
    });
};