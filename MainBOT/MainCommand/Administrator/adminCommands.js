const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../Core/Database/dbSetting');
const FumoPool = require('../Data/FumoPool');
const { RARITY_PRIORITY } = require('../Configuration/rarity');

const ALLOWED_ADMINS = ['1128296349566251068', '1362450043939979378'];

// Store pending admin actions
const pendingActions = new Map();

/**
 * Admin command: .additem
 * Adds items to a user's inventory with rarity and quantity selection
 */
async function handleAddItem(message) {
    const allowedUsers = ['1128296349566251068'];
    if (!allowedUsers.includes(message.author.id)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const args = message.content.trim().split(' ').slice(1);
    if (args.length < 2) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.additem <userId> <itemName>`\n\nYou will then select rarity and quantity.')
            ]
        });
    }

    const [userId, ...itemNameParts] = args;
    const itemName = itemNameParts.join(' ');

    if (!itemName) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.additem <userId> <itemName>`')
            ]
        });
    }

    // Show rarity selection menu
    const rarityOptions = [
        { label: 'Basic (B)', value: 'B' },
        { label: 'Common (C)', value: 'C' },
        { label: 'Rare (R)', value: 'R' },
        { label: 'Epic (E)', value: 'E' },
        { label: 'Legendary (L)', value: 'L' },
        { label: 'Mythical (M)', value: 'M' },
        { label: 'Divine (D)', value: 'D' },
        { label: 'Secret (?)', value: '?' }
    ];

    const rarityMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_item_rarity_${message.author.id}`)
            .setPlaceholder('Select item rarity')
            .addOptions(rarityOptions)
    );

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🎁 Add Item - Step 1')
        .setDescription(`**Item:** ${itemName}\n**User:** <@${userId}>\n\nSelect the rarity suffix for this item:`);

    const msg = await message.reply({
        embeds: [embed],
        components: [rarityMenu]
    });

    // Store pending action
    pendingActions.set(message.author.id, {
        type: 'additem',
        userId,
        itemName,
        messageId: msg.id
    });
}

/**
 * Admin command: .addfumo
 * Adds fumos to a user's inventory with rarity, fumo, and trait selection
 */
async function handleAddFumo(message) {
    const allowedUsers = ['1128296349566251068'];
    if (!allowedUsers.includes(message.author.id)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const args = message.content.trim().split(' ').slice(1);
    if (args.length < 1) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.addfumo <userId>`\n\nYou will then select rarity, fumo, trait, and quantity.')
            ]
        });
    }

    const userId = args[0];

    // Show rarity selection menu
    const rarityOptions = RARITY_PRIORITY.map(rarity => ({
        label: rarity,
        value: rarity
    }));

    const rarityMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_fumo_rarity_${message.author.id}`)
            .setPlaceholder('Select fumo rarity')
            .addOptions(rarityOptions.slice(0, 25)) // Discord limit
    );

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🎭 Add Fumo - Step 1')
        .setDescription(`**User:** <@${userId}>\n\nSelect the rarity of the fumo:`);

    const msg = await message.reply({
        embeds: [embed],
        components: [rarityMenu]
    });

    // Store pending action
    pendingActions.set(message.author.id, {
        type: 'addfumo',
        userId,
        messageId: msg.id
    });
}

/**
 * Handle admin item rarity selection
 */
async function handleItemRaritySelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pending = pendingActions.get(adminId);
    if (!pending || pending.type !== 'additem') {
        return interaction.reply({
            content: '❌ No pending item addition found.',
            ephemeral: true
        });
    }

    const rarity = interaction.values[0];
    const fullItemName = `${pending.itemName}(${rarity})`;

    // Show quantity input prompt
    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🎁 Add Item - Step 2')
        .setDescription(
            `**Item:** ${fullItemName}\n` +
            `**User:** <@${pending.userId}>\n\n` +
            `Reply with the quantity to add (or "cancel" to cancel):`
        );

    await interaction.update({
        embeds: [embed],
        components: []
    });

    // Update pending action
    pendingActions.set(adminId, {
        ...pending,
        fullItemName,
        awaitingQuantity: true
    });
}

/**
 * Handle admin fumo rarity selection
 */
async function handleFumoRaritySelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pending = pendingActions.get(adminId);
    if (!pending || pending.type !== 'addfumo') {
        return interaction.reply({
            content: '❌ No pending fumo addition found.',
            ephemeral: true
        });
    }

    const rarity = interaction.values[0];

    // Get fumos from pool using getRaw() instead of getAll()
    const allFumos = FumoPool.getRaw();
    const fumosOfRarity = allFumos.filter(fumo => fumo.rarity === rarity);

    if (fumosOfRarity.length === 0) {
        return interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ No Fumos Found')
                    .setDescription(`No fumos found with rarity: ${rarity}`)
            ],
            components: []
        });
    }

    // Create fumo selection menu (max 25 options)
    const fumoOptions = fumosOfRarity.slice(0, 25).map(fumo => {
        return {
            label: fumo.name.length > 100 ? fumo.name.substring(0, 97) + '...' : fumo.name,
            value: fumo.name,
            description: `${rarity} fumo`
        };
    });

    const fumoMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_fumo_select_${adminId}`)
            .setPlaceholder('Select a fumo')
            .addOptions(fumoOptions)
    );

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🎭 Add Fumo - Step 2')
        .setDescription(`**User:** <@${pending.userId}>\n**Rarity:** ${rarity}\n\nSelect the fumo:`);

    await interaction.update({
        embeds: [embed],
        components: [fumoMenu]
    });

    // Update pending action
    pendingActions.set(adminId, {
        ...pending,
        rarity
    });
}

/**
 * Handle admin fumo selection
 */
async function handleFumoSelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pending = pendingActions.get(adminId);
    if (!pending || pending.type !== 'addfumo') {
        return interaction.reply({
            content: '❌ No pending fumo addition found.',
            ephemeral: true
        });
    }

    const baseFumoName = interaction.values[0];

    // Show trait selection menu
    const traitOptions = [
        { label: 'Normal (no trait)', value: 'normal' },
        { label: '✨ SHINY', value: 'shiny' },
        { label: '🌟 alG', value: 'alg' }
    ];

    const traitMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_fumo_trait_${adminId}`)
            .setPlaceholder('Select trait')
            .addOptions(traitOptions)
    );

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🎭 Add Fumo - Step 3')
        .setDescription(
            `**User:** <@${pending.userId}>\n` +
            `**Fumo:** ${baseFumoName}\n\n` +
            `Select a trait for this fumo:`
        );

    await interaction.update({
        embeds: [embed],
        components: [traitMenu]
    });

    // Update pending action
    pendingActions.set(adminId, {
        ...pending,
        baseFumoName
    });
}

/**
 * Handle admin fumo trait selection
 */
async function handleFumoTraitSelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pending = pendingActions.get(adminId);
    if (!pending || pending.type !== 'addfumo') {
        return interaction.reply({
            content: '❌ No pending fumo addition found.',
            ephemeral: true
        });
    }

    const trait = interaction.values[0];
    let fullFumoName = `${pending.baseFumoName}(${pending.rarity})`;

    // Add trait suffix
    if (trait === 'shiny') {
        fullFumoName += '[✨SHINY]';
    } else if (trait === 'alg') {
        fullFumoName += '[🌟alG]';
    }

    // Show quantity input prompt
    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🎭 Add Fumo - Step 4')
        .setDescription(
            `**Fumo:** ${fullFumoName}\n` +
            `**User:** <@${pending.userId}>\n\n` +
            `Reply with the quantity to add (or "cancel" to cancel):`
        );

    await interaction.update({
        embeds: [embed],
        components: []
    });

    // Update pending action
    pendingActions.set(adminId, {
        ...pending,
        fullFumoName,
        awaitingQuantity: true
    });
}

/**
 * Handle admin quantity input
 */
async function handleQuantityInput(message) {
    const pending = pendingActions.get(message.author.id);
    if (!pending || !pending.awaitingQuantity) return;

    if (message.content.toLowerCase() === 'cancel') {
        pendingActions.delete(message.author.id);
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Grey')
                    .setTitle('❌ Cancelled')
                    .setDescription('Operation cancelled.')
            ]
        });
    }

    const quantity = parseInt(message.content);
    if (isNaN(quantity) || quantity <= 0) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Invalid Quantity')
                    .setDescription('Please enter a valid positive number.')
            ]
        });
    }

    // Execute the addition based on type
    if (pending.type === 'additem') {
        await executeAddItem(message, pending.userId, pending.fullItemName, quantity);
    } else if (pending.type === 'addfumo') {
        await executeAddFumo(message, pending.userId, pending.fullFumoName, quantity);
    }

    pendingActions.delete(message.author.id);
}

/**
 * Execute item addition
 */
async function executeAddItem(message, userId, itemName, quantity) {
    db.get(
        `SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName],
        (err, row) => {
            if (err) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('⚠️ Error')
                            .setDescription('Failed to add the item to the user\'s inventory.')
                    ]
                });
            }
            if (row) {
                db.run(
                    `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                    [quantity, userId, itemName],
                    function (err) {
                        if (err) {
                            return message.reply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setTitle('⚠️ Error')
                                        .setDescription('Failed to update the item quantity.')
                                ]
                            });
                        }
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Item Added')
                                    .setDescription(`Added **${quantity}x ${itemName}** to user \`${userId}\`.`)
                            ]
                        });
                    }
                );
            } else {
                db.run(
                    `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)`,
                    [userId, itemName, quantity],
                    function (err) {
                        if (err) {
                            return message.reply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setTitle('⚠️ Error')
                                        .setDescription('Failed to add the item to the user\'s inventory.')
                                ]
                            });
                        }
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Item Added')
                                    .setDescription(`Added **${quantity}x ${itemName}** to user \`${userId}\`.`)
                            ]
                        });
                    }
                );
            }
        }
    );
}

/**
 * Execute fumo addition
 */
async function executeAddFumo(message, userId, fumoName, quantity) {
    for (let i = 0; i < quantity; i++) {
        db.run(
            `INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`,
            [userId, fumoName],
            function (err) {
                if (err) {
                    console.error('Error adding fumo:', err);
                }
            }
        );
    }

    message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Fumo Added')
                .setDescription(`Added **${quantity}x ${fumoName}** to user \`${userId}\`.`)
        ]
    });
}

/**
 * Register all admin commands and interactions
 */
function registerAdminCommands(client) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const content = message.content.trim();

        // Handle quantity input for pending actions
        const pending = pendingActions.get(message.author.id);
        if (pending && pending.awaitingQuantity) {
            return handleQuantityInput(message);
        }

        // Handle commands
        if (content.startsWith('.additem')) {
            await handleAddItem(message);
        } else if (content.startsWith('.addfumo')) {
            await handleAddFumo(message);
        }
    });

    // Handle interactions
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;

        if (interaction.customId.startsWith('admin_item_rarity_')) {
            await handleItemRaritySelection(interaction);
        } else if (interaction.customId.startsWith('admin_fumo_rarity_')) {
            await handleFumoRaritySelection(interaction);
        } else if (interaction.customId.startsWith('admin_fumo_select_')) {
            await handleFumoSelection(interaction);
        } else if (interaction.customId.startsWith('admin_fumo_trait_')) {
            await handleFumoTraitSelection(interaction);
        }
    });
}

module.exports = { registerAdminCommands, ALLOWED_ADMINS };