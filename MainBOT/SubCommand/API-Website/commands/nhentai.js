/**
 * NHentai Command
 * Browse and read nhentai doujins with full page pagination
 * NSFW only - requires age verification channel
 */

const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const nhentaiService = require('../services/nhentaiService');
const nhentaiHandler = require('../handlers/nhentaiHandler');
const { cooldownManager, COOLDOWN_SETTINGS } = require('../shared/utils/cooldown');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nhentai')
        .setDescription('Browse and read nhentai doujins')
        .setNSFW(true)
        .addSubcommand(sub => sub
            .setName('code')
            .setDescription('Fetch a doujin by its 6-digit code')
            .addIntegerOption(option =>
                option.setName('id')
                    .setDescription('The gallery code (e.g., 177013)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(999999)
            )
        )
        .addSubcommand(sub => sub
            .setName('random')
            .setDescription('Get a random doujin')
        )
        .addSubcommand(sub => sub
            .setName('popular')
            .setDescription('Get a popular doujin')
        )
        .addSubcommand(sub => sub
            .setName('read')
            .setDescription('Read a doujin by code starting from a specific page')
            .addIntegerOption(option =>
                option.setName('id')
                    .setDescription('The gallery code')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(999999)
            )
            .addIntegerOption(option =>
                option.setName('page')
                    .setDescription('Starting page number (default: 1)')
                    .setRequired(false)
                    .setMinValue(1)
            )
        ),

    async execute(interaction) {
        // Access control
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        // NSFW channel check
        if (!interaction.channel.nsfw) {
            return interaction.reply({
                embeds: [nhentaiHandler.createErrorEmbed('This command can only be used in **NSFW channels**.\n\nAsk a server admin to mark this channel as age-restricted.')],
                ephemeral: true
            });
        }

        // Cooldown check
        const cooldown = cooldownManager.check(interaction.user.id, 'nhentai', COOLDOWN_SETTINGS.nhentai);
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [nhentaiHandler.createCooldownEmbed(cooldown.remaining)],
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply();

        try {
            let result;
            let isRandom = false;
            let isPopular = false;

            switch (subcommand) {
                case 'code': {
                    const code = interaction.options.getInteger('id');
                    result = await nhentaiService.fetchGallery(code);
                    break;
                }
                case 'random': {
                    result = await nhentaiService.fetchRandomGallery();
                    isRandom = true;
                    break;
                }
                case 'popular': {
                    result = await nhentaiService.fetchPopularGallery();
                    isPopular = true;
                    break;
                }
                case 'read': {
                    const code = interaction.options.getInteger('id');
                    const startPage = interaction.options.getInteger('page') || 1;
                    result = await nhentaiService.fetchGallery(code);
                    
                    if (result.success) {
                        // Validate page number
                        if (startPage > result.data.num_pages) {
                            return interaction.editReply({
                                embeds: [nhentaiHandler.createErrorEmbed(`Invalid page. This gallery only has **${result.data.num_pages}** pages.`)]
                            });
                        }
                        
                        // Start reading mode
                        nhentaiHandler.setPageSession(interaction.user.id, result.data, startPage);
                        const embed = nhentaiHandler.createPageEmbed(result.data, startPage);
                        const buttons = nhentaiHandler.createPageButtons(result.data.id, interaction.user.id, startPage, result.data.num_pages);
                        
                        return interaction.editReply({ embeds: [embed], components: buttons });
                    }
                    break;
                }
                default:
                    return interaction.editReply({ embeds: [nhentaiHandler.createErrorEmbed('Unknown subcommand.')] });
            }

            if (!result.success) {
                return interaction.editReply({ embeds: [nhentaiHandler.createErrorEmbed(result.error)] });
            }

            // Create gallery info view
            const embed = nhentaiHandler.createGalleryEmbed(result.data, { isRandom, isPopular });
            const buttons = nhentaiHandler.createMainButtons(result.data.id, interaction.user.id, result.data.num_pages);
            
            // Store gallery for potential reading
            nhentaiHandler.setPageSession(interaction.user.id, result.data, 1);
            
            await interaction.editReply({ embeds: [embed], components: buttons });
        } catch (error) {
            console.error('[NHentai Command Error]', error);
            await interaction.editReply({
                embeds: [nhentaiHandler.createErrorEmbed('An unexpected error occurred. Please try again.')]
            });
        }
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const userId = parts[parts.length - 1];

        // Verify button owner
        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ These buttons are not for you!',
                ephemeral: true
            });
        }

        try {
            switch (action) {
                case 'random':
                case 'popular': {
                    await interaction.deferUpdate();
                    
                    const result = action === 'random' 
                        ? await nhentaiService.fetchRandomGallery()
                        : await nhentaiService.fetchPopularGallery();
                    
                    if (!result.success) {
                        return interaction.followUp({ 
                            embeds: [nhentaiHandler.createErrorEmbed(result.error)],
                            ephemeral: true 
                        });
                    }
                    
                    nhentaiHandler.setPageSession(interaction.user.id, result.data, 1);
                    const embed = nhentaiHandler.createGalleryEmbed(result.data, { 
                        isRandom: action === 'random', 
                        isPopular: action === 'popular' 
                    });
                    const buttons = nhentaiHandler.createMainButtons(result.data.id, interaction.user.id, result.data.num_pages);
                    
                    await interaction.editReply({ embeds: [embed], components: buttons });
                    break;
                }

                case 'read': {
                    // Start reading from page 1
                    const galleryId = parts[2];
                    await interaction.deferUpdate();
                    
                    const session = nhentaiHandler.getPageSession(interaction.user.id);
                    if (!session || session.galleryId !== parseInt(galleryId)) {
                        // Fetch gallery if not in cache
                        const result = await nhentaiService.fetchGallery(galleryId);
                        if (!result.success) {
                            return interaction.followUp({
                                embeds: [nhentaiHandler.createErrorEmbed(result.error)],
                                ephemeral: true
                            });
                        }
                        nhentaiHandler.setPageSession(interaction.user.id, result.data, 1);
                    }
                    
                    const updatedSession = nhentaiHandler.getPageSession(interaction.user.id);
                    const embed = nhentaiHandler.createPageEmbed(updatedSession.gallery, 1);
                    const buttons = nhentaiHandler.createPageButtons(updatedSession.galleryId, interaction.user.id, 1, updatedSession.totalPages);
                    
                    await interaction.editReply({ embeds: [embed], components: buttons });
                    break;
                }

                case 'first':
                case 'prev':
                case 'next':
                case 'last': {
                    const galleryId = parts[2];
                    await interaction.deferUpdate();
                    
                    const session = nhentaiHandler.getPageSession(interaction.user.id);
                    if (!session) {
                        return interaction.followUp({
                            content: '❌ Session expired. Please use the command again.',
                            ephemeral: true
                        });
                    }
                    
                    let newPage = session.currentPage;
                    switch (action) {
                        case 'first': newPage = 1; break;
                        case 'prev': newPage = Math.max(1, session.currentPage - 1); break;
                        case 'next': newPage = Math.min(session.totalPages, session.currentPage + 1); break;
                        case 'last': newPage = session.totalPages; break;
                    }
                    
                    nhentaiHandler.updatePageSession(interaction.user.id, newPage);
                    const embed = nhentaiHandler.createPageEmbed(session.gallery, newPage);
                    const buttons = nhentaiHandler.createPageButtons(session.galleryId, interaction.user.id, newPage, session.totalPages);
                    
                    await interaction.editReply({ embeds: [embed], components: buttons });
                    break;
                }

                case 'jump': {
                    // Show modal for page input
                    const galleryId = parts[2];
                    const session = nhentaiHandler.getPageSession(interaction.user.id);
                    
                    if (!session) {
                        return interaction.reply({
                            content: '❌ Session expired. Please use the command again.',
                            ephemeral: true
                        });
                    }
                    
                    const modal = new ModalBuilder()
                        .setCustomId(`nhentai_jumpto_${galleryId}_${userId}`)
                        .setTitle('Jump to Page');
                    
                    const pageInput = new TextInputBuilder()
                        .setCustomId('page_number')
                        .setLabel(`Enter page number (1-${session.totalPages})`)
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g., 15')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(4);
                    
                    modal.addComponents(new ActionRowBuilder().addComponents(pageInput));
                    await interaction.showModal(modal);
                    break;
                }

                case 'info': {
                    // Show gallery info
                    const galleryId = parts[2];
                    await interaction.deferUpdate();
                    
                    let session = nhentaiHandler.getPageSession(interaction.user.id);
                    if (!session || session.galleryId !== parseInt(galleryId)) {
                        const result = await nhentaiService.fetchGallery(galleryId);
                        if (!result.success) {
                            return interaction.followUp({
                                embeds: [nhentaiHandler.createErrorEmbed(result.error)],
                                ephemeral: true
                            });
                        }
                        nhentaiHandler.setPageSession(interaction.user.id, result.data, 1);
                        session = nhentaiHandler.getPageSession(interaction.user.id);
                    }
                    
                    const embed = nhentaiHandler.createGalleryEmbed(session.gallery);
                    const buttons = nhentaiHandler.createMainButtons(session.galleryId, interaction.user.id, session.totalPages);
                    
                    await interaction.editReply({ embeds: [embed], components: buttons });
                    break;
                }

                default:
                    await interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
            }
        } catch (error) {
            console.error('[NHentai Button Error]', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred. Please try again.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    },

    async handleModal(interaction) {
        if (!interaction.customId.startsWith('nhentai_jumpto_')) return;
        
        const parts = interaction.customId.split('_');
        const galleryId = parts[2];
        const userId = parts[3];
        
        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ This modal is not for you!',
                ephemeral: true
            });
        }
        
        const pageInput = interaction.fields.getTextInputValue('page_number');
        const pageNum = parseInt(pageInput, 10);
        
        const session = nhentaiHandler.getPageSession(interaction.user.id);
        if (!session) {
            return interaction.reply({
                content: '❌ Session expired. Please use the command again.',
                ephemeral: true
            });
        }
        
        if (isNaN(pageNum) || pageNum < 1 || pageNum > session.totalPages) {
            return interaction.reply({
                content: `❌ Invalid page number. Please enter a number between 1 and ${session.totalPages}.`,
                ephemeral: true
            });
        }
        
        await interaction.deferUpdate();
        
        nhentaiHandler.updatePageSession(interaction.user.id, pageNum);
        const embed = nhentaiHandler.createPageEmbed(session.gallery, pageNum);
        const buttons = nhentaiHandler.createPageButtons(session.galleryId, interaction.user.id, pageNum, session.totalPages);
        
        await interaction.editReply({ embeds: [embed], components: buttons });
    }
};
