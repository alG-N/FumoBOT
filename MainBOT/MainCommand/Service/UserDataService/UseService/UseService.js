const { createClient } = require('../../../Configuration/discord');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { validateItemUse, canUseItem } = require('./UseValidationService');
const { getUserInventory, updateInventory } = require('./UseDatabaseService');
const { sendErrorEmbed } = require('./UseUIService');
const ItemHandlers = require('./ItemUseHandler/SpecialItemHandler');

const UNUSABLE_ITEMS = new Set([
    'UniqueRock(C)', 'Books(C)', 'Wool(C)', 'Wood(C)', 'Dice(C)',
    'FragmentOf1800s(R)',
    'EnhancedScroll(E)', 'RustedCore(E)',
    'RedShard(L)', 'BlueShard(L)', 'YellowShard(L)', 'WhiteShard(L)', 'DarkShard(L)',
    'ChromaShard(M)', 'MonoShard(M)', 'EquinoxAlloy(M)', 'StarShard(M)',
    'Undefined(?)', 'Null?(?)',
]);

async function handleUseCommand(message, args) {
    const restriction = checkRestrictions(message.author.id);
    if (restriction.blocked) {
        return message.reply({ embeds: [restriction.embed] });
    }

    const { itemName, quantity, error } = parseUseArgs(args);
    
    if (error) {
        return message.reply(error);
    }

    if (UNUSABLE_ITEMS.has(itemName)) {
        return message.reply(`❌ The item **${itemName}** cannot be used.`);
    }

    const inventory = await getUserInventory(message.author.id, itemName);
    
    const validation = validateItemUse(inventory, itemName, quantity);
    if (!validation.valid) {
        return message.reply(validation.message);
    }

    const canUse = await canUseItem(message.author.id, itemName, quantity);
    if (!canUse.valid) {
        return message.reply(canUse.message);
    }

    try {
        await updateInventory(message.author.id, itemName, quantity);
        await ItemHandlers.handleItem(message, itemName, quantity);
    } catch (error) {
        console.error('[USE] Error processing item use:', error);
        return sendErrorEmbed(message, '❌ Error', 'Failed to use item');
    }
}

function parseUseArgs(args) {
    let quantity = 1;
    const lastArg = args[args.length - 1];

    if (!isNaN(lastArg) && Number.isInteger(Number(lastArg))) {
        quantity = parseInt(lastArg);
        args.pop();
    }

    if (quantity <= 0) {
        return { 
            error: '❌ Quantity must be a positive number.',
            quantity: 0,
            itemName: null
        };
    }

    const itemName = args.join(' ').trim();
    if (!itemName) {
        return { 
            error: '❌ Please specify an item name. Example: `.use CoinPotionT1(R)`',
            quantity: 0,
            itemName: null
        };
    }

    return { itemName, quantity, error: null };
}

module.exports = async (discordClient) => {
    discordClient.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (!message.content.match(/^\.u(se)?(\s|$)/)) return;

            const args = message.content.split(/ +/).slice(1);
            await handleUseCommand(message, args);
        } catch (error) {
            console.error('[USE] Unexpected error:', error);
            message.reply('❌ An unexpected error occurred.').catch(() => {});
        }
    });
};