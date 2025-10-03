const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { Buffer } = require('buffer');

// Add your Reddit API credentials here
const clientId = 'yzZCVDLnuHeoCJRl-7p_wQ';
const secret = 'plNFJELWBg2LsxD-CvZdOhYpPwzqgA';
const userPostsMap = new Map();

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
    const focused = interaction.options.getFocused();
    if (!focused) return interaction.respond([]);
    try {
        const res = await axios.get(
            `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(focused)}&limit=10`,
            { headers: { 'User-Agent': 'DiscordBot/1.0 by YourRedditUsername' }, timeout: 5000 }
        );
        const subs = res.data.data.children.map(c => ({
            name: `${c.data.display_name_prefixed} — ${c.data.title}`,
            value: c.data.display_name
        }));
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

async function fetchRedditData(subreddit) {
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
        const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/top`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'YourAppName/1.0 by YourRedditUsername'
            },
            params: {
                limit: 3,
                t: 'day'
            }
        });
        if (!response.data || !response.data.data || !response.data.data.children) {
            return null;
        }
        return response.data.data.children.map(child => {
            const postData = child.data;
            const upvotes = postData.ups ?? 0;
            const downvotes = postData.downs ?? 0;
            let fullSizeImage = null;
            if (postData.preview && postData.preview.images && postData.preview.images[0].resolutions) {
                const resolutions = postData.preview.images[0].resolutions;
                fullSizeImage = resolutions[resolutions.length - 1].url.replace(/&amp;/g, '&');
            }
            let galleryImages = null;
            if (postData.gallery_data && postData.media_metadata) {
                galleryImages = Object.values(postData.media_metadata).map(item => {
                    const maxResolution = item.p[item.p.length - 1].u.replace(/&amp;/g, '&');
                    return maxResolution;
                });
            }
            let videoUrl = null;
            if (postData.media && postData.media.reddit_video) {
                videoUrl = postData.media.reddit_video.fallback_url;
            }
            return {
                title: postData.title || '[No Title]',
                url: postData.url || '[No URL]',
                image: fullSizeImage,
                gallery: galleryImages,
                video: videoUrl,
                permalink: `https://reddit.com${postData.permalink}`,
                upvotes: upvotes,
                downvotes: downvotes
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
            .setTitle(`Subreddit Not Found: /r/${subreddit}`)
            .setDescription('But we found these similar subreddits. Could one of them be what you were looking for?')
            .setColor('#FFB800')
            .setFooter({ text: 'Type /reddit [subreddit name] to try again with a similar subreddit.' })
            .setTimestamp();
        similarSubreddits.forEach((sub, index) => {
            embed.addFields({
                name: `Option ${index + 1}`,
                value: `/r/${sub}`,
                inline: true
            });
        });
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.editReply(`❌ **Couldn't find /r/${subreddit}, not even a similar one!**\nPlease check the subreddit name and try again.`);
    }
}

async function sendTopPostsEmbed(interaction, subreddit, posts) {
    const postCount = posts.length;
    const embed = new EmbedBuilder()
        .setTitle(`🔥 Top ${postCount} Posts from r/${subreddit}`)
        .setDescription('Click a button below to view more details about a post!')
        .setColor('#FF4500')
        .setFooter({ text: 'Powered by alterGolden' })
        .setTimestamp();

    posts.forEach((post, index) => {
        embed.addFields({
            name: `#${index + 1}: ${post.title}`,
            value: `[View Post](${post.permalink})\n👍 ${post.upvotes} | 👎 ${post.downvotes}`,
            inline: false
        });
    });

    const actionRows = createPostButtons(postCount, interaction.user.id);
    await interaction.editReply({ embeds: [embed], components: actionRows });
}

function createPostButtons(postCount, userId) {
    const row = new ActionRowBuilder();
    for (let i = 0; i < postCount; i++) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`show_post_${i}_${userId}`) // CustomId includes userId
                .setLabel(`Details #${i + 1}`)
                .setStyle(ButtonStyle.Primary)
        );
    }
    return [row];
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
        ),
    async execute(interaction) {
        const subreddit = interaction.options.getString('subreddit').replace(/\s/g, '').trim();
        await interaction.deferReply();
        const loadingEmbed = new EmbedBuilder()
            .setTitle(`🔄 Fetching Data...`)
            .setDescription(`**Golden is fetching data from /r/${subreddit}...**\nPlease wait a moment..`)
            .setColor('#FFA500')
            .setImage('https://media2.giphy.com/media/YQitE4YNQNahy/giphy.gif?cid=6c09b9524j71vaxv55gweh94itjqa6ywaghl79s7ghbhw5vs&ep=v1_gifs_search&rid=giphy.gif&ct=g')
            .setFooter({ text: 'Want faster loading? Little Golden`s Premium coming right up!' })
            .setTimestamp();
        await interaction.editReply({ embeds: [loadingEmbed] });
        const waitTime = Math.random() * 2000 + 4000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        const posts = await fetchRedditData(subreddit);
        if (posts === 'not_found') {
            await handleSubredditNotFound(interaction, subreddit);
            return;
        }
        if (!posts || posts.length === 0) {
            await interaction.editReply(`⚠️ **Couldn't fetch data from /r/${subreddit}.** Please ensure the subreddit exists or try again later.`);
            return;
        }
        userPostsMap.set(interaction.user.id, posts);
        await sendTopPostsEmbed(interaction, subreddit, posts);
    },
    async handleButton(interaction) {
        if (!interaction.isButton()) return;
        // CustomId format: show_post_{index}_{userId}
        const match = interaction.customId.match(/^show_post_(\d+)_(\d+)$/);
        if (!match) {
            await interaction.reply({ content: 'Invalid button.', ephemeral: true });
            return;
        }
        const index = match[1];
        const buttonUserId = match[2];
        if (interaction.user.id !== buttonUserId) {
            await interaction.reply({ content: 'This interaction is only for the user who used the command.', ephemeral: true });
            return;
        }
        const userPosts = userPostsMap.get(interaction.user.id);
        if (index && userPosts && userPosts[index]) {
            try {
                const selectedPost = userPosts[index];
                const postEmbed = new EmbedBuilder()
                    .setTitle(selectedPost.title)
                    .setURL(selectedPost.permalink)
                    .setDescription(`👍 Upvotes: ${selectedPost.upvotes} | 👎 Downvotes: ${selectedPost.downvotes}`)
                    .setColor('#FF4500')
                    .setFooter({ text: `View more on Reddit` });
                if (selectedPost.image) {
                    postEmbed.setImage(selectedPost.image);
                }
                if (selectedPost.gallery) {
                    const galleryText = selectedPost.gallery
                        .map((imageUrl, i) => `[Image ${i + 1}](${imageUrl})`)
                        .join('\n');
                    postEmbed.addFields({ name: 'Gallery', value: galleryText });
                }
                await interaction.reply({ embeds: [postEmbed], ephemeral: true });
                if (selectedPost.gallery && selectedPost.gallery.length > 1) {
                    for (const imageUrl of selectedPost.gallery) {
                        const galleryEmbed = new EmbedBuilder().setImage(imageUrl).setColor('#FF4500');
                        await interaction.followUp({ embeds: [galleryEmbed], ephemeral: true });
                    }
                }
            } catch (error) {
                console.error('Error showing post:', error);
                await interaction.reply({ content: 'Something went wrong displaying the post. Please try again.', ephemeral: true });
            }
        } else {
            await interaction.reply({ content: 'Invalid post selected or posts expired. Please try again.', ephemeral: true });
        }
    },
    autocomplete
};
