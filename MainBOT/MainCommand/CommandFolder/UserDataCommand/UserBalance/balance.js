const { EmbedBuilder } = require('discord.js');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { 
    getUserData, 
    getFarmingFumos, 
    getActiveBoosts, 
    getUserAchievements,
    getUserActivity,
    getUserBuildings,
    getUserPets,
    getUserQuestSummary,
    getCurrentWeather,
    getSanaeData
} = require('../../../Service/UserDataService/BalanceService/BalanceService');
const { generateAllPages } = require('../../../Service/UserDataService/BalanceService/BalanceUIService');
const { sendPaginatedBalance } = require('../../../Service/UserDataService/BalanceService/BalanceNavigationService');

async function parseTargetUser(message, args) {
    let targetUser = message.author;
    
    if (args.length > 0) {
        const mention = message.mentions.users.first();
        if (mention) {
            targetUser = mention;
        } else if (/^\d{17,19}$/.test(args[0])) {
            try {
                const fetched = await message.client.users.fetch(args[0]);
                if (fetched) targetUser = fetched;
            } catch (error) {
                console.error('[Balance] Failed to fetch user:', error);
            }
        }
    }
    
    return targetUser;
}

async function handleBalanceCommand(message, targetUser) {
    try {
        const userData = await getUserData(targetUser.id);
        
        if (!userData) {
            const isOwner = targetUser.id === message.author.id;
            const response = isOwner
                ? 'You do not have any coins or gems yet. Use `.starter` or `.daily` to begin!'
                : `${targetUser.username} does not have any coins or gems yet.`;
            
            return message.reply(response);
        }
        
        // Fetch all data in parallel for better performance
        const [
            farmingFumos, 
            activeBoosts, 
            achievements, 
            activityData,
            petData,
            buildings,
            questSummary,
            weather,
            sanaeData
        ] = await Promise.all([
            getFarmingFumos(targetUser.id),
            getActiveBoosts(targetUser.id),
            getUserAchievements(targetUser.id, userData),
            getUserActivity(targetUser.id),
            getUserPets(targetUser.id),
            getUserBuildings(targetUser.id),
            getUserQuestSummary(targetUser.id),
            getCurrentWeather(targetUser.id),
            getSanaeData(targetUser.id)
        ]);
        
        const pages = await generateAllPages(
            targetUser,
            userData,
            farmingFumos,
            activeBoosts,
            achievements,
            activityData,
            petData,
            buildings,
            questSummary,
            weather,
            sanaeData
        );
        
        const onUpdate = async () => {
            const freshData = await getUserData(targetUser.id, false);
            if (!freshData) return pages;
            
            const [
                freshFarming, 
                freshBoosts, 
                freshAchievements, 
                freshActivity,
                freshPets,
                freshBuildings,
                freshQuests,
                freshWeather,
                freshSanae
            ] = await Promise.all([
                getFarmingFumos(targetUser.id),
                getActiveBoosts(targetUser.id),
                getUserAchievements(targetUser.id, freshData),
                getUserActivity(targetUser.id),
                getUserPets(targetUser.id),
                getUserBuildings(targetUser.id),
                getUserQuestSummary(targetUser.id),
                getCurrentWeather(targetUser.id),
                getSanaeData(targetUser.id)
            ]);
            
            return await generateAllPages(
                targetUser,
                freshData,
                freshFarming,
                freshBoosts,
                freshAchievements,
                freshActivity,
                freshPets,
                freshBuildings,
                freshQuests,
                freshWeather,
                freshSanae
            );
        };
        
        await sendPaginatedBalance(message.channel, pages, message.author.id, onUpdate);
        
    } catch (error) {
        console.error('[Balance] Command execution error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Error')
            .setDescription('An error occurred while fetching balance data. Please try again later.')
            .setTimestamp();
        
        await message.reply({ embeds: [errorEmbed] }).catch(() => {});
    }
}

module.exports = (clientInstance) => {
    clientInstance.on('messageCreate', async message => {
        if (message.author.bot) return;
        
        const content = message.content.trim();
        const command = content.split(/\s+/)[0].toLowerCase();
        // Only respond to exact .balance or .bal (not .b which conflicts with .boost)
        if (command !== '.balance' && command !== '.bal') return;
        
        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }
        
        const args = content.split(/\s+/).slice(1);
        
        // Handle subcommands
        if (args[0]?.toLowerCase() === 'achievements' || args[0]?.toLowerCase() === 'ach') {
            // Redirect to quest achievements
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x7B68EE)
                        .setTitle('🏆 Achievements')
                        .setDescription([
                            'Use `.quest` and click **🏆 Achievements** to view your detailed achievement progress!',
                            '',
                            'Or use `.quest achievements` directly.',
                            '',
                            '**Quick Info:**',
                            '• Achievements track your lifetime progress',
                            '• Each achievement has multiple milestones',
                            '• Milestones scale infinitely!',
                            '• Claim rewards with `.claim`'
                        ].join('\n'))
                        .setTimestamp()
                ]
            });
        }
        
        const targetUser = await parseTargetUser(message, args);
        
        await handleBalanceCommand(message, targetUser);
    });
};