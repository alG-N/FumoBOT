const { EmbedBuilder } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (message.content !== '.craft' && message.content !== '.c') return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const embed = new EmbedBuilder()
            .setTitle('🛠️ Crafting Menu')
            .setDescription('Here are all available crafting commands you can use:')
            .setColor('Random')
            .addFields(
                { name: '.potionCraft || .pc', value: '💊 Create powerful potions to aid you.' },
                { name: '.itemCraft || .ic', value: '🧰 Craft basic and advanced items.' },
                { name: '.fumoCraft || .fc', value: '🧸 Create adorable fumos using materials.' },
                { name: '.blessingCraft || .bc', value: '🌟 Craft powerful blessings.' }
            )
            .setFooter({ text: 'Use the commands above to begin crafting!' });

        await message.channel.send({ embeds: [embed] });
    });
};