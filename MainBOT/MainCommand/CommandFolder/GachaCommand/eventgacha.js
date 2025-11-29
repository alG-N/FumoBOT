const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../Core/Database/dbSetting');
const { maintenance, developerID } = require("../../Configuration/Maintenance/maintenanceConfig");
const { isBanned } = require('../../Administrator/BannedList/BanUtils');
const { getWeekIdentifier, incrementWeeklyShiny } = require('../../Ultility/weekly');

// add more logs, a little bit more detailed
const ROLL_LIMIT = 50000;
const WINDOW_DURATION = 30 * 60 * 1000;
const LOG_CHANNEL_ID = '1411386632589807719';
const MYTHICAL_PITY = 1000;
const QUESTION_PITY = 10000;

const BASE_CHANCES = {
    EPIC: 86.3899,
    LEGENDARY: 13.5,
    MYTHICAL: 0.1,
    '???': 0.01,
    TRANSCENDENT: 0.0001
};

const cooldowns = new Map();
const eventStartTime = new Date();
const eventDuration = 11 * 24 * 60 * 60 * 1000;
const eventEndTime = new Date(eventStartTime.getTime() + eventDuration);

const formatNumber = (num) => num.toLocaleString();

const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
    );

const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) =>
        db.run(sql, params, function (err) { err ? reject(err) : resolve(this); })
    );

const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
    );

const isWindowExpired = (lastRollTime) =>
    !lastRollTime || Date.now() - lastRollTime > WINDOW_DURATION;

function getRollResetTime(lastRollTime) {
    const now = Date.now();
    const windowStart = lastRollTime ? Math.floor(lastRollTime / WINDOW_DURATION) * WINDOW_DURATION : now;
    const timeLeft = Math.max(0, (windowStart + WINDOW_DURATION) - now);
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}

const isEventActive = () => Date.now() < eventEndTime.getTime();

function getRemainingTime() {
    const remaining = eventEndTime.getTime() - Date.now();
    if (remaining <= 0) return 'Event has ended';
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${days}d ${hours}h ${minutes}m`;
}

const selectFumo = (rarity, Efumos) => {
    const filtered = Efumos.filter(f => f.rarity === rarity);
    return filtered.length > 0 ? filtered[Math.floor(Math.random() * filtered.length)] : null;
};

async function getUserBoosts(userId) {
    const boosts = {
        ancient: 1,
        mysterious: 1,
        mysteriousDice: 1,
        pet: 1,
        lumina: false,
        nullified: null,
        lines: []
    };

    try {
        const ancient = await dbGet(
            `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic' AND expiresAt > ?`,
            [userId, Date.now()]
        );
        if (ancient) {
            boosts.ancient = ancient.multiplier;
            boosts.lines.push(`🎇 AncientRelic x${ancient.multiplier}`);
        }

        const mysterious = await dbGet(
            `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube' AND expiresAt > ?`,
            [userId, Date.now()]
        );
        if (mysterious) {
            boosts.mysterious = mysterious.multiplier;
            boosts.lines.push(`🧊 MysteriousCube x${mysterious.multiplier.toFixed(2)}`);
        }

        const dice = await dbGet(
            `SELECT multiplier, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice' AND expiresAt > ?`,
            [userId, Date.now()]
        );
        if (dice) {
            let perHourArr = [];
            try { perHourArr = JSON.parse(dice.extra || '[]'); } catch { }

            const now = Date.now();
            const currentHourTimestamp = now - (now % (60 * 60 * 1000));
            let currentHour = perHourArr.find(e => e.at === currentHourTimestamp);

            if (!currentHour) {
                const newMultiplier = parseFloat((0.0001 + Math.random() * 10.9999).toFixed(4));
                currentHour = { at: currentHourTimestamp, multiplier: newMultiplier };
                perHourArr.push(currentHour);
                perHourArr = perHourArr.slice(-12);

                await dbRun(
                    `UPDATE activeBoosts SET multiplier = ?, extra = ? WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                    [newMultiplier, JSON.stringify(perHourArr), userId]
                );
            }

            boosts.mysteriousDice = currentHour.multiplier;
            boosts.lines.push(`🎲 MysteriousDice x${currentHour.multiplier}`);
        }

        const petBoosts = await dbAll(
            `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source LIKE 'Pet:%'`,
            [userId]
        );
        if (petBoosts.length > 0) {
            boosts.pet = petBoosts.reduce((acc, row) => acc * row.multiplier, 1);
            boosts.lines.push(`🐰 Pet x${boosts.pet.toFixed(4)}`);
        }

        const lumina = await dbGet(
            `SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`,
            [userId]
        );
        if (lumina) {
            boosts.lumina = true;
            boosts.lines.push('🌟 Lumina (Every 10th roll x5)');
        }

        boosts.nullified = await dbGet(
            `SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
            [userId]
        );
        if (boosts.nullified) boosts.lines.push('Nullified');

    } catch (err) {
        await logToDiscord(`Error loading boosts for ${userId}: ${err.message}`, 'error');
    }

    return boosts;
}

function calculateLuckMultiplier(boosts, luck, rollsLeft, isBoostActive) {
    const bonusRollMultiplier = (rollsLeft > 0 && !isBoostActive) ? 2 : 1;
    if (bonusRollMultiplier === 2) boosts.lines.push('✨ Bonus Roll x2');

    return boosts.ancient * boosts.mysterious * boosts.mysteriousDice * boosts.pet * Math.max(1, luck) * bonusRollMultiplier;
}

function calculateChances(totalLuckMultiplier) {
    const mythical = Math.min(BASE_CHANCES.MYTHICAL * totalLuckMultiplier, 5);
    const question = Math.min(BASE_CHANCES['???'] * totalLuckMultiplier, 0.5);
    const transcendent = BASE_CHANCES.TRANSCENDENT;
    const legendary = Math.max(BASE_CHANCES.LEGENDARY - (mythical + question + transcendent), 0.01);
    const epic = 100 - (legendary + mythical + question + transcendent);

    return { epic, legendary, mythical, question, transcendent };
}

module.exports = (client, Efumos) => {

    async function logToDiscord(message, type = 'info') {
        try {
            const channel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setDescription(message)
                .setTimestamp()
                .setColor(type === 'error' ? '#FF0000' : type === 'warning' ? '#FFA500' : '#00FF00');

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Failed to log to Discord:', err);
        }
    }

    client.on('messageCreate', async message => {
        const content = message.content.trim().toLowerCase();
        if (content !== '.eventgacha status' && content !== '.eg status') return;

        try {
            const userId = message.author.id;
            const userData = await dbGet(
                `SELECT gems, lastRollTime, rollsInCurrentWindow, rollsSinceLastMythical, rollsSinceLastQuestionMark, luck, rollsLeft FROM userCoins WHERE userId = ?`,
                [userId]
            );

            if (!userData) return message.reply('No data found. Use `.eventgacha` to start!');

            const rollsLeft = userData.rollsLeft || 0;
            const boosts = await getUserBoosts(userId);
            const isBoostActive = boosts.ancient > 1 || boosts.mysterious > 1 || boosts.pet > 1;
            const totalLuckMultiplier = calculateLuckMultiplier(boosts, userData.luck, rollsLeft, isBoostActive);
            const chances = calculateChances(totalLuckMultiplier);

            const embed = new EmbedBuilder()
                .setTitle('🎲 Event Gacha Status')
                .addFields(
                    { name: 'Gems', value: formatNumber(userData.gems), inline: true },
                    { name: 'Rolls in Window', value: `${userData.rollsInCurrentWindow || 0} / ${ROLL_LIMIT}`, inline: true },
                    { name: 'Window Reset', value: getRollResetTime(userData.lastRollTime), inline: true },
                    { name: 'Pity', value: `🟥 Mythical: ${userData.rollsSinceLastMythical || 0} / ${MYTHICAL_PITY}\n❓ ???: ${userData.rollsSinceLastQuestionMark || 0} / ${QUESTION_PITY}`, inline: false },
                    { name: 'Event Time Left', value: getRemainingTime(), inline: false },
                    {
                        name: '🎲 Your Current Chances',
                        value: `🔮 EPIC - ${chances.epic.toFixed(4)}%\n🟨 LEGENDARY - ${chances.legendary.toFixed(4)}%\n🟥 MYTHICAL - ${chances.mythical.toFixed(4)}%\n❓ ??? - ${chances.question.toFixed(5)}%\n👑 TRANSCENDENT - ???%`
                    }
                )
                .setColor('#0099ff')
                .setFooter({ text: boosts.lines.join('\n') || 'No luck boost applied...' });

            await message.reply({ embeds: [embed] });
        } catch (err) {
            await logToDiscord(`Status command error for ${message.author.id}: ${err.message}`, 'error');
            await message.reply('Error fetching your status.');
        }
    });

    client.on('messageCreate', async message => {
        const content = message.content.trim().toLowerCase();
        if (content !== '.eventgacha' && content !== '.eg') return;

        const banData = isBanned(message.author.id);
        if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                .setDescription(
                    maintenance === "yes"
                        ? "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden"
                        : `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}${banData.expiresAt
                            ? `\n**Time Remaining:** ${Math.floor((banData.expiresAt - Date.now()) / 1000)}s`
                            : '\n**Ban Type:** Permanent'
                        }`
                )
                .setFooter({ text: maintenance === "yes" ? "Thank you for your patience" : "Ban enforced by developer" })
                .setTimestamp();

            await logToDiscord(`Blocked user ${message.author.id} (${message.author.tag}) - ${maintenance === "yes" ? "maintenance" : "ban"}`, 'warning');
            return message.reply({ embeds: [embed] });
        }

        if (!isEventActive()) {
            return message.reply('The banner has closed. Please wait for further updates.');
        }

        try {
            const userData = await dbGet(
                `SELECT gems, lastRollTime, rollsInCurrentWindow, hasFantasyBook, luck, rollsLeft, rollsSinceLastMythical, rollsSinceLastQuestionMark FROM userCoins WHERE userId = ?`,
                [message.author.id]
            );

            if (!userData) return message.reply('You do not have any gems.');
            if (!userData.hasFantasyBook) {
                return message.reply('You are not allowed to use this command until you enable **FantasyBook(M)**.');
            }

            let rollsInCurrentWindow = userData.rollsInCurrentWindow || 0;
            let lastRollTime = userData.lastRollTime || Date.now();

            if (isWindowExpired(lastRollTime)) {
                rollsInCurrentWindow = 0;
                lastRollTime = Date.now();
                await dbRun(
                    `UPDATE userCoins SET rollsInCurrentWindow = 0, lastRollTime = ? WHERE userId = ?`,
                    [lastRollTime, message.author.id]
                );
            }

            if (rollsInCurrentWindow >= ROLL_LIMIT) {
                return message.reply(`You have reached your roll limit. Please wait ${getRollResetTime(lastRollTime)} before rolling again.`);
            }

            const rollsLeft = userData.rollsLeft || 0;
            const boosts = await getUserBoosts(message.author.id);
            const isBoostActive = boosts.ancient > 1 || boosts.mysterious > 1 || boosts.pet > 1;
            const totalLuckMultiplier = calculateLuckMultiplier(boosts, userData.luck, rollsLeft, isBoostActive);
            const chances = calculateChances(totalLuckMultiplier);

            const embed = new EmbedBuilder()
                .setTitle('🎲 Jujutsu Kaisen turned into Marketable Fumo?!?! 🎲')
                .setDescription(`💎 You're sitting on a treasure of ${formatNumber(userData.gems)} gems. Unleash the urge to gamble, each summon is just 100 gems for 1 marketable-fumo.`)
                .addFields(
                    {
                        name: '🌟 Rarity Chances 🌟',
                        value: `Step right up and test your luck! Here are the odds for each rarity (with your luck applied):\n🔮 EPIC - ${chances.epic.toFixed(4)}%\n🟨 LEGENDARY - ${chances.legendary.toFixed(4)}%\n🟥 MYTHICAL - ${chances.mythical.toFixed(4)}%\n❓ ??? - ${chances.question.toFixed(5)}%\n👑 TRANSCENDENT - ???%`
                    },
                    { name: '⏳ Time Left', value: getRemainingTime(), inline: true },
                    { name: '🔄 Roll Limit', value: `${rollsInCurrentWindow} / ${ROLL_LIMIT} rolls. ${getRollResetTime(lastRollTime)} until reset.`, inline: true },
                    { name: '🟥 Mythical Pity', value: `${userData.rollsSinceLastMythical || 0} / ${MYTHICAL_PITY}`, inline: false },
                    { name: '❓ ??? Pity', value: `${userData.rollsSinceLastQuestionMark || 0} / ???`, inline: false }
                )
                .setColor('#0099ff')
                .setImage('https://cdn141.picsart.com/322879240181201.jpg')
                .setFooter({ text: boosts.lines.join('\n') || 'No luck boost applied...' });

            const rowButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`eventbuy1fumo_${message.author.id}`).setLabel('Summon 1').setStyle(ButtonStyle.Primary).setDisabled(rollsInCurrentWindow >= ROLL_LIMIT),
                    new ButtonBuilder().setCustomId(`eventbuy10fumos_${message.author.id}`).setLabel('Summon 10').setStyle(ButtonStyle.Secondary).setDisabled(rollsInCurrentWindow >= ROLL_LIMIT),
                    new ButtonBuilder().setCustomId(`eventbuy100fumos_${message.author.id}`).setLabel('Summon 100').setStyle(ButtonStyle.Success).setDisabled(rollsInCurrentWindow >= ROLL_LIMIT)
                );

            await message.channel.send({ embeds: [embed], components: [rowButtons] });
        } catch (err) {
            await logToDiscord(`Main command error for ${message.author.id}: ${err.message}`, 'error');
            await message.reply('Database error. Please try again later.');
        }
    });

    async function performSummon(userId, numSummons, Efumos) {
        try {
            const user = await dbGet(
                `SELECT gems, luckRarity, rollsLeft, rollsSinceLastMythical, rollsSinceLastQuestionMark, totalRolls, luck FROM userCoins WHERE userId = ?`,
                [userId]
            );

            if (!user || user.gems < 100 * numSummons) {
                return { success: false, message: `Oops! It seems like you need more gems to unlock ${numSummons} fumos.` };
            }

            const boosts = await getUserBoosts(userId);
            const rollsLeft = user.rollsLeft || 0;
            const isBoostActive = boosts.ancient > 1 || boosts.mysterious > 1 || boosts.pet > 1;
            const totalLuckMultiplier = calculateLuckMultiplier(boosts, user.luck, rollsLeft, isBoostActive);
            const chances = calculateChances(totalLuckMultiplier);

            let fumoList = [];
            let currentMythical = user.rollsSinceLastMythical || 0;
            let currentQuestion = user.rollsSinceLastQuestionMark || 0;

            for (let i = 0; i < numSummons; i++) {
                let rarity;
                if (boosts.nullified?.uses > 0) {
                    const rarities = ['EPIC', 'LEGENDARY', 'MYTHICAL', '???', 'TRANSCENDENT'];
                    rarity = rarities[Math.floor(Math.random() * rarities.length)];

                    if (boosts.nullified.uses > 1) {
                        await dbRun(
                            `UPDATE activeBoosts SET uses = ? WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                            [boosts.nullified.uses - 1, userId]
                        );
                        boosts.nullified.uses--;
                    } else {
                        await dbRun(
                            `DELETE FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                            [userId]
                        );
                        boosts.nullified = null;
                    }
                } else {
                    if (currentQuestion >= QUESTION_PITY) {
                        rarity = '???';
                        currentQuestion = 0;
                        currentMythical = 0;
                    } else if (currentMythical >= MYTHICAL_PITY) {
                        rarity = 'MYTHICAL';
                        currentMythical = 0;
                        currentQuestion = 0;
                    } else {
                        let roll = Math.random() * 100;

                        if (boosts.lumina && (user.totalRolls + i + 1) % 10 === 0) {
                            roll /= 5;
                        }

                        const { epic, legendary, mythical, question, transcendent } = chances;
                        if (roll < transcendent) rarity = 'TRANSCENDENT';
                        else if (roll < question + transcendent) rarity = '???';
                        else if (roll < mythical + question + transcendent) rarity = 'MYTHICAL';
                        else if (roll < legendary + mythical + question + transcendent) rarity = 'LEGENDARY';
                        else rarity = 'EPIC';

                        if (rarity === 'MYTHICAL' || rarity === '???') {
                            currentMythical = 0;
                            currentQuestion = 0;
                        } else {
                            currentMythical++;
                            currentQuestion++;
                        }
                    }
                }

                const fumo = selectFumo(rarity, Efumos);
                if (fumo) {
                    const shinyMark = Math.min(1, user.luck || 0);
                    const shinyChance = 0.01 + (shinyMark * 0.02);
                    const alGChance = 0.00001 + (shinyMark * 0.00009);

                    const isAlterGolden = Math.random() < alGChance;
                    const isShiny = !isAlterGolden && Math.random() < shinyChance;

                    let fumoName = fumo.name;
                    if (isAlterGolden) {
                        fumoName += '[🌟alG]';
                        await incrementWeeklyShiny(userId);
                    } else if (isShiny) {
                        fumoName += '[✨SHINY]';
                        await incrementWeeklyShiny(userId);
                    }

                    await dbRun(`INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`, [userId, fumoName]);
                    fumoList.push({ name: fumoName, rarity, picture: fumo.picture });
                }
            }

            await dbRun(
                `UPDATE userCoins SET 
                    gems = gems - ?,
                    totalRolls = totalRolls + ?,
                    rollsInCurrentWindow = rollsInCurrentWindow + ?,
                    lastRollTime = ?,
                    rollsLeft = CASE WHEN rollsLeft > 0 THEN rollsLeft - ? ELSE 0 END,
                    luckRarity = CASE WHEN rollsLeft <= 1 THEN 'NORMAL' ELSE luckRarity END,
                    rollsSinceLastMythical = ?,
                    rollsSinceLastQuestionMark = ?
                WHERE userId = ?`,
                [100 * numSummons, numSummons, numSummons, Date.now(), numSummons, currentMythical, currentQuestion, userId]
            );

            // Update quests/achievements
            await dbRun(
                `INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
                VALUES (?, 'roll_1000', ?, 0, DATE('now'))
                ON CONFLICT(userId, questId, date) DO UPDATE SET 
                progress = MIN(progress + ?, 1000),
                completed = CASE WHEN progress + ? >= 1000 THEN 1 ELSE completed END`,
                [userId, numSummons, numSummons, numSummons]
            );

            const weekId = getWeekIdentifier();
            await dbRun(
                `INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
                VALUES (?, 'roll_15000', ?, 0, ?)
                ON CONFLICT(userId, questId, week) DO UPDATE SET 
                progress = MIN(progress + ?, 15000),
                completed = CASE WHEN progress + ? >= 15000 THEN 1 ELSE completed END`,
                [userId, numSummons, weekId, numSummons, numSummons]
            );

            await dbRun(
                `INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
                VALUES (?, 'total_rolls', ?, 0)
                ON CONFLICT(userId, achievementId) DO UPDATE SET progress = progress + ?`,
                [userId, numSummons, numSummons]
            );

            await logToDiscord(`${userId} summoned ${numSummons} fumos. Total rolls: ${user.totalRolls + numSummons}`, 'info');

            return {
                success: true,
                fumoList,
                rollsSinceLastMythical: currentMythical,
                rollsSinceLastQuestionMark: currentQuestion,
                boostText: boosts.lines.join('\n') || 'No luck boost applied...'
            };
        } catch (err) {
            await logToDiscord(`Summon error for ${userId}: ${err.message}`, 'error');
            return { success: false, message: 'An error occurred during summoning.' };
        }
    }

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        const [baseId, buttonOwnerId] = interaction.customId.split('_');
        const validButtons = ['eventbuy1fumo', 'eventbuy10fumos', 'eventbuy100fumos', 'continue1', 'continue10', 'continue100'];

        if (!validButtons.includes(baseId)) return;
        if (interaction.user.id !== buttonOwnerId) {
            return interaction.reply({
                content: "You can't use someone else's summon buttons. Use `/eventgacha` to start your own!",
                ephemeral: true
            });
        }

        const now = Date.now();
        let cooldownDuration = 3000;

        try {
            const [timeBlessing, timeClock] = await Promise.all([
                dbGet(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'farmingCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [interaction.user.id, now]),
                dbGet(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [interaction.user.id, now])
            ]);

            let cooldownMultiplier = 1;
            if (timeBlessing) cooldownMultiplier *= timeBlessing.multiplier;
            if (timeClock) cooldownMultiplier *= timeClock.multiplier;
            cooldownDuration /= cooldownMultiplier;
        } catch (err) {
            // Use default cooldown
        }

        const lastUsed = cooldowns.get(interaction.user.id) || 0;
        if (now - lastUsed < cooldownDuration) {
            return interaction.reply({
                content: `🕒 Please wait ${((cooldownDuration - (now - lastUsed)) / 1000).toFixed(1)}s before clicking again.`,
                ephemeral: true
            });
        }
        cooldowns.set(interaction.user.id, now);

        if (!isEventActive()) {
            return interaction.reply('The banner has closed. Please wait for further updates.');
        }

        try {
            const userData = await dbGet(
                `SELECT gems, lastRollTime, rollsInCurrentWindow FROM userCoins WHERE userId = ?`,
                [interaction.user.id]
            );

            if (!userData) return interaction.reply('User data not found. Please try again later.');

            let { rollsInCurrentWindow, lastRollTime } = userData;
            rollsInCurrentWindow = rollsInCurrentWindow || 0;
            lastRollTime = lastRollTime || Date.now();

            if (isWindowExpired(lastRollTime)) {
                rollsInCurrentWindow = 0;
                lastRollTime = Date.now();
                await dbRun(
                    `UPDATE userCoins SET rollsInCurrentWindow = 0, lastRollTime = ? WHERE userId = ?`,
                    [lastRollTime, interaction.user.id]
                );
            }

            if (rollsInCurrentWindow >= ROLL_LIMIT) {
                return interaction.reply(`You have reached your roll limit. Please wait ${getRollResetTime(lastRollTime)} before rolling again.`);
            }
            await interaction.deferReply({ ephemeral: true });

            let numSummons;
            if (baseId === 'eventbuy1fumo' || baseId === 'continue1') numSummons = 1;
            else if (baseId === 'eventbuy10fumos' || baseId === 'continue10') numSummons = 10;
            else if (baseId === 'eventbuy100fumos' || baseId === 'continue100') numSummons = 100;
            else numSummons = 1;
            const result = await performSummon(interaction.user.id, numSummons, Efumos);

            if (!result.success) {
                return interaction.editReply({ content: result.message });
            }

            // Build response
            let description = '';
            if (numSummons === 1) {
                const fumo = result.fumoList[0];
                description = `You acquired a ${fumo.rarity === 'TRANSCENDENT' ? '👑' : ''}${fumo.name} from the exclusive Event Fumo Crate! 🎊🎉`;
            } else {
                const rarityOrder = ['EPIC', 'LEGENDARY', 'MYTHICAL', 'TRANSCENDENT', '???'];
                const grouped = result.fumoList.reduce((acc, fumo) => {
                    if (!acc[fumo.rarity]) acc[fumo.rarity] = {};
                    acc[fumo.rarity][fumo.name] = (acc[fumo.rarity][fumo.name] || 0) + 1;
                    return acc;
                }, {});

                for (const rarity of rarityOrder) {
                    if (!grouped[rarity]) continue;
                    const total = Object.values(grouped[rarity]).reduce((sum, count) => sum + count, 0);
                    description += `**${rarity === 'TRANSCENDENT' ? '👑 ' : ''}${rarity} (x${total}):**\n`;
                    for (const [name, count] of Object.entries(grouped[rarity])) {
                        description += `- ${name} x${count}\n`;
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎉🎊 ${numSummons === 1 ? "Woohoo! You've successfully unlocked a fantastic fumo!" : `You've successfully unlocked ${numSummons} fantastic fumos from the JJK's Fumo Crate!`} 🎊🎉`)
                .setDescription(description)
                .addFields(
                    { name: 'Mythical Pity', value: `${result.rollsSinceLastMythical} / ${MYTHICAL_PITY}` },
                    { name: '??? Pity', value: `${result.rollsSinceLastQuestionMark} / ???` },
                    { name: '🔄 Roll Limit', value: `${rollsInCurrentWindow + numSummons} / ${ROLL_LIMIT} rolls. ${getRollResetTime(lastRollTime)} until reset.` }
                )
                .setFooter({ text: result.boostText });

            if (numSummons === 1 && result.fumoList[0]) {
                embed.setImage(result.fumoList[0].picture);
            }

            const continueButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`continue${numSummons}_${interaction.user.id}`)
                    .setLabel('Continue')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled((rollsInCurrentWindow + numSummons) >= ROLL_LIMIT)
            );

            await interaction.editReply({ embeds: [embed], components: [continueButton] });
        } catch (err) {
            await logToDiscord(`Button interaction error for ${interaction.user.id}: ${err.message}`, 'error');
            if (!interaction.replied) {
                await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
            }
        }
    });
};