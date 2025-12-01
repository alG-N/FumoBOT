const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const { queues, player } = require("./play"); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop the music, clear the queue, and leave the channel"),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;

            const connection = getVoiceConnection(guildId);
            if (connection) {
                try {
                    connection.destroy();
                    console.log("[Stop] Destroyed lingering voice connection.");
                } catch (err) {
                    console.error("[Stop] Error destroying connection:", err);
                }
            }

            if (player) {
                try {
                    player.stop(true);
                    player.removeAllListeners();
                    console.log("[Stop] Stopped player.");
                } catch (err) {
                    console.error("[Stop] Error stopping player:", err);
                }
            }

            if (queues && queues.has(guildId)) {
                queues.delete(guildId);
                console.log("[Stop] Cleared queue.");
            }

            await interaction.reply("⏹️ Stopped the music, cleared the queue, and left the channel.");
        } catch (err) {
            console.error("[Stop] Error:", err);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply("❌ Failed to stop the music.");
            } else {
                await interaction.reply("❌ Failed to stop the music.");
            }
        }
    }
};
