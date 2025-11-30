const { checkRestrictions } = require('../../Middleware/restrictions');
const { getUserMarket } = require('../../Service/MarketService/MarketService/MarketCacheService');
const { handleMarketPurchase } = require('../../Service/MarketService/MarketService/MarketPurchaseService');
const { createMarketEmbed } = require('../../Service/MarketService/MarketService/MarketUIService');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const isMarketCommand = message.content === '.market' || message.content === '.m' || 
                                message.content.startsWith('.market ') || message.content.startsWith('.m ');
        const isPurchaseCommand = message.content.startsWith('.purchase') || message.content.startsWith('.pu');

        if (!isMarketCommand && !isPurchaseCommand) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        if (isMarketCommand) {
            await showMarket(message);
        } else if (isPurchaseCommand) {
            await handlePurchase(message);
        }
    });
};

async function showMarket(message) {
    try {
        const market = await getUserMarket(message.author.id);
        const embed = await createMarketEmbed(message.author.id, market);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Market display error:', error);
        await message.reply('❌ Failed to load market. Please try again.');
    }
}

async function handlePurchase(message) {
    const args = message.content.split(' ').slice(1);
    
    if (args.length === 0) {
        const { createPurchaseTutorialEmbed } = require('../../Service/MarketService/MarketUIService');
        return message.reply({ embeds: [createPurchaseTutorialEmbed()] });
    }

    await handleMarketPurchase(message, args);
}