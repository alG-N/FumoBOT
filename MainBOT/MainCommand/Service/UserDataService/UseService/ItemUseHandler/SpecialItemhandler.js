const { applyBoost, applyMultipleBoosts, updateBoostStack, setBoostUses, clearAllBoosts } = require('../UseBoostService');
const { getUserData, updateUserData, getActiveBoost } = require('../UseDatabaseService');
const { createBoostEmbed, createSuccessEmbed, createConfirmationEmbed, sendErrorEmbed, createStackEmbed } = require('../UseUIService');
const { formatNumber } = require('../../../Ultility/formatting');
const { EmbedBuilder } = require('discord.js');
const { run } = require('../../../Core/database');

async function handleWeirdGrass(message, itemName, quantity, userId) {
    const outcomes = [
        { type: 'coin', multiplier: 1.5, duration: 15 * 60 * 1000, desc: "+50% coins for 15 mins", color: 0xFFD700, emoji: "💰" },
        { type: 'gem', multiplier: 1.5, duration: 5 * 60 * 1000, desc: "+50% gems for 5 mins", color: 0x00FFFF, emoji: "💎" },
        { type: 'both', multiplier: { coin: 0.25, gem: 0.5 }, duration: 25 * 60 * 1000, desc: "-75% coins, -50% gems for 25 mins", color: 0xFF6347, emoji: "☠️" }
    ];

    const choice = outcomes[Math.floor(Math.random() * outcomes.length)];
    const now = Date.now();
    const expiresAt = now + choice.duration;

    try {
        if (choice.type === 'both') {
            const boosts = [
                { type: 'coin', source: 'WeirdGrass-Negative', multiplier: choice.multiplier.coin },
                { type: 'gem', source: 'WeirdGrass-Negative', multiplier: choice.multiplier.gem }
            ];
            await applyMultipleBoosts(userId, boosts, choice.duration);
        } else {
            await applyBoost(userId, choice.type, 'WeirdGrass-Boost', choice.multiplier, expiresAt);
        }

        const embed = new EmbedBuilder()
            .setColor(choice.color)
            .setTitle("🌿 You used WeirdGrass(R)!")
            .setDescription(`${choice.emoji} **Effect:** ${choice.desc}`)
            .setFooter({ text: "Weird grass has unpredictable powers..." })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[WEIRD_GRASS] Error:', error);
        message.reply('❌ Failed to apply WeirdGrass effect.');
    }
}

async function handleGoldenSigil(message, itemName, quantity, userId) {
    const source = 'GoldenSigil';
    const baseMultiplier = 100;

    try {
        const result = await updateBoostStack(userId, 'coin', source, 1, 10);

        if (!result.success) {
            await run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);

            const embed = new EmbedBuilder()
                .setColor(0xFF4500)
                .setTitle("⚠️ Max Stack Reached!")
                .setDescription(
                    "You already have **10/10** GoldenSigil boosts.\n" +
                    "> 💸 That's a **+1,000,000% coin boost**!\n\n" +
                    "Your item was **not** consumed."
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }

        const newStack = result.currentStack;
        const newMultiplier = baseMultiplier * newStack;

        if (result.isNew) {
            await run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack) 
                 VALUES (?, 'coin', ?, ?, NULL, 1)`,
                [userId, source, baseMultiplier]
            );
        } else {
            await run(
                `UPDATE activeBoosts SET stack = ?, multiplier = ? 
                 WHERE userId = ? AND type = 'coin' AND source = ?`,
                [newStack, newMultiplier, userId, source]
            );
        }

        const embed = createStackEmbed(
            "GoldenSigil(?)",
            newStack,
            10,
            newMultiplier,
            0xFFD700
        );

        embed.setFooter({ text: "Stacks reset when the effect is cleared." });
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[GOLDEN_SIGIL] Error:', error);
        message.reply('❌ Failed to stack GoldenSigil.');
    }
}

async function handleHakureiTicket(message, itemName, quantity, userId) {
    try {
        const userData = await getUserData(userId);

        if (!userData || userData.reimuUsageCount <= 0) {
            return sendErrorEmbed(
                message,
                '🌀 Ticket Not Needed',
                "You're still within your prayer limit. No need to use a HakureiTicket(L) right now."
            );
        }

        await updateUserData(userId, {
            reimuUsageCount: 0,
            reimuLastReset: Date.now()
        });

        const embed = createSuccessEmbed(
            "✨ Ticket Used",
            "Your **Reimu prayer limit** has been reset using a HakureiTicket(L)!",
            0x9b59b6
        );
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[HAKUREI_TICKET] Error:', error);
        message.reply('❌ Failed to reset your prayer cooldown.');
    }
}

async function handleLumina(message, itemName, quantity, userId) {
    const source = 'Lumina';
    const multiplier = 5.0;

    try {
        const existing = await getActiveBoost(userId, 'luckEvery10', source);

        if (existing) {
            const embed = new EmbedBuilder()
                .setColor(0x00FFFF)
                .setTitle("🔮 Lumina(M) Already Active!")
                .setDescription(
                    "You already have the **Lumina(M)** boost active.\n" +
                    "> Every 10th roll = **x5 luck** forever!"
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }

        await run(
            `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack) 
             VALUES (?, ?, ?, ?, NULL, NULL)`,
            [userId, 'luckEvery10', source, multiplier]
        );

        const embed = new EmbedBuilder()
            .setColor(0x00FFFF)
            .setTitle("✨ Lumina(M) Activated!")
            .setDescription(
                "You used **Lumina(M)**!\n\n" +
                "📹 **Effect:** Every 10th roll = **5x luck** (permanent)"
            )
            .setFooter({ text: "Enjoy your new luck boost!" })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[LUMINA] Error:', error);
        message.reply('❌ Failed to activate Lumina.');
    }
}

async function handleFantasyBook(message, itemName, quantity, userId) {
    try {
        const userData = await getUserData(userId);

        if (userData?.hasFantasyBook) {
            const embed = new EmbedBuilder()
                .setColor(0x9370DB)
                .setTitle("📖 FantasyBook(M) Already Used!")
                .setDescription(
                    "You've already unlocked **ASTRAL+** and non-Touhou rarities.\n" +
                    "> The Fantasy power is eternal."
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }

        const confirmEmbed = createConfirmationEmbed(
            "⚠️ Confirm Use of FantasyBook(M)",
            "**Are you sure you want to use FantasyBook(M)?**\n\n" +
            "> ⚠️ This will unlock drops from **non-Touhou** fumos (e.g., Lumina, Aya) and rarities like **OTHERWORLDLY** and **ASTRAL+**.\n\n" +
            "Once used, this cannot be undone.",
            "Reply with 'yes' to confirm or 'no' to cancel."
        );

        await message.reply({ embeds: [confirmEmbed] });

        const filter = m => m.author.id === userId && ['yes', 'no'].includes(m.content.toLowerCase());
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] })
            .catch(() => null);

        if (!collected) {
            await run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);
            return message.reply('⏱️ FantasyBook(M) use timed out. Please try again.');
        }

        const response = collected.first().content.toLowerCase();

        if (response === 'no') {
            await run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);
            return message.reply('❌ FantasyBook(M) use cancelled.');
        }

        await updateUserData(userId, { hasFantasyBook: 1 });

        const embed = new EmbedBuilder()
            .setColor(0x8A2BE2)
            .setTitle("📖 FantasyBook(M) Activated!")
            .setDescription(
                "**You used FantasyBook(M)!**\n\n" +
                "📚 **Effects Unlocked:**\n" +
                "- Non-Touhou Fumos (e.g., Lumina, Aya, etc.)\n" +
                "- **OTHERWORLDLY** Rarity\n" +
                "- **ASTRAL+** Rarities\n\n" +
                "A whole new dimension of power is now accessible."
            )
            .setFooter({ text: "You will now obtain even more rarer fumo..." })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[FANTASY_BOOK] Error:', error);
        message.reply('❌ Failed to activate FantasyBook.');
    }
}

async function handleAncientRelic(message, itemName, quantity, userId) {
    const source = 'AncientRelic';
    const boosts = [
        { type: 'luck', source, multiplier: 3.5 },
        { type: 'coin', source, multiplier: 4.5 },
        { type: 'gem', source, multiplier: 6.0 },
        { type: 'sellPenalty', source, multiplier: 0.4 }
    ];
    const duration = 24 * 60 * 60 * 1000 * quantity;

    try {
        await applyMultipleBoosts(userId, boosts, duration);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("🔮 Ancient Power Unleashed!")
            .setDescription(
                `You used **AncientRelic(E)** x${quantity}!\n\n` +
                `> 🤠 **+250% Luck Boost**\n` +
                `> 💰 **+350% Coin Boost**\n` +
                `> 💎 **+500% Gem Boost**\n\n` +
                `**Boost Details**\n` +
                `⏳ Duration: ${24 * quantity} hour(s)\n\n` +
                `📉 **-60% Sell Value Penalty is now active!**`
            )
            .setFooter({ text: `Boost Source: ${source}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[ANCIENT_RELIC] Error:', error);
        message.reply('❌ Failed to activate AncientRelic boost.');
    }
}

async function handleNullified(message, itemName, quantity, userId) {
    const source = 'Nullified';
    const type = 'rarityOverride';

    try {
        await setBoostUses(userId, type, source, quantity);

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle("🎲 Rarity Nullified!")
            .setDescription(
                `You used **Nullified(?)** ${quantity} time(s)!\n\n` +
                `> All rarity chances will be **equal** for **${quantity} roll(s)** (applies to Coins/Gems banners).\n` +
                `🎯 Every rarity has an equal chance!`
            )
            .setFooter({ text: `Boost Source: ${source}` })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[NULLIFIED] Error:', error);
        message.reply('❌ Failed to apply Nullified boost.');
    }
}

async function handlePetFoob(message, itemName, quantity, userId) {
    function getMaxHunger(rarity) {
        const hungerMap = {
            Common: 1500,
            Rare: 1800,
            Epic: 2160,
            Legendary: 2880,
            Mythical: 3600,
            Divine: 4320
        };
        return hungerMap[rarity] || 1500;
    }

    try {
        const { get, run } = require('../../../Core/database');
        
        const petRow = await get(
            `SELECT * FROM petInventory WHERE userId = ? AND type = 'pet' AND hunger < 100 ORDER BY hunger ASC LIMIT 1`,
            [userId]
        );

        if (!petRow) {
            return message.reply("❌ You don't have any pets that need feeding.");
        }

        const maxHunger = getMaxHunger(petRow.rarity || 'Common');

        await run(
            `UPDATE petInventory SET hunger = ?, lastHungerUpdate = ? WHERE petId = ?`,
            [maxHunger, Math.floor(Date.now() / 1000), petRow.petId]
        );

        message.reply(`✅ You fed **${petRow.name}**! Hunger restored to 100%.`);
    } catch (error) {
        console.error('[PET_FOOB] Error:', error);
        message.reply('❌ Failed to feed your pet.');
    }
}

module.exports = {
    handleWeirdGrass,
    handleGoldenSigil,
    handleHakureiTicket,
    handleLumina,
    handleFantasyBook,
    handleAncientRelic,
    handleNullified,
    handlePetFoob
};