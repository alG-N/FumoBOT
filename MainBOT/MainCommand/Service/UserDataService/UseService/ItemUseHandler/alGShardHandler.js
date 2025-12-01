const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get, run } = require('../../../../Core/database');
const { buildSecureCustomId, parseCustomId } = require('../../../../Middleware/buttonOwnership');
const FumoPool = require('../../../../Data/FumoPool');

async function handleAlGShard(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **alGShard(P)** can only be used one at a time.");
    }

    try {
        const rarities = ['LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        
        const rarityOptions = rarities.map(rarity => ({
            label: rarity,
            value: `alg_rarity_${rarity}`,
            description: `Select a ${rarity} fumo`,
            emoji: getRarityEmoji(rarity)
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(buildSecureCustomId('alg_rarity_select', userId))
            .setPlaceholder('Select a rarity (LEGENDARY+)')
            .addOptions(rarityOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🌟 alGShard(P) - Select Rarity')
            .setDescription('Choose a rarity to see available fumos.\n\nThis will create an **alG** version of your selected fumo.\n\n**Note:** Only LEGENDARY rarity and above are available.')
            .setTimestamp();

        await message.reply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error('[ALG_SHARD] Error:', error);
        message.reply('❌ Failed to use alGShard.');
    }
}

async function handleAlGShardRaritySelection(interaction) {
    const userId = interaction.user.id;
    
    // Extract rarity from value (format: alg_rarity_RARITY)
    const rarity = interaction.values[0].replace('alg_rarity_', '');

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
            value: `alg_fumo_${index}`,
            description: `Create alG version`.slice(0, 100),
            emoji: '🌟'
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(buildSecureCustomId('alg_fumo_select', userId, { rarity }))
            .setPlaceholder('Select a fumo')
            .addOptions(fumoOptions);

        const backButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('alg_back', userId))
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);

        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        const row2 = new ActionRowBuilder().addComponents(backButton);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`🌟 alGShard(P) - Select ${rarity} Fumo`)
            .setDescription(`Choose a fumo to create its **alG** version.\n\nShowing ${Math.min(fumos.length, 25)} available fumos.`)
            .setFooter({ text: `Rarity: ${rarity} | Total: ${fumos.length}` })
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [row1, row2] });

    } catch (error) {
        console.error('[ALG_SHARD] Rarity selection error:', error);
        interaction.update({
            content: '❌ Failed to load fumos.',
            embeds: [],
            components: []
        });
    }
}

async function handleAlGShardFumoSelection(interaction) {
    const userId = interaction.user.id;
    
    // Parse the customId to get additional data
    const { additionalData } = parseCustomId(interaction.customId);
    const rarity = additionalData?.rarity;
    
    if (!rarity) {
        return interaction.update({
            content: '❌ Invalid interaction data.',
            embeds: [],
            components: []
        });
    }
    
    // Get selected fumo index
    const selectedIndex = parseInt(interaction.values[0].replace('alg_fumo_', ''));

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
            `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = 'alGShard(P)'`,
            [userId]
        );

        if (!inventory || inventory.quantity < 1) {
            return interaction.update({
                content: '❌ You no longer have an alGShard(P).',
                embeds: [],
                components: []
            });
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('alg_confirm', userId, { fumoName, rarity }))
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('alg_cancel', userId))
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🌟 Confirm alGShard Usage')
            .setDescription(
                `**Selected Fumo:** ${fumoName}\n\n` +
                `This will create: **${fumoName}[🌟alG]**\n\n` +
                `Are you sure you want to proceed?`
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error('[ALG_SHARD] Fumo selection error:', error);
        interaction.update({
            content: '❌ Failed to process selection.',
            embeds: [],
            components: []
        });
    }
}

async function handleAlGShardConfirmation(interaction) {
    const userId = interaction.user.id;
    
    // Parse customId to get data
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
        const inventory = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = 'alGShard(P)'`,
            [userId]
        );

        if (!inventory || inventory.quantity < 1) {
            return interaction.update({
                content: '❌ You no longer have an alGShard(P).',
                embeds: [],
                components: []
            });
        }

        await run(
            `UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = 'alGShard(P)'`,
            [userId]
        );

        // Delete if quantity becomes 0
        await run(
            `DELETE FROM userInventory WHERE userId = ? AND itemName = 'alGShard(P)' AND quantity <= 0`,
            [userId]
        );

        const alGFumoName = `${fumoName}[🌟alG]`;

        await run(
            `INSERT INTO userInventory (userId, fumoName, itemName, rarity, quantity, type, dateObtained)
             VALUES (?, ?, ?, ?, 1, 'fumo', datetime('now'))
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
            [userId, alGFumoName, alGFumoName, rarity]
        );

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🌟 alGShard(P) Used Successfully!')
            .setDescription(
                `**Created:** ${alGFumoName}\n\n` +
                `Your alG fumo has been added to your inventory!`
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

    } catch (error) {
        console.error('[ALG_SHARD] Confirmation error:', error);
        interaction.update({
            content: '❌ Failed to create alG fumo.',
            embeds: [],
            components: []
        });
    }
}

async function handleAlGShardCancellation(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Cancelled')
        .setDescription('alGShard(P) usage was cancelled.')
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function handleAlGShardBack(interaction) {
    const userId = interaction.user.id;
    
    // Recreate the initial rarity selection menu
    try {
        const rarities = ['LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        
        const rarityOptions = rarities.map(rarity => ({
            label: rarity,
            value: `alg_rarity_${rarity}`,
            description: `Select a ${rarity} fumo`,
            emoji: getRarityEmoji(rarity)
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(buildSecureCustomId('alg_rarity_select', userId))
            .setPlaceholder('Select a rarity (LEGENDARY+)')
            .addOptions(rarityOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🌟 alGShard(P) - Select Rarity')
            .setDescription('Choose a rarity to see available fumos.\n\nThis will create an **alG** version of your selected fumo.\n\n**Note:** Only LEGENDARY rarity and above are available.')
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('[ALG_SHARD] Back error:', error);
        interaction.update({
            content: '❌ Failed to go back.',
            embeds: [],
            components: []
        });
    }
}

function getRarityEmoji(rarity) {
    const emojis = {
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
    handleAlGShard,
    handleAlGShardRaritySelection,
    handleAlGShardFumoSelection,
    handleAlGShardConfirmation,
    handleAlGShardCancellation,
    handleAlGShardBack
};