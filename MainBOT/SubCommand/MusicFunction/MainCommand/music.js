/**
 * Music Command
 * Comprehensive music bot with play, queue, controls, favorites, history, and settings
 * 
 * Refactored: Handlers split into separate modules in ./handlers/
 */

const { SlashCommandBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const handlers = require('./handlers');
const trackHandler = require('../Handler/trackHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Music player commands')
        
        // Play subcommand
        .addSubcommand(sub => sub
            .setName('play')
            .setDescription('Play a song or playlist')
            .addStringOption(opt => opt
                .setName('query')
                .setDescription('Song name, URL, or playlist URL')
                .setRequired(true)
            )
            .addBooleanOption(opt => opt
                .setName('shuffle')
                .setDescription('Shuffle the playlist')
                .setRequired(false)
            )
            .addBooleanOption(opt => opt
                .setName('priority')
                .setDescription('Add to front of queue')
                .setRequired(false)
            )
        )
        
        // Stop subcommand
        .addSubcommand(sub => sub
            .setName('stop')
            .setDescription('Stop music and clear the queue')
        )
        
        // Skip subcommand
        .addSubcommand(sub => sub
            .setName('skip')
            .setDescription('Skip the current track')
        )
        
        // Pause subcommand
        .addSubcommand(sub => sub
            .setName('pause')
            .setDescription('Pause or resume playback')
        )
        
        // Queue subcommand
        .addSubcommand(sub => sub
            .setName('queue')
            .setDescription('View the queue')
            .addIntegerOption(opt => opt
                .setName('page')
                .setDescription('Page number')
                .setRequired(false)
                .setMinValue(1)
            )
        )
        
        // Now Playing subcommand
        .addSubcommand(sub => sub
            .setName('nowplaying')
            .setDescription('Show currently playing track')
        )
        
        // Volume subcommand
        .addSubcommand(sub => sub
            .setName('volume')
            .setDescription('Set the volume')
            .addIntegerOption(opt => opt
                .setName('level')
                .setDescription('Volume level (0-200)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(200)
            )
        )
        
        // Loop subcommand
        .addSubcommand(sub => sub
            .setName('loop')
            .setDescription('Toggle loop mode')
            .addStringOption(opt => opt
                .setName('mode')
                .setDescription('Loop mode')
                .setRequired(false)
                .addChoices(
                    { name: '➡️ Off', value: 'off' },
                    { name: '🔂 Track', value: 'track' },
                    { name: '🔁 Queue', value: 'queue' }
                )
            )
        )
        
        // Shuffle subcommand
        .addSubcommand(sub => sub
            .setName('shuffle')
            .setDescription('Toggle shuffle mode')
        )
        
        // Remove subcommand
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a track from queue')
            .addIntegerOption(opt => opt
                .setName('position')
                .setDescription('Position in queue (1 = first)')
                .setRequired(true)
                .setMinValue(1)
            )
        )
        
        // Move subcommand
        .addSubcommand(sub => sub
            .setName('move')
            .setDescription('Move a track in the queue')
            .addIntegerOption(opt => opt
                .setName('from')
                .setDescription('Current position')
                .setRequired(true)
                .setMinValue(1)
            )
            .addIntegerOption(opt => opt
                .setName('to')
                .setDescription('New position')
                .setRequired(true)
                .setMinValue(1)
            )
        )
        
        // Clear subcommand
        .addSubcommand(sub => sub
            .setName('clear')
            .setDescription('Clear the queue (keeps current track)')
        )
        
        // Seek subcommand
        .addSubcommand(sub => sub
            .setName('seek')
            .setDescription('Seek to a position in the track')
            .addStringOption(opt => opt
                .setName('time')
                .setDescription('Time to seek to (e.g., 1:30 or 90)')
                .setRequired(true)
            )
        )
        
        // Recent subcommand
        .addSubcommand(sub => sub
            .setName('recent')
            .setDescription('Show recently played tracks')
        )
        
        // Favorites group
        .addSubcommandGroup(group => group
            .setName('favorites')
            .setDescription('Manage your favorite tracks')
            .addSubcommand(sub => sub
                .setName('list')
                .setDescription('View your favorites')
                .addIntegerOption(opt => opt
                    .setName('page')
                    .setDescription('Page number')
                    .setRequired(false)
                    .setMinValue(1)
                )
            )
            .addSubcommand(sub => sub
                .setName('play')
                .setDescription('Play a track from favorites')
                .addIntegerOption(opt => opt
                    .setName('number')
                    .setDescription('Favorite number to play')
                    .setRequired(true)
                    .setMinValue(1)
                )
            )
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove a track from favorites')
                .addIntegerOption(opt => opt
                    .setName('number')
                    .setDescription('Favorite number to remove')
                    .setRequired(true)
                    .setMinValue(1)
                )
            )
            .addSubcommand(sub => sub
                .setName('clear')
                .setDescription('Clear all favorites')
            )
        )
        
        // History group
        .addSubcommandGroup(group => group
            .setName('history')
            .setDescription('View listening history')
            .addSubcommand(sub => sub
                .setName('list')
                .setDescription('View your listening history')
                .addIntegerOption(opt => opt
                    .setName('page')
                    .setDescription('Page number')
                    .setRequired(false)
                    .setMinValue(1)
                )
            )
            .addSubcommand(sub => sub
                .setName('play')
                .setDescription('Play a track from history')
                .addIntegerOption(opt => opt
                    .setName('number')
                    .setDescription('History number to play')
                    .setRequired(true)
                    .setMinValue(1)
                )
            )
            .addSubcommand(sub => sub
                .setName('clear')
                .setDescription('Clear listening history')
            )
        )
        
        // Settings subcommand
        .addSubcommand(sub => sub
            .setName('settings')
            .setDescription('Configure your music preferences')
        )
        
        // Status subcommand
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('Show bot status and statistics')
        ),

    /**
     * Execute the music command
     */
    async execute(interaction) {
        // Access control check
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        try {
            // Handle subcommand groups
            if (subcommandGroup === 'favorites') {
                return await handlers.handleFavorites(interaction, subcommand, userId);
            }
            if (subcommandGroup === 'history') {
                return await handlers.handleHistory(interaction, subcommand, userId);
            }

            // Handle regular subcommands
            switch (subcommand) {
                case 'play':
                    return await handlers.handlePlay(interaction, guildId, userId);
                case 'stop':
                    return await handlers.handleStop(interaction, guildId);
                case 'skip':
                    return await handlers.handleSkip(interaction, guildId);
                case 'pause':
                    return await handlers.handlePause(interaction, guildId);
                case 'queue':
                    return await handlers.handleQueue(interaction, guildId);
                case 'nowplaying':
                    return await handlers.handleNowPlaying(interaction, guildId);
                case 'volume':
                    return await handlers.handleVolume(interaction, guildId);
                case 'loop':
                    return await handlers.handleLoop(interaction, guildId);
                case 'shuffle':
                    return await handlers.handleShuffle(interaction, guildId);
                case 'remove':
                    return await handlers.handleRemove(interaction, guildId);
                case 'move':
                    return await handlers.handleMove(interaction, guildId);
                case 'clear':
                    return await handlers.handleClear(interaction, guildId);
                case 'seek':
                    return await handlers.handleSeek(interaction, guildId);
                case 'recent':
                    return await handlers.handleRecent(interaction, guildId);
                case 'settings':
                    return await handlers.handleSettings(interaction);
                case 'status':
                    return await handlers.handleStatus(interaction);
                default:
                    return interaction.reply({ content: '❌ Unknown command', ephemeral: true });
            }
        } catch (error) {
            console.error('[Music Command Error]', error);
            const errorEmbed = trackHandler.createErrorEmbed(error.message || 'An error occurred');
            
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
            }
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    /**
     * Handle button interactions
     */
    async handleButton(interaction) {
        return await handlers.handleButton(interaction);
    },

    /**
     * Handle select menu interactions
     */
    async handleSelectMenu(interaction) {
        return await handlers.handleSelectMenu(interaction);
    }
};
