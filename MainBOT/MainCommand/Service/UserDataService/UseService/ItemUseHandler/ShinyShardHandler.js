const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get, run, all } = require('../../../../Core/database');
const { buildSecureCustomId } = require('../../../../Middleware/buttonOwnership');

async function handleShinyShard(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **ShinyShard(?)** can only be used one at a time.");
    }

    try {
        const rarities = ['UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        
        const rarityOptions = rarities.map(rarity => ({
            label: rarity,
            value: `shiny_rarity_${rarity}`,
            description: `Select a ${rarity} fumo`,
            emoji: getRarityEmoji(rarity)
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(buildSecureCustomId('shiny_rarity_select', userId))
            .setPlaceholder('Select a rarity')
            .addOptions(rarityOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('✨ ShinyShard(?) - Select Rarity')
            .setDescription('Choose a rarity to see available fumos.\n\nThis will create a **SHINY** version of your selected fumo.')
            .setTimestamp();

        await message.reply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error('[SHINY_SHARD] Error:', error);
        message.reply('❌ Failed to use ShinyShard.');
    }
}

async function handleShinyShardRaritySelection(interaction) {
    const userId = interaction.user.id;
    
    const rarity = interaction.values[0].replace('shiny_rarity_', '');

    try {
        // Get ALL fumos of this rarity from user's inventory (without traits)
        const inventoryFumos = await all(
            `SELECT DISTINCT fumoName 
             FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName NOT LIKE '%[✨SHINY]%'
             AND fumoName NOT LIKE '%[🌟alG]%'
             ORDER BY fumoName`,
            [userId, `%(${rarity})%`]
        );

        if (inventoryFumos.length === 0) {
            return interaction.update({
                content: `❌ No ${rarity} fumos found in your inventory (without traits).`,
                embeds: [],
                components: []
            });
        }

        const fumoOptions = inventoryFumos.slice(0, 25).map((item, index) => {
            const cleanName = item.fumoName.replace(/\(.*?\)/, '').trim();
            return {
                label: cleanName.slice(0, 100),
                value: `shiny_fumo_${index}`,
                description: `Create shiny version`.slice(0, 100),
                emoji: '✨'
            };
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(buildSecureCustomId('shiny_fumo_select', userId, { rarity }))
            .setPlaceholder('Select a fumo')
            .addOptions(fumoOptions);

        const backButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('shiny_back', userId))
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);

        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        const row2 = new ActionRowBuilder().addComponents(backButton);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`✨ ShinyShard(?) - Select ${rarity} Fumo`)
            .setDescription(`Choose a fumo to create its **SHINY** version.\n\nShowing ${Math.min(inventoryFumos.length, 25)} available fumos from your inventory.`)
            .setFooter({ text: `Rarity: ${rarity} | Total: ${inventoryFumos.length}` })
            .setTimestamp();

        // Store the fumo list for later retrieval
        interaction.client.shinyShardData = interaction.client.shinyShardData || {};
        interaction.client.shinyShardData[userId] = {
            rarity,
            fumos: inventoryFumos.map(f => f.fumoName)
        };

        await interaction.update({ embeds: [embed], components: [row1, row2] });

    } catch (error) {
        console.error('[SHINY_SHARD] Rarity selection error:', error);
        interaction.update({
            content: '❌ Failed to load fumos.',
            embeds: [],
            components: []
        });
    }
}

async function handleShinyShardFumoSelection(interaction) {
    const userId = interaction.user.id;
    const customId = interaction.customId;
    
    const { parseCustomId } = require('../../../../Middleware/buttonOwnership');
    const { additionalData } = parseCustomId(customId);
    const rarity = additionalData?.rarity;
    
    if (!rarity) {
        return interaction.update({
            content: '❌ Invalid interaction data.',
            embeds: [],
            components: []
        });
    }
    
    const selectedIndex = parseInt(interaction.values[0].replace('shiny_fumo_', ''));

    try {
        // Get the stored fumo list
        const storedData = interaction.client.shinyShardData?.[userId];
        if (!storedData || storedData.rarity !== rarity) {
            return interaction.update({
                content: '❌ Session expired. Please start over.',
                embeds: [],
                components: []
            });
        }

        const selectedFumoName = storedData.fumos[selectedIndex];
        if (!selectedFumoName) {
            return interaction.update({
                content: '❌ Invalid fumo selection.',
                embeds: [],
                components: []
            });
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('shiny_confirm', userId, { fumoName: selectedFumoName, rarity }))
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('shiny_cancel', userId))
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('✨ Confirm ShinyShard Usage')
            .setDescription(
                `**Selected Fumo:** ${selectedFumoName}\n\n` +
                `This will create: **${selectedFumoName}[✨SHINY]**\n\n` +
                `Are you sure you want to proceed?`
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error('[SHINY_SHARD] Fumo selection error:', error);
        interaction.update({
            content: '❌ Failed to process selection.',
            embeds: [],
            components: []
        });
    }
}

async function handleShinyShardConfirmation(interaction) {
    const userId = interaction.user.id;
    
    const { parseCustomId } = require('../../../../Middleware/buttonOwnership');
    const { additionalData } = parseCustomId(interaction.customId);
    
    if (!additionalData?.fumoName || !additionalData?.rarity) {
        return interaction.update({
            content: '❌ Invalid confirmation data.',
            embeds: [],
            components: []
        });
    }
    
    const { fumoName, rarity } = additionalData;

    try {
        const originalFumo = await get(
            `SELECT id, fumoName, itemName, quantity FROM userInventory 
             WHERE userId = ? 
             AND (fumoName = ? OR itemName = ?)
             AND fumoName NOT LIKE '%[✨SHINY]%'
             AND fumoName NOT LIKE '%[🌟alG]%'
             LIMIT 1`,
            [userId, fumoName, fumoName]
        );

        if (!originalFumo || originalFumo.quantity < 1) {
            await run(
                `INSERT INTO userInventory (userId, itemName, quantity, type) 
                 VALUES (?, 'ShinyShard(?)', 1, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                [userId]
            );
            
            return interaction.update({
                content: `❌ You don't have **${fumoName}** to transform!\n\n` +
                         `Make sure you have the base version (without traits) in your inventory.\n\n` +
                         `Your ShinyShard has been returned.`,
                embeds: [],
                components: []
            });
        }

        if (originalFumo.quantity > 1) {
            await run(
                `UPDATE userInventory SET quantity = quantity - 1 WHERE id = ?`,
                [originalFumo.id]
            );
        } else {
            await run(
                `DELETE FROM userInventory WHERE id = ?`,
                [originalFumo.id]
            );
        }

        const baseFumoName = originalFumo.fumoName;
        const shinyFumoName = `${baseFumoName}[✨SHINY]`;

        await run(
            `INSERT INTO userInventory (userId, fumoName, itemName, rarity, quantity, type, dateObtained)
             VALUES (?, ?, ?, ?, 1, 'fumo', datetime('now'))
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
            [userId, shinyFumoName, shinyFumoName, rarity]
        );

        // Clean up stored data
        if (interaction.client.shinyShardData?.[userId]) {
            delete interaction.client.shinyShardData[userId];
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('✨ ShinyShard(?) Used Successfully!')
            .setDescription(
                `**Transformed:** ${baseFumoName} → ${shinyFumoName}\n\n` +
                `Your shiny fumo has been added to your inventory!`
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

    } catch (error) {
        console.error('[SHINY_SHARD] Confirmation error:', error);
        
        try {
            await run(
                `INSERT INTO userInventory (userId, itemName, quantity, type) 
                 VALUES (?, 'ShinyShard(?)', 1, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                [userId]
            );
        } catch (restoreError) {
            console.error('[SHINY_SHARD] Failed to restore shard:', restoreError);
        }
        
        interaction.update({
            content: '❌ Failed to create shiny fumo. Your ShinyShard has been returned. Error: ' + error.message,
            embeds: [],
            components: []
        });
    }
}

async function handleShinyShardCancellation(interaction) {
    const userId = interaction.user.id;
    
    try {
        await run(
            `INSERT INTO userInventory (userId, itemName, quantity, type) 
             VALUES (?, 'ShinyShard(?)', 1, 'item')
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
            [userId]
        );
    } catch (error) {
        console.error('[SHINY_SHARD] Failed to restore shard on cancel:', error);
    }

    // Clean up stored data
    if (interaction.client.shinyShardData?.[userId]) {
        delete interaction.client.shinyShardData[userId];
    }
    
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Cancelled')
        .setDescription('ShinyShard(?) usage was cancelled. Your shard has been returned.')
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function handleShinyShardBack(interaction) {
    const userId = interaction.user.id;
    
    try {
        const rarities = ['UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        
        const rarityOptions = rarities.map(rarity => ({
            label: rarity,
            value: `shiny_rarity_${rarity}`,
            description: `Select a ${rarity} fumo`,
            emoji: getRarityEmoji(rarity)
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(buildSecureCustomId('shiny_rarity_select', userId))
            .setPlaceholder('Select a rarity')
            .addOptions(rarityOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('✨ ShinyShard(?) - Select Rarity')
            .setDescription('Choose a rarity to see available fumos.\n\nThis will create a **SHINY** version of your selected fumo.')
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('[SHINY_SHARD] Back error:', error);
        interaction.update({
            content: '❌ Failed to go back.',
            embeds: [],
            components: []
        });
    }
}

function getRarityEmoji(rarity) {
    const emojis = {
        'Common': '⚪',
        'UNCOMMON': '🟢',
        'RARE': '🔵',
        'EPIC': '🟣',
        'OTHERWORLDLY': '🌌',
        'LEGENDARY': '🟠',
        'MYTHICAL': '🔴',
        'EXCLUSIVE': '💎',
        '???': '❓',
        'ASTRAL': '🌠',
        'CELESTIAL': '🌟',
        'INFINITE': '♾️',
        'ETERNAL': '🪐',
        'TRANSCENDENT': '🌈'
    };
    return emojis[rarity] || '⚪';
}

module.exports = {
    handleShinyShard,
    handleShinyShardRaritySelection,
    handleShinyShardFumoSelection,
    handleShinyShardConfirmation,
    handleShinyShardCancellation,
    handleShinyShardBack
};