const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { AudioPlayerStatus } = require("@discordjs/voice");

const queueService = require('../Service/QueueService');
const voiceService = require('../Service/VoiceService');
const audioPlayerService = require('../Service/AudioPlayerService');
const trackResolverService = require('../Service/TrackResolverService');
const streamService = require('../Service/StreamService');
const votingService = require('../Service/VotingService');

const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');
const validators = require('../Utility/validators');

const { checkVoiceChannel, checkVoicePermissions } = require('../Middleware/voiceChannelCheck');
const interactionHandler = require('../Middleware/interactionHandler');

const { MAX_TRACK_DURATION, CONFIRMATION_TIMEOUT, PLAYBACK_DELAY, MIN_VOTES_REQUIRED } = require('../Configuration/MusicConfig');

const PlaybackController = require('../Controller/PlaybackController');
const ControlsController = require('../Controller/ControlsController');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song in your voice channel by name or URL")
        .addStringOption(o =>
            o.setName("query").setDescription("Song name or YouTube URL").setRequired(true)
        ),

    async execute(interaction) {
        logger.log(`Command invoked by ${interaction.user.tag} (${interaction.user.id})`, interaction);

        if (!await checkVoiceChannel(interaction)) return;
        if (!await checkVoicePermissions(interaction)) return;

        const query = interaction.options.getString("query");
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        let track;
        try {
            logger.log(`Resolving track for query: ${query}`, interaction);
            track = await trackResolverService.resolve(query, interaction.user);
            logger.log(`Track resolved: ${track.title} (${track.url})`, interaction);
        } catch (e) {
            let msg = "Could not fetch video info. Make sure it's a valid YouTube URL or search query.";
            if (e.message === "NO_RESULTS") msg = "No results found for your search.";
            logger.error(`Track resolve error: ${e.message}`, interaction);
            return interaction.editReply({
                embeds: [embedBuilder.buildErrorEmbed(msg)],
            });
        }

        if (trackResolverService.isLongTrack(track, MAX_TRACK_DURATION)) {
            const confirmed = await this.handleLongTrackConfirmation(interaction, track);
            if (!confirmed) return;
        }

        const position = queueService.addTrack(guildId, track);
        
        const queuedEmbed = embedBuilder.buildQueuedEmbed(track, position, interaction.user);
        await interaction.editReply({ embeds: [queuedEmbed], components: [] });

        const queue = queueService.getOrCreateQueue(guildId);

        try {
            logger.log(`Ensuring connection`, interaction);
            await voiceService.connect(interaction, queue);
            
            voiceService.monitorVoiceChannel(guildId, interaction.channel, queue, async (gid) => {
                await queueService.cleanup(gid);
                await interaction.channel.send({ embeds: [embedBuilder.buildNoUserVCEmbed()] });
            });
        } catch (err) {
            logger.error(`Connection error: ${err.message}`, interaction);
            await interaction.followUp({
                embeds: [
                    embedBuilder.buildErrorEmbed(
                        err.message === "NO_VC" ? "Join a voice channel." : "Failed to reach Ready state."
                    ),
                ],
                ephemeral: true,
            });
            return;
        }

        if (!queue._eventsBound) {
            PlaybackController.bindPlayerEvents(queue, guildId, interaction);
        }

        await PlaybackController.playNext(interaction, guildId);
    },

    async handleLongTrackConfirmation(interaction, track) {
        logger.log(`Long video detected: ${track.title} (${track.lengthSeconds}s)`, interaction);
        
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_yes").setLabel("Yes").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("confirm_no").setLabel("No").setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            embeds: [embedBuilder.buildLongVideoConfirmEmbed(track)],
            components: [confirmRow],
        });

        const filter = i =>
            i.user.id === interaction.user.id &&
            ["confirm_yes", "confirm_no"].includes(i.customId);

        try {
            const btnInt = await interaction.channel.awaitMessageComponent({ 
                filter, 
                time: CONFIRMATION_TIMEOUT 
            });

            logger.log(`Confirmation button pressed: ${btnInt.customId}`, interaction);

            if (btnInt.customId === "confirm_no") {
                await btnInt.update({
                    embeds: [embedBuilder.buildInfoEmbed("❌ Cancelled", "Playback cancelled.")],
                    components: [],
                });
                logger.log(`Playback cancelled by user`, interaction);
                return false;
            }

            await btnInt.update({
                embeds: [embedBuilder.buildInfoEmbed("✅ Confirmed", "Added to the queue and will play soon!")],
                components: [],
            });
            logger.log(`Track confirmed and added to queue`, interaction);
            return true;

        } catch (err) {
            logger.error(`Confirmation timeout or error: ${err}`, interaction);
            await interaction.editReply({
                embeds: [embedBuilder.buildInfoEmbed("❌ Timeout", "No response. Playback cancelled.")],
                components: [],
            });
            return false;
        }
    }
};