/**
 * Wikipedia Command
 * Search and display Wikipedia articles with full features
 */

const { SlashCommandBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const wikipediaService = require('../services/wikipediaService');
const wikipediaHandler = require('../handlers/wikipediaHandler');
const { cooldownManager, COOLDOWN_SETTINGS } = require('../shared/utils/cooldown');

// Cache for search results (for select menu handling)
const searchCache = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wikipedia')
        .setDescription('Search and browse Wikipedia articles')
        .addSubcommand(sub => sub
            .setName('search')
            .setDescription('Search for Wikipedia articles')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('What to search for')
                    .setRequired(true)
                    .setMaxLength(200)
                    .setAutocomplete(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('article')
            .setDescription('Get a specific article by title')
            .addStringOption(option =>
                option.setName('title')
                    .setDescription('Article title')
                    .setRequired(true)
                    .setMaxLength(200)
                    .setAutocomplete(true)
            )
            .addStringOption(option =>
                option.setName('language')
                    .setDescription('Wikipedia language')
                    .setRequired(false)
                    .addChoices(
                        { name: 'English', value: 'en' },
                        { name: 'Japanese', value: 'ja' },
                        { name: 'German', value: 'de' },
                        { name: 'French', value: 'fr' },
                        { name: 'Spanish', value: 'es' }
                    )
            )
        )
        .addSubcommand(sub => sub
            .setName('random')
            .setDescription('Get a random Wikipedia article')
            .addStringOption(option =>
                option.setName('language')
                    .setDescription('Wikipedia language')
                    .setRequired(false)
                    .addChoices(
                        { name: 'English', value: 'en' },
                        { name: 'Japanese', value: 'ja' },
                        { name: 'German', value: 'de' },
                        { name: 'French', value: 'fr' },
                        { name: 'Spanish', value: 'es' }
                    )
            )
        )
        .addSubcommand(sub => sub
            .setName('today')
            .setDescription('Get events that happened on this day in history')
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        
        if (!focused || focused.length < 2) {
            return interaction.respond([]).catch(() => {});
        }

        try {
            const result = await wikipediaService.search(focused, { limit: 8 });
            
            if (!result.success || result.results.length === 0) {
                return interaction.respond([]).catch(() => {});
            }

            const choices = result.results.map(r => ({
                name: r.title.substring(0, 100),
                value: r.title.substring(0, 100)
            }));

            await interaction.respond(choices).catch(() => {});
        } catch (error) {
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        // Access control
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        // Cooldown check
        const cooldown = cooldownManager.check(interaction.user.id, 'wikipedia', COOLDOWN_SETTINGS.wikipedia);
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [wikipediaHandler.createCooldownEmbed(cooldown.remaining)],
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply();

        try {
            switch (subcommand) {
                case 'search': {
                    const query = interaction.options.getString('query');
                    const result = await wikipediaService.search(query);

                    if (!result.success) {
                        return interaction.editReply({
                            embeds: [wikipediaHandler.createErrorEmbed(result.error)]
                        });
                    }

                    if (result.results.length === 0) {
                        return interaction.editReply({
                            embeds: [wikipediaHandler.createSearchResultsEmbed(query, [])]
                        });
                    }

                    // If only one result, show the article directly
                    if (result.results.length === 1) {
                        const articleResult = await wikipediaService.getArticleSummary(result.results[0].title);
                        if (articleResult.success) {
                            const embed = wikipediaHandler.createArticleEmbed(articleResult.article);
                            const buttons = wikipediaHandler.createArticleButtons(articleResult.article, interaction.user.id);
                            return interaction.editReply({ embeds: [embed], components: [buttons] });
                        }
                    }

                    // Cache results for select menu
                    searchCache.set(interaction.user.id, {
                        results: result.results,
                        expiresAt: Date.now() + 300000
                    });

                    const embed = wikipediaHandler.createSearchResultsEmbed(query, result.results);
                    const selectMenu = wikipediaHandler.createSearchSelectMenu(result.results, interaction.user.id);
                    
                    const components = selectMenu ? [selectMenu] : [];
                    await interaction.editReply({ embeds: [embed], components });
                    break;
                }

                case 'article': {
                    const title = interaction.options.getString('title');
                    const language = interaction.options.getString('language') || 'en';
                    
                    const result = await wikipediaService.getArticleSummary(title, language);

                    if (!result.success) {
                        return interaction.editReply({
                            embeds: [wikipediaHandler.createErrorEmbed(result.error)]
                        });
                    }

                    const embed = wikipediaHandler.createArticleEmbed(result.article);
                    const buttons = wikipediaHandler.createArticleButtons(result.article, interaction.user.id);
                    
                    await interaction.editReply({ embeds: [embed], components: [buttons] });
                    break;
                }

                case 'random': {
                    const language = interaction.options.getString('language') || 'en';
                    const result = await wikipediaService.getRandomArticle(language);

                    if (!result.success) {
                        return interaction.editReply({
                            embeds: [wikipediaHandler.createErrorEmbed(result.error)]
                        });
                    }

                    const embed = wikipediaHandler.createRandomArticleEmbed(result.article);
                    const buttons = wikipediaHandler.createArticleButtons(result.article, interaction.user.id);
                    
                    await interaction.editReply({ embeds: [embed], components: [buttons] });
                    break;
                }

                case 'today': {
                    const now = new Date();
                    const result = await wikipediaService.getOnThisDay(now.getMonth() + 1, now.getDate());

                    if (!result.success) {
                        return interaction.editReply({
                            embeds: [wikipediaHandler.createErrorEmbed(result.error)]
                        });
                    }

                    const embed = wikipediaHandler.createOnThisDayEmbed(result.events, result.date);
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                default:
                    await interaction.editReply({
                        embeds: [wikipediaHandler.createErrorEmbed('Unknown subcommand.')]
                    });
            }
        } catch (error) {
            console.error('[Wikipedia Command Error]', error);
            await interaction.editReply({
                embeds: [wikipediaHandler.createErrorEmbed('An unexpected error occurred. Please try again.')]
            });
        }
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const userId = parts[2];

        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ This button is not for you!',
                ephemeral: true
            });
        }

        if (action === 'random') {
            await interaction.deferUpdate();
            
            try {
                const result = await wikipediaService.getRandomArticle();
                
                if (!result.success) {
                    return interaction.followUp({
                        embeds: [wikipediaHandler.createErrorEmbed(result.error)],
                        ephemeral: true
                    });
                }

                const embed = wikipediaHandler.createRandomArticleEmbed(result.article);
                const buttons = wikipediaHandler.createArticleButtons(result.article, interaction.user.id);
                
                await interaction.editReply({ embeds: [embed], components: [buttons] });
            } catch (error) {
                console.error('[Wikipedia Button Error]', error);
            }
        }
    },

    async handleSelectMenu(interaction) {
        if (!interaction.customId.startsWith('wiki_search_')) return;

        const userId = interaction.customId.split('_')[2];
        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ This menu is not for you!',
                ephemeral: true
            });
        }

        const selectedValue = interaction.values[0];
        const parts = selectedValue.split('_');
        const index = parseInt(parts[2]);

        const cached = searchCache.get(interaction.user.id);
        if (!cached || Date.now() > cached.expiresAt) {
            return interaction.reply({
                content: '❌ Search results expired. Please search again.',
                ephemeral: true
            });
        }

        const selectedResult = cached.results[index];
        if (!selectedResult) {
            return interaction.reply({
                content: '❌ Invalid selection.',
                ephemeral: true
            });
        }

        await interaction.deferUpdate();

        try {
            const result = await wikipediaService.getArticleSummary(selectedResult.title);

            if (!result.success) {
                return interaction.followUp({
                    embeds: [wikipediaHandler.createErrorEmbed(result.error)],
                    ephemeral: true
                });
            }

            const embed = wikipediaHandler.createArticleEmbed(result.article);
            const buttons = wikipediaHandler.createArticleButtons(result.article, interaction.user.id);
            
            await interaction.editReply({ embeds: [embed], components: [buttons] });
        } catch (error) {
            console.error('[Wikipedia SelectMenu Error]', error);
        }
    }
};
