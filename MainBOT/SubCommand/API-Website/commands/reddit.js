const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const redditService = require('../services/redditService');
const redditCache = require('../repositories/redditCache');
const postHandler = require('../handlers/redditPostHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reddit')
        .setDescription('Fetches posts from Reddit')
        .addSubcommand(sub =>
            sub.setName('browse')
                .setDescription('Browse a specific subreddit')
                .addStringOption(option =>
                    option.setName('subreddit')
                        .setDescription('The subreddit to fetch')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('sort')
                        .setDescription('How to sort the posts')
                        .setRequired(false)
                        .addChoices(
                            { name: '🔥 Hot', value: 'hot' },
                            { name: '⭐ Best', value: 'best' },
                            { name: '🏆 Top', value: 'top' },
                            { name: '🆕 New', value: 'new' },
                            { name: '📈 Rising', value: 'rising' }
                        )
                )
                .addStringOption(option =>
                    option.setName('count')
                        .setDescription('Number of posts to fetch (default: 5)')
                        .setRequired(false)
                        .addChoices(
                            { name: '5 posts', value: '5' },
                            { name: '10 posts', value: '10' },
                            { name: '15 posts', value: '15' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('trending')
                .setDescription('See what\'s trending on Reddit right now')
                .addStringOption(option =>
                    option.setName('source')
                        .setDescription('Where to get trending posts from')
                        .setRequired(false)
                        .addChoices(
                            { name: '🌍 r/popular (Global)', value: 'popular' },
                            { name: '🌐 r/all (Everything)', value: 'all' }
                        )
                )
                .addStringOption(option =>
                    option.setName('count')
                        .setDescription('Number of posts to fetch (default: 10)')
                        .setRequired(false)
                        .addChoices(
                            { name: '5 posts', value: '5' },
                            { name: '10 posts', value: '10' },
                            { name: '15 posts', value: '15' },
                            { name: '20 posts', value: '20' }
                        )
                )
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();

        if (!focused || focused.length < 2) {
            return interaction.respond([]).catch(() => {});
        }

        try {
            // Set a timeout to ensure we respond within 3 seconds
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 2500)
            );

            const searchPromise = redditService.searchSubreddits(focused, 8);

            const subreddits = await Promise.race([searchPromise, timeoutPromise]);

            const choices = subreddits.map(sub => ({
                name: `${sub.displayName} — ${sub.title}`.slice(0, 100),
                value: sub.name
            }));

            await interaction.respond(choices).catch(() => {});
        } catch (error) {
            // Silently fail - autocomplete errors are non-critical
            console.log('[Reddit Autocomplete] Timeout or error, responding with empty');
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        // Access control check
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'trending') {
            return this.handleTrending(interaction);
        }

        // Default: browse subcommand
        return this.handleBrowse(interaction);
    },

    async handleBrowse(interaction) {
        const subreddit = interaction.options.getString('subreddit').replace(/\s/g, '').trim();
        const sortBy = interaction.options.getString('sort') || 'top';
        const count = parseInt(interaction.options.getString('count') || '5');
        
        // Check if channel is NSFW-enabled (for filtering NSFW posts)
        const isNsfwChannel = interaction.channel?.nsfw || false;

        await interaction.deferReply();

        const sortNames = {
            hot: 'Hot', best: 'Best', top: 'Top', new: 'New', rising: 'Rising'
        };

        const loadingEmbed = new EmbedBuilder()
            .setTitle('🔄 Fetching Posts...')
            .setDescription(`Retrieving **${count} ${sortNames[sortBy]}** posts from **r/${subreddit}**\n\nThis may take a moment...`)
            .setColor('#FF4500')
            .setThumbnail('https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png')
            .setFooter({ text: 'Powered by FumoBOT' })
            .setTimestamp();

        await interaction.editReply({ embeds: [loadingEmbed] });

        // Small delay for rate limiting
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1500));

        const result = await redditService.fetchSubredditPosts(subreddit, sortBy, count);

        if (result.error === 'not_found') {
            const similarSubreddits = await redditService.searchSimilarSubreddits(subreddit);
            const embed = postHandler.createNotFoundEmbed(subreddit, similarSubreddits);
            return interaction.editReply({ embeds: [embed] });
        }

        if (result.error || !result.posts || result.posts.length === 0) {
            return interaction.editReply({
                content: `⚠️ **No posts found in r/${subreddit}**\nThe subreddit might be private or have no recent posts.`
            });
        }

        // Filter out NSFW posts if channel is not NSFW-enabled
        let filteredPosts = result.posts;
        if (!isNsfwChannel) {
            filteredPosts = result.posts.filter(post => !post.nsfw);
            if (filteredPosts.length === 0 && result.posts.length > 0) {
                const nsfwEmbed = new EmbedBuilder()
                    .setTitle('🔞 NSFW Content Only')
                    .setDescription(`All posts from **r/${subreddit}** are marked NSFW.\n\nTo view NSFW content, use this command in an **age-restricted channel**.`)
                    .setColor('#ED4245')
                    .setFooter({ text: 'Channel must be marked as NSFW in Discord settings' });
                return interaction.editReply({ embeds: [nsfwEmbed] });
            }
        }

        // Store in cache
        redditCache.setPosts(interaction.user.id, filteredPosts);
        redditCache.setPage(interaction.user.id, 0);
        redditCache.setSort(interaction.user.id, sortBy);
        redditCache.setNsfwChannel(interaction.user.id, isNsfwChannel);

        await postHandler.sendPostListEmbed(interaction, subreddit, filteredPosts, sortBy, 0, isNsfwChannel);
    },

    async handleTrending(interaction) {
        const source = interaction.options.getString('source') || 'popular';
        const count = parseInt(interaction.options.getString('count') || '10');
        
        const isNsfwChannel = interaction.channel?.nsfw || false;

        await interaction.deferReply();

        const sourceNames = {
            popular: 'r/popular',
            all: 'r/all'
        };

        const loadingEmbed = new EmbedBuilder()
            .setTitle('🔥 Fetching Trending Posts...')
            .setDescription(`Getting **${count}** hot posts from **${sourceNames[source]}**\n\nThis may take a moment...`)
            .setColor('#FF4500')
            .setThumbnail('https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png')
            .setFooter({ text: 'Powered by FumoBOT' })
            .setTimestamp();

        await interaction.editReply({ embeds: [loadingEmbed] });

        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1500));

        let result;
        if (source === 'all') {
            result = await redditService.fetchAllPosts('hot', count);
        } else {
            result = await redditService.fetchTrendingPosts('global', count);
        }

        if (result.error || !result.posts || result.posts.length === 0) {
            return interaction.editReply({
                content: `⚠️ **Failed to fetch trending posts**\nPlease try again later.`
            });
        }

        // Filter NSFW
        let filteredPosts = result.posts;
        if (!isNsfwChannel) {
            filteredPosts = result.posts.filter(post => !post.nsfw);
            if (filteredPosts.length === 0) {
                const nsfwEmbed = new EmbedBuilder()
                    .setTitle('🔞 NSFW Content Filtered')
                    .setDescription(`Most trending posts are currently NSFW.\n\nTo view NSFW content, use this command in an **age-restricted channel**.`)
                    .setColor('#ED4245')
                    .setFooter({ text: 'Channel must be marked as NSFW in Discord settings' });
                return interaction.editReply({ embeds: [nsfwEmbed] });
            }
        }

        // Store in cache
        redditCache.setPosts(interaction.user.id, filteredPosts);
        redditCache.setPage(interaction.user.id, 0);
        redditCache.setSort(interaction.user.id, 'hot');
        redditCache.setNsfwChannel(interaction.user.id, isNsfwChannel);

        // Use 'trending' as subreddit name for display
        const displayName = source === 'all' ? 'all (Trending)' : 'popular (Trending)';
        await postHandler.sendPostListEmbed(interaction, displayName, filteredPosts, 'hot', 0, isNsfwChannel);
    },

    async handleButton(interaction) {
        if (!interaction.isButton()) return;

        const customId = interaction.customId;
        const userId = interaction.user.id;

        // Extract user ID from button
        const parts = customId.split('_');
        const buttonUserId = parts[parts.length - 1];

        if (userId !== buttonUserId) {
            return interaction.reply({ content: '❌ This button is not for you!', ephemeral: true });
        }

        const posts = redditCache.getPosts(userId);
        if (!posts || posts.length === 0) {
            return interaction.reply({ content: '⚠️ Post data expired. Please run the command again.', ephemeral: true });
        }

        await interaction.deferUpdate();

        try {
            // Page navigation
            if (customId.startsWith('reddit_prev_') || customId.startsWith('reddit_next_')) {
                let currentPage = redditCache.getPage(userId);
                const totalPages = Math.ceil(posts.length / postHandler.POSTS_PER_PAGE);

                if (customId.startsWith('reddit_prev_')) {
                    currentPage = Math.max(0, currentPage - 1);
                } else {
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                }

                redditCache.setPage(userId, currentPage);
                const subreddit = posts[0].permalink.split('/')[4];
                const sortBy = redditCache.getSort(userId);
                await postHandler.sendPostListEmbed(interaction, subreddit, posts, sortBy, currentPage);
                return;
            }

            // Show post details
            if (customId.startsWith('reddit_show_')) {
                const postIndex = parseInt(parts[2]);
                if (!posts[postIndex]) {
                    return interaction.followUp({ content: '⚠️ Post not found.', ephemeral: true });
                }
                await postHandler.showPostDetails(interaction, posts[postIndex], postIndex, userId);
                return;
            }

            // Gallery navigation
            if (customId.startsWith('reddit_gprev_') || customId.startsWith('reddit_gnext_')) {
                const postIndex = parseInt(parts[2]);
                const post = posts[postIndex];
                if (!post || post.contentType !== 'gallery') return;

                let galleryPage = redditCache.getGalleryPage(userId, postIndex);

                if (customId.startsWith('reddit_gprev_')) {
                    galleryPage = Math.max(0, galleryPage - 1);
                } else {
                    galleryPage = Math.min(post.gallery.length - 1, galleryPage + 1);
                }

                redditCache.setGalleryPage(userId, postIndex, galleryPage);
                await postHandler.showPostDetails(interaction, post, postIndex, userId);
                return;
            }

            // Close gallery / back to post
            if (customId.startsWith('reddit_gclose_')) {
                const postIndex = parseInt(parts[2]);
                redditCache.setGalleryPage(userId, postIndex, 0);
                await postHandler.showPostDetails(interaction, posts[postIndex], postIndex, userId);
                return;
            }

            // Back to list
            if (customId.startsWith('reddit_back_')) {
                redditCache.clearGalleryStates(userId);
                const currentPage = redditCache.getPage(userId);
                const subreddit = posts[0].permalink.split('/')[4];
                const sortBy = redditCache.getSort(userId);
                await postHandler.sendPostListEmbed(interaction, subreddit, posts, sortBy, currentPage);
                return;
            }

        } catch (error) {
            console.error('Reddit button handler error:', error);
            await interaction.followUp({ content: '❌ An error occurred. Please try again.', ephemeral: true }).catch(() => {});
        }
    }
};