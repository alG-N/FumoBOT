const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const TRADING_CONFIG = require('../../Configuration/tradingConfig');
const { RARITY_PRIORITY } = require('../../Configuration/rarity');
const { formatNumber } = require('../../Ultility/formatting');

function createInviteEmbed(requester, target) {
    return new EmbedBuilder()
        .setTitle('🤝 Trade Request')
        .setDescription(
            `**${requester.tag}** wants to trade with **${target.tag}**!\n\n` +
            `Do you accept this trade request?`
        )
        .setColor(TRADING_CONFIG.COLORS.INVITE)
        .setFooter({ text: 'You have 60 seconds to respond' })
        .setTimestamp();
}

function createInviteButtons(sessionKey) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`trade_accept_${sessionKey}`)
            .setLabel('Accept Trade')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId(`trade_decline_${sessionKey}`)
            .setLabel('Decline Trade')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    );
}

function createTradeEmbed(trade, client) {
    const { user1, user2, state } = trade;

    const user1Items = Array.from(user1.items.entries())
        .map(([name, qty]) => `• ${name} x${qty}`)
        .join('\n') || 'None';

    const user2Items = Array.from(user2.items.entries())
        .map(([name, qty]) => `• ${name} x${qty}`)
        .join('\n') || 'None';

    const user1Fumos = Array.from(user1.fumos.entries())
        .map(([name, qty]) => `• ${name} x${qty}`)
        .join('\n') || 'None';

    const user2Fumos = Array.from(user2.fumos.entries())
        .map(([name, qty]) => `• ${name} x${qty}`)
        .join('\n') || 'None';

    const user1Pets = Array.from(user1.pets.values())
        .map(p => `• ${p.petName || p.name} (${p.rarity})`)
        .join('\n') || 'None';

    const user2Pets = Array.from(user2.pets.values())
        .map(p => `• ${p.petName || p.name} (${p.rarity})`)
        .join('\n') || 'None';

    const statusEmoji1 = user1.accepted ? '✅' : '⏳';
    const statusEmoji2 = user2.accepted ? '✅' : '⏳';

    const confirmEmoji1 = user1.confirmed ? '🎯' : '⬜';
    const confirmEmoji2 = user2.confirmed ? '🎯' : '⬜';

    let color = TRADING_CONFIG.COLORS.ACTIVE;
    if (state === TRADING_CONFIG.STATES.BOTH_ACCEPTED) {
        color = TRADING_CONFIG.COLORS.ACCEPTED;
    } else if (state === TRADING_CONFIG.STATES.CONFIRMING) {
        color = TRADING_CONFIG.COLORS.CONFIRMING;
    }

    let description = 'Add items to the trade and click Accept when ready.';
    if (state === TRADING_CONFIG.STATES.BOTH_ACCEPTED) {
        if (user1.confirmed && user2.confirmed) {
            description = '⚠️ **Both players confirmed! Finalizing trade...**';
        } else {
            description = '⚠️ **Both players ready! Each player must click CONFIRM to finalize.**';
        }
    } else if (state === TRADING_CONFIG.STATES.CONFIRMING) {
        description = '⏰ **Final confirmation in progress...**';
    }

    return new EmbedBuilder()
        .setTitle('🤝 Active Trade')
        .setDescription(description)
        .addFields(
            {
                name: `${statusEmoji1}${confirmEmoji1} ${user1.tag}'s Offer`,
                value:
                    `💰 Coins: **${formatNumber(user1.coins)}**\n` +
                    `💎 Gems: **${formatNumber(user1.gems)}**\n` +
                    `📦 Items:\n${user1Items}\n` +
                    `🎭 Fumos:\n${user1Fumos}\n` +
                    `🐾 Pets:\n${user1Pets}`,
                inline: true
            },
            {
                name: `${statusEmoji2}${confirmEmoji2} ${user2.tag}'s Offer`,
                value:
                    `💰 Coins: **${formatNumber(user2.coins)}**\n` +
                    `💎 Gems: **${formatNumber(user2.gems)}**\n` +
                    `📦 Items:\n${user2Items}\n` +
                    `🎭 Fumos:\n${user2Fumos}\n` +
                    `🐾 Pets:\n${user2Pets}`,
                inline: true
            }
        )
        .setColor(color)
        .setFooter({
            text: state === TRADING_CONFIG.STATES.BOTH_ACCEPTED
                ? '✅ = Accepted | 🎯 = Confirmed | Both must confirm!'
                : 'Trade will timeout after 5 minutes of inactivity'
        })
        .setTimestamp();
}

function createTradeActionButtons(sessionKey, bothAccepted = false, bothConfirmed = false) {
    const buttons = [];

    if (bothAccepted && !bothConfirmed) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`trade_confirm_${sessionKey}`)
                .setLabel('CONFIRM TRADE')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎯')
        );
    } else if (!bothAccepted) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`trade_toggle_accept_${sessionKey}`)
                .setLabel('Accept / Unaccept')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✅')
        );
    }

    buttons.push(
        new ButtonBuilder()
            .setCustomId(`trade_cancel_${sessionKey}`)
            .setLabel('Cancel Trade')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    );

    return new ActionRowBuilder().addComponents(buttons);
}

function createItemTypeButtons(sessionKey) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`trade_add_coins_${sessionKey}`)
            .setLabel('Coins')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('💰'),
        new ButtonBuilder()
            .setCustomId(`trade_add_gems_${sessionKey}`)
            .setLabel('Gems')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('💎'),
        new ButtonBuilder()
            .setCustomId(`trade_add_items_${sessionKey}`)
            .setLabel('Items')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📦'),
        new ButtonBuilder()
            .setCustomId(`trade_add_fumos_${sessionKey}`)
            .setLabel('Fumos')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎭'),
        new ButtonBuilder()
            .setCustomId(`trade_add_pets_${sessionKey}`)
            .setLabel('Pets')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🐾')
    );
}

function createItemRarityMenu(sessionKey) {
    const rarityEmojis = {
        'Basic': '⚪',
        'Common': '🟩',
        'Rare': '🟦',
        'Epic': '🟨',
        'Legendary': '🟪',
        'Mythical': '🟥',
        'Divine': '⭐',
        'Secret': '⬛',
        'Unknown': "🌀",
        'Prime': "👑"
    };

    const rarityOrder = ['Basic', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Divine', 'Secret', 'Unknown', 'Prime'];

    const options = rarityOrder.map(rarity => ({
        label: rarity,
        description: `Filter items by ${rarity} rarity`,
        value: `${sessionKey}|${rarity}`,
        emoji: rarityEmojis[rarity] || '⚪'
    }));

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`trade_select_item_rarity_${sessionKey}`)
            .setPlaceholder('Select item rarity')
            .addOptions(options)
    );
}

function createItemSelectMenu(sessionKey, items, rarity = '') {
    const options = items.slice(0, 25).map(item => ({
        label: item.itemName,
        description: `Available: ${item.quantity}`,
        value: `${sessionKey}|${item.itemName}`,
        emoji: '📦'
    }));

    if (options.length === 0) {
        options.push({
            label: 'No items available',
            description: rarity ? `You have no ${rarity} items` : 'You have no tradeable items',
            value: 'none',
            emoji: '❌'
        });
    }

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`trade_select_item_${sessionKey}`)
            .setPlaceholder(rarity ? `Select a ${rarity} item to trade` : 'Select an item to trade')
            .addOptions(options)
            .setDisabled(options[0].value === 'none')
    );
}

function createPetSelectMenu(sessionKey, pets) {
    const options = pets.slice(0, 25).map(pet => ({
        label: `${pet.petName || pet.name} (${pet.rarity})`,
        description: `Lv.${pet.level || 1} | Age ${pet.age || 1}`,
        value: `${sessionKey}|${pet.petId}`,
        emoji: '🐾'
    }));

    if (options.length === 0) {
        options.push({
            label: 'No pets available',
            description: 'You have no tradeable pets',
            value: 'none',
            emoji: '❌'
        });
    }

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`trade_select_pet_${sessionKey}`)
            .setPlaceholder('Select a pet to trade')
            .addOptions(options)
            .setDisabled(options[0].value === 'none')
    );
}

function createFumoTypeMenu(sessionKey) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`trade_select_fumo_type_${sessionKey}`)
            .setPlaceholder('Select fumo type')
            .addOptions([
                {
                    label: 'Normal Fumos',
                    description: 'Regular fumos without special variants',
                    value: `${sessionKey}|normal`,
                    emoji: '🎭'
                },
                {
                    label: 'Shiny Fumos',
                    description: 'Fumos with [✨SHINY] tag',
                    value: `${sessionKey}|shiny`,
                    emoji: '✨'
                },
                {
                    label: 'alG Fumos',
                    description: 'Fumos with [🌟alG] tag',
                    value: `${sessionKey}|alg`,
                    emoji: '🌟'
                }
            ])
    );
}

function createFumoRarityMenu(sessionKey, type) {
    const rarityEmojis = {
        'Common': '⚪',
        'UNCOMMON': '🟢',
        'RARE': '🔵',
        'EPIC': '🟣',
        'OTHERWORLDLY': '🌌',
        'LEGENDARY': '🟠',
        'MYTHICAL': '💫',
        'EXCLUSIVE': '💎',
        '???': '❓',
        'ASTRAL': '🌠',
        'CELESTIAL': '🌟',
        'INFINITE': '♾️',
        'ETERNAL': '🪐',
        'TRANSCENDENT': '🌈'
    };

    const options = RARITY_PRIORITY.map(rarity => ({
        label: rarity,
        description: `Filter ${type} fumos by ${rarity} rarity`,
        value: `${sessionKey}|${type}|${rarity}`,
        emoji: rarityEmojis[rarity] || '⚪'
    }));

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`trade_select_fumo_rarity_${sessionKey}`)
            .setPlaceholder(`Select rarity for ${type} fumos`)
            .addOptions(options)
    );
}

function createFumoSelectMenu(sessionKey, fumos, type, rarity) {
    const typeEmoji = {
        normal: '🎭',
        shiny: '✨',
        alg: '🌟'
    };

    const uniqueFumosMap = new Map();
    fumos.forEach(fumo => {
        const key = fumo.fumoName;
        if (!uniqueFumosMap.has(key)) {
            uniqueFumosMap.set(key, fumo);
        } else {
            const existing = uniqueFumosMap.get(key);
            existing.quantity += fumo.quantity;
        }
    });

    const uniqueFumos = Array.from(uniqueFumosMap.values());

    const options = uniqueFumos.slice(0, 25).map(fumo => {
        const cleanName = fumo.fumoName.replace(/\[.*?\]/g, '').trim();
        return {
            label: cleanName.length > 100 ? cleanName.substring(0, 97) + '...' : cleanName,
            description: `Available: ${fumo.quantity}`,
            value: `${sessionKey}|${fumo.fumoName}`,
            emoji: typeEmoji[type] || '🎭'
        };
    });

    if (options.length === 0) {
        options.push({
            label: 'No fumos available',
            description: `You have no ${rarity} ${type} fumos`,
            value: 'none',
            emoji: '❌'
        });
    }

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`trade_select_fumo_${sessionKey}`)
            .setPlaceholder(`Select a ${rarity} ${type} fumo to trade`)
            .addOptions(options)
            .setDisabled(options[0].value === 'none')
    );
}

function createConfirmationEmbed(trade) {
    return new EmbedBuilder()
        .setTitle('⚠️ FINALIZING TRADE')
        .setDescription(
            '**Both players have confirmed!**\n\n' +
            'Trade will be executed in **3 seconds**...\n\n' +
            '⚠️ **This action cannot be undone!**'
        )
        .addFields(
            {
                name: `${trade.user1.tag} gives:`,
                value:
                    `💰 ${formatNumber(trade.user1.coins)} coins\n` +
                    `💎 ${formatNumber(trade.user1.gems)} gems\n` +
                    `📦 ${trade.user1.items.size} items\n` +
                    `🎭 ${trade.user1.fumos.size} fumos\n` +
                    `🐾 ${trade.user1.pets.size} pets`,
                inline: true
            },
            {
                name: `${trade.user2.tag} gives:`,
                value:
                    `💰 ${formatNumber(trade.user2.coins)} coins\n` +
                    `💎 ${formatNumber(trade.user2.gems)} gems\n` +
                    `📦 ${trade.user2.items.size} items\n` +
                    `🎭 ${trade.user2.fumos.size} fumos\n` +
                    `🐾 ${trade.user2.pets.size} pets`,
                inline: true
            }
        )
        .setColor(TRADING_CONFIG.COLORS.CONFIRMING)
        .setFooter({ text: 'Trade executing...' })
        .setTimestamp();
}

function createCompleteEmbed(trade) {
    return new EmbedBuilder()
        .setTitle('✅ Trade Completed!')
        .setDescription('The trade has been successfully completed. All items have been exchanged.')
        .setColor(TRADING_CONFIG.COLORS.ACCEPTED)
        .setTimestamp();
}

function createCancelledEmbed(cancelledBy) {
    return new EmbedBuilder()
        .setTitle('❌ Trade Cancelled')
        .setDescription(`The trade was cancelled${cancelledBy !== 'timeout' ? ` by **${cancelledBy}**` : ' due to timeout'}.`)
        .setColor(TRADING_CONFIG.COLORS.CANCELLED)
        .setTimestamp();
}

module.exports = {
    createInviteEmbed,
    createInviteButtons,
    createTradeEmbed,
    createTradeActionButtons,
    createItemTypeButtons,
    createItemRarityMenu,
    createItemSelectMenu,
    createPetSelectMenu,
    createFumoTypeMenu,
    createFumoRarityMenu,
    createFumoSelectMenu,
    createConfirmationEmbed,
    createCompleteEmbed,
    createCancelledEmbed
};