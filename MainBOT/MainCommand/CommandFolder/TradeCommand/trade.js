const { checkRestrictions } = require('../../Middleware/restrictions');
const TRADING_CONFIG = require('../../Configuration/tradingConfig');

const {
    isUserTrading,
    createTradeSession,
    getTradeSession,
    updateTradeItem,
    toggleAccept,
    toggleConfirm,
    executeTrade,
    cancelTrade,
    getUserItems,
    getUserPets,
    getUserFumos
} = require('../../Service/TradingService/TradingService');

const {
    createInviteEmbed,
    createInviteButtons,
    createTradeEmbed,
    createTradeActionButtons,
    createItemTypeButtons,
    createItemSelectMenu,
    createPetSelectMenu,
    createFumoTypeMenu,
    createFumoSelectMenu,
    createConfirmationEmbed,
    createCompleteEmbed,
    createCancelledEmbed
} = require('../../Service/TradingService/TradingUIService');

const {
    handleInviteAccept,
    handleInviteDecline,
    handleToggleAccept,
    handleConfirm,
    handleCancel,
    handleAddItem,
    handleSelectItem,
    handleSelectItemRarity,
    handleSelectFumoType,
    handleSelectFumoRarity,
    handleSelectFumo
} = require('../../Service/TradingService/TradingHandlers');

// Store pending trade invites
const pendingInvites = new Map();

module.exports = (client) => {
    // Handle .trade command
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.trade')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const mentionedUser = message.mentions.users.first();
        
        if (!mentionedUser) {
            return message.reply('Usage: `.trade @user` - Initiate a trade with another user.');
        }

        if (mentionedUser.id === message.author.id) {
            return message.reply('❌ You cannot trade with yourself!');
        }

        if (mentionedUser.bot) {
            return message.reply('❌ You cannot trade with bots!');
        }

        // Check if either user is already trading
        const requesterCheck = isUserTrading(message.author.id);
        const targetCheck = isUserTrading(mentionedUser.id);

        if (requesterCheck.trading) {
            return message.reply('❌ You are already in an active trade! Cancel it first.');
        }

        if (targetCheck.trading) {
            return message.reply(`❌ ${mentionedUser.tag} is already in an active trade!`);
        }

        // Create trade session
        const trade = createTradeSession(
            { id: message.author.id, tag: message.author.tag },
            { id: mentionedUser.id, tag: mentionedUser.tag }
        );

        const inviteEmbed = createInviteEmbed(message.author, mentionedUser);
        const inviteButtons = createInviteButtons(trade.sessionKey);

        // Send confirmation to requester
        await message.reply(`📨 Trade request sent to **${mentionedUser.tag}**!`);

        // Send invite in channel (pings the target)
        const inviteMsg = await message.channel.send({
            content: `<@${mentionedUser.id}> - You have a trade request!`,
            embeds: [inviteEmbed],
            components: [inviteButtons]
        });

        // Store pending invite with timeout
        const timeoutId = setTimeout(() => {
            const pending = pendingInvites.get(trade.sessionKey);
            if (pending) {
                pendingInvites.delete(trade.sessionKey);
                cancelTrade(trade.sessionKey);
                inviteMsg.edit({
                    content: '⏰ Trade request expired.',
                    embeds: [createCancelledEmbed('timeout')],
                    components: []
                }).catch(() => {});
            }
        }, TRADING_CONFIG.INVITE_TIMEOUT);

        pendingInvites.set(trade.sessionKey, {
            trade,
            inviteMsg,
            channelId: message.channelId,
            requesterId: message.author.id,
            targetId: mentionedUser.id,
            createdAt: Date.now(),
            timeoutId
        });
    });

    // Handle all trade interactions
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.customId?.startsWith('trade_')) return;

        const parts = interaction.customId.split('_');
        
        // Find where the sessionKey starts
        let sessionKeyStartIndex = -1;
        for (let i = 0; i < parts.length - 1; i++) {
            if (/^\d{17,19}$/.test(parts[i]) && /^\d{17,19}$/.test(parts[i + 1])) {
                sessionKeyStartIndex = i;
                break;
            }
        }
        
        let action, sessionKey;
        if (sessionKeyStartIndex !== -1) {
            action = parts.slice(1, sessionKeyStartIndex).join('_');
            sessionKey = parts.slice(sessionKeyStartIndex, sessionKeyStartIndex + 2).join('_');
        } else {
            action = parts[1];
            sessionKey = parts.slice(2).join('_');
        }

        console.log(`[Trade] Action: ${action}, SessionKey: ${sessionKey}`);

        // Handle invite accept/decline
        if (action === 'accept' || action === 'decline') {
            const pending = pendingInvites.get(sessionKey);
            
            if (!pending) {
                return interaction.reply({
                    content: '❌ This trade invitation has expired.',
                    ephemeral: true
                }).catch(() => {});
            }

            if (interaction.user.id !== pending.targetId) {
                return interaction.reply({
                    content: '❌ This trade invitation is not for you!',
                    ephemeral: true
                }).catch(() => {});
            }

            await interaction.deferUpdate().catch(() => {});

            if (action === 'decline') {
                await handleInviteDecline(interaction, pending, pendingInvites);
                return;
            }

            // Accept trade
            await handleInviteAccept(client, interaction, pending, pendingInvites);
            return;
        }

        // All other trade actions
        const trade = getTradeSession(sessionKey);
        if (!trade) {
            return interaction.reply({
                content: '❌ This trade session has expired or been cancelled.',
                ephemeral: true
            }).catch(() => {});
        }

        // Verify user is part of this trade
        if (interaction.user.id !== trade.user1.id && interaction.user.id !== trade.user2.id) {
            return interaction.reply({
                content: '❌ You are not part of this trade!',
                ephemeral: true
            });
        }

        try {
            switch (action) {
                case 'toggle_accept':
                    await handleToggleAccept(interaction, trade);
                    break;
                case 'confirm':
                    await handleConfirm(interaction, trade, client);
                    break;
                case 'cancel':
                    await handleCancel(interaction, trade);
                    break;
                case 'add_coins':
                case 'add_gems':
                case 'add_items':
                case 'add_pets':
                case 'add_fumos':
                    const itemType = action.split('_')[1];
                    await handleAddItem(interaction, trade, itemType);
                    break;
                case 'select_item':
                case 'select_pet':
                    const selectType = action.split('_')[1];
                    await handleSelectItem(interaction, trade, selectType);
                    break;
                case 'select_item_rarity':
                    await handleSelectItemRarity(interaction, trade);
                    break;
                case 'select_fumo_type':
                    await handleSelectFumoType(interaction, trade);
                    break;
                case 'select_fumo_rarity':
                    await handleSelectFumoRarity(interaction, trade);
                    break;
                case 'select_fumo':
                    await handleSelectFumo(interaction, trade);
                    break;
                default:
                    console.log(`[Trade] Unknown action: ${action}`);
                    break;
            }
        } catch (error) {
            console.error('[Trade] Interaction error:', error);
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            }).catch(() => {});
        }
    });

    // Cleanup expired invites every minute
    setInterval(() => {
        const now = Date.now();
        for (const [key, pending] of pendingInvites.entries()) {
            if (now - pending.createdAt > TRADING_CONFIG.INVITE_TIMEOUT) {
                pendingInvites.delete(key);
                cancelTrade(key);
            }
        }
    }, 60000);
};