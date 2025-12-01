const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    ComponentType 
} = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const TRADING_CONFIG = require('../../Configuration/tradingConfig');

const {
    isUserTrading,
    createTradeSession,
    getTradeSession,
    updateTradeItem,
    toggleAccept,
    executeTrade,
    cancelTrade,
    getUserItems,
    getUserPets
} = require('../../Service/TradingService/TradingService');

const {
    createInviteEmbed,
    createInviteButtons,
    createTradeEmbed,
    createTradeActionButtons,
    createItemTypeButtons,
    createItemSelectMenu,
    createPetSelectMenu,
    createConfirmationEmbed,
    createCompleteEmbed,
    createCancelledEmbed
} = require('../../Service/TradingService/TradingUIService');

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

        // Store pending invite
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
            timeoutId  // Store timeout ID so we can clear it
        });
    });

    // Handle all trade interactions
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.customId?.startsWith('trade_')) return;

        // Parse customId to extract action and sessionKey
        // Format: trade_{action}_{sessionKey}
        // SessionKey contains two user IDs separated by underscore (always 17-19 digits each)
        const parts = interaction.customId.split('_');
        
        // Find where the sessionKey starts (look for two consecutive parts that are user IDs)
        let sessionKeyStartIndex = -1;
        for (let i = 0; i < parts.length - 1; i++) {
            if (/^\d{17,19}$/.test(parts[i]) && /^\d{17,19}$/.test(parts[i + 1])) {
                sessionKeyStartIndex = i;
                break;
            }
        }
        
        let action, sessionKey;
        if (sessionKeyStartIndex !== -1) {
            // Extract action (everything between 'trade' and the sessionKey)
            action = parts.slice(1, sessionKeyStartIndex).join('_');
            // Extract sessionKey (two user IDs)
            sessionKey = parts.slice(sessionKeyStartIndex, sessionKeyStartIndex + 2).join('_');
        } else {
            // Fallback for malformed customIds
            action = parts[1];
            sessionKey = parts.slice(2).join('_');
        }

        console.log(`[Trade] Interaction received: ${interaction.customId}`);
        console.log(`[Trade] Action: ${action}, SessionKey: ${sessionKey}`);
        console.log(`[Trade] Pending invites:`, Array.from(pendingInvites.keys()));

        // Handle invite accept/decline
        if (action === 'accept' || action === 'decline') {
            const pending = pendingInvites.get(sessionKey);
            
            console.log(`[Trade] Pending data found:`, pending ? 'YES' : 'NO');
            
            if (!pending) {
                console.log(`[Trade] ERROR: No pending invite found for ${sessionKey}`);
                return interaction.reply({
                    content: '❌ This trade invitation has expired.',
                    ephemeral: true
                }).catch(() => {});
            }

            if (interaction.user.id !== pending.targetId) {
                console.log(`[Trade] ERROR: Wrong user ${interaction.user.id} vs ${pending.targetId}`);
                return interaction.reply({
                    content: '❌ This trade invitation is not for you!',
                    ephemeral: true
                }).catch(() => {});
            }

            console.log(`[Trade] Processing ${action} for session ${sessionKey}`);

            // Defer the update immediately to prevent expiration
            await interaction.deferUpdate().catch((err) => {
                console.log(`[Trade] Defer failed:`, err.message);
            });

            if (action === 'decline') {
                const { timeoutId } = pending;
                
                // Clear the timeout
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                
                pendingInvites.delete(sessionKey);
                cancelTrade(sessionKey);
                
                await interaction.editReply({
                    content: `❌ **${interaction.user.tag}** declined the trade.`,
                    embeds: [createCancelledEmbed(interaction.user.tag)],
                    components: []
                }).catch(() => {});
                return;
            }

            // Accept trade
            const { trade, timeoutId } = pending;
            
            // Clear the timeout since trade is being accepted
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            pendingInvites.delete(sessionKey);
            trade.state = TRADING_CONFIG.STATES.ACTIVE;

            // Update invite message
            await interaction.editReply({
                content: `✅ Trade accepted by **${interaction.user.tag}**!`,
                embeds: [],
                components: []
            }).catch(() => {});

            // Create main trade window
            const tradeMsg = await interaction.channel.send({
                content: `🤝 **Active Trade: ${trade.user1.tag} ↔️ ${trade.user2.tag}**`,
                embeds: [createTradeEmbed(trade, client)],
                components: [
                    createTradeActionButtons(trade.sessionKey),
                    createItemTypeButtons(trade.sessionKey)
                ]
            });

            // Start trade session
            await handleTradeSession(client, tradeMsg, trade);
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
                    const itemType = action.split('_')[1]; // Extract 'coins', 'gems', 'items', or 'pets'
                    await handleAddItem(interaction, trade, itemType);
                    break;
                case 'select_item':
                case 'select_pet':
                    const selectType = action.split('_')[1]; // Extract 'item' or 'pet'
                    await handleSelectItem(interaction, trade, selectType);
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

/**
 * Handle trade session
 */
async function handleTradeSession(client, message, trade) {
    const collector = message.createMessageComponentCollector({
        time: TRADING_CONFIG.TRADE_SESSION_TIMEOUT
    });

    collector.on('collect', async (interaction) => {
        // Update UI after toggle accept or item selection
        if (interaction.customId.startsWith('trade_toggle')) {
            const currentTrade = getTradeSession(trade.sessionKey);
            if (currentTrade) {
                await message.edit({
                    embeds: [createTradeEmbed(currentTrade, client)],
                    components: [
                        createTradeActionButtons(trade.sessionKey, currentTrade.state === TRADING_CONFIG.STATES.BOTH_ACCEPTED),
                        createItemTypeButtons(trade.sessionKey)
                    ]
                }).catch(() => {});
            }
        }
    });

    collector.on('end', () => {
        const currentTrade = getTradeSession(trade.sessionKey);
        if (currentTrade && currentTrade.state !== TRADING_CONFIG.STATES.COMPLETED) {
            cancelTrade(trade.sessionKey);
            message.edit({
                content: '⏰ Trade session timed out.',
                embeds: [createCancelledEmbed('timeout')],
                components: []
            }).catch(() => {});
        }
    });

    // Auto-refresh UI every 2 seconds while active
    const refreshInterval = setInterval(async () => {
        const currentTrade = getTradeSession(trade.sessionKey);
        if (!currentTrade || currentTrade.state === TRADING_CONFIG.STATES.COMPLETED || 
            currentTrade.state === TRADING_CONFIG.STATES.CANCELLED) {
            clearInterval(refreshInterval);
            return;
        }

        try {
            await message.edit({
                embeds: [createTradeEmbed(currentTrade, client)],
                components: [
                    createTradeActionButtons(trade.sessionKey, currentTrade.state === TRADING_CONFIG.STATES.BOTH_ACCEPTED),
                    createItemTypeButtons(trade.sessionKey)
                ]
            });
        } catch (error) {
            clearInterval(refreshInterval);
        }
    }, 2000);
}

/**
 * Handle toggle accept
 */
async function handleToggleAccept(interaction, trade) {
    const result = toggleAccept(trade.sessionKey, interaction.user.id);
    
    if (!result.success) {
        return interaction.reply({
            content: '❌ Failed to update accept status.',
            ephemeral: true
        });
    }

    const userSide = trade.user1.id === interaction.user.id ? trade.user1 : trade.user2;
    
    await interaction.reply({
        content: userSide.accepted ? '✅ You accepted the trade!' : '⏳ You unaccepted the trade.',
        ephemeral: true
    });
}

/**
 * Handle final confirmation
 */
async function handleConfirm(interaction, trade, client) {
    if (trade.state !== TRADING_CONFIG.STATES.BOTH_ACCEPTED) {
        return interaction.reply({
            content: '❌ Both users must accept before confirming!',
            ephemeral: true
        });
    }

    trade.state = TRADING_CONFIG.STATES.CONFIRMING;

    await interaction.update({
        embeds: [createConfirmationEmbed(trade)],
        components: []
    });

    // Wait 5 seconds then execute
    setTimeout(async () => {
        const result = await executeTrade(trade.sessionKey);
        
        if (result.success) {
            await interaction.editReply({
                content: '✅ **Trade Completed Successfully!**',
                embeds: [createCompleteEmbed(trade)],
                components: []
            });
        } else {
            await interaction.editReply({
                content: `❌ **Trade Failed:** ${result.error}`,
                embeds: [],
                components: []
            });
        }
        
        cancelTrade(trade.sessionKey);
    }, TRADING_CONFIG.CONFIRM_TIMEOUT);
}

/**
 * Handle cancel
 */
async function handleCancel(interaction, trade) {
    cancelTrade(trade.sessionKey);
    
    await interaction.update({
        content: `❌ Trade cancelled by **${interaction.user.tag}**.`,
        embeds: [createCancelledEmbed(interaction.user.tag)],
        components: []
    });
}

/**
 * Handle add item type
 */
async function handleAddItem(interaction, trade, type) {
    if (type === 'coins' || type === 'gems') {
        // Show modal for amount input
        const modal = new ModalBuilder()
            .setCustomId(`trade_modal_${type}_${trade.sessionKey}_${interaction.user.id}`)
            .setTitle(`Add ${type === 'coins' ? 'Coins' : 'Gems'}`);

        const input = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel(`How many ${type}? (0 to remove)`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter amount...')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        
        await interaction.showModal(modal);
        
        // Handle modal submit
        try {
            const submitted = await interaction.awaitModalSubmit({
                filter: i => i.customId === modal.data.custom_id,
                time: 60000
            });

            const amount = parseInt(submitted.fields.getTextInputValue('amount').replace(/,/g, ''));
            
            if (isNaN(amount) || amount < 0) {
                return submitted.reply({
                    content: '❌ Invalid amount!',
                    ephemeral: true
                });
            }

            const result = updateTradeItem(trade.sessionKey, interaction.user.id, type, { amount });
            
            if (!result.success) {
                return submitted.reply({
                    content: `❌ ${result.error}`,
                    ephemeral: true
                });
            }

            await submitted.reply({
                content: amount === 0 
                    ? `✅ Removed ${type} from trade`
                    : `✅ Set ${type} to ${amount.toLocaleString()}`,
                ephemeral: true
            });

        } catch (error) {
            // Modal timeout
        }
        
    } else if (type === 'items') {
        // Show item selector
        const items = await getUserItems(interaction.user.id);
        
        if (items.length === 0) {
            return interaction.reply({
                content: '❌ You have no items to trade!',
                ephemeral: true
            });
        }
        
        const menu = createItemSelectMenu(trade.sessionKey, items);
        
        await interaction.reply({
            content: 'Select an item to trade:',
            components: [menu],
            ephemeral: true
        });
        
    } else if (type === 'pets') {
        // Show pet selector
        const pets = await getUserPets(interaction.user.id);
        
        if (pets.length === 0) {
            return interaction.reply({
                content: '❌ You have no pets to trade!',
                ephemeral: true
            });
        }
        
        const menu = createPetSelectMenu(trade.sessionKey, pets);
        
        await interaction.reply({
            content: 'Select a pet to trade:',
            components: [menu],
            ephemeral: true
        });
    }
}

/**
 * Handle item/pet selection
 */
async function handleSelectItem(interaction, trade, type) {
    if (!interaction.isStringSelectMenu()) return;
    
    const value = interaction.values[0];
    if (value === 'none') {
        return interaction.update({
            content: '❌ No items available.',
            components: []
        });
    }
    
    const [sessionKey, identifier] = value.split('|');
    
    if (type === 'item') {
        // Show quantity modal
        const modal = new ModalBuilder()
            .setCustomId(`trade_item_qty_${sessionKey}_${interaction.user.id}`)
            .setTitle(`Trade ${identifier}`);

        const input = new TextInputBuilder()
            .setCustomId('quantity')
            .setLabel('How many? (0 to remove)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter quantity...')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        
        await interaction.showModal(modal);
        
        try {
            const submitted = await interaction.awaitModalSubmit({
                filter: i => i.customId === modal.data.custom_id,
                time: 60000
            });

            const quantity = parseInt(submitted.fields.getTextInputValue('quantity'));
            
            if (isNaN(quantity) || quantity < 0) {
                return submitted.reply({
                    content: '❌ Invalid quantity!',
                    ephemeral: true
                });
            }

            const result = updateTradeItem(trade.sessionKey, interaction.user.id, 'item', {
                itemName: identifier,
                quantity
            });
            
            if (!result.success) {
                return submitted.reply({
                    content: `❌ ${result.error}`,
                    ephemeral: true
                });
            }

            await submitted.reply({
                content: quantity === 0 
                    ? `✅ Removed ${identifier} from trade`
                    : `✅ Added ${quantity}x ${identifier}`,
                ephemeral: true
            });

        } catch (error) {
            // Modal timeout
        }
        
    } else if (type === 'pet') {
        // Add pet directly
        const pets = await getUserPets(interaction.user.id);
        const pet = pets.find(p => p.petId === identifier);
        
        if (!pet) {
            return interaction.update({
                content: '❌ Pet not found!',
                components: []
            });
        }

        const result = updateTradeItem(trade.sessionKey, interaction.user.id, 'pet', {
            petId: identifier,
            ...pet
        });
        
        if (!result.success) {
            return interaction.update({
                content: `❌ ${result.error}`,
                components: []
            });
        }

        await interaction.update({
            content: `✅ Added pet: ${pet.petName || pet.name}`,
            components: []
        });
    }
}