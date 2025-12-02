const { EmbedBuilder } = require('discord.js');
const { PRAY_CHARACTERS } = require('../../../Configuration/prayConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { getRarityFromFumoName } = require('../../../Ultility/characterStats');
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
const { run } = require('../../../Core/database');

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

        const demand = Math.max(0, timeSkip.costScaling[useCount] || 0.60) * 0.3;
        const requiredFumos = Math.max(0, (timeSkip.fumoRequirements[useCount] || 2) - 1);

        const allowedRarities = useCount >= 5 
            ? config.rarityRequirements.high 
            : config.rarityRequirements.normal;

        const allFumos = await getUserInventory(userId);
        const ownsSakuyaUncommon = allFumos.some(f => f.fumoName === "Sakuya(UNCOMMON)");
        
        const dropChances = {
            fragment: { 
                base: rewards.bonusDrops.fragment.base * 3, 
                withSakuya: rewards.bonusDrops.fragment.withSakuya * 3 
            },
            clock: { 
                base: rewards.bonusDrops.clock.base * 3, 
                withSakuya: rewards.bonusDrops.clock.withSakuya * 3 
            },
            watch: { 
                base: rewards.bonusDrops.watch.base * 3, 
                withSakuya: rewards.bonusDrops.watch.withSakuya * 3 
            }
        };

        const rarePlusFumos = allFumos.filter(f => {
            const match = f.fumoName?.match(/\((.*?)\)$/);
            const rarity = match?.[1]?.toUpperCase();
            return allowedRarities.includes(rarity);
        });

        const totalAvailable = rarePlusFumos.reduce((acc, f) => acc + (f.quantity || 1), 0);
        
        const perfectSkipChance = ownsSakuyaUncommon 
            ? rewards.perfectSkipChanceWithSakuya * 2
            : rewards.perfectSkipChance * 2;
        const isPerfectSkip = Math.random() < perfectSkipChance;
        const blessingActive = blessingExpiry && now < blessingExpiry;
        let blessingSkip = false;

        if (totalAvailable < requiredFumos && !isPerfectSkip && !blessingActive && requiredFumos > 0) {
            await channel.send(`⚠️ You need at least ${requiredFumos} RARE+ fumo(s) for Sakuya to skip time.`);
            return;
        }

        const farming = await getFarmingFumos(userId);
        const twelveHours = 720;
        let farmingCoins = 0;
        let farmingGems = 0;

        // Calculate farming rewards with proper trait multipliers
        for (const fumo of farming) {
            const rarity = getRarityFromFumoName(fumo.fumoName);
            
            const statMap = {
                Common: [25, 5],
                UNCOMMON: [55, 15],
                RARE: [120, 35],
                EPIC: [250, 75],
                OTHERWORLDLY: [550, 165],
                LEGENDARY: [1200, 360],
                MYTHICAL: [2500, 750],
                EXCLUSIVE: [5500, 1650],
                '???': [12000, 3600],
                ASTRAL: [25000, 7500],
                CELESTIAL: [50000, 15000],
                INFINITE: [85000, 25500],
                ETERNAL: [125000, 37500],
                TRANSCENDENT: [375000, 57500]
            };

            let [coinsPerMin, gemsPerMin] = statMap[rarity] || [0, 0];
            
            // Apply trait multipliers
            if (fumo.fumoName.includes('[🌟alG]')) {
                coinsPerMin *= 100;
                gemsPerMin *= 100;
            } else if (fumo.fumoName.includes('[✨SHINY]')) {
                coinsPerMin *= 2;
                gemsPerMin *= 2;
            }
            
            const qty = fumo.quantity || 1;
            farmingCoins += coinsPerMin * twelveHours * qty;
            farmingGems += gemsPerMin * twelveHours * qty;
        }

        const baseCoins = 150 * twelveHours;
        const baseGems = 50 * twelveHours;
        let totalCoins = farmingCoins + baseCoins;
        let totalGems = farmingGems + baseGems;

        // Apply personal boosts (potions, etc.)
        const coinBoosts = await getActiveBoosts(userId, now);
        let coinMult = 1;
        let gemMult = 1;
        
        coinBoosts.forEach(b => {
            const type = b.type.toLowerCase();
            if (['coin', 'income'].includes(type)) {
                coinMult *= b.multiplier;
            }
            if (['gem', 'gems', 'income'].includes(type)) {
                gemMult *= b.multiplier;
            }
        });

        // Apply building multipliers
        const { getBuildingLevels } = require('../../FarmingService/BuildingService/BuildingDatabaseService');
        const { calculateBuildingMultiplier, calculateEventAmplification } = require('../../../Configuration/buildingConfig');
        const buildingLevels = await getBuildingLevels(userId);
        
        const coinBuildingBoost = calculateBuildingMultiplier('COIN_BOOST', buildingLevels.COIN_BOOST);
        const gemBuildingBoost = calculateBuildingMultiplier('GEM_BOOST', buildingLevels.GEM_BOOST);
        
        // Apply weather/seasonal multipliers
        const { getCurrentMultipliers } = require('../../FarmingService/SeasonService/SeasonManagerService');
        let { coinMultiplier: seasonCoinMult, gemMultiplier: seasonGemMult } = await getCurrentMultipliers();
        
        // Apply event amplification from buildings
        seasonCoinMult = calculateEventAmplification(buildingLevels.EVENT_BOOST, seasonCoinMult);
        seasonGemMult = calculateEventAmplification(buildingLevels.EVENT_BOOST, seasonGemMult);

        // Calculate final amounts with all multipliers
        totalCoins = Math.floor(totalCoins * coinMult * coinBuildingBoost * seasonCoinMult);
        totalGems = Math.floor(totalGems * gemMult * gemBuildingBoost * seasonGemMult);

        timeBlessing += blessing.increment * 2;

        if (timeBlessing >= blessing.threshold && !blessingActive) {
            timeBlessing = 0;
            blessingExpiry = now + blessing.duration * 2;

            await updateSakuyaUsage(userId, {
                blessingExpiry,
                timeBlessing: 0
            });

            await run(
                `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt) 
                VALUES (?, 'summonCooldown', 'TimeBlessing', ?, ?)`,
                [userId, blessing.cooldownMultiplier * 0.25, blessingExpiry]
            );

            blessingSkip = true;
        }

        if (blessingSkip || blessingActive) {
            totalCoins *= 4;
            totalGems *= 4;
        }

        if (!isPerfectSkip && !blessingSkip && !blessingActive) {
            totalCoins = Math.floor(totalCoins * (1 - demand));
            totalGems = Math.floor(totalGems * (1 - demand));
        } else {
            totalCoins = Math.floor(totalCoins * 1.5);
            totalGems = Math.floor(totalGems * 1.5);
        }

        if (!isPerfectSkip && !blessingSkip && !blessingActive && requiredFumos > 0) {
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
        
        const fragmentRolls = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < fragmentRolls; i++) {
            if (Math.random() < dropChances.fragment[dropRate]) {
                drops.push("FragmentOfTime(E)");
            }
        }
        
        const clockRolls = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < clockRolls; i++) {
            if (Math.random() < dropChances.clock[dropRate]) {
                drops.push("TimeClock-Broken(L)");
            }
        }
        
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
            ? Math.floor((blessingRemaining / (blessing.duration * 2)) * 100)
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
                `**You earned:**\n🪙 Coins: **${formatNumber(totalCoins)}**\n💎 Gems: **${formatNumber(totalCoins)}**` +
                (drops.length ? `\n\n**Extra Item Drops:**\n${drops.map(d => `• ${d}`).join('\n')}` : '') +
                `\n\n**Time's Demander:** \`${progressBar}\` (${currentDemand}/${timeSkip.maxUses})` +
                (blessingSkip
                    ? `\n\n🌟 **Time Blessing activated!** No cost taken. Extended cooldown buff granted!`
                    : isPerfectSkip
                        ? `\n\n✨ **Perfect Skip!** You kept everything and got 50% bonus rewards!`
                        : `\n\nSakuya took ${Math.round(demand * 100)}% of your rewards${requiredFumos > 0 ? ` and ${requiredFumos} RARE+ fumo(s)` : ''}.`)
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