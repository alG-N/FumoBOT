const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get, run } = require('../../../../Core/database');
const FumoPool = require('../../../../Data/FumoPool');

async function handleAlGShard(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **alGShard(P)** can only be used one at a time.");
    }

    try {
        const rarities = ['LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        
        const rarityOptions = rarities.map(rarity => ({
            label: rarity,
            value: `alg_rarity_${rarity}_${userId}`,
            description: `Select a ${rarity} fumo`,
            emoji: getRarityEmoji(rarity)
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`alg_rarity_select_${userId}`)
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
    const rarity = interaction.values[0].split('_')[2];

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

        const fumoOptions = fumos.slice(0, 25).map(fumo => ({
            label: fumo.name.replace(/\(.*?\)/, '').trim(),
            value: `alg_fumo_${fumo.name}_${userId}`,
            description: `Create alG version`,
            emoji: '🌟'
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`alg_fumo_select_${userId}`)
            .setPlaceholder('Select a fumo')
            .addOptions(fumoOptions);

        const backButton = new ButtonBuilder()
            .setCustomId(`alg_back_${userId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);

        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        const row2 = new ActionRowBuilder().addComponents(backButton);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`🌟 alGShard(P) - Select ${rarity} Fumo`)
            .setDescription(`Choose a fumo to create its **alG** version.\n\nShowing ${fumos.length} available fumos.`)
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
    const selectedValue = interaction.values[0];
    const fumoName = selectedValue.replace(`alg_fumo_`, '').replace(`_${userId}`, '');

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

        const confirmButton = new ButtonBuilder()
            .setCustomId(`alg_confirm_${fumoName}_${userId}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`alg_cancel_${userId}`)
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
    const parts = interaction.customId.split('_');
    const fumoName = parts.slice(2, -1).join('_');

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

        const alGFumoName = `${fumoName}[🌟alG]`;

        await run(
            `INSERT INTO userInventory (userId, fumoName, itemName, rarity, quantity, type, dateObtained)
             VALUES (?, ?, ?, ?, 1, 'fumo', datetime('now'))
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
            [userId, alGFumoName, alGFumoName, fumoName.match(/\((.*?)\)/)?.[1] || 'Common']
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
    handleAlGShardCancellation
};