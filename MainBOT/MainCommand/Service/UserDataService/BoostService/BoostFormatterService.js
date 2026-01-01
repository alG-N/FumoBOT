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
    const { type, source, multiplier, uses, isDynamic, displayValue } = boost;

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

    if (type === 'faithPoints') {
        return `• ⛩️ **Faith Points** (${uses}/20 accumulated)`;
    }

    if (type === 'boostMultiplier') {
        return `• 👑 **Divine Amplification** (×${multiplier} all boosts): ${timeLeft}`;
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