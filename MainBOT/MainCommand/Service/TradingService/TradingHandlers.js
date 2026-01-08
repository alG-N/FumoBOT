const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} = require('discord.js');
const TRADING_CONFIG = require('../../Configuration/tradingConfig');
const { RARITY_PRIORITY } = require('../../Configuration/rarity');

const {
    toggleAccept,
    toggleConfirm,
    updateTradeItem,
    executeTrade,
    cancelTrade,
    getUserItems,
    getUserItemsByRarity,
    getUserPets,
    getUserFumos,
    getUserFumoQuantity
} = require('./TradingService');

const {
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
} = require('./TradingUIService');

async function handleInviteAccept(client, interaction, pending, pendingInvites) {
    const { trade, timeoutId } = pending;
    
    if (timeoutId) clearTimeout(timeoutId);
    pendingInvites.delete(trade.sessionKey);
    
    trade.state = TRADING_CONFIG.STATES.ACTIVE;

    await interaction.editReply({
        content: `✅ Trade accepted by **${interaction.user.tag}**!`,
        embeds: [],
        components: []
    }).catch(() => {});

    const tradeMsg = await interaction.channel.send({
        content: `🤝 **Active Trade: ${trade.user1.tag} ↔️ ${trade.user2.tag}**`,
        embeds: [createTradeEmbed(trade, client)],
        components: [
            createTradeActionButtons(trade.sessionKey),
            createItemTypeButtons(trade.sessionKey)
        ]
    });

    await handleTradeSession(client, tradeMsg, trade);
}

async function handleInviteDecline(interaction, pending, pendingInvites) {
    const { trade, timeoutId } = pending;
    
    if (timeoutId) clearTimeout(timeoutId);
    pendingInvites.delete(trade.sessionKey);
    cancelTrade(trade.sessionKey);
    
    await interaction.editReply({
        content: `❌ **${interaction.user.tag}** declined the trade.`,
        embeds: [createCancelledEmbed(interaction.user.tag)],
        components: []
    }).catch(() => {});
}

async function handleTradeSession(client, message, trade) {
    let refreshInterval = null; // Declare here so collector.on('end') can access it
    
    const collector = message.createMessageComponentCollector({
        time: TRADING_CONFIG.TRADE_SESSION_TIMEOUT
    });

    collector.on('collect', async (interaction) => {
        if (interaction.customId.startsWith('trade_toggle') || 
            interaction.customId.startsWith('trade_confirm')) {
            const currentTrade = require('./TradingService').getTradeSession(trade.sessionKey);
            if (currentTrade) {
                const bothConfirmed = currentTrade.user1.confirmed && currentTrade.user2.confirmed;
                await message.edit({
                    embeds: [createTradeEmbed(currentTrade, client)],
                    components: [
                        createTradeActionButtons(
                            trade.sessionKey, 
                            currentTrade.state === TRADING_CONFIG.STATES.BOTH_ACCEPTED,
                            bothConfirmed
                        ),
                        createItemTypeButtons(trade.sessionKey)
                    ]
                }).catch(() => {});
            }
        }
    });

    collector.on('end', () => {
        // Always clear refresh interval when collector ends
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        
        const currentTrade = require('./TradingService').getTradeSession(trade.sessionKey);
        if (currentTrade && currentTrade.state !== TRADING_CONFIG.STATES.COMPLETED) {
            cancelTrade(trade.sessionKey);
            message.edit({
                content: '⏰ Trade session timed out.',
                embeds: [createCancelledEmbed('timeout')],
                components: []
            }).catch(() => {});
        }
    });

    refreshInterval = setInterval(async () => {
        const currentTrade = require('./TradingService').getTradeSession(trade.sessionKey);
        if (!currentTrade || currentTrade.state === TRADING_CONFIG.STATES.COMPLETED || 
            currentTrade.state === TRADING_CONFIG.STATES.CANCELLED) {
            clearInterval(refreshInterval);
            return;
        }

        try {
            const bothConfirmed = currentTrade.user1.confirmed && currentTrade.user2.confirmed;
            await message.edit({
                embeds: [createTradeEmbed(currentTrade, client)],
                components: [
                    createTradeActionButtons(
                        trade.sessionKey, 
                        currentTrade.state === TRADING_CONFIG.STATES.BOTH_ACCEPTED,
                        bothConfirmed
                    ),
                    createItemTypeButtons(trade.sessionKey)
                ]
            });
        } catch (error) {
            clearInterval(refreshInterval);
        }
    }, 2000);
}

async function handleToggleAccept(interaction, trade) {
    const result = toggleAccept(trade.sessionKey, interaction.user.id);
    
    if (!result.success) {
        return interaction.reply({
            content: '❌ Failed to update accept status.',
            ephemeral: true
        });
    }

    const userSide = trade.user1.id === interaction.user.id ? trade.user1 : trade.user2;
    const otherSide = trade.user1.id === interaction.user.id ? trade.user2 : trade.user1;
    
    const message = userSide.accepted 
        ? `✅ You accepted the trade! <@${otherSide.id}> has been notified.`
        : '⏳ You unaccepted the trade.';
    
    await interaction.reply({
        content: message,
        ephemeral: true
    });
    
    if (userSide.accepted) {
        await interaction.channel.send({
            content: `<@${otherSide.id}> **${interaction.user.tag}** has accepted the trade!`
        }).catch(() => {});
    }
}

async function handleConfirm(interaction, trade, client) {
    if (trade.state !== TRADING_CONFIG.STATES.BOTH_ACCEPTED) {
        return interaction.reply({
            content: '❌ Both users must accept before confirming!',
            ephemeral: true
        });
    }

    const result = toggleConfirm(trade.sessionKey, interaction.user.id);
    
    if (!result.success) {
        return interaction.reply({
            content: '❌ Failed to confirm trade.',
            ephemeral: true
        });
    }

    const userSide = trade.user1.id === interaction.user.id ? trade.user1 : trade.user2;
    const otherSide = trade.user1.id === interaction.user.id ? trade.user2 : trade.user1;

    if (userSide.confirmed) {
        if (otherSide.confirmed) {
            trade.state = TRADING_CONFIG.STATES.CONFIRMING;

            await interaction.update({
                embeds: [createConfirmationEmbed(trade)],
                components: []
            });

            setTimeout(async () => {
                try {
                    const executeResult = await executeTrade(trade.sessionKey);
                    
                    if (executeResult.success) {
                        await interaction.editReply({
                            content: '✅ **Trade Completed Successfully!**',
                            embeds: [createCompleteEmbed(trade)],
                            components: []
                        }).catch(() => {});
                    } else {
                        await interaction.editReply({
                            content: `❌ **Trade Failed:** ${executeResult.error}`,
                            embeds: [],
                            components: []
                        }).catch(() => {});
                    }
                    
                    cancelTrade(trade.sessionKey);
                } catch (error) {
                    console.error('Error executing trade:', error);
                    cancelTrade(trade.sessionKey);
                }
            }, 3000);
        } else {
            await interaction.reply({
                content: `✅ You confirmed the trade! <@${otherSide.id}> must also confirm to finalize.`,
                ephemeral: true
            });
            
            await interaction.channel.send({
                content: `<@${otherSide.id}> **${interaction.user.tag}** has confirmed the trade! Click CONFIRM to finalize.`
            }).catch(() => {});
        }
    } else {
        await interaction.reply({
            content: '⏳ You unconfirmed the trade.',
            ephemeral: true
        });
    }
}

async function handleCancel(interaction, trade) {
    cancelTrade(trade.sessionKey);
    
    await interaction.update({
        content: `❌ Trade cancelled by **${interaction.user.tag}**.`,
        embeds: [createCancelledEmbed(interaction.user.tag)],
        components: []
    });
}

async function handleAddItem(interaction, trade, type) {
    if (type === 'coins' || type === 'gems') {
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

            const result = await updateTradeItem(trade.sessionKey, interaction.user.id, type, { amount });
            
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
        }
        
    } else if (type === 'items') {
        const menu = createItemRarityMenu(trade.sessionKey);
        
        await interaction.reply({
            content: 'Select the rarity of items you want to trade:',
            components: [menu],
            ephemeral: true
        });
        
    } else if (type === 'pets') {
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
    } else if (type === 'fumos') {
        const menu = createFumoTypeMenu(trade.sessionKey);
        
        await interaction.reply({
            content: 'Select the type of Fumo you want to trade:',
            components: [menu],
            ephemeral: true
        });
    }
}

async function handleSelectItemRarity(interaction, trade) {
    if (!interaction.isStringSelectMenu()) return;
    
    const value = interaction.values[0];
    const [sessionKey, rarity] = value.split('|');
    
    const items = await getUserItemsByRarity(interaction.user.id, rarity);
    
    if (items.length === 0) {
        return interaction.update({
            content: `❌ You have no ${rarity} items to trade!`,
            components: []
        });
    }
    
    const menu = createItemSelectMenu(sessionKey, items, rarity);
    
    await interaction.update({
        content: `Select a ${rarity} item to trade:`,
        components: [menu]
    });
}

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

            const result = await updateTradeItem(trade.sessionKey, interaction.user.id, 'item', {
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
        }
        
    } else if (type === 'pet') {
        const pets = await getUserPets(interaction.user.id);
        const pet = pets.find(p => p.petId === identifier);
        
        if (!pet) {
            return interaction.update({
                content: '❌ Pet not found!',
                components: []
            });
        }

        const result = await updateTradeItem(trade.sessionKey, interaction.user.id, 'pet', {
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

async function handleSelectFumoType(interaction, trade) {
    if (!interaction.isStringSelectMenu()) return;
    
    const fumoType = interaction.values[0];
    const [sessionKey, type] = fumoType.split('|');
    
    const menu = createFumoRarityMenu(sessionKey, type);
    
    await interaction.update({
        content: `Select a rarity for ${type} fumos:`,
        components: [menu]
    });
}

async function handleSelectFumoRarity(interaction, trade) {
    if (!interaction.isStringSelectMenu()) return;
    
    const value = interaction.values[0];
    const [sessionKey, type, rarity] = value.split('|');
    
    const fumos = await getUserFumos(interaction.user.id, type, rarity);
    
    if (fumos.length === 0) {
        return interaction.update({
            content: `❌ You have no ${rarity} ${type} fumos to trade!`,
            components: []
        });
    }
    
    const menu = createFumoSelectMenu(sessionKey, fumos, type, rarity);
    
    await interaction.update({
        content: `Select a ${rarity} ${type} fumo to trade:`,
        components: [menu]
    });
}

async function handleSelectFumo(interaction, trade) {
    if (!interaction.isStringSelectMenu()) return;
    
    const value = interaction.values[0];
    if (value === 'none') {
        return interaction.update({
            content: '❌ No fumos available.',
            components: []
        });
    }
    
    const [sessionKey, fumoName] = value.split('|');
    
    const maxQuantity = await getUserFumoQuantity(interaction.user.id, fumoName);
    
    const fumoHash = Buffer.from(fumoName).toString('base64').substring(0, 20);
    
    const modal = new ModalBuilder()
        .setCustomId(`trade_fumo_${sessionKey}_${fumoHash}_${interaction.user.id}`)
        .setTitle(`Trade ${fumoName.slice(0, 45)}`);

    const input = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel(`How many? (Max: ${maxQuantity}, 0 to remove)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Enter 1-${maxQuantity}...`)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    
    await interaction.showModal(modal);
    
    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.customId.startsWith(`trade_fumo_${sessionKey}_${fumoHash}`),
            time: 60000
        });

        const inputQuantity = parseInt(submitted.fields.getTextInputValue('quantity'));
        
        if (isNaN(inputQuantity) || inputQuantity < 0) {
            return submitted.reply({
                content: '❌ Invalid quantity!',
                ephemeral: true
            });
        }

        const quantity = Math.min(inputQuantity, maxQuantity);
        const wasCapped = inputQuantity > maxQuantity;

        const result = await updateTradeItem(trade.sessionKey, interaction.user.id, 'fumo', {
            fumoName,
            quantity,
            maxQuantity
        });
        
        if (!result.success) {
            return submitted.reply({
                content: `❌ ${result.error}`,
                ephemeral: true
            });
        }

        let message;
        if (quantity === 0) {
            message = `✅ Removed ${fumoName} from trade`;
        } else if (wasCapped) {
            message = `✅ Added ${quantity}x ${fumoName} (capped to max available - you only have ${maxQuantity})`;
        } else {
            message = `✅ Added ${quantity}x ${fumoName}`;
        }

        await submitted.reply({
            content: message,
            ephemeral: true
        });
    } catch (error) {
        console.error('[Trade] Fumo selection error:', error);
    }
}

module.exports = {
    handleInviteAccept,
    handleInviteDecline,
    handleTradeSession,
    handleToggleAccept,
    handleConfirm,
    handleCancel,
    handleAddItem,
    handleSelectItem,
    handleSelectItemRarity,
    handleSelectFumoType,
    handleSelectFumoRarity,
    handleSelectFumo
};