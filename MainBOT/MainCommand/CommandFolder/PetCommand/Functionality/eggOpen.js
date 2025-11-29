const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../Core/Database/db');
const { EGG_DATA } = require('../Configuration/petConfig');
const { getUserEggs, getHatchingEggs, dbRun, dbGet } = require('../Utilities/dbUtils');

module.exports = async (client) => {
    client.on("messageCreate", async message => {
        const content = message.content.trim().toLowerCase();
        const cmd = content.split(" ")[0];
        
        if (message.author.bot) return;
        // REMOVED .ue from here to avoid conflict with unequip
        if (![".useegg", ".eggcheck"].includes(cmd)) return;

        const userId = message.author.id;
        const args = message.content.split(" ").slice(1);

        try {
            // .eggcheck command
            if (cmd === ".eggcheck") {
                const [eggs, hatching] = await Promise.all([
                    getUserEggs(db, userId),
                    getHatchingEggs(db, userId)
                ]);

                let desc = "";

                if (eggs.length === 0) {
                    desc += "You have no eggs in your inventory.\n";
                } else {
                    desc += "**Your Egg Inventory:**\n";
                    eggs.forEach(egg => {
                        const data = EGG_DATA[egg.name];
                        desc += `${data?.emoji || "🥚"} **${egg.name}** × ${egg.count}\n`;
                    });
                }

                if (hatching.length === 0) {
                    desc += "\nYou have no eggs currently hatching.";
                } else {
                    desc += "\n**Eggs Hatching:**\n";
                    hatching.forEach(egg => {
                        const data = EGG_DATA[egg.eggName];
                        desc += `${data?.emoji || "🥚"} **${egg.eggName}** - Hatches <t:${Math.floor(egg.hatchAt / 1000)}:R>\n`;
                    });
                }

                const components = [];
                if (eggs.length > 0 && hatching.length < 5) {
                    components.push(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`hatch_all_${userId}`)
                                .setLabel("Hatch All")
                                .setStyle(ButtonStyle.Success)
                        )
                    );
                }

                const embed = new EmbedBuilder()
                    .setColor("#FFD700")
                    .setTitle("🥚 Your Eggs")
                    .setDescription(desc)
                    .setFooter({ text: "Use .useegg <EggName> to hatch an egg!" });

                const replyMsg = await message.reply({ embeds: [embed], components });

                if (components.length > 0) {
                    const filter = i => i.customId === `hatch_all_${userId}` && i.user.id === userId;
                    
                    replyMsg.awaitMessageComponent({ 
                        filter, 
                        componentType: ComponentType.Button, 
                        time: 60_000 
                    }).then(async interaction => {
                        await handleHatchAll(interaction, userId);
                    }).catch(() => {
                        replyMsg.edit({ components: [] }).catch(() => {});
                    });
                }
                return;
            }

            // .useegg command (removed .ue shortcut)
            const eggName = args[0];
            if (!eggName || !EGG_DATA[eggName]) {
                const available = Object.keys(EGG_DATA).map(e => `\`${e}\``).join(", ");
                return message.reply(`❌ Please specify a valid egg: ${available}.\nUse \`.eggcheck\` to see your eggs.`);
            }

            const hatchingCount = await dbGet(db, 
                `SELECT COUNT(*) AS count FROM hatchingEggs WHERE userId = ?`, [userId]
            );

            if (hatchingCount.count >= 5) {
                return message.reply("❌ You can only incubate up to 5 eggs at once. Use `.eggcheck` to manage them.");
            }

            const egg = await dbGet(db,
                `SELECT rowid, * FROM petInventory WHERE userId = ? AND type = 'egg' AND name = ? LIMIT 1`,
                [userId, eggName]
            );

            if (!egg) {
                return message.reply(`❌ You don't have any ${eggName} to hatch. Use \`.eggcheck\` to view your eggs.`);
            }

            await dbRun(db, `DELETE FROM petInventory WHERE rowid = ?`, [egg.rowid]);

            const now = Date.now();
            const hatchAt = now + EGG_DATA[eggName].time;

            await dbRun(db,
                `INSERT INTO hatchingEggs (userId, eggName, startedAt, hatchAt) VALUES (?, ?, ?, ?)`,
                [userId, egg.name, now, hatchAt]
            );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`cancel_hatch_${egg.rowid}_${userId}`)
                    .setLabel("Cancel Hatching")
                    .setStyle(ButtonStyle.Danger)
            );

            const embed = new EmbedBuilder()
                .setColor("#00FF00")
                .setTitle(`${EGG_DATA[eggName].emoji} Egg Hatching Started!`)
                .setDescription(`You placed a **${egg.name}** (${EGG_DATA[eggName].rarity}) into the incubator.\nIt will hatch <t:${Math.floor(hatchAt / 1000)}:R>.`)
                .setFooter({ text: "Use .eggcheck to monitor progress." });

            const replyMsg = await message.reply({ embeds: [embed], components: [row] });

            const filter = i => i.customId === `cancel_hatch_${egg.rowid}_${userId}` && i.user.id === userId;
            
            replyMsg.awaitMessageComponent({ 
                filter, 
                componentType: ComponentType.Button, 
                time: 60_000 
            }).then(async interaction => {
                await handleCancelHatch(interaction, userId, egg, hatchAt, egg.rowid);
            }).catch(() => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cancel_hatch_${egg.rowid}_${userId}`)
                        .setLabel("Cancel Hatching")
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                );
                replyMsg.edit({ components: [disabledRow] }).catch(() => {});
            });

        } catch (error) {
            console.error("Error in eggOpen:", error);
            return message.reply("An error occurred. Please try again later.");
        }
    });
};

async function handleHatchAll(interaction, userId) {
    const [eggsNow, hatchingNow] = await Promise.all([
        getUserEggs(db, userId),
        getHatchingEggs(db, userId)
    ]);

    let slotsLeft = 5 - hatchingNow.length;
    if (slotsLeft <= 0) {
        return interaction.update({
            content: "❌ You have no available incubator slots.",
            embeds: [],
            components: []
        });
    }

    const hatched = [];
    for (const egg of eggsNow) {
        if (slotsLeft <= 0) break;
        const count = Math.min(egg.count, slotsLeft);
        
        for (let i = 0; i < count; i++) {
            const row = await dbGet(db,
                `SELECT rowid FROM petInventory WHERE userId = ? AND type = 'egg' AND name = ? LIMIT 1`,
                [userId, egg.name]
            );
            
            if (row) {
                await dbRun(db, `DELETE FROM petInventory WHERE rowid = ?`, [row.rowid]);
            }

            const now = Date.now();
            const hatchAt = now + (EGG_DATA[egg.name]?.time || 0);
            
            await dbRun(db,
                `INSERT INTO hatchingEggs (userId, eggName, startedAt, hatchAt) VALUES (?, ?, ?, ?)`,
                [userId, egg.name, now, hatchAt]
            );

            hatched.push({ name: egg.name, hatchAt });
            slotsLeft--;
            if (slotsLeft <= 0) break;
        }
    }

    const desc = hatched.length
        ? hatched.map(e => `${EGG_DATA[e.name]?.emoji || "🥚"} **${e.name}** - Hatches <t:${Math.floor(e.hatchAt / 1000)}:R>`).join("\n")
        : "No eggs were hatched.";

    await interaction.update({
        embeds: [
            new EmbedBuilder()
                .setColor("#00FF00")
                .setTitle("🥚 Eggs Hatching Started!")
                .setDescription(desc)
                .setFooter({ text: "Use .eggcheck to monitor progress." })
        ],
        components: []
    });
}

async function handleCancelHatch(interaction, userId, egg, hatchAt, rowid) {
    await dbRun(db,
        `DELETE FROM hatchingEggs WHERE userId = ? AND eggName = ? AND hatchAt = ?`,
        [userId, egg.name, hatchAt]
    );
    
    await dbRun(db,
        `INSERT INTO petInventory (userId, name, type) VALUES (?, ?, 'egg')`,
        [userId, egg.name]
    );

    const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`cancel_hatch_${rowid}_${userId}`)
            .setLabel("Cancel Hatching")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
    );

    await interaction.update({
        embeds: [
            new EmbedBuilder()
                .setColor("#FF9900")
                .setTitle("❌ Hatching Cancelled")
                .setDescription(`Your **${egg.name}** was returned to your inventory.`)
        ],
        components: [disabledRow]
    });
}