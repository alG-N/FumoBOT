const { checkRestrictions } = require('../../../Middleware/restrictions');
const { validateItemUse } = require('../../../Service/UserDataService/UseService/UseValidationService');
const { getUserInventory, updateInventory } = require('../../../Service/UserDataService/UseService/UseDatabaseService');
const { sendErrorEmbed } = require('../../../Service/UserDataService/UseService/UseUIService');
const ItemHandlers = require('../../../Service/UserDataService/UseService/ItemUseHandler/SpecialItemHandler');

const UNUSABLE_ITEMS = new Set([
    'Stone(B)',
    'Stick(B)',
    'UniqueRock(C)',
    'Books(C)',
    'Wool(C)',
    'Wood(C)',
    'Dice(C)',
    'FragmentOf1800s(R)',
    'EnhancedScroll(E)',
    'RustedCore(E)',
    'RedShard(L)',
    'BlueShard(L)',
    'YellowShard(L)',
    'WhiteShard(L)',
    'DarkShard(L)',
    'ChromaShard(M)',
    'MonoShard(M)',
    'EquinoxAlloy(M)',
    'StarShard(M)',
    'Undefined(?)',
    'Null?(?)',
    'VoidFragment(?)',
    'ObsidianRelic(Un)',
    'ChaosEssence(Un)',
    'AbyssalShard(Un)'
]);

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
            error: '❌ Please specify an item name.\n\n**Usage:** `.use <item name> [quantity]`\n**Example:** `.use CoinPotionT1(R)` or `.use CoinPotionT1(R) 5`',
            quantity: 0,
            itemName: null
        };
    }

    return { itemName, quantity, error: null };
}

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
        return message.reply(`❌ **${itemName}** is a material/crafting item and cannot be used directly.`);
    }

    if (!ItemHandlers.isUsableItem(itemName)) {
        return message.reply(`❌ **${itemName}** cannot be used or has no implemented handler.`);
    }

    try {
        const inventory = await getUserInventory(message.author.id, itemName);
        const validation = validateItemUse(inventory, itemName, quantity);
        if (!validation.valid) {
            return message.reply(validation.message);
        }
        await updateInventory(message.author.id, itemName, quantity);
        await ItemHandlers.handleItem(message, itemName, quantity);

    } catch (error) {
        console.error('[USE_COMMAND] Error processing item use:', error);
        try {
            await getUserInventory(message.author.id, itemName).then(inv => {
                if (inv) {
                    return updateInventory(message.author.id, itemName, -quantity);
                }
            });
        } catch (restoreError) {
            console.error('[USE_COMMAND] Failed to restore items:', restoreError);
        }

        return sendErrorEmbed(
            message,
            '❌ Error Processing Item',
            `Failed to use **${itemName}**. Your items have been returned.\n\nIf this persists, contact support.`
        );
    }
}


module.exports = async (discordClient) => {
    discordClient.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (!message.content.match(/^\.u(se)?(\s|$)/i)) return;
            const args = message.content.split(/ +/).slice(1);
            await handleUseCommand(message, args);

        } catch (error) {
            console.error('[USE_COMMAND] Unexpected error:', error);
            message.reply('❌ An unexpected error occurred while processing your command.').catch(() => {});
        }
    });

    console.log('✅ Use command handler registered');
};