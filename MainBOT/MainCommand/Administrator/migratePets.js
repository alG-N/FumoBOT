const { EmbedBuilder } = require('discord.js');
const PetStats = require('../Service/PetService/PetStatsService');

const AUTHORIZED_USER_ID = '1128296349566251068'; // Replace with your Discord ID

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (message.author.id !== AUTHORIZED_USER_ID) return;

        const content = message.content.trim().toLowerCase();

        if (content === '.migratepets' || content === '.fixpets') {
            try {
                const msg = await message.reply('🔄 Starting pet ability migration...');

                const result = await PetStats.migrateAllPetsAbilities();

                const embed = new EmbedBuilder()
                    .setTitle('✅ Pet Migration Complete')
                    .setColor('#00FF00')
                    .addFields(
                        { name: 'Total Pets Found', value: result.total.toString(), inline: true },
                        { name: 'Pets Updated', value: result.updated.toString(), inline: true }
                    )
                    .setTimestamp();

                await msg.edit({ content: null, embeds: [embed] });

            } catch (error) {
                console.error('Error migrating pets:', error);
                await message.reply('❌ Failed to migrate pets. Check console for details.');
            }
        }
    });
};
