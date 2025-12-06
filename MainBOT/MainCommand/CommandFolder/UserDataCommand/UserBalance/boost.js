const { checkRestrictions } = require('../../../Middleware/restrictions');
const { getActiveBoosts } = require('../../../Service/UserDataService/BoostService/BoostQueryService');
const { createBoostEmbed } = require('../../../Service/UserDataService/BoostService/BoostUIService');

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;

        const prefixMatch = message.content.match(/^\.b(?:oost|st)(?:\s+details\s+(\w+))?/i);
        if (!prefixMatch) return;

        const detailsType = prefixMatch[1]?.toLowerCase();
        const userId = message.author.id;

        const restriction = checkRestrictions(userId);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        try {
            const boostData = await getActiveBoosts(userId);

            if (!boostData.hasBoosts && !detailsType) {
                return message.reply("🛑 You have no active boosts at the moment.");
            }

            const embed = createBoostEmbed(boostData, detailsType);
            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[BOOST] Error:', error);
            await message.reply("❌ An error occurred while fetching your boosts. Please try again later.");
        }
    });
};