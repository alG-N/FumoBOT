const { formatNumber } = require('../../../Ultility/formatting');

function formatTime(ms) {
    if (!ms || ms === Infinity) return "∞ - Permanent";
    
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    
    let timeString = "";
    if (days) timeString += `${days}d `;
    if (hours) timeString += `${hours}h `;
    if (minutes) timeString += `${minutes}m `;
    if (!days && !hours && seconds) timeString += `${seconds}s`;
    
    return timeString.trim() || "< 1s";
}

function formatBoostPercentage(multiplier) {
    const percent = Math.round(multiplier * 100);
    const sign = percent >= 100 ? "+" : (percent < 100 ? "-" : "");
    const effective = Math.abs(percent - 100);
    return `${sign}${effective}%`;
}

function formatBoostLabel(boost, timeLeft) {
    const { type, source, multiplier, uses, isDynamic, displayValue, extra } = boost;

    // Sanae blessing types with custom display
    if (displayValue) {
        // Extract boost name from displayValue if it contains parentheses
        const nameMatch = displayValue.match(/^(.+?)\s*\((.+)\)$/);
        if (nameMatch) {
            const [, name, effect] = nameMatch;
            if (uses !== undefined && uses !== null) {
                return `• 🌊 **${name}** (${effect}) - **${source}**`;
            }
            return `• 🌊 **${name}** (${effect}): ${timeLeft}`;
        }
        // Fallback for displayValue without parentheses
        if (uses !== undefined && uses !== null) {
            return `• 🌊 **${source}** (${displayValue})`;
        }
        return `• 🌊 **${source}** (${displayValue}): ${timeLeft}`;
    }

    if (type === 'yuyukoRolls') {
        return `• 🌸 **Yuyuko's Blessing** (${formatNumber(uses)} rolls remaining)`;
    }

    if (type === 'rarityOverride') {
        return `• 🎯 **${source}** (Equal rarity odds): ${uses || 0} rolls left`;
    }

    if (type === 'luckEvery10') {
        return `• 🎲 **${source}** (×${multiplier} luck every 10 rolls): ${timeLeft}`;
    }

    if (type === 'summonCooldown') {
        const reduction = Math.round((1 - multiplier) * 100);
        return `• ⏱️ **${source}** (${reduction}% cooldown reduction): ${timeLeft}`;
    }

    if (type === 'sellPenalty') {
        const reduction = Math.round((1 - multiplier) * 100);
        return `• ⚠️ **${source}** (${reduction}% sell penalty): ${timeLeft}`;
    }

    if (type === 'luck') {
        const prefix = isDynamic ? 'this hour' : 'active';
        return `• 🍀 **${source}** (×${multiplier.toFixed(2)} luck ${prefix}): ${timeLeft}`;
    }

    // Sanae specific types with proper naming
    if (type === 'craftDiscount') {
        return `• 🔨 **Shrine's Protection** (${multiplier}% craft discount): ${timeLeft}`;
    }

    if (type === 'freeCrafts') {
        return `• 🆓 **Divine Generosity** (free crafting): ${timeLeft}`;
    }

    if (type === 'craftProtection') {
        return `• 🛡️ **Craft Guardian** (${uses} fail protections remaining)`;
    }

    if (type === 'guaranteedRarity') {
        return `• 🎲 **Fortune's Favor** (guaranteed rarity rolls): ${uses} left`;
    }

    if (type === 'luckForRolls') {
        return `• 🍀 **Blessed Rolls** (+${(multiplier * 100).toFixed(0)}% luck): ${uses} rolls left`;
    }

    if (type === 'prayImmunity') {
        return `• 🙏 **Sacred Protection** (pray penalty immunity): ${timeLeft}`;
    }

    // Note: faithPoints removed - it's a tracker, not a boost (shown in .pray sanae)

    if (type === 'boostMultiplier') {
        return `• 👑 **Divine Amplification** (×${multiplier} all boosts): ${timeLeft}`;
    }

    if (type === 'income') {
        return `• 💰 **${source}** (×${multiplier} income - coins & gems): ${timeLeft}`;
    }

    // === TIER 6 SPECIAL EFFECTS ===
    if (type === 'voidTrait') {
        const oneInX = multiplier > 0 ? Math.round(1 / multiplier).toLocaleString() : '?';
        return `• 🌀 **${source}** ([VOID Trait]: 1 in ${oneInX}): ${timeLeft}`;
    }

    if (type === 'glitchedTrait') {
        const oneInX = multiplier > 0 ? Math.round(1 / multiplier).toLocaleString() : '?';
        return `• 🔮 **${source}** ([GLITCHED Trait]: 1 in ${oneInX}): ${timeLeft}`;
    }

    if (type === 'traitLuck') {
        return `• ✨ **${source}** ([Trait Luck]: x${multiplier.toFixed(2)}): ${timeLeft}`;
    }

    if (type === 'rollSpeed') {
        return `• ⚡ **${source}** ([Roll Speed]: x${multiplier.toFixed(2)}): ${timeLeft}`;
    }

    // === S!GIL SPECIAL EFFECTS ===
    if (type === 'sell' || type === 'sellvalue') {
        const percent = Math.round(multiplier * 100);
        return `• 📈 **${source}** ([Sell Value]: +${percent}%): ${timeLeft}`;
    }

    if (type === 'reimuLuck' || type === 'reimuluck') {
        // multiplier is 5.0 for +500%, display as percentage
        const percent = Math.round((multiplier - 1) * 100);
        return `• 🙏 **${source}** ([Reimu Luck]: +${percent}%): ${timeLeft}`;
    }

    if (type === 'astralBlock' || type === 'astralblock') {
        return `• 🚫 **${source}** ([ASTRAL+ Block]: Active): ${timeLeft}`;
    }

    if (type === 'nullifiedRolls' || type === 'nullifiedrolls') {
        // Parse extra to get remaining/total
        let remaining = 'Active';
        if (extra) {
            try {
                const extraData = typeof extra === 'string' ? JSON.parse(extra) : extra;
                if (extraData.remaining !== undefined) {
                    remaining = `${extraData.remaining}/${extraData.total || 10}`;
                }
            } catch {}
        }
        return `• 🎰 **${source}** ([Nullified Rolls]: ${remaining}): ${timeLeft}`;
    }

    // Generic format: Source (effect): timer
    const percentLabel = formatBoostPercentage(multiplier);
    return `• 💫 **${source}** (${percentLabel}): ${timeLeft}`;
}

function formatTotalBoost(total) {
    return formatBoostPercentage(total);
}

module.exports = {
    formatTime,
    formatBoostPercentage,
    formatBoostLabel,
    formatTotalBoost
};