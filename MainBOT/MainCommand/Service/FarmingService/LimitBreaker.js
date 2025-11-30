const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { get, run } = require('../../Core/database');
const { logToDiscord, LogLevel } = require('../../Core/logger');

const LIMIT_BREAK_FUMO_POOL = [
    'Reimu(Common)',
    'Marisa(Common)',
    'Cirno(Common)',
    'Sanae(Common)',
    'Sakuya(UNCOMMON)',
    'Meiling(UNCOMMON)',
    'Patchouli(UNCOMMON)',
    'Remilia(RARE)',
    'Youmu(RARE)',
    'Ran(EPIC)',
    'Satori(EPIC)',
    'Kasen(EPIC)'
];

const MAX_LIMIT_BREAKS = 100;
function calculateRequirements(currentBreaks) {
    const baseFragments = 15;
    const baseNullified = 1;
    
    const fragmentIncrease = Math.floor(currentBreaks / 10) * 5;
    
    const nullifiedIncrease = Math.floor(currentBreaks / 20);
    
    return {
        fragments: baseFragments + fragmentIncrease,
        nullified: baseNullified + nullifiedIncrease
    };
}

function getRandomRequiredFumo() {
    return LIMIT_BREAK_FUMO_POOL[Math.floor(Math.random() * LIMIT_BREAK_FUMO_POOL.length)];
}

function createLimitBreakerEmbed(userId, currentBreaks, requirements, requiredFumo, userInventory) {
    const nextBreakNumber = currentBreaks + 1;
    const canBreak = currentBreaks < MAX_LIMIT_BREAKS;
    
    const embed = new EmbedBuilder()
        .setTitle('⚡ Limit Breaker System')
        .setColor(canBreak ? 0xFFD700 : 0xFF0000)
        .setDescription(
            canBreak 
                ? '**Break through your farming limits!**\n\n' +
                  'Sacrifice specific items to gain additional farming slots beyond the fragment limit.\n\n' +
                  '**Current Progress:**'
                : '**Maximum Limit Breaks Reached!**\n\n' +
                  'You have reached the maximum of 100 limit breaks.'
        );

    if (canBreak) {
        const hasFragments = userInventory.fragments >= requirements.fragments;
        const hasNullified = userInventory.nullified >= requirements.nullified;
        const hasFumo = userInventory.hasFumo;

        embed.addFields(
            {
                name: '📊 Limit Break Status',
                value: `Current Breaks: **${currentBreaks} / ${MAX_LIMIT_BREAKS}**\n` +
                       `Total Farm Limit: **${5 + (userInventory.fragmentUses || 0) + currentBreaks}**`,
                inline: false
            },
            {
                name: `💎 Next Break Requirements (#${nextBreakNumber})`,
                value: 
                    `${hasFragments ? '✅' : '❌'} **${requirements.fragments}x** FragmentOf1800s(R)\n` +
                    `${hasNullified ? '✅' : '❌'} **${requirements.nullified}x** Nullified(?)\n` +
                    `${hasFumo ? '✅' : '❌'} **1x** ${requiredFumo}`,
                inline: false
            },
            {
                name: '📦 Your Inventory',
                value: 
                    `Fragments: **${userInventory.fragments}**\n` +
                    `Nullified: **${userInventory.nullified}**\n` +
                    `${requiredFumo}: **${hasFumo ? '✓' : 'None'}**`,
                inline: false
            }
        );

        if (currentBreaks > 0) {
            const nextFragmentMilestone = Math.ceil((currentBreaks + 1) / 10) * 10;
            const nextNullifiedMilestone = Math.ceil((currentBreaks + 1) / 20) * 20;
            
            let milestoneText = '**Upcoming Milestones:**\n';
            if (currentBreaks < nextFragmentMilestone) {
                const nextFragReq = calculateRequirements(nextFragmentMilestone).fragments;
                milestoneText += `• Break #${nextFragmentMilestone}: Fragments increase to ${nextFragReq}\n`;
            }
            if (currentBreaks < nextNullifiedMilestone) {
                const nextNullReq = calculateRequirements(nextNullifiedMilestone).nullified;
                milestoneText += `• Break #${nextNullifiedMilestone}: Nullified increase to ${nextNullReq}\n`;
            }
            
            embed.addFields({
                name: '🎯 Progression',
                value: milestoneText,
                inline: false
            });
        }
    } else {
        embed.addFields({
            name: '🏆 Achievement Unlocked',
            value: 'You have maxed out the Limit Breaker system!\n' +
                   `Your total farm limit is now: **${5 + (userInventory.fragmentUses || 0) + currentBreaks}**`,
            inline: false
        });
    }

    embed.setFooter({ 
        text: canBreak 
            ? '⚡ Click the button below to perform a Limit Break' 
            : '🎉 Congratulations on reaching the maximum!' 
    });

    return embed;
}

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.limitbreaker') && !message.content.startsWith('.lb')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;

        try {
            const userRow = await get(
                `SELECT limitBreaks, fragmentUses FROM userUpgrades WHERE userId = ?`,
                [userId]
            );

            const currentBreaks = userRow?.limitBreaks || 0;
            const fragmentUses = userRow?.fragmentUses || 0;

            const requiredFumo = getRandomRequiredFumo();
            const requirements = calculateRequirements(currentBreaks);

            const fragmentRow = await get(
                `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                [userId, 'FragmentOf1800s(R)']
            );

            const nullifiedRow = await get(
                `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                [userId, 'Nullified(?)']
            );

            const fumoRow = await get(
                `SELECT COUNT(*) as count FROM userInventory WHERE userId = ? AND fumoName = ?`,
                [userId, requiredFumo]
            );

            const userInventory = {
                fragments: fragmentRow?.quantity || 0,
                nullified: nullifiedRow?.quantity || 0,
                hasFumo: (fumoRow?.count || 0) > 0,
                fragmentUses
            };

            // Create embed and button
            const embed = createLimitBreakerEmbed(userId, currentBreaks, requirements, requiredFumo, userInventory);

            const canBreak = currentBreaks < MAX_LIMIT_BREAKS &&
                           userInventory.fragments >= requirements.fragments &&
                           userInventory.nullified >= requirements.nullified &&
                           userInventory.hasFumo;

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`limitbreak_${userId}_${requiredFumo}`)
                        .setLabel('⚡ Perform Limit Break')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(!canBreak)
                );

            const msg = await message.reply({ 
                embeds: [embed],
                components: currentBreaks < MAX_LIMIT_BREAKS ? [row] : []
            });

            const collector = msg.createMessageComponentCollector({
                time: 120000 
            });

            collector.on('collect', async (interaction) => {
                if (!await checkButtonOwnership(interaction)) return;

                try {
                    await interaction.deferUpdate();

                    const parts = interaction.customId.split('_');
                    const fumoToConsume = parts.slice(2).join('_');

                    const checkRow = await get(
                        `SELECT limitBreaks, fragmentUses FROM userUpgrades WHERE userId = ?`,
                        [userId]
                    );

                    const breaks = checkRow?.limitBreaks || 0;

                    if (breaks >= MAX_LIMIT_BREAKS) {
                        return interaction.followUp({
                            content: '❌ You have already reached the maximum limit breaks!',
                            ephemeral: true
                        });
                    }

                    const reqs = calculateRequirements(breaks);

                    const fragCheck = await get(
                        `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                        [userId, 'FragmentOf1800s(R)']
                    );

                    const nullCheck = await get(
                        `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                        [userId, 'Nullified(?)']
                    );

                    const fumoCheck = await get(
                        `SELECT id FROM userInventory WHERE userId = ? AND fumoName = ? LIMIT 1`,
                        [userId, fumoToConsume]
                    );

                    const frags = fragCheck?.quantity || 0;
                    const nulls = nullCheck?.quantity || 0;
                    const hasFumoCheck = !!fumoCheck;

                    if (frags < reqs.fragments) {
                        return interaction.followUp({
                            content: `❌ You need ${reqs.fragments} FragmentOf1800s(R) but only have ${frags}!`,
                            ephemeral: true
                        });
                    }

                    if (nulls < reqs.nullified) {
                        return interaction.followUp({
                            content: `❌ You need ${reqs.nullified} Nullified(?) but only have ${nulls}!`,
                            ephemeral: true
                        });
                    }

                    if (!hasFumoCheck) {
                        return interaction.followUp({
                            content: `❌ You don't have ${fumoToConsume} in your inventory!`,
                            ephemeral: true
                        });
                    }

                    await run(
                        `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
                        [reqs.fragments, userId, 'FragmentOf1800s(R)']
                    );

                    await run(
                        `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
                        [reqs.nullified, userId, 'Nullified(?)']
                    );

                    await run(
                        `DELETE FROM userInventory WHERE id = ?`,
                        [fumoCheck.id]
                    );

                    if (checkRow) {
                        await run(
                            `UPDATE userUpgrades SET limitBreaks = limitBreaks + 1 WHERE userId = ?`,
                            [userId]
                        );
                    } else {
                        await run(
                            `INSERT INTO userUpgrades (userId, limitBreaks, fragmentUses) VALUES (?, 1, 0)`,
                            [userId]
                        );
                    }

                    const newBreaks = breaks + 1;
                    const totalLimit = 5 + (checkRow?.fragmentUses || 0) + newBreaks;

                    await logToDiscord(
                        client,
                        `User ${message.author.tag} performed Limit Break #${newBreaks}`,
                        null,
                        LogLevel.ACTIVITY
                    );

                    const successEmbed = new EmbedBuilder()
                        .setTitle('⚡ LIMIT BREAK SUCCESSFUL!')
                        .setColor(0x00FF00)
                        .setDescription(
                            `**Congratulations!** You've broken through your limits!\n\n` +
                            `**Limit Break:** #${newBreaks}\n` +
                            `**New Farm Limit:** ${totalLimit} slots\n\n` +
                            `**Items Consumed:**\n` +
                            `• ${reqs.fragments}x FragmentOf1800s(R)\n` +
                            `• ${reqs.nullified}x Nullified(?)\n` +
                            `• 1x ${fumoToConsume}`
                        )
                        .setFooter({ text: `Progress: ${newBreaks} / ${MAX_LIMIT_BREAKS}` })
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [successEmbed],
                        components: []
                    });

                } catch (error) {
                    console.error('Error in limit break button:', error);
                    await interaction.followUp({
                        content: '❌ An error occurred during the limit break.',
                        ephemeral: true
                    });
                }
            });

            collector.on('end', async () => {
                try {
                    await msg.edit({ components: [] });
                } catch (error) {
                    // Message might be deleted
                }
            });

        } catch (error) {
            console.error('Error in .limitbreaker:', error);
            await logToDiscord(client, `Error in .limitbreaker for ${message.author.tag}`, error, LogLevel.ERROR);

            return message.reply({
                content: '⚠️ Something went wrong.',
                ephemeral: true
            });
        }
    });
};