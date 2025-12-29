/**
 * Admin Commands Handler
 * Handles admin command registration and execution
 */

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { ADMIN_IDS, isAdmin, isValidUserId, EMBED_COLORS } = require('../Config/adminConfig');
const AdminActionService = require('../Service/AdminActionService');

// ═══════════════════════════════════════════════════════════════
// EMBED BUILDERS
// ═══════════════════════════════════════════════════════════════

function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR)
        .setTitle(title)
        .setDescription(description);
}

function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.SUCCESS)
        .setTitle(title)
        .setDescription(description);
}

function createInfoEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.INFO)
        .setTitle(title)
        .setDescription(description);
}

// ═══════════════════════════════════════════════════════════════
// PERMISSION CHECK
// ═══════════════════════════════════════════════════════════════

function checkAdminPermission(message) {
    if (!isAdmin(message.author.id)) {
        message.reply({
            embeds: [createErrorEmbed('❌ Access Denied', 'You do not have permission to use this command.')]
        });
        return false;
    }
    return true;
}

// ═══════════════════════════════════════════════════════════════
// ADD ITEM COMMAND
// ═══════════════════════════════════════════════════════════════

async function handleAddItem(message) {
    if (!checkAdminPermission(message)) return;

    const args = message.content.trim().split(' ').slice(1);
    if (args.length < 2) {
        return message.reply({
            embeds: [createInfoEmbed('Usage', '`.additem <userId> <itemName>`\n\nYou will then select rarity and quantity.')]
        });
    }

    const [userId, ...itemNameParts] = args;
    const itemName = itemNameParts.join(' ');

    if (!itemName) {
        return message.reply({
            embeds: [createInfoEmbed('Usage', '`.additem <userId> <itemName>`')]
        });
    }

    const rarityOptions = AdminActionService.getItemRarities();
    const rarityMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_item_rarity_${message.author.id}`)
            .setPlaceholder('Select item rarity')
            .addOptions(rarityOptions)
    );

    const embed = createInfoEmbed(
        '🎁 Add Item - Step 1',
        `**Item:** ${itemName}\n**User:** <@${userId}>\n\nSelect the rarity suffix for this item:`
    );

    const msg = await message.reply({
        embeds: [embed],
        components: [rarityMenu]
    });

    AdminActionService.storePendingAction(message.author.id, {
        type: 'additem',
        userId,
        itemName,
        messageId: msg.id
    });
}

// ═══════════════════════════════════════════════════════════════
// ADD FUMO COMMAND
// ═══════════════════════════════════════════════════════════════

async function handleAddFumo(message) {
    if (!checkAdminPermission(message)) return;

    const args = message.content.trim().split(' ').slice(1);
    if (args.length < 1) {
        return message.reply({
            embeds: [createInfoEmbed('Usage', '`.addfumo <userId>`\n\nYou will then select rarity, fumo, trait, and quantity.')]
        });
    }

    const userId = args[0];
    const rarityOptions = AdminActionService.getFumoRarities();

    const rarityMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_fumo_rarity_${message.author.id}`)
            .setPlaceholder('Select fumo rarity')
            .addOptions(rarityOptions)
    );

    const embed = createInfoEmbed(
        '🎭 Add Fumo - Step 1',
        `**User:** <@${userId}>\n\nSelect the rarity of the fumo:`
    );

    const msg = await message.reply({
        embeds: [embed],
        components: [rarityMenu]
    });

    AdminActionService.storePendingAction(message.author.id, {
        type: 'addfumo',
        userId,
        messageId: msg.id
    });
}

// ═══════════════════════════════════════════════════════════════
// ADD CURRENCY COMMAND
// ═══════════════════════════════════════════════════════════════

async function handleAddCurrency(message) {
    if (!checkAdminPermission(message)) return;

    const args = message.content.trim().split(' ').slice(1);
    if (args.length < 1) {
        return message.reply({
            embeds: [createInfoEmbed('Usage', '`.addcurrency <userId>`\n\nYou will then select currency type and amount.')]
        });
    }

    const userId = args[0];
    if (!isValidUserId(userId)) {
        return message.reply({
            embeds: [createErrorEmbed('❌ Invalid User ID', 'Please provide a valid Discord user ID.')]
        });
    }

    const currencyTypes = AdminActionService.getCurrencyTypes();
    const currencyMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_currency_type_${message.author.id}`)
            .setPlaceholder('Select currency type')
            .addOptions(currencyTypes.map(c => ({ label: c.label, value: c.value })))
    );

    const embed = createInfoEmbed(
        '💰 Add Currency - Step 1',
        `**User:** <@${userId}>\n\nSelect the currency type:`
    );

    const msg = await message.reply({
        embeds: [embed],
        components: [currencyMenu]
    });

    AdminActionService.storePendingCurrency(message.author.id, {
        userId,
        messageId: msg.id
    });
}

// ═══════════════════════════════════════════════════════════════
// WEATHER COMMAND
// ═══════════════════════════════════════════════════════════════

async function handleWeatherCommand(message, client) {
    if (!checkAdminPermission(message)) return;

    const args = message.content.trim().split(' ').slice(1);

    if (args.length === 0) {
        const weatherList = AdminActionService.formatWeatherList();
        return message.reply({
            embeds: [createInfoEmbed(
                '🌤️ Weather Command Usage',
                '**Usage:** `.weather <weather_name> [duration_minutes]`\n\n' +
                '**Available Weather Events:**\n' +
                weatherList + '\n\n' +
                '**Examples:**\n' +
                '`.weather DAWN_DAYLIGHT` - Start with default duration\n' +
                '`.weather GOLDEN_HOUR 30` - Start for 30 minutes\n' +
                '`.weather stop STORM` - Stop a weather event'
            )]
        });
    }

    const [action, weatherName, durationArg] = args[0].toLowerCase() === 'stop'
        ? ['stop', args[1]?.toUpperCase(), null]
        : ['start', args[0]?.toUpperCase(), args[1]];

    if (action === 'stop') {
        const result = await AdminActionService.stopWeather(weatherName, client);
        
        if (!result.success) {
            return message.reply({
                embeds: [createErrorEmbed('❌ Invalid Weather Type', 'Please provide a valid weather event name to stop.')]
            });
        }

        return message.reply({
            embeds: [createSuccessEmbed('✅ Weather Stopped', `Successfully stopped **${weatherName}**`)]
        });
    }

    const durationMinutes = durationArg ? parseInt(durationArg, 10) : null;
    const result = await AdminActionService.startWeather(weatherName, durationMinutes, client);

    if (!result.success) {
        return message.reply({
            embeds: [createErrorEmbed(
                '❌ Invalid Weather Type',
                'Please provide a valid weather event name.\nUse `.weather` to see the list of available events.'
            )]
        });
    }

    return message.reply({
        embeds: [createSuccessEmbed(
            '✅ Weather Event Started',
            `${result.description}\n\n` +
            `**Duration:** ${result.durationMinutes} minutes\n` +
            `**Coin Multiplier:** x${result.coinMultiplier}\n` +
            `**Gem Multiplier:** x${result.gemMultiplier}`
        )]
    });
}

// ═══════════════════════════════════════════════════════════════
// INTERACTION HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleItemRaritySelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({ content: '❌ This is not your selection menu.', ephemeral: true });
    }

    const pendingAction = AdminActionService.getPendingAction(adminId);
    if (!pendingAction || pendingAction.type !== 'additem') {
        return interaction.reply({ content: '❌ No pending item addition found.', ephemeral: true });
    }

    const rarity = interaction.values[0];
    const fullItemName = AdminActionService.buildItemName(pendingAction.itemName, rarity);

    const embed = createInfoEmbed(
        '🎁 Add Item - Step 2',
        `**Item:** ${fullItemName}\n**User:** <@${pendingAction.userId}>\n\nReply with the quantity to add (or "cancel" to cancel):`
    );

    await interaction.update({ embeds: [embed], components: [] });

    AdminActionService.storePendingAction(adminId, {
        ...pendingAction,
        fullItemName,
        awaitingQuantity: true
    });
}

async function handleFumoRaritySelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({ content: '❌ This is not your selection menu.', ephemeral: true });
    }

    const pendingAction = AdminActionService.getPendingAction(adminId);
    if (!pendingAction || pendingAction.type !== 'addfumo') {
        return interaction.reply({ content: '❌ No pending fumo addition found.', ephemeral: true });
    }

    const rarity = interaction.values[0];
    const fumosOfRarity = AdminActionService.getFumosByRarity(rarity);

    if (fumosOfRarity.length === 0) {
        return interaction.update({
            embeds: [createErrorEmbed('❌ No Fumos Found', `No fumos found with rarity: ${rarity}`)],
            components: []
        });
    }

    const fumoOptions = fumosOfRarity.slice(0, 25).map(fumo => ({
        label: fumo.name.length > 100 ? fumo.name.substring(0, 97) + '...' : fumo.name,
        value: fumo.name,
        description: `${rarity} fumo`
    }));

    const fumoMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_fumo_select_${adminId}`)
            .setPlaceholder('Select a fumo')
            .addOptions(fumoOptions)
    );

    const embed = createInfoEmbed(
        '🎭 Add Fumo - Step 2',
        `**User:** <@${pendingAction.userId}>\n**Rarity:** ${rarity}\n\nSelect the fumo:`
    );

    await interaction.update({ embeds: [embed], components: [fumoMenu] });

    AdminActionService.storePendingAction(adminId, { ...pendingAction, rarity });
}

async function handleFumoSelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({ content: '❌ This is not your selection menu.', ephemeral: true });
    }

    const pendingAction = AdminActionService.getPendingAction(adminId);
    if (!pendingAction || pendingAction.type !== 'addfumo') {
        return interaction.reply({ content: '❌ No pending fumo addition found.', ephemeral: true });
    }

    const baseFumoName = interaction.values[0];
    const traitOptions = AdminActionService.getFumoTraits();

    const traitMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_fumo_trait_${adminId}`)
            .setPlaceholder('Select trait')
            .addOptions(traitOptions.map(t => ({ label: t.label, value: t.value })))
    );

    const embed = createInfoEmbed(
        '🎭 Add Fumo - Step 3',
        `**User:** <@${pendingAction.userId}>\n**Fumo:** ${baseFumoName}\n\nSelect a trait for this fumo:`
    );

    await interaction.update({ embeds: [embed], components: [traitMenu] });

    AdminActionService.storePendingAction(adminId, { ...pendingAction, baseFumoName });
}

async function handleFumoTraitSelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({ content: '❌ This is not your selection menu.', ephemeral: true });
    }

    const pendingAction = AdminActionService.getPendingAction(adminId);
    if (!pendingAction || pendingAction.type !== 'addfumo') {
        return interaction.reply({ content: '❌ No pending fumo addition found.', ephemeral: true });
    }

    const trait = interaction.values[0];
    const fullFumoName = AdminActionService.buildFumoName(pendingAction.baseFumoName, pendingAction.rarity, trait);

    const embed = createInfoEmbed(
        '🎭 Add Fumo - Step 4',
        `**Fumo:** ${fullFumoName}\n**User:** <@${pendingAction.userId}>\n\nReply with the quantity to add (or "cancel" to cancel):`
    );

    await interaction.update({ embeds: [embed], components: [] });

    AdminActionService.storePendingAction(adminId, {
        ...pendingAction,
        fullFumoName,
        awaitingQuantity: true
    });
}

async function handleCurrencyTypeSelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({ content: '❌ This is not your selection menu.', ephemeral: true });
    }

    const pendingCurr = AdminActionService.getPendingCurrency(adminId);
    if (!pendingCurr) {
        return interaction.reply({ content: '❌ No pending currency addition found.', ephemeral: true });
    }

    const currencyType = interaction.values[0];
    const currencyInfo = AdminActionService.getCurrencyInfo(currencyType);

    const embed = createInfoEmbed(
        '💰 Add Currency - Step 2',
        `**User:** <@${pendingCurr.userId}>\n` +
        `**Currency:** ${currencyInfo.emoji} ${currencyInfo.label.split(' ')[0]}\n\n` +
        `Reply with the amount to add (supports K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc, etc.)\n` +
        `Examples: 1000, 1K, 1.5M, 2B, 5Qa\n\n` +
        `Or type "cancel" to cancel.`
    );

    await interaction.update({ embeds: [embed], components: [] });

    AdminActionService.storePendingCurrency(adminId, {
        ...pendingCurr,
        currencyType,
        awaitingAmount: true
    });
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE INPUT HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleQuantityInput(message) {
    const pendingAction = AdminActionService.getPendingAction(message.author.id);
    if (!pendingAction || !pendingAction.awaitingQuantity) return false;

    if (message.content.toLowerCase() === 'cancel') {
        AdminActionService.removePendingAction(message.author.id);
        await message.reply({
            embeds: [new EmbedBuilder().setColor(EMBED_COLORS.GREY).setTitle('❌ Cancelled').setDescription('Operation cancelled.')]
        });
        return true;
    }

    const quantity = parseInt(message.content);
    if (isNaN(quantity) || quantity <= 0) {
        await message.reply({
            embeds: [createErrorEmbed('❌ Invalid Quantity', 'Please enter a valid positive number.')]
        });
        return true;
    }

    if (pendingAction.type === 'additem') {
        try {
            await AdminActionService.addItemToUser(pendingAction.userId, pendingAction.fullItemName, quantity);
            await message.reply({
                embeds: [createSuccessEmbed('✅ Item Added', `Added **${quantity}x ${pendingAction.fullItemName}** to user \`${pendingAction.userId}\`.`)]
            });
        } catch (error) {
            await message.reply({
                embeds: [createErrorEmbed('⚠️ Error', 'Failed to add the item to the user\'s inventory.')]
            });
        }
    } else if (pendingAction.type === 'addfumo') {
        try {
            await AdminActionService.addFumoToUser(pendingAction.userId, pendingAction.fullFumoName, quantity);
            await message.reply({
                embeds: [createSuccessEmbed('✅ Fumo Added', `Added **${quantity}x ${pendingAction.fullFumoName}** to user \`${pendingAction.userId}\`.`)]
            });
        } catch (error) {
            await message.reply({
                embeds: [createErrorEmbed('⚠️ Error', 'Failed to add the fumo to the user\'s inventory.')]
            });
        }
    }

    AdminActionService.removePendingAction(message.author.id);
    return true;
}

async function handleAmountInput(message) {
    const pendingCurr = AdminActionService.getPendingCurrency(message.author.id);
    if (!pendingCurr || !pendingCurr.awaitingAmount) return false;

    if (message.content.toLowerCase() === 'cancel') {
        AdminActionService.removePendingCurrency(message.author.id);
        await message.reply({
            embeds: [new EmbedBuilder().setColor(EMBED_COLORS.GREY).setTitle('❌ Cancelled').setDescription('Currency addition cancelled.')]
        });
        return true;
    }

    const amount = AdminActionService.parseAmount(message.content, Infinity);
    if (isNaN(amount) || amount <= 0) {
        await message.reply({
            embeds: [createErrorEmbed('❌ Invalid Amount', 'Please enter a valid positive number or use suffixes like K, M, B, T, Qa, etc.')]
        });
        return true;
    }

    try {
        await AdminActionService.addCurrencyToUser(pendingCurr.userId, pendingCurr.currencyType, amount);
        const currencyInfo = AdminActionService.getCurrencyInfo(pendingCurr.currencyType);
        await message.reply({
            embeds: [createSuccessEmbed(
                '✅ Currency Added',
                `Added **${amount.toLocaleString()}** ${currencyInfo.emoji} to user \`${pendingCurr.userId}\`.`
            )]
        });
    } catch (error) {
        await message.reply({
            embeds: [createErrorEmbed('⚠️ Error', 'Failed to add currency.')]
        });
    }

    AdminActionService.removePendingCurrency(message.author.id);
    return true;
}

// ═══════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════

function registerAdminCommands(client) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const content = message.content.trim();

        // Check for pending actions
        if (await handleQuantityInput(message)) return;
        if (await handleAmountInput(message)) return;

        // Command routing
        if (content.startsWith('.additem')) {
            await handleAddItem(message);
        } else if (content.startsWith('.addfumo')) {
            await handleAddFumo(message);
        } else if (content.startsWith('.weather')) {
            await handleWeatherCommand(message, client);
        } else if (content.startsWith('.addcurrency')) {
            await handleAddCurrency(message);
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;

        const customId = interaction.customId;

        if (customId.startsWith('admin_item_rarity_')) {
            await handleItemRaritySelection(interaction);
        } else if (customId.startsWith('admin_fumo_rarity_')) {
            await handleFumoRaritySelection(interaction);
        } else if (customId.startsWith('admin_fumo_select_')) {
            await handleFumoSelection(interaction);
        } else if (customId.startsWith('admin_fumo_trait_')) {
            await handleFumoTraitSelection(interaction);
        } else if (customId.startsWith('admin_currency_type_')) {
            await handleCurrencyTypeSelection(interaction);
        }
    });
}

module.exports = { 
    registerAdminCommands, 
    ALLOWED_ADMINS: ADMIN_IDS 
};
