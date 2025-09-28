import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';

// --- CONFIGURATION --- //
const clientId = 'yzZCVDLnuHeoCJRl-7p_wQ';
const secret = 'plNFJELWBg2LsxD-CvZdOhYpPwzqgA';
const redditUserAgent = 'GoldenBot/1.0 by golden_exist';

// --- Helper: Get OAuth Token --- //
async function getAccessToken() {
    try {
        const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
        const response = await axios.post(
            'https://www.reddit.com/api/v1/access_token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': redditUserAgent
                },
                timeout: 5000
            }
        );
        return response.data.access_token;
    } catch (err) {
        console.error("Reddit token error:", err.message);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reddit')
        .setDescription('Fetch a post from a subreddit')
        .addStringOption(option =>
            option.setName('subreddit')
                .setDescription('The subreddit to search')
                .setAutocomplete(true) // 🔹 enables live search
                .setRequired(true)
        ),

    // --- Autocomplete handler --- //
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        if (!focused) return interaction.respond([]);

        try {
            const res = await axios.get(
                `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(focused)}&limit=10`,
                { headers: { 'User-Agent': redditUserAgent }, timeout: 5000 }
            );

            const subs = res.data.data.children.map(c => ({
                name: `${c.data.display_name_prefixed} — ${c.data.title}`,
                value: c.data.display_name // only the name, e.g. "BlueArchive"
            }));

            await interaction.respond(subs);
        } catch (err) {
            console.error("Autocomplete failed:", err.message);
            await interaction.respond([]); // must always respond
        }
    },

    // --- Command executor --- //
    async execute(interaction) {
        const subreddit = interaction.options.getString('subreddit');

        await interaction.deferReply();

        const loadingEmbed = new EmbedBuilder()
            .setTitle(`🔍 Searching r/${subreddit}...`)
            .setColor(0xff4500);

        await interaction.editReply({ embeds: [loadingEmbed] });

        const token = await getAccessToken();
        if (!token) {
            return interaction.editReply("❌ Could not authenticate with Reddit.");
        }

        try {
            const res = await axios.get(
                `https://oauth.reddit.com/r/${subreddit}/hot?limit=1`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': redditUserAgent
                    },
                    timeout: 5000
                }
            );

            const posts = res.data.data.children;
            if (!posts.length) {
                return interaction.editReply(`⚠️ No posts found in r/${subreddit}.`);
            }

            const post = posts[0].data;
            const embed = new EmbedBuilder()
                .setTitle(post.title)
                .setURL(`https://reddit.com${post.permalink}`)
                .setDescription(post.selftext ? post.selftext.substring(0, 2000) : '')
                .setColor(0xff4500)
                .setFooter({ text: `From r/${subreddit}` });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error("Reddit fetch error:", err.message);
            return interaction.editReply(`❌ Could not fetch posts from r/${subreddit}.`);
        }
    }
};
