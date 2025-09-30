const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');

const REDDIT_CLIENT_ID = 'yzZCVDLnuHeoCJRl-7p_wQ';
const REDDIT_SECRET = 'plNFJELWBg2LsxD-CvZdOhYpPwzqgA';
const REDDIT_USER_AGENT = 'Complete-Ranger-4823/1.0';
const LOG_CHANNEL_ID = '1411386693499486429';

async function getRedditToken() {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_SECRET}`).toString('base64'),
            'User-Agent': REDDIT_USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    const raw = await response.text(); // always read once
    let data;

    try {
        data = JSON.parse(raw);
    } catch (err) {
        console.error("Reddit token response (not JSON):", response.status, response.statusText, raw);
        throw new Error(`Reddit token request failed: ${response.status} ${response.statusText}`);
    }

    if (!response.ok || !data.access_token) {
        console.error("Reddit token request failed:", response.status, response.statusText, data);
        throw new Error(`Reddit token request failed: ${response.status} ${response.statusText}`);
    }

    return data.access_token;
}

// --- SEARCH --- //
async function searchSubreddits(query, token) {
    const response = await fetch(`https://oauth.reddit.com/subreddits/search?q=${encodeURIComponent(query)}&limit=5`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': REDDIT_USER_AGENT
        }
    });
    const data = await response.json();
    return data.data?.children?.map(c => c.data.display_name) || [];
}

// --- TOP POST --- //
async function getTopPost(subreddit, token) {
    const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/top?limit=1&t=day`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': REDDIT_USER_AGENT
        }
    });
    const data = await response.json();
    return data.data?.children[0]?.data;
}

// --- COMMAND EXPORT --- //
module.exports = {
    data: new SlashCommandBuilder()
        .setName('reddit')
        .setDescription('Fetch a top post from a subreddit or suggest similar subreddits')
        .addStringOption(option =>
            option.setName('subreddit')
                .setDescription('The subreddit or topic to fetch from')
                .setRequired(true)
        ),
    async execute(interaction) {
        const subredditInput = interaction.options.getString('subreddit');
        console.log(`/reddit command received | Subreddit: ${subredditInput} | User: ${interaction.user.tag}`);

        // Log to channel
        const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            logChannel.send(`\`\`\`/reddit command received | Subreddit: ${subredditInput} | User: ${interaction.user.tag}\`\`\``);
        }

        // Get token
        let token;
        try {
            token = await getRedditToken();
        } catch (err) {
            console.error('Failed to get Reddit token:', err);
            await interaction.reply({ content: 'Error connecting to Reddit API. Check logs.', ephemeral: true });
            return;
        }

        // Get post
        let post = await getTopPost(subredditInput, token);

        if (!post) {
            const matches = await searchSubreddits(subredditInput, token);
            if (matches.length === 0) {
                await interaction.reply({ content: `No subreddit or matches found for "${subredditInput}".`, ephemeral: true });
                return;
            }
            await interaction.reply({
                content: `No posts found in r/${subredditInput}. Did you mean:\n${matches.map(s => `• r/${s}`).join('\n')}`,
                ephemeral: true
            });
            return;
        }

        // Reply with embed
        await interaction.reply({
            embeds: [{
                title: post.title,
                url: `https://reddit.com${post.permalink}`,
                description: post.selftext?.slice(0, 2000) || '',
                image: post.url && post.post_hint === 'image' ? { url: post.url } : undefined,
                footer: { text: `👍 ${post.ups} | 💬 ${post.num_comments}` }
            }]
        });
    }
};
