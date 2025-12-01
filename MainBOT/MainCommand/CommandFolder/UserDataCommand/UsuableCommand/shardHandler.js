const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../Core/Database/dbSetting');
const { RARITY_PRIORITY } = require('../../../Configuration/rarity');

// Store pending shard uses
const pendingShardUses = new Map();

/**
 * Handle alGShard usage
 */
async function handleAlGShard(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **alGShard(P)** is a one-time use item.");
    }

    // Check if user has any fumos
    db.all(
        `SELECT DISTINCT fumoName, rarity FROM userInventory WHERE userId = ? AND fumoName IS NOT NULL`,
        [userId],
        async (err, rows) => {
            if (err) {
                console.error("alGShard DB error:", err);
                return message.reply("❌ Failed to check your fumo inventory.");
            }

            if (!rows || rows.length === 0) {
                // Refund the shard
                db.run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);
                return message.reply("❌ You don't have any fumos to apply the alG trait to!\n> Your alGShard(P) was not consumed.");
            }

            // Show rarity selection menu
            const rarityOptions = RARITY_PRIORITY
                .filter(rarity => rows.some(r => r.rarity === rarity))
                .slice(0, 25) // Discord limit
                .map(rarity => ({
                    label: rarity,
                    value: rarity
                }));

            const rarityMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`alg_rarity_${userId}`)
                    .setPlaceholder('Select fumo rarity')
                    .addOptions(rarityOptions)
            );

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('👑 alGShard Selection - Step 1')
                .setDescription(
                    `**User:** <@${userId}>\n\n` +
                    `Select the rarity of the fumo you want to apply **[🌟alG]** trait to:`
                )
                .setFooter({ text: 'This will add the alG trait to your chosen fumo' })
                .setTimestamp();

            const msg = await message.reply({
                embeds: [embed],
                components: [rarityMenu]
            });

            // Store pending action
            pendingShardUses.set(userId, {
                type: 'alg',
                itemName,
                messageId: msg.id,
                timestamp: Date.now()
            });

            // Auto-cleanup after 5 minutes
            setTimeout(() => {
                if (pendingShardUses.has(userId)) {
                    pendingShardUses.delete(userId);
                }
            }, 300000);
        }
    );
}

/**
 * Handle ShinyShard usage
 */
async function handleShinyShard(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **ShinyShard(?)** is a one-time use item.");
    }

    // Check if user has any fumos
    db.all(
        `SELECT DISTINCT fumoName, rarity FROM userInventory WHERE userId = ? AND fumoName IS NOT NULL`,
        [userId],
        async (err, rows) => {
            if (err) {
                console.error("ShinyShard DB error:", err);
                return message.reply("❌ Failed to check your fumo inventory.");
            }

            if (!rows || rows.length === 0) {
                // Refund the shard
                db.run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);
                return message.reply("❌ You don't have any fumos to apply the SHINY trait to!\n> Your ShinyShard(?) was not consumed.");
            }

            // Show rarity selection menu
            const rarityOptions = RARITY_PRIORITY
                .filter(rarity => rows.some(r => r.rarity === rarity))
                .slice(0, 25)
                .map(rarity => ({
                    label: rarity,
                    value: rarity
                }));

            const rarityMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`shiny_rarity_${userId}`)
                    .setPlaceholder('Select fumo rarity')
                    .addOptions(rarityOptions)
            );

            const embed = new EmbedBuilder()
                .setColor(0xFF00FF)
                .setTitle('✨ ShinyShard Selection - Step 1')
                .setDescription(
                    `**User:** <@${userId}>\n\n` +
                    `Select the rarity of the fumo you want to apply **[✨SHINY]** trait to:`
                )
                .setFooter({ text: 'This will add the SHINY trait to your chosen fumo' })
                .setTimestamp();

            const msg = await message.reply({
                embeds: [embed],
                components: [rarityMenu]
            });

            // Store pending action
            pendingShardUses.set(userId, {
                type: 'shiny',
                itemName,
                messageId: msg.id,
                timestamp: Date.now()
            });

            setTimeout(() => {
                if (pendingShardUses.has(userId)) {
                    pendingShardUses.delete(userId);
                }
            }, 300000);
        }
    );
}

/**
 * Handle rarity selection for shard
 */
async function handleShardRaritySelection(interaction) {
    const userId = interaction.customId.split('_').pop();
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pending = pendingShardUses.get(userId);
    if (!pending) {
        return interaction.reply({
            content: '❌ No pending shard usage found.',
            ephemeral: true
        });
    }

    const rarity = interaction.values[0];
    const shardType = pending.type;

    // Get fumos of selected rarity
    db.all(
        `SELECT fumoName FROM userInventory WHERE userId = ? AND rarity = ? AND fumoName IS NOT NULL GROUP BY fumoName`,
        [userId, rarity],
        async (err, rows) => {
            if (err) {
                console.error("Shard rarity selection error:", err);
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❌ Error')
                            .setDescription('Failed to fetch your fumos.')
                    ],
                    components: []
                });
            }

            if (!rows || rows.length === 0) {
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❌ No Fumos Found')
                            .setDescription(`You don't have any **${rarity}** fumos.`)
                    ],
                    components: []
                });
            }

            // Filter out fumos that already have the trait
            const traitSuffix = shardType === 'alg' ? '[🌟alG]' : '[✨SHINY]';
            const availableFumos = rows.filter(r => !r.fumoName.includes(traitSuffix));

            if (availableFumos.length === 0) {
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❌ No Available Fumos')
                            .setDescription(`All your **${rarity}** fumos already have the **${traitSuffix}** trait!`)
                    ],
                    components: []
                });
            }

            // Create fumo selection menu (max 25)
            const fumoOptions = availableFumos.slice(0, 25).map(r => ({
                label: r.fumoName.length > 100 ? r.fumoName.substring(0, 97) + '...' : r.fumoName,
                value: r.fumoName
            }));

            const fumoMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`${shardType}_fumo_${userId}`)
                    .setPlaceholder('Select a fumo')
                    .addOptions(fumoOptions)
            );

            const embed = new EmbedBuilder()
                .setColor(shardType === 'alg' ? 0xFFD700 : 0xFF00FF)
                .setTitle(`${shardType === 'alg' ? '👑' : '✨'} ${shardType === 'alg' ? 'alG' : 'Shiny'}Shard Selection - Step 2`)
                .setDescription(
                    `**Rarity:** ${rarity}\n\n` +
                    `Select the fumo you want to apply **${traitSuffix}** to:`
                );

            await interaction.update({
                embeds: [embed],
                components: [fumoMenu]
            });

            // Update pending action
            pendingShardUses.set(userId, {
                ...pending,
                rarity
            });
        }
    );
}

/**
 * Handle fumo selection for shard
 */
async function handleShardFumoSelection(interaction) {
    const userId = interaction.customId.split('_').pop();
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: '❌ This is not your selection menu.',
            ephemeral: true
        });
    }

    const pending = pendingShardUses.get(userId);
    if (!pending) {
        return interaction.reply({
            content: '❌ No pending shard usage found.',
            ephemeral: true
        });
    }

    const selectedFumo = interaction.values[0];
    const shardType = pending.type;
    const traitSuffix = shardType === 'alg' ? '[🌟alG]' : '[✨SHINY]';

    // Show confirmation
    const confirmButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${shardType}_confirm_${userId}`)
            .setLabel('Yes, Apply Trait')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${shardType}_cancel_${userId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
        .setColor(shardType === 'alg' ? 0xFFD700 : 0xFF00FF)
        .setTitle(`${shardType === 'alg' ? '👑' : '✨'} Confirm Trait Application`)
        .setDescription(
            `Are you sure you want to apply **${traitSuffix}** to:\n\n` +
            `> **${selectedFumo}**\n\n` +
            `This will consume your **${pending.itemName}** and transform the fumo to:\n` +
            `> **${selectedFumo}${traitSuffix}**\n\n` +
            `⚠️ This action cannot be undone!`
        );

    await interaction.update({
        embeds: [embed],
        components: [confirmButtons]
    });

    // Update pending action
    pendingShardUses.set(userId, {
        ...pending,
        selectedFumo
    });
}

/**
 * Handle shard confirmation
 */
async function handleShardConfirmation(interaction) {
    const userId = interaction.customId.split('_').pop();
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: '❌ This is not your button.',
            ephemeral: true
        });
    }

    const pending = pendingShardUses.get(userId);
    if (!pending) {
        return interaction.reply({
            content: '❌ No pending shard usage found.',
            ephemeral: true
        });
    }

    const shardType = pending.type;
    const traitSuffix = shardType === 'alg' ? '[🌟alG]' : '[✨SHINY]';
    const oldFumoName = pending.selectedFumo;
    const newFumoName = `${oldFumoName}${traitSuffix}`;

    // Update the fumo in database
    db.run(
        `UPDATE userInventory SET fumoName = ? WHERE userId = ? AND fumoName = ?`,
        [newFumoName, userId, oldFumoName],
        function (err) {
            if (err) {
                console.error("Shard application error:", err);
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❌ Error')
                            .setDescription('Failed to apply trait to fumo.')
                    ],
                    components: []
                });
            }

            if (this.changes === 0) {
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❌ Error')
                            .setDescription('Fumo not found in your inventory.')
                    ],
                    components: []
                });
            }

            // Success!
            const embed = new EmbedBuilder()
                .setColor(shardType === 'alg' ? 0xFFD700 : 0xFF00FF)
                .setTitle(`${shardType === 'alg' ? '👑' : '✨'} Trait Applied Successfully!`)
                .setDescription(
                    `Your fumo has been transformed!\n\n` +
                    `**Before:** ${oldFumoName}\n` +
                    `**After:** ${newFumoName}\n\n` +
                    `${shardType === 'alg' ? 
                        '> This fumo now has **x150 multiplier** on farming rewards!' : 
                        '> This fumo now has **x2 multiplier** on farming rewards!'}`
                )
                .setFooter({ text: `${pending.itemName} consumed` })
                .setTimestamp();

            interaction.update({
                embeds: [embed],
                components: []
            });

            // Clean up
            pendingShardUses.delete(userId);
        }
    );
}

/**
 * Handle shard cancellation
 */
async function handleShardCancellation(interaction) {
    const userId = interaction.customId.split('_').pop();
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: '❌ This is not your button.',
            ephemeral: true
        });
    }

    const pending = pendingShardUses.get(userId);
    if (!pending) {
        return interaction.reply({
            content: '❌ No pending shard usage found.',
            ephemeral: true
        });
    }

    // Refund the shard
    db.run(
        `UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`,
        [userId, pending.itemName],
        () => {
            const embed = new EmbedBuilder()
                .setColor('Grey')
                .setTitle('❌ Cancelled')
                .setDescription(`Trait application cancelled.\n> Your **${pending.itemName}** was not consumed.`)
                .setTimestamp();

            interaction.update({
                embeds: [embed],
                components: []
            });

            pendingShardUses.delete(userId);
        }
    );
}

module.exports = {
    handleAlGShard,
    handleShinyShard,
    handleShardRaritySelection,
    handleShardFumoSelection,
    handleShardConfirmation,
    handleShardCancellation
};