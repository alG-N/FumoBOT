const { EmbedBuilder } = require('discord.js');
const { PRAY_CHARACTERS } = require('../../../Configuration/prayConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { getStatsByRarity } = require('../../../Ultility/characterStats');
const {
    getUserData,
    getSakuyaUsage,
    updateSakuyaUsage,
    getFarmingFumos,
    getActiveBoosts,
    addToInventory,
    incrementDailyPray,
    getUserInventory,
    deleteFumoFromInventory
} = require('../PrayDatabaseService');
const { run, all } = require('../../../Core/database');

async function handleSakuya(userId, channel) {
    const config = PRAY_CHARACTERS.SAKUYA;

    try {
        const user = await getUserData(userId);
        if (!user) {
            await channel.send("❌ Couldn't find your account!");
            return;
        }

        const usage = await getSakuyaUsage(userId);
        const now = Date.now();
        const { timeSkip, rewards, blessing } = config;

        let useCount = usage?.uses || 0;
        let timeBlessing = usage?.timeBlessing || 0;
        let blessingExpiry = usage?.blessingExpiry || null;
        let firstUseTime = usage?.firstUseTime || now;

        if (blessingExpiry && now > blessingExpiry) {
            timeBlessing = 0;
            blessingExpiry = null;
            await updateSakuyaUsage(userId, { timeBlessing: 0, blessingExpiry: null });
        }

        if (usage) {
            const timeSinceFirst = now - firstUseTime;

            if (useCount >= timeSkip.maxUses && timeSinceFirst >= timeSkip.resetWindow) {
                useCount = 0;
                timeBlessing = 0;
                blessingExpiry = null;
                firstUseTime = now;
                await updateSakuyaUsage(userId, {
                    uses: 0,
                    timeBlessing: 0,
                    blessingExpiry: null,
                    firstUseTime: now,
                    lastUsed: now
                });
            } else if (useCount < timeSkip.maxUses && timeSinceFirst >= timeSkip.cooldownWindow) {
                useCount = 0;
                timeBlessing = 0;
                firstUseTime = now;
                await updateSakuyaUsage(userId, {
                    uses: 0,
                    timeBlessing: 0,
                    firstUseTime: now,
                    lastUsed: now
                });
            }
        }

        if (useCount >= timeSkip.maxUses) {
            const timeLeft = timeSkip.resetWindow - (now - firstUseTime);
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            await channel.send(`⛔ You've reached the maximum skips (${timeSkip.maxUses}). Please wait **${hours}h ${minutes}m** before using it again.`);
            return;
        }

        const demand = timeSkip.costScaling[useCount] || 0.60;
        const requiredFumos = timeSkip.fumoRequirements[useCount] || 2;

        const allowedRarities = useCount >= 5 
            ? config.rarityRequirements.high 
            : config.rarityRequirements.normal;

        const allFumos = await getUserInventory(userId);
        const ownsSakuyaUncommon = allFumos.some(f => f.fumoName === "Sakuya(UNCOMMON)");
        
        const dropChances = ownsSakuyaUncommon 
            ? rewards.bonusDrops 
            : {
                fragment: { base: rewards.bonusDrops.fragment.base, withSakuya: rewards.bonusDrops.fragment.base },
                clock: { base: rewards.bonusDrops.clock.base, withSakuya: rewards.bonusDrops.clock.base },
                watch: { base: rewards.bonusDrops.watch.base, withSakuya: rewards.bonusDrops.watch.base }
            };

        const rarePlusFumos = allFumos.filter(f => {
            const match = f.fumoName?.match(/\((.*?)\)$/);
            const rarity = match?.[1]?.toUpperCase();
            return allowedRarities.includes(rarity);
        });

        const totalAvailable = rarePlusFumos.reduce((acc, f) => acc + (f.quantity || 1), 0);
        
        const perfectSkipChance = ownsSakuyaUncommon 
            ? rewards.perfectSkipChanceWithSakuya 
            : rewards.perfectSkipChance;
        const isPerfectSkip = Math.random() < perfectSkipChance;
        const blessingActive = blessingExpiry && now < blessingExpiry;
        let blessingSkip = false;

        if (totalAvailable < requiredFumos && !isPerfectSkip && !blessingActive) {
            await channel.send(`⚠️ You need at least ${requiredFumos} RARE+ fumo(s) for Sakuya to skip time.`);
            return;
        }

        const farming = await getFarmingFumos(userId);
        const twelveHours = 720;
        let farmingCoins = 0;
        let farmingGems = 0;

        for (const fumo of farming) {
            const { coinsPerMin, gemsPerMin } = getStatsByRarity(fumo.fumoName);
            const qty = fumo.quantity || 1;
            farmingCoins += coinsPerMin * twelveHours * qty;
            farmingGems += gemsPerMin * twelveHours * qty;
        }

        const baseCoins = 150 * twelveHours;
        const baseGems = 50 * twelveHours;
        let totalCoins = farmingCoins + baseCoins;
        let totalGems = farmingGems + baseGems;

        const coinBoosts = await getActiveBoosts(userId, now);
        const coinMult = coinBoosts
            .filter(b => ['coin', 'income'].includes(b.type.toLowerCase()))
            .reduce((acc, b) => acc * b.multiplier, 1);
        
        const gemMult = coinBoosts
            .filter(b => ['gem', 'gems', 'income'].includes(b.type.toLowerCase()))
            .reduce((acc, b) => acc * b.multiplier, 1);

        totalCoins = Math.floor(totalCoins * coinMult);
        totalGems = Math.floor(totalGems * gemMult);

        timeBlessing += blessing.increment;

        if (timeBlessing >= blessing.threshold && !blessingActive) {
            timeBlessing = 0;
            blessingExpiry = now + blessing.duration;

            await updateSakuyaUsage(userId, {
                blessingExpiry,
                timeBlessing: 0
            });

            await run(
                `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt) 
                VALUES (?, 'summonCooldown', 'TimeBlessing', ?, ?)`,
                [userId, blessing.cooldownMultiplier, blessingExpiry]
            );

            blessingSkip = true;
        }

        if (blessingSkip || blessingActive) {
            totalCoins *= 2;
            totalGems *= 2;
        }

        if (!isPerfectSkip && !blessingSkip && !blessingActive) {
            totalCoins = Math.floor(totalCoins * (1 - demand));
            totalGems = Math.floor(totalGems * (1 - demand));
        }

        if (totalCoins > rewards.coinLimit) totalCoins = rewards.coinLimit;
        if (totalGems > rewards.gemLimit) totalGems = rewards.gemLimit;

        if (!isPerfectSkip && !blessingSkip && !blessingActive) {
            const expanded = [];
            for (const f of rarePlusFumos) {
                const qty = f.quantity || 1;
                for (let i = 0; i < qty; i++) {
                    expanded.push({ ...f });
                }
            }
            const shuffled = expanded.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, requiredFumos);

            for (const fumo of selected) {
                await deleteFumoFromInventory(userId, fumo.id, 1);
            }
        }

        await run(
            `UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`,
            [totalCoins, totalGems, userId]
        );

        const drops = [];
        const dropRate = ownsSakuyaUncommon ? 'withSakuya' : 'base';
        
        if (Math.random() < dropChances.fragment[dropRate]) drops.push("FragmentOfTime(E)");
        if (Math.random() < dropChances.clock[dropRate]) drops.push("TimeClock-Broken(L)");
        if (Math.random() < dropChances.watch[dropRate]) drops.push("PocketWatch(M)");

        for (const item of drops) {
            await addToInventory(userId, item, 1);
        }

        if (usage) {
            const timeSinceFirst = now - firstUseTime;

            if (usage.uses < timeSkip.maxUses) {
                if (timeSinceFirst >= timeSkip.cooldownWindow) {
                    await updateSakuyaUsage(userId, {
                        uses: 1,
                        firstUseTime: now,
                        lastUsed: now,
                        timeBlessing
                    });
                } else {
                    await updateSakuyaUsage(userId, {
                        uses: usage.uses + 1,
                        lastUsed: now,
                        timeBlessing
                    });
                }
            }
        } else {
            await updateSakuyaUsage(userId, {
                uses: 1,
                firstUseTime: now,
                lastUsed: now,
                timeBlessing,
                blessingExpiry: null
            });
        }

        const currentDemand = Math.min(useCount + 1, timeSkip.maxUses);
        const progressBar = '█'.repeat(currentDemand) + '░'.repeat(timeSkip.maxUses - currentDemand);

        const blessingRemaining = blessingActive && blessingExpiry ? blessingExpiry - now : 0;
        const blessingPercent = blessingActive
            ? Math.floor((blessingRemaining / blessing.duration) * 100)
            : Math.min(Math.floor((timeBlessing / blessing.threshold) * 100), 100);

        const blessingBar = '█'.repeat(Math.floor(blessingPercent / 20)) + '░'.repeat(5 - Math.floor(blessingPercent / 20));

        const hB = Math.floor(blessingRemaining / 3600000);
        const mB = Math.floor((blessingRemaining % 3600000) / 60000);
        const sB = Math.floor((blessingRemaining % 60000) / 1000);
        const blessingTimer = `${hB.toString().padStart(2, '0')}:${mB.toString().padStart(2, '0')}:${sB.toString().padStart(2, '0')}`;

        const embed = new EmbedBuilder()
            .setTitle('🕰️ Sakuya\'s Time Skip 🕰️')
            .setDescription(
                `${blessingSkip ? '⏳ Sakuya skipped time forward a day!' : '⏳ Sakuya skipped time forward 12 hours!'}\n\n` +
                `**You earned:**\n🪙 Coins: **${totalCoins.toLocaleString()}**\n💎 Gems: **${totalGems.toLocaleString()}**` +
                (drops.length ? `\n\n**Extra Item Drops:**\n${drops.map(d => `• ${d}`).join('\n')}` : '') +
                `\n\n**Time's Demander:** \`${progressBar}\` (${currentDemand}/${timeSkip.maxUses})` +
                (blessingSkip
                    ? `\n\n🌟 **Time Blessing activated!** No cost taken. 1-day cooldown buff granted!`
                    : isPerfectSkip
                        ? `\n\n✨ **Perfect Skip!** You kept everything without losing any fumos or coins!`
                        : `\n\nSakuya took ${Math.round(demand * 100)}% of your rewards and ${requiredFumos} RARE+ fumo(s).`)
            )
            .setFooter({ 
                text: `🔮 Time Blessing: [${blessingBar}] ${blessingPercent}% | ${blessingActive ? `Expires in: ${blessingTimer}` : 'Not active'}` 
            })
            .setColor('#b0c4de')
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        await incrementDailyPray(userId);

    } catch (error) {
        console.error('[Sakuya] Error:', error);
        channel.send('❌ An error occurred during Sakuya\'s time skip.');
    }
}

module.exports = { handleSakuya };