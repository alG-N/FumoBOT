const { SlashCommandBuilder } = require("discord.js");
const queueService = require('./Service/QueueService');
const logger = require('./Utility/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop the music, clear the queue, and leave the channel"),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;

            logger.log(`Stop command invoked by ${interaction.user.tag}`, interaction);

            await queueService.cleanup(guildId);

            logger.log(`Successfully stopped and cleaned up`, interaction);

            await interaction.reply("⏹️ Stopped the music, cleared the queue, and left the channel.");
        } catch (err) {
            logger.error(`Stop command error: ${err.message}`, interaction);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply("❌ Failed to stop the music.");
            } else {
                await interaction.reply("❌ Failed to stop the music.");
            }
        }
    }
};