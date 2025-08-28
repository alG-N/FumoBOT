const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const { player } = require("./play");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop the music and leave the channel"),

    async execute(interaction) {
        try {
            // Stop audio playback
            if (player) {
                console.log("[Stop] Stopping player...");
                player.stop(true); // true = force stop
                player.removeAllListeners(); // cleanup listeners
            }

            // Destroy VC connection
            const connection = getVoiceConnection(interaction.guild.id);
            if (connection) {
                console.log("[Stop] Destroying connection...");
                connection.destroy();
            }

            await interaction.reply("⏹️ Stopped the music and left the channel.");
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
