const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../Core/Database/dbSetting');
const FumoPool = require('../Data/FumoPool');
const { RARITY_PRIORITY } = require('../Configuration/rarity');
const { SEASONS, WEATHER_EVENTS, getSeasonDescription, getWeatherDuration } = require('../Configuration/seasonConfig');
const { forceWeatherEvent, stopWeatherEvent } = require('../Service/FarmingService/SeasonService/SeasonManagerService');

const ALLOWED_ADMINS = ['1128296349566251068', '1362450043939979378', '1421544451897299024'];

const pendingActions = new Map();
const pendingCurrency = new Map(); // Added separate Map for currency operations

// Helper function to parse amounts with suffixes (K, M, B, T, etc.)
function parseAmount(input, max = Infinity) {
    const suffixes = {
        'k': 1e3,
        'm': 1e6,
        'b': 1e9,
        't': 1e12,
        'qa': 1e15,
        'qi': 1e18,
        'sx': 1e21,
        'sp': 1e24,
        'oc': 1e27,
        'no': 1e30,
        'dc': 1e33,
        'ud': 1e36,
        'dd': 1e39,
        'td': 1e42,
        'qad': 1e45,
        'qid': 1e48
    };

    const match = input.toLowerCase().trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
    if (!match) return NaN;

    const [, numStr, suffix] = match;
    let num = parseFloat(numStr);

    if (suffix && suffixes[suffix]) {
        num *= suffixes[suffix];
    } else if (suffix) {
        return NaN; // Invalid suffix
    }

    return Math.min(num, max);
}

async function handleAddItem(message) {
    const allowedUsers = ['1128296349566251068', '1362450043939979378', '1421544451897299024'];
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

    const rarityOptions = [
        { label: 'Basic (B)', value: 'B' },
        { label: 'Common (C)', value: 'C' },
        { label: 'Rare (R)', value: 'R' },
        { label: 'Epic (E)', value: 'E' },
        { label: 'Legendary (L)', value: 'L' },
        { label: 'Mythical (M)', value: 'M' },
        { label: 'Divine (D)', value: 'D' },
        { label: 'Secret (?)', value: '?' },
        { label: 'Unknown (Un)', value: 'Un' },
        { label: 'Prime (P)', value: 'P' }
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

    pendingActions.set(message.author.id, {
        type: 'additem',
        userId,
        itemName,
        messageId: msg.id
    });
}

async function handleAddFumo(message) {
    const allowedUsers = ['1128296349566251068', '1362450043939979378', '1421544451897299024'];
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

    const rarityOptions = RARITY_PRIORITY.map(rarity => ({
        label: rarity,
        value: rarity
    }));

    const rarityMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_fumo_rarity_${message.author.id}`)
            .setPlaceholder('Select fumo rarity')
            .addOptions(rarityOptions.slice(0, 25))
    );

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🎭 Add Fumo - Step 1')
        .setDescription(`**User:** <@${userId}>\n\nSelect the rarity of the fumo:`);

    const msg = await message.reply({
        embeds: [embed],
        components: [rarityMenu]
    });

    pendingActions.set(message.author.id, {
        type: 'addfumo',
        userId,
        messageId: msg.id
    });
}

async function handleItemRaritySelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pendingAction = pendingActions.get(adminId);
    if (!pendingAction || pendingAction.type !== 'additem') {
        return interaction.reply({
            content: '❌ No pending item addition found.',
            ephemeral: true
        });
    }

    const rarity = interaction.values[0];
    const fullItemName = `${pendingAction.itemName}(${rarity})`;

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🎁 Add Item - Step 2')
        .setDescription(
            `**Item:** ${fullItemName}\n` +
            `**User:** <@${pendingAction.userId}>\n\n` +
            `Reply with the quantity to add (or "cancel" to cancel):`
        );

    await interaction.update({
        embeds: [embed],
        components: []
    });

    pendingActions.set(adminId, {
        ...pendingAction,
        fullItemName,
        awaitingQuantity: true
    });
}

async function handleFumoRaritySelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pendingAction = pendingActions.get(adminId);
    if (!pendingAction || pendingAction.type !== 'addfumo') {
        return interaction.reply({
            content: '❌ No pending fumo addition found.',
            ephemeral: true
        });
    }

    const rarity = interaction.values[0];

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
        .setDescription(`**User:** <@${pendingAction.userId}>\n**Rarity:** ${rarity}\n\nSelect the fumo:`);

    await interaction.update({
        embeds: [embed],
        components: [fumoMenu]
    });

    pendingActions.set(adminId, {
        ...pendingAction,
        rarity
    });
}

async function handleFumoSelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pendingAction = pendingActions.get(adminId);
    if (!pendingAction || pendingAction.type !== 'addfumo') {
        return interaction.reply({
            content: '❌ No pending fumo addition found.',
            ephemeral: true
        });
    }

    const baseFumoName = interaction.values[0];

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
            `**User:** <@${pendingAction.userId}>\n` +
            `**Fumo:** ${baseFumoName}\n\n` +
            `Select a trait for this fumo:`
        );

    await interaction.update({
        embeds: [embed],
        components: [traitMenu]
    });

    pendingActions.set(adminId, {
        ...pendingAction,
        baseFumoName
    });
}

async function handleFumoTraitSelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pendingAction = pendingActions.get(adminId);
    if (!pendingAction || pendingAction.type !== 'addfumo') {
        return interaction.reply({
            content: '❌ No pending fumo addition found.',
            ephemeral: true
        });
    }

    const trait = interaction.values[0];
    let fullFumoName = `${pendingAction.baseFumoName}(${pendingAction.rarity})`;

    if (trait === 'shiny') {
        fullFumoName += '[✨SHINY]';
    } else if (trait === 'alg') {
        fullFumoName += '[🌟alG]';
    }

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('🎭 Add Fumo - Step 4')
        .setDescription(
            `**Fumo:** ${fullFumoName}\n` +
            `**User:** <@${pendingAction.userId}>\n\n` +
            `Reply with the quantity to add (or "cancel" to cancel):`
        );

    await interaction.update({
        embeds: [embed],
        components: []
    });

    pendingActions.set(adminId, {
        ...pendingAction,
        fullFumoName,
        awaitingQuantity: true
    });
}

async function handleQuantityInput(message) {
    const pendingAction = pendingActions.get(message.author.id);
    if (!pendingAction || !pendingAction.awaitingQuantity) return;

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

    if (pendingAction.type === 'additem') {
        await executeAddItem(message, pendingAction.userId, pendingAction.fullItemName, quantity);
    } else if (pendingAction.type === 'addfumo') {
        await executeAddFumo(message, pendingAction.userId, pendingAction.fullFumoName, quantity);
    }

    pendingActions.delete(message.author.id);
}

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

async function handleWeatherCommand(message, client) {
    if (!ALLOWED_ADMINS.includes(message.author.id)) {
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

    if (args.length === 0) {
        const weatherList = WEATHER_EVENTS.map(w => {
            const season = SEASONS[w];
            return `• **${w}** - ${season.emoji} ${season.name}`;
        }).join('\n');

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Blue')
                    .setTitle('🌤️ Weather Command Usage')
                    .setDescription(
                        '**Usage:** `.weather <weather_name> [duration_minutes]`\n\n' +
                        '**Available Weather Events:**\n' +
                        weatherList + '\n\n' +
                        '**Examples:**\n' +
                        '`.weather DAWN_DAYLIGHT` - Start with default duration\n' +
                        '`.weather GOLDEN_HOUR 30` - Start for 30 minutes\n' +
                        '`.weather stop STORM` - Stop a weather event'
                    )
            ]
        });
    }

    const [action, weatherName, durationArg] = args[0].toLowerCase() === 'stop'
        ? ['stop', args[1]?.toUpperCase(), null]
        : ['start', args[0]?.toUpperCase(), args[1]];

    if (action === 'stop') {
        if (!weatherName || !WEATHER_EVENTS.includes(weatherName)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('❌ Invalid Weather Type')
                        .setDescription('Please provide a valid weather event name to stop.')
                ]
            });
        }

        await stopWeatherEvent(weatherName, client);

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('✅ Weather Stopped')
                    .setDescription(`Successfully stopped **${weatherName}**`)
            ]
        });
    }

    if (!weatherName || !WEATHER_EVENTS.includes(weatherName)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Invalid Weather Type')
                    .setDescription(
                        'Please provide a valid weather event name.\n' +
                        'Use `.weather` to see the list of available events.'
                    )
            ]
        });
    }

    let duration = getWeatherDuration(weatherName);
    if (durationArg) {
        const minutes = parseInt(durationArg, 10);
        if (!isNaN(minutes) && minutes > 0 && minutes <= 10080) {
            duration = minutes * 60 * 1000;
        }
    }

    const result = await forceWeatherEvent(weatherName, duration, client);

    if (!result.success) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Failed to Start Weather')
                    .setDescription('An error occurred while starting the weather event.')
            ]
        });
    }

    const description = getSeasonDescription(weatherName);
    const season = SEASONS[weatherName];

    return message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Weather Event Started')
                .setDescription(
                    `${description}\n\n` +
                    `**Duration:** ${Math.floor(duration / 60000)} minutes\n` +
                    `**Coin Multiplier:** x${season.coinMultiplier}\n` +
                    `**Gem Multiplier:** x${season.gemMultiplier}`
                )
        ]
    });
}

async function handleAddCurrency(message) {
    if (!ALLOWED_ADMINS.includes(message.author.id)) {
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
                    .setDescription('`.addcurrency <userId>`\n\nYou will then select currency type and amount.')
            ]
        });
    }

    const userId = args[0];
    if (!/^\d{17,19}$/.test(userId)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Invalid User ID')
                    .setDescription('Please provide a valid Discord user ID.')
            ]
        });
    }

    const currencyMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_currency_type_${message.author.id}`)
            .setPlaceholder('Select currency type')
            .addOptions([
                { label: 'Coins 💰', value: 'coins' },
                { label: 'Gems 💎', value: 'gems' }
            ])
    );

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('💰 Add Currency - Step 1')
        .setDescription(`**User:** <@${userId}>\n\nSelect the currency type:`);

    const msg = await message.reply({
        embeds: [embed],
        components: [currencyMenu]
    });

    pendingCurrency.set(message.author.id, {
        userId,
        messageId: msg.id
    });
}

async function handleCurrencyTypeSelection(interaction) {
    const adminId = interaction.customId.split('_').pop();
    if (interaction.user.id !== adminId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pendingCurr = pendingCurrency.get(adminId);
    if (!pendingCurr) {
        return interaction.reply({
            content: '❌ No pending currency addition found.',
            ephemeral: true
        });
    }

    const currencyType = interaction.values[0];

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('💰 Add Currency - Step 2')
        .setDescription(
            `**User:** <@${pendingCurr.userId}>\n` +
            `**Currency:** ${currencyType === 'coins' ? '💰 Coins' : '💎 Gems'}\n\n` +
            `Reply with the amount to add (supports K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc, etc.)\n` +
            `Examples: 1000, 1K, 1.5M, 2B, 5Qa\n\n` +
            `Or type "cancel" to cancel.`
        );

    await interaction.update({
        embeds: [embed],
        components: []
    });

    pendingCurrency.set(adminId, {
        ...pendingCurr,
        currencyType,
        awaitingAmount: true
    });
}

async function handleAmountInput(message) {
    const pendingCurr = pendingCurrency.get(message.author.id);
    if (!pendingCurr || !pendingCurr.awaitingAmount) return;

    if (message.content.toLowerCase() === 'cancel') {
        pendingCurrency.delete(message.author.id);
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Grey')
                    .setTitle('❌ Cancelled')
                    .setDescription('Currency addition cancelled.')
            ]
        });
    }

    const amount = parseAmount(message.content, Infinity);
    if (isNaN(amount) || amount <= 0) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Invalid Amount')
                    .setDescription('Please enter a valid positive number or use suffixes like K, M, B, T, Qa, etc.')
            ]
        });
    }

    await executeAddCurrency(message, pendingCurr.userId, pendingCurr.currencyType, amount);
    pendingCurrency.delete(message.author.id);
}

async function executeAddCurrency(message, userId, currencyType, amount) {
    const column = currencyType === 'coins' ? 'coins' : 'gems';

    db.get(
        `SELECT ${column} FROM userCoins WHERE userId = ?`,
        [userId],
        (err, row) => {
            if (err) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('⚠️ Error')
                            .setDescription('Failed to add currency.')
                    ]
                });
            }

            if (row) {
                db.run(
                    `UPDATE userCoins SET ${column} = ${column} + ? WHERE userId = ?`,
                    [amount, userId],
                    function (err) {
                        if (err) {
                            return message.reply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setTitle('⚠️ Error')
                                        .setDescription('Failed to update currency.')
                                ]
                            });
                        }
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Currency Added')
                                    .setDescription(
                                        `Added **${amount.toLocaleString()}** ${currencyType === 'coins' ? '💰' : '💎'} to user \`${userId}\`.`
                                    )
                            ]
                        });
                    }
                );
            } else {
                db.run(
                    `INSERT INTO userCoins (userId, coins, gems) VALUES (?, ?, ?)`,
                    [userId, currencyType === 'coins' ? amount : 0, currencyType === 'gems' ? amount : 0],
                    function (err) {
                        if (err) {
                            return message.reply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setTitle('⚠️ Error')
                                        .setDescription('Failed to add currency.')
                                ]
                            });
                        }
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Currency Added')
                                    .setDescription(
                                        `Added **${amount.toLocaleString()}** ${currencyType === 'coins' ? '💰' : '💎'} to user \`${userId}\`.`
                                    )
                            ]
                        });
                    }
                );
            }
        }
    );
}

function registerAdminCommands(client) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const content = message.content.trim();

        // Check for pending actions (items/fumos)
        const pendingAction = pendingActions.get(message.author.id);
        if (pendingAction && pendingAction.awaitingQuantity) {
            return handleQuantityInput(message);
        }

        // Check for pending currency
        const pendingCurr = pendingCurrency.get(message.author.id);
        if (pendingCurr && pendingCurr.awaitingAmount) {
            return handleAmountInput(message);
        }

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

        if (interaction.customId.startsWith('admin_item_rarity_')) {
            await handleItemRaritySelection(interaction);
        } else if (interaction.customId.startsWith('admin_fumo_rarity_')) {
            await handleFumoRaritySelection(interaction);
        } else if (interaction.customId.startsWith('admin_fumo_select_')) {
            await handleFumoSelection(interaction);
        } else if (interaction.customId.startsWith('admin_fumo_trait_')) {
            await handleFumoTraitSelection(interaction);
        } else if (interaction.customId.startsWith('admin_currency_type_')) {
            await handleCurrencyTypeSelection(interaction);
        }
    });
}

module.exports = { registerAdminCommands, ALLOWED_ADMINS };