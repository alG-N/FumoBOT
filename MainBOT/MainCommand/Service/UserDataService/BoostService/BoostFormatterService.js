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
        if (uses !== undefined && uses !== null) {
            return `• 🌊 **${displayValue}** from **${source}**`;
        }
        return `• 🌊 **${displayValue}** from **${source}** (${timeLeft})`;
    }

    if (type === 'yuyukoRolls') {
        return `• 🌸 **${formatNumber(uses)} Rolls Left** from Yuyuko's Blessing`;
    }

    if (type === 'rarityOverride') {
        return `• 🎯 Equal Rarity Odds from **${source}** (${uses || 0} roll(s) left)`;
    }

    if (type === 'luckEvery10') {
        return `• x${multiplier} Luck Boost (every 10 rolls) from **${source}** (${timeLeft})`;
    }

    if (type === 'summonCooldown') {
        const reduction = Math.round((1 - multiplier) * 100);
        return `• -${reduction}% Summon Cooldown from **${source}** (${timeLeft})`;
    }

    if (type === 'sellPenalty') {
        const reduction = Math.round((1 - multiplier) * 100);
        return `• -${reduction}% Sell Value from **${source}** (${timeLeft})`;
    }

    if (type === 'luck') {
        const prefix = isDynamic ? 'this hour' : 'total';
        // Display as multiplier format (x2, x10, etc.)
        return `• x${multiplier.toFixed(2)} Luck Boost (${prefix}) from **${source}** (${timeLeft})`;
    }

    // Sanae specific types (fallback)
    if (type === 'craftDiscount') {
        return `• 🔨 **${multiplier}% Craft Discount** from **${source}** (${timeLeft})`;
    }

    if (type === 'freeCrafts') {
        return `• 🆓 **Free Crafts** from **${source}** (${timeLeft})`;
    }

    if (type === 'craftProtection') {
        return `• 🛡️ **${uses} Craft Protections** from **${source}**`;
    }

    if (type === 'guaranteedRarity') {
        return `• 🎲 **Guaranteed Rarity Rolls** from **${source}** (${uses} left)`;
    }

    if (type === 'luckForRolls') {
        return `• 🍀 **+${(multiplier * 100).toFixed(0)}% Luck** from **${source}** (${uses} rolls left)`;
    }

    if (type === 'prayImmunity') {
        return `• 🙏 **Pray Immunity** from **${source}** (${timeLeft})`;
    }

    if (type === 'faithPoints') {
        return `• ⛩️ **${uses}/20 Faith Points** - Sanae`;
    }

    const percentLabel = formatBoostPercentage(multiplier);
    return `• ${percentLabel} from **${source}** (${timeLeft})`;
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