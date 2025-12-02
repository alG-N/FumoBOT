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

    console.log(`[USE_COMMAND] User ${message.author.id} attempting to use: ${itemName} x${quantity}`);

    // Check if item is in the unusable materials list
    if (UNUSABLE_ITEMS.has(itemName)) {
        console.log(`[USE_COMMAND] Item ${itemName} is in UNUSABLE_ITEMS list`);
        return message.reply(`❌ **${itemName}** is a material/crafting item and cannot be used directly.`);
    }

    // Check if item has a handler
    if (!ItemHandlers.isUsableItem(itemName)) {
        console.log(`[USE_COMMAND] No handler found for ${itemName}`);
        return message.reply(`❌ **${itemName}** cannot be used or has no implemented handler.`);
    }

    console.log(`[USE_COMMAND] Handler found for ${itemName}, proceeding...`);

    try {
        // Get user inventory
        const inventory = await getUserInventory(message.author.id, itemName);
        console.log(`[USE_COMMAND] Inventory check: ${JSON.stringify(inventory)}`);
        
        // Validate they have enough items
        const validation = validateItemUse(inventory, itemName, quantity);
        if (!validation.valid) {
            console.log(`[USE_COMMAND] Validation failed: ${validation.message}`);
            return message.reply(validation.message);
        }

        // Update inventory (consume items) - DO THIS FIRST
        await updateInventory(message.author.id, itemName, quantity);
        console.log(`[USE_COMMAND] Inventory updated, items consumed`);

        // Execute item handler - handlers should NOT consume items again
        console.log(`[USE_COMMAND] Executing handler for ${itemName}`);
        await ItemHandlers.handleItem(message, itemName, quantity);
        console.log(`[USE_COMMAND] Handler execution completed successfully`);

    } catch (error) {
        console.error('[USE_COMMAND] Error processing item use:', error);
        console.error('[USE_COMMAND] Error stack:', error.stack);
        
        // Try to restore items if something went wrong
        try {
            const inv = await getUserInventory(message.author.id, itemName);
            if (inv !== null) {
                // Restore the consumed items
                const { run } = require('../../../Core/database');
                await run(
                    `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                    [quantity, message.author.id, itemName]
                );
                console.log(`[USE_COMMAND] Items restored after error`);
            }
        } catch (restoreError) {
            console.error('[USE_COMMAND] Failed to restore items:', restoreError);
        }

        return sendErrorEmbed(
            message,
            '❌ Error Processing Item',
            `Failed to use **${itemName}**. Your items have been returned.\n\n**Error:** ${error.message}\n\nIf this persists, contact support.`
        );
    }
}


module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (!message.content.match(/^\.u(se)?(\s|$)/i)) return;
            
            const args = message.content.split(/ +/).slice(1);
            await handleUseCommand(message, args);

        } catch (error) {
            console.error('[USE_COMMAND] Unexpected error:', error);
            console.error('[USE_COMMAND] Unexpected error stack:', error.stack);
            message.reply('❌ An unexpected error occurred while processing your command.').catch(() => {});
        }
    });

    console.log('✅ Use command handler registered');
};