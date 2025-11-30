const { checkRestrictions } = require('../../Middleware/restrictions');
const { getFarmLimit, getUserFarmingFumos } = require('../../Service/FarmingService/FarmingDatabaseService');
const { calculateFarmLimit } = require('../../Service/FarmingService/FarmingCalculationService');
const { createFarmStatusEmbed, createErrorEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { all } = require('../../Core/database');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.farmcheck') && !message.content.startsWith('.fc')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;

        try {
            const [fragmentUses, farmingFumos] = await Promise.all([
                getFarmLimit(userId),
                getUserFarmingFumos(userId)
            ]);

            if (farmingFumos.length === 0) {
                return message.reply({
                    embeds: [createErrorEmbed('🤷‍♂️ No Fumos are currently farming. Time to get started!')]
                });
            }

            const now = Date.now();
            const boosts = await all(
                `SELECT type, multiplier, source, expiresAt FROM activeBoosts 
                 WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
                [userId, now]
            );

            let coinMultiplier = 1;
            let gemMultiplier = 1;

            boosts.forEach(b => {
                const type = (b.type || '').toLowerCase();
                const mult = b.multiplier || 1;
                
                if (['coin', 'income'].includes(type)) {
                    coinMultiplier *= mult;
                }
                if (['gem', 'gems', 'income'].includes(type)) {
                    gemMultiplier *= mult;
                }
            });

            const farmLimit = calculateFarmLimit(fragmentUses);

            const embed = createFarmStatusEmbed({
                username: message.author.username,
                farmingFumos,
                farmLimit,
                fragmentUses,
                boosts: {
                    coinMultiplier,
                    gemMultiplier,
                    activeBoosts: boosts
                }
            });

            return message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in .farmcheck:', error);
            return message.reply({
                embeds: [createErrorEmbed('⚠️ Something went wrong while checking your farm.')]
            });
        }
    });
};