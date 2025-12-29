/**
 * Migrate Pets Command
 * Administrative command for migrating pet abilities
 */

const { EmbedBuilder } = require('discord.js');
const PetStats = require('../../Service/PetService/PetStatsService');
const { DEVELOPER_ID, isDeveloper, EMBED_COLORS } = require('../Config/adminConfig');

/**
 * Register the migrate pets command
 * @param {Client} client - Discord client
 */
module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!isDeveloper(message.author.id) && message.author.id !== DEVELOPER_ID) return;

        const content = message.content.trim().toLowerCase();

        if (content === '.migratepets' || content === '.fixpets') {
            try {
                const msg = await message.reply('🔄 Starting pet ability migration...');

                const result = await PetStats.migrateAllPetsAbilities();

                const embed = new EmbedBuilder()
                    .setTitle('✅ Pet Migration Complete')
                    .setColor(EMBED_COLORS.SUCCESS)
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
