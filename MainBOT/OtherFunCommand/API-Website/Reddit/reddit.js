const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { Buffer } = require('buffer');
require('dotenv').config({ path: __dirname + '/.env' });

// Reddit API credentials
const clientId = process.env.CLIENT_ID;
const secret = process.env.SECRET_KEY;

const userPostsMap = new Map();
const userGalleryState = new Map(); // Track gallery pagination state

async function getAccessToken() {
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
    try {
        const response = await axios.post(
            'https://www.reddit.com/api/v1/access_token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error.response ? error.response.data : error);
    }
}

// Live search/autocomplete handler for subreddit names
async function autocomplete(interaction) {
    console.log('📝 Reddit autocomplete called');
    const focused = interaction.options.getFocused();
    console.log('Focused value:', focused);

    if (!focused) {
        console.log('No focused value, returning empty');
        return interaction.respond([]);
    }

    try {
        console.log('Searching subreddits for:', focused);
        const res = await axios.get(
            `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(focused)}&limit=10`,
            { headers: { 'User-Agent': 'DiscordBot/1.0 by YourRedditUsername' }, timeout: 5000 }
        );

        console.log('Reddit API response status:', res.status);
        console.log('Results found:', res.data?.data?.children?.length || 0);

        const subs = res.data.data.children.map(c => ({
            name: `${c.data.display_name_prefixed} — ${c.data.title}`.slice(0, 100),
            value: c.data.display_name
        }));

        console.log('Sending autocomplete options:', subs.length);
        await interaction.respond(subs);
    } catch (err) {
        console.error("Autocomplete failed:", err.message);
        await interaction.respond([]);
    }
}

async function searchSimilarSubreddits(subreddit) {
    const token = await getAccessToken();
    if (!token) return [];
    try {
        const response = await axios.get(`https://oauth.reddit.com/subreddits/search`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'YourAppName/1.0 by YourRedditUsername'
            },
            params: {
                q: subreddit,
                limit: 5,
                sort: 'relevance'
            }
        });
        if (response.data && response.data.data && response.data.data.children) {
            return response.data.data.children.map(child => child.data.display_name);
        } else {
            return [];
        }
    } catch (error) {
        console.error('Error fetching similar subreddits:', error.response ? error.response.data : error);
        return [];
    }
}

async function fetchRedditData(subreddit, sortBy = 'top') {
    const token = await getAccessToken();
    if (!token) return null;
    try {
        const aboutResponse = await axios.get(`https://oauth.reddit.com/r/${subreddit}/about`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'YourAppName/1.0 by YourRedditUsername'
            }
        });
        if (!aboutResponse.data || aboutResponse.data.kind !== 't5') {
            return 'not_found';
        }
        const rateLimitRemaining = aboutResponse.headers['x-ratelimit-remaining'];
        if (rateLimitRemaining < 5) {
            return null;
        }

        // Build the endpoint based on sort type
        let endpoint = `https://oauth.reddit.com/r/${subreddit}/${sortBy}`;
        let params = { limit: 5 };

        // Add time parameter for 'top' sort
        if (sortBy === 'top') {
            params.t = 'day';
        }

        const response = await axios.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'YourAppName/1.0 by YourRedditUsername'
            },
            params: params
        });
        if (!response.data || !response.data.data || !response.data.data.children) {
            return null;
        }
        return response.data.data.children.map(child => {
            const postData = child.data;
            const upvotes = postData.ups ?? 0;
            const downvotes = postData.downs ?? 0;
            const comments = postData.num_comments ?? 0;
            const awards = postData.total_awards_received ?? 0;

            let fullSizeImage = null;
            if (postData.preview && postData.preview.images && postData.preview.images[0]) {
                const source = postData.preview.images[0].source;
                fullSizeImage = source.url.replace(/&amp;/g, '&');
            }

            let galleryImages = [];
            if (postData.gallery_data && postData.media_metadata) {
                galleryImages = postData.gallery_data.items.map(item => {
                    const mediaId = item.media_id;
                    const media = postData.media_metadata[mediaId];
                    if (media && media.s && media.s.u) {
                        return media.s.u.replace(/&amp;/g, '&');
                    }
                    return null;
                }).filter(url => url !== null);
            }

            let videoUrl = null;
            let isVideo = false;
            if (postData.is_video && postData.media && postData.media.reddit_video) {
                videoUrl = postData.media.reddit_video.fallback_url;
                isVideo = true;
            }

            // Get selftext (text content)
            let selftext = postData.selftext || '';
            let selftextHtml = postData.selftext_html || '';

            // Detect content type
            let contentType = 'text';
            if (isVideo) contentType = 'video';
            else if (galleryImages.length > 0) contentType = 'gallery';
            else if (fullSizeImage) contentType = 'image';

            return {
                title: postData.title || '[No Title]',
                url: postData.url || '[No URL]',
                image: fullSizeImage,
                gallery: galleryImages,
                video: videoUrl,
                isVideo: isVideo,
                contentType: contentType,
                selftext: selftext,
                permalink: `https://reddit.com${postData.permalink}`,
                upvotes: upvotes,
                downvotes: downvotes,
                comments: comments,
                awards: awards,
                author: postData.author || '[deleted]',
                nsfw: postData.over_18 || false,
                created: postData.created_utc || null
            };
        });
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return 'not_found';
        } else {
            console.error(`Error fetching Reddit data from /r/${subreddit}:`, error.response ? error.response.data : error);
            return null;
        }
    }
}

async function handleSubredditNotFound(interaction, subreddit) {
    const similarSubreddits = await searchSimilarSubreddits(subreddit);
    if (similarSubreddits.length > 0) {
        const embed = new EmbedBuilder()
            .setTitle(`❌ Subreddit Not Found`)
            .setDescription(`**r/${subreddit}** doesn't exist, but check out these similar subreddits:`)
            .setColor('#FF4500')
            .setFooter({ text: 'Use /reddit [subreddit] to try again' })
            .setTimestamp();

        const fields = similarSubreddits.map((sub, index) => ({
            name: `${index + 1}. r/${sub}`,
            value: `[Visit](https://reddit.com/r/${sub})`,
            inline: true
        }));
        embed.addFields(fields);

        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.editReply(`❌ **Couldn't find r/${subreddit}**\nPlease check the spelling and try again.`);
    }
}

async function sendTopPostsEmbed(interaction, subreddit, posts, sortBy = 'top') {
    const postCount = posts.length;

    const sortEmojis = {
        'hot': '🔥',
        'best': '⭐',
        'top': '🏆',
        'new': '🆕',
        'rising': '📈'
    };

    const sortNames = {
        'hot': 'Hot',
        'best': 'Best',
        'top': 'Top',
        'new': 'New',
        'rising': 'Rising'
    };

    const emoji = sortEmojis[sortBy] || '🔥';
    const sortName = sortNames[sortBy] || 'Top';

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${sortName} ${postCount} Posts from r/${subreddit}`)
        .setDescription('Select a post below to view full details, media, and content!')
        .setColor('#FF4500')
        .setFooter({ text: 'Powered by alterGolden • Reddit API' })
        .setTimestamp();

    const fields = posts.map((post, index) => {
        const contentIcon = {
            'video': '🎥',
            'gallery': '🖼️',
            'image': '📷',
            'text': '📝'
        }[post.contentType] || '📝';

        const nsfwTag = post.nsfw ? '🔞 ' : '';

        return {
            name: `${index + 1}. ${nsfwTag}${contentIcon} ${post.title.slice(0, 80)}${post.title.length > 80 ? '...' : ''}`,
            value: `👍 ${formatNumber(post.upvotes)} | 💬 ${formatNumber(post.comments)} | 🏆 ${post.awards}\n[View on Reddit](${post.permalink})`,
            inline: false
        };
    });

    embed.addFields(fields);

    const actionRows = createPostButtons(postCount, interaction.user.id);
    await interaction.editReply({ embeds: [embed], components: actionRows });
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function createPostButtons(postCount, userId) {
    const rows = [];
    const row1 = new ActionRowBuilder();

    for (let i = 0; i < Math.min(postCount, 5); i++) {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`show_post_${i}_${userId}`)
                .setLabel(`Post ${i + 1}`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📖')
        );
    }
    rows.push(row1);

    return rows;
}

function createGalleryButtons(currentPage, totalPages, postIndex, userId) {
    const row = new ActionRowBuilder();

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`gallery_prev_${postIndex}_${userId}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`gallery_page_${postIndex}_${userId}`)
            .setLabel(`${currentPage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`gallery_next_${postIndex}_${userId}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('▶️')
            .setDisabled(currentPage === totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`gallery_close_${postIndex}_${userId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔙')
    );

    return row;
}

function truncateText(text, maxLength = 4000) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

async function showPostDetails(interaction, post, postIndex, userId, isUpdate = false) {
    try {
        console.log('=== SHOW POST DETAILS DEBUG ===');
        console.log(`Post Index: ${postIndex}`);
        console.log(`User ID: ${userId}`);
        console.log(`Is Update: ${isUpdate}`);
        console.log(`Post Title: ${post.title}`);
        console.log(`Content Type: ${post.contentType}`);
        console.log(`Has interaction: ${!!interaction}`);
        console.log(`Interaction type: ${interaction.constructor.name}`);

        const embed = new EmbedBuilder()
            .setTitle(post.title)
            .setURL(post.permalink)
            .setColor('#FF4500')
            .setAuthor({ name: `Posted by u/${post.author}` })
            .setFooter({ text: `r/${post.permalink.split('/')[4]}${post.nsfw ? ' • NSFW' : ''}` })
            .setTimestamp(post.created ? new Date(post.created * 1000) : null);

        // Statistics field
        const statsField = {
            name: '📊 Statistics',
            value: `👍 ${formatNumber(post.upvotes)} upvotes\n💬 ${formatNumber(post.comments)} comments\n🏆 ${post.awards} awards`,
            inline: true
        };

        // Create back button for all post types
        const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`back_to_list_${userId}`)
                .setLabel('Back to Posts')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔙')
        );

        // Handle different content types
        if (post.contentType === 'video' && post.video) {
            console.log('🎹 Processing video post');
            embed.addFields([
                statsField,
                {
                    name: '🎥 Reddit Video',
                    value: `[▶️ Watch Video](${post.video})\n*Note: Discord doesn't embed Reddit videos directly. Click the link to watch!*`,
                    inline: true
                }
            ]);

            // Add text content if available
            if (post.selftext && post.selftext.trim()) {
                const truncated = truncateText(post.selftext, 1000);
                embed.addFields({
                    name: '📝 Post Content',
                    value: truncated,
                    inline: false
                });
            }

            // Try to show video thumbnail if available
            if (post.image) {
                embed.setImage(post.image);
            }

            console.log('✅ Sending video embed...');
            await interaction.editReply({ embeds: [embed], components: [backButton] });
            console.log('✅ Video embed sent successfully');

        } else if (post.contentType === 'gallery' && post.gallery.length > 0) {
            console.log('🖼️ Processing gallery post');
            // Initialize gallery state
            const stateKey = `${userId}_${postIndex}`;
            if (!userGalleryState.has(stateKey)) {
                userGalleryState.set(stateKey, 0);
                console.log(`Initialized gallery state for ${stateKey}`);
            }
            const currentPage = userGalleryState.get(stateKey);

            console.log(`Gallery current page: ${currentPage}/${post.gallery.length}`);
            console.log(`Image URL: ${post.gallery[currentPage]}`);

            embed.setImage(post.gallery[currentPage]);
            embed.addFields([
                statsField,
                {
                    name: '🖼️ Gallery',
                    value: `Image ${currentPage + 1} of ${post.gallery.length}\nUse buttons below to navigate`,
                    inline: true
                }
            ]);

            // Add text content if available
            if (post.selftext && post.selftext.trim()) {
                const truncated = truncateText(post.selftext, 800);
                embed.addFields({
                    name: '📝 Post Content',
                    value: truncated,
                    inline: false
                });
            }

            const galleryRow = createGalleryButtons(currentPage, post.gallery.length, postIndex, userId);

            console.log('✅ Sending gallery embed...');
            await interaction.editReply({ embeds: [embed], components: [galleryRow, backButton] });
            console.log('✅ Gallery embed sent successfully');

        } else if (post.contentType === 'image' && post.image) {
            console.log('📷 Processing image post');
            embed.setImage(post.image);
            embed.addFields([statsField]);

            // Add text content if available
            if (post.selftext && post.selftext.trim()) {
                const truncated = truncateText(post.selftext, 1500);
                embed.addFields({
                    name: '📝 Post Content',
                    value: truncated,
                    inline: false
                });
            }

            console.log('✅ Sending image embed...');
            await interaction.editReply({ embeds: [embed], components: [backButton] });
            console.log('✅ Image embed sent successfully');

        } else {
            console.log('📝 Processing text post');
            // Text post
            embed.addFields([statsField]);

            if (post.selftext && post.selftext.trim()) {
                const truncated = truncateText(post.selftext, 3000);
                embed.setDescription(truncated);

                if (post.selftext.length > 3000) {
                    embed.addFields({
                        name: '⚠️ Content Truncated',
                        value: `[Read full post on Reddit](${post.permalink})`,
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: '🔗 External Link',
                    value: `[View Content](${post.url})`,
                    inline: true
                });
            }

            console.log('✅ Sending text embed...');
            await interaction.editReply({ embeds: [embed], components: [backButton] });
            console.log('✅ Text embed sent successfully');
        }

        console.log('=== END SHOW POST DETAILS DEBUG ===\n');
    } catch (error) {
        console.error('❌ ERROR in showPostDetails:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Full error:', JSON.stringify(error, null, 2));
        throw error;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reddit')
        .setDescription('Fetches top posts from a subreddit')
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
        ),
    async execute(interaction) {
        const subreddit = interaction.options.getString('subreddit').replace(/\s/g, '').trim();
        const sortBy = interaction.options.getString('sort') || 'top';

        await interaction.deferReply();

        const sortNames = {
            'hot': 'Hot',
            'best': 'Best',
            'top': 'Top',
            'new': 'New',
            'rising': 'Rising'
        };

        const loadingEmbed = new EmbedBuilder()
            .setTitle(`🔄 Fetching Posts...`)
            .setDescription(`Retrieving **${sortNames[sortBy]}** posts from **r/${subreddit}**\n\nThis may take a moment...`)
            .setColor('#FF4500')
            .setThumbnail('https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png')
            .setFooter({ text: 'Powered by alterGolden' })
            .setTimestamp();

        await interaction.editReply({ embeds: [loadingEmbed] });

        const waitTime = Math.random() * 1000 + 2000;
        await new Promise(resolve => setTimeout(resolve, waitTime));

        const posts = await fetchRedditData(subreddit, sortBy);

        if (posts === 'not_found') {
            await handleSubredditNotFound(interaction, subreddit);
            return;
        }

        if (!posts || posts.length === 0) {
            await interaction.editReply(`⚠️ **No posts found in r/${subreddit}**\nThe subreddit might be private or have no recent posts.`);
            return;
        }

        userPostsMap.set(interaction.user.id, posts);
        await sendTopPostsEmbed(interaction, subreddit, posts, sortBy);
    },

    async handleButton(interaction) {
        console.log('🔘 Button interaction received:', interaction.customId);

        if (!interaction.isButton()) return;

        // Handle post detail buttons
        const postMatch = interaction.customId.match(/^show_post_(\d+)_(\d+)$/);
        if (postMatch) {
            const index = parseInt(postMatch[1]);
            const buttonUserId = postMatch[2];

            if (interaction.user.id !== buttonUserId) {
                await interaction.reply({ content: '❌ This button is not for you!', ephemeral: true });
                return;
            }

            const userPosts = userPostsMap.get(interaction.user.id);

            if (!userPosts || !userPosts[index]) {
                await interaction.reply({ content: '⚠️ Post data expired. Please run the command again.', ephemeral: true });
                return;
            }

            try {
                await interaction.deferUpdate();
                const selectedPost = userPosts[index];
                await showPostDetails(interaction, selectedPost, index, interaction.user.id, false);
            } catch (error) {
                console.error('Error showing post:', error);
                try {
                    await interaction.followUp({ content: '❌ Failed to display post. Please try again.', ephemeral: true });
                } catch (e) {
                    console.error('Failed to send error message:', e);
                }
            }
            return;
        }

        // Handle gallery navigation buttons
        const galleryMatch = interaction.customId.match(/^gallery_(prev|next|close)_(\d+)_(\d+)$/);
        if (galleryMatch) {
            const action = galleryMatch[1];
            const postIndex = parseInt(galleryMatch[2]);
            const buttonUserId = galleryMatch[3];

            console.log('=== GALLERY BUTTON DEBUG ===');
            console.log(`Action: ${action}`);
            console.log(`Post Index: ${postIndex}`);
            console.log(`Button User ID: ${buttonUserId}`);
            console.log(`Interaction User ID: ${interaction.user.id}`);
            console.log(`User match: ${interaction.user.id === buttonUserId}`);

            if (interaction.user.id !== buttonUserId) {
                console.log('❌ User mismatch - responding with error');
                await interaction.reply({ content: '❌ This button is not for you!', ephemeral: true });
                return;
            }

            const userPosts = userPostsMap.get(interaction.user.id);
            console.log(`User posts exist: ${!!userPosts}`);
            console.log(`User posts length: ${userPosts ? userPosts.length : 0}`);
            console.log(`Post at index exists: ${userPosts && userPosts[postIndex] ? 'YES' : 'NO'}`);

            if (!userPosts || !userPosts[postIndex]) {
                console.log('❌ No posts found - responding with error');
                await interaction.reply({ content: '⚠️ Post data expired. Please run the command again.', ephemeral: true });
                return;
            }

            try {
                console.log('✅ Deferring update...');
                await interaction.deferUpdate();
                console.log('✅ Update deferred successfully');

                const stateKey = `${interaction.user.id}_${postIndex}`;
                console.log(`State key: ${stateKey}`);

                if (action === 'close') {
                    console.log('🔙 Closing gallery and returning to post details');
                    userGalleryState.delete(stateKey);
                    await showPostDetails(interaction, userPosts[postIndex], postIndex, interaction.user.id, true);
                    console.log('✅ Successfully closed gallery');
                    return;
                }

                let currentPage = userGalleryState.get(stateKey) || 0;
                const galleryLength = userPosts[postIndex].gallery.length;

                console.log(`Current page: ${currentPage}`);
                console.log(`Gallery length: ${galleryLength}`);
                console.log(`Gallery array:`, userPosts[postIndex].gallery);

                if (action === 'prev') {
                    currentPage = Math.max(0, currentPage - 1);
                    console.log(`⬅️ Moving to previous: ${currentPage}`);
                } else if (action === 'next') {
                    currentPage = Math.min(galleryLength - 1, currentPage + 1);
                    console.log(`➡️ Moving to next: ${currentPage}`);
                }

                console.log(`New page: ${currentPage}`);

                userGalleryState.set(stateKey, currentPage);
                console.log('✅ State updated, calling showPostDetails...');

                await showPostDetails(interaction, userPosts[postIndex], postIndex, interaction.user.id, true);
                console.log('✅ Gallery navigation completed successfully');
            } catch (error) {
                console.error('❌ ERROR in gallery navigation:');
                console.error('Error name:', error.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                console.error('Full error object:', JSON.stringify(error, null, 2));

                try {
                    await interaction.followUp({ content: '❌ Failed to navigate gallery. Please try again.', ephemeral: true });
                } catch (e) {
                    console.error('❌ Failed to send error message:', e.message);
                }
            }
            console.log('=== END GALLERY BUTTON DEBUG ===\n');
            return;
        }

        // Handle back to list button
        const backMatch = interaction.customId.match(/^back_to_list_(\d+)$/);
        if (backMatch) {
            const buttonUserId = backMatch[1];

            if (interaction.user.id !== buttonUserId) {
                await interaction.reply({ content: '❌ This button is not for you!', ephemeral: true });
                return;
            }

            try {
                await interaction.deferUpdate();

                // Clear gallery state for all posts of this user
                const userPosts = userPostsMap.get(interaction.user.id);
                if (userPosts) {
                    for (let i = 0; i < userPosts.length; i++) {
                        const stateKey = `${interaction.user.id}_${i}`;
                        userGalleryState.delete(stateKey);
                    }
                }

                // Rebuild the posts list embed
                if (userPosts && userPosts.length > 0) {
                    const subreddit = userPosts[0].permalink.split('/')[4];
                    await sendTopPostsEmbed(interaction, subreddit, userPosts);
                } else {
                    await interaction.editReply({ content: '⚠️ Post data expired. Please run the command again.' });
                }
            } catch (error) {
                console.error('Error returning to post list:', error);
                try {
                    await interaction.followUp({ content: '❌ Failed to return to posts list. Please try again.', ephemeral: true });
                } catch (e) {
                    console.error('Failed to send error message:', e);
                }
            }
            return;
        }
    },

    autocomplete
};