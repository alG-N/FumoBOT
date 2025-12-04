const validators = require('../Utility/validators');
const embedBuilder = require('../Utility/embedBuilder');
const queueService = require('../Service/QueueService');

async function validateQueueExists(interaction, guildId) {
    const queue = queueService.getOrCreateQueue(guildId);
    
    if (!validators.isValidQueue(queue)) {
        await interaction.reply({
            embeds: [embedBuilder.buildInfoEmbed("❌ Invalid Queue", "Queue data is corrupted.")],
            ephemeral: true
        });
        return false;
    }

    return true;
}

async function validateQueueNotEmpty(interaction, guildId) {
    const queueLength = queueService.getQueueLength(guildId);
    const currentTrack = queueService.getCurrentTrack(guildId);

    if (queueLength === 0 && !currentTrack) {
        await interaction.reply({
            embeds: [embedBuilder.buildInfoEmbed("❌ Empty Queue", "There are no songs in the queue.")],
            ephemeral: true
        });
        return false;
    }

    return true;
}

async function validateTrackPlaying(interaction, guildId) {
    const currentTrack = queueService.getCurrentTrack(guildId);

    if (!currentTrack) {
        await interaction.reply({
            embeds: [embedBuilder.buildInfoEmbed("❌ Nothing Playing", "No track is currently playing.")],
            ephemeral: true
        });
        return false;
    }

    return true;
}

async function validateQueueLimit(interaction, maxQueueSize = 100) {
    const guildId = interaction.guild.id;
    const queueLength = queueService.getQueueLength(guildId);

    if (queueLength >= maxQueueSize) {
        await interaction.reply({
            embeds: [embedBuilder.buildInfoEmbed(
                "❌ Queue Full", 
                `The queue has reached its maximum size of ${maxQueueSize} tracks.`
            )],
            ephemeral: true
        });
        return false;
    }

    return true;
}

module.exports = {
    validateQueueExists,
    validateQueueNotEmpty,
    validateTrackPlaying,
    validateQueueLimit
};