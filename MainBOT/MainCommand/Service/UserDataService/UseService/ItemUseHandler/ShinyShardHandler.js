const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get, run } = require('../../../../Core/database');
const { buildSecureCustomId } = require('../../../../Middleware/buttonOwnership');
const FumoPool = require('../../../../Data/FumoPool');

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
    
    // Extract rarity from value (format: shiny_rarity_RARITY)
    const rarity = interaction.values[0].replace('shiny_rarity_', '');

    try {
        const allFumos = FumoPool.getForCrate();
        const fumos = allFumos.filter(f => f.rarity === rarity);

        if (fumos.length === 0) {
            return interaction.update({
                content: `❌ No fumos available for rarity: ${rarity}`,
                embeds: [],
                components: []
            });
        }

        // Limit to 25 options (Discord limit)
        const fumoOptions = fumos.slice(0, 25).map((fumo, index) => ({
            label: fumo.name.replace(/\(.*?\)/, '').trim().slice(0, 100),
            value: `shiny_fumo_${index}`,
            description: `Create shiny version`.slice(0, 100),
            emoji: '✨'
        }));

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
            .setDescription(`Choose a fumo to create its **SHINY** version.\n\nShowing ${Math.min(fumos.length, 25)} available fumos.`)
            .setFooter({ text: `Rarity: ${rarity} | Total: ${fumos.length}` })
            .setTimestamp();

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
    
    // Parse the customId to get additional data
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
    
    // Get selected fumo index
    const selectedIndex = parseInt(interaction.values[0].replace('shiny_fumo_', ''));

    try {
        // Get fumos again to match the index
        const allFumos = FumoPool.getForCrate();
        const fumos = allFumos.filter(f => f.rarity === rarity);
        const selectedFumo = fumos[selectedIndex];

        if (!selectedFumo) {
            return interaction.update({
                content: '❌ Invalid fumo selection.',
                embeds: [],
                components: []
            });
        }

        const fumoName = selectedFumo.name;

        const inventory = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = 'ShinyShard(?)'`,
            [userId]
        );

        if (!inventory || inventory.quantity < 1) {
            return interaction.update({
                content: '❌ You no longer have a ShinyShard(?).',
                embeds: [],
                components: []
            });
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('shiny_confirm', userId, { fumoName, rarity }))
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
                `**Selected Fumo:** ${fumoName}\n\n` +
                `This will create: **${fumoName}[✨SHINY]**\n\n` +
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
        // Check if user has the shard
        const inventory = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = 'ShinyShard(?)'`,
            [userId]
        );

        if (!inventory || inventory.quantity < 1) {
            return interaction.update({
                content: '❌ You no longer have a ShinyShard(?).',
                embeds: [],
                components: []
            });
        }

        // NEW: Check if user has the original fumo
        const originalFumo = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
            [userId, fumoName]
        );

        if (!originalFumo || originalFumo.quantity < 1) {
            return interaction.update({
                content: `❌ You don't have **${fumoName}** to transform!`,
                embeds: [],
                components: []
            });
        }

        // Consume the shard
        await run(
            `UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = 'ShinyShard(?)'`,
            [userId]
        );

        await run(
            `DELETE FROM userInventory WHERE userId = ? AND itemName = 'ShinyShard(?)' AND quantity <= 0`,
            [userId]
        );

        // NEW: Remove 1 of the original fumo
        await run(
            `UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = ?`,
            [userId, fumoName]
        );

        await run(
            `DELETE FROM userInventory WHERE userId = ? AND itemName = ? AND quantity <= 0`,
            [userId, fumoName]
        );

        // Create the shiny version
        const shinyFumoName = `${fumoName}[✨SHINY]`;

        await run(
            `INSERT INTO userInventory (userId, fumoName, itemName, rarity, quantity, type, dateObtained)
             VALUES (?, ?, ?, ?, 1, 'fumo', datetime('now'))
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
            [userId, shinyFumoName, shinyFumoName, rarity]
        );

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('✨ ShinyShard(?) Used Successfully!')
            .setDescription(
                `**Transformed:** ${fumoName} → ${shinyFumoName}\n\n` +
                `Your shiny fumo has been added to your inventory!`
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

    } catch (error) {
        console.error('[SHINY_SHARD] Confirmation error:', error);
        interaction.update({
            content: '❌ Failed to create shiny fumo.',
            embeds: [],
            components: []
        });
    }
}

async function handleShinyShardCancellation(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Cancelled')
        .setDescription('ShinyShard(?) usage was cancelled.')
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function handleShinyShardBack(interaction) {
    const userId = interaction.user.id;
    
    // Recreate the initial rarity selection menu
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