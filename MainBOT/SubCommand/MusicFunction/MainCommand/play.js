const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const queueService = require('../Service/QueueService');
const voiceService = require('../Service/VoiceService');
const trackResolverService = require('../Service/TrackResolverService');
const lavalinkService = require('../Service/LavalinkService');

const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');

const { checkVoiceChannel, checkVoicePermissions } = require('../Middleware/voiceChannelCheck');
const interactionHandler = require('../Middleware/interactionHandler');

const { MAX_TRACK_DURATION, CONFIRMATION_TIMEOUT } = require('../Configuration/MusicConfig');

const PlaybackController = require('../Controller/PlaybackController');

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

        let trackData;
        try {
            logger.log(`Resolving track for query: ${query}`, interaction);
            trackData = await trackResolverService.resolve(query, interaction.user);
            logger.log(`Track resolved: ${trackData.title} (${trackData.url})`, interaction);
        } catch (e) {
            let msg = "Could not fetch video info. Make sure it's a valid YouTube URL or search query.";
            if (e.message === "NO_RESULTS") msg = "No results found for your search.";
            logger.error(`Track resolve error: ${e.message}`, interaction);
            return interaction.editReply({
                embeds: [embedBuilder.buildErrorEmbed(msg)],
            });
        }

        if (trackResolverService.isLongTrack(trackData, MAX_TRACK_DURATION)) {
            const confirmed = await this.handleLongTrackConfirmation(interaction, trackData);
            if (!confirmed) return;
        }

        try {
            logger.log(`Ensuring connection`, interaction);
            await voiceService.connect(interaction, guildId);
            
            voiceService.monitorVoiceChannel(guildId, interaction.channel, async (gid) => {
                await queueService.cleanup(gid);
                await interaction.channel.send({ embeds: [embedBuilder.buildNoUserVCEmbed()] });
            });
        } catch (err) {
            logger.error(`Connection error: ${err.message}`, interaction);
            await interaction.followUp({
                embeds: [
                    embedBuilder.buildErrorEmbed(
                        err.message === "NO_VC" ? "Join a voice channel." : "Failed to connect to voice channel."
                    ),
                ],
                ephemeral: true,
            });
            return;
        }

        const player = lavalinkService.getPlayer(guildId);
        
        player.queue.add(trackData.track);
        
        const position = player.queue.size;
        
        const queuedEmbed = embedBuilder.buildQueuedEmbed(trackData, position, interaction.user);
        await interaction.editReply({ embeds: [queuedEmbed], components: [] });

        const queue = queueService.getOrCreateQueue(guildId);
        
        if (!queue._eventsBound) {
            PlaybackController.bindPlayerEvents(guildId, interaction);
        }

        if (!player.playing && !player.paused) {
            await player.play();
        }
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