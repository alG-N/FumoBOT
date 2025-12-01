const { EmbedBuilder } = require('discord.js');
const { run, get } = require('../../../../Core/database');

async function handleFantasyBook(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **FantasyBook(M)** is a one-time use item.");
    }

    try {
        const userRow = await get(
            `SELECT hasFantasyBook FROM userCoins WHERE userId = ?`,
            [userId]
        );

        if (userRow?.hasFantasyBook) {
            const embed = new EmbedBuilder()
                .setColor(0x9370DB)
                .setTitle("📖 FantasyBook(M) Already Used!")
                .setDescription("You've already unlocked **ASTRAL+** and non-Touhou rarities.\n> The Fantasy power is eternal.")
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        await message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle("⚠️ Confirm Use of FantasyBook(M)")
                    .setDescription(
                        "**Are you sure you want to use FantasyBook(M)?**\n\n" +
                        "> ⚠️ This will unlock drops from **non-Touhou** fumos (e.g., Lumina, Aya) and rarities like **OTHERWORLDLY** and **ASTRAL+**.\n\n" +
                        "Once used, this cannot be undone."
                    )
                    .setFooter({ text: "Reply with 'yes' to confirm or 'no' to cancel." })
                    .setTimestamp()
            ]
        });

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

        await run(
            `UPDATE userCoins SET hasFantasyBook = 1 WHERE userId = ?`,
            [userId]
        );

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

module.exports = { handleFantasyBook };