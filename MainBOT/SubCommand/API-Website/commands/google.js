/**
 * Google Search Command
 * Search the web using Google Custom Search or DuckDuckGo fallback
 */

const { SlashCommandBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const googleService = require('../services/googleService');
const googleHandler = require('../handlers/googleHandler');
const { cooldownManager, COOLDOWN_SETTINGS } = require('../shared/utils/cooldown');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('google')
        .setDescription('Search the web')
        .addSubcommand(sub => sub
            .setName('search')
            .setDescription('Search for websites and information')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('What to search for')
                    .setRequired(true)
                    .setMaxLength(200)
            )
            .addBooleanOption(option =>
                option.setName('safe')
                    .setDescription('Enable SafeSearch filter (default: true)')
                    .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('image')
            .setDescription('Open image search in browser')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('What to search for')
                    .setRequired(true)
                    .setMaxLength(200)
            )
        ),

    async execute(interaction) {
        // Access control
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        // Cooldown check
        const cooldown = cooldownManager.check(interaction.user.id, 'google', COOLDOWN_SETTINGS.google);
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [googleHandler.createCooldownEmbed(cooldown.remaining)],
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const query = interaction.options.getString('query');

        if (subcommand === 'image') {
            // Direct link to image search
            const searchEngine = googleService.getSearchEngine();
            const url = searchEngine === 'Google'
                ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`
                : `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
            
            return interaction.reply({
                content: `🖼️ **Image Search:** [Click here to search "${query}"](${url})`,
                ephemeral: false
            });
        }

        await interaction.deferReply();

        try {
            const safeSearch = interaction.options.getBoolean('safe') ?? true;
            
            const result = await googleService.search(query, { 
                safeSearch,
                maxResults: 5 
            });

            if (!result.success) {
                return interaction.editReply({
                    embeds: [googleHandler.createErrorEmbed(result.error)]
                });
            }

            const embed = googleHandler.createResultsEmbed(query, result.results, {
                totalResults: result.totalResults,
                searchEngine: result.searchEngine
            });
            
            const buttons = googleHandler.createSearchButtons(query, result.searchEngine);

            await interaction.editReply({ embeds: [embed], components: [buttons] });
        } catch (error) {
            console.error('[Google Command Error]', error);
            await interaction.editReply({
                embeds: [googleHandler.createErrorEmbed('An unexpected error occurred. Please try again.')]
            });
        }
    }
};
