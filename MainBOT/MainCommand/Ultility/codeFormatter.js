const { formatNumber } = require('./formatting');
const { CODE_CATEGORIES } = require('../Configuration/codeConfig');

function formatReward(reward) {
    const parts = [];
    
    if (reward.coins) {
        parts.push(`🪙 **${formatNumber(reward.coins)} coins**`);
    }
    
    if (reward.gems) {
        parts.push(`💎 **${formatNumber(reward.gems)} gems**`);
    }
    
    if (reward.items && reward.items.length > 0) {
        reward.items.forEach(({ item, quantity }) => {
            parts.push(`🎁 **${item}** x${formatNumber(quantity)}`);
        });
    }
    
    return parts.length ? parts.join('\n') : '*No reward data*';
}

function formatCodeInfo(code, codeData, isAdmin = false) {
    const parts = [];
    
    parts.push(`**Code:** \`${code}\``);
    parts.push(`**Description:** ${codeData.description || 'No description'}`);
    
    const category = CODE_CATEGORIES[codeData.category];
    if (category) {
        parts.push(`**Category:** ${category.emoji} ${category.name}`);
    }
    
    if (codeData.expires) {
        const expiryDate = new Date(codeData.expires);
        const isExpired = expiryDate < new Date();
        parts.push(`**Expires:** ${expiryDate.toLocaleDateString()} ${isExpired ? '(EXPIRED)' : ''}`);
    } else {
        parts.push(`**Expires:** Never`);
    }
    
    if (codeData.maxUses !== null) {
        parts.push(`**Max Uses:** ${formatNumber(codeData.maxUses)}`);
    } else {
        parts.push(`**Max Uses:** Unlimited`);
    }
    
    if (isAdmin) {
        parts.push(`\n**Rewards:**`);
        parts.push(formatReward(codeData));
    }
    
    return parts.join('\n');
}

function formatCodeList(codes, isAdmin = false) {
    const codesByCategory = {};
    
    for (const [code, data] of Object.entries(codes)) {
        const category = data.category || 'regular';
        if (!codesByCategory[category]) {
            codesByCategory[category] = [];
        }
        codesByCategory[category].push({ code, data });
    }
    
    const sections = [];
    
    for (const [category, items] of Object.entries(codesByCategory)) {
        const categoryInfo = CODE_CATEGORIES[category] || CODE_CATEGORIES.regular;
        const header = `${categoryInfo.emoji} **${categoryInfo.name}**`;
        
        const codeList = items.map(({ code, data }) => {
            const expired = data.expires && new Date(data.expires) < new Date();
            const status = expired ? '❌' : data.maxUses !== null ? '⏰' : '✅';
            return `${status} \`${code}\` - ${data.description}`;
        }).join('\n');
        
        sections.push(`${header}\n${codeList}`);
    }
    
    return sections.join('\n\n');
}

function formatRedemptionHistory(redemptions) {
    if (!redemptions || redemptions.length === 0) {
        return 'No redemption history found.';
    }
    
    return redemptions.map((r, idx) => {
        const date = new Date(r.redeemedAt);
        return `${idx + 1}. \`${r.code}\` - ${date.toLocaleDateString()}`;
    }).join('\n');
}

function formatCodeStats(stats) {
    const parts = [];
    
    parts.push(`**Total Redemptions:** ${formatNumber(stats.totalRedemptions)}`);
    parts.push(`**Unique Users:** ${formatNumber(stats.uniqueUsers)}`);
    
    if (stats.firstRedemption) {
        parts.push(`**First Used:** ${new Date(stats.firstRedemption).toLocaleDateString()}`);
    }
    
    if (stats.lastRedemption) {
        parts.push(`**Last Used:** ${new Date(stats.lastRedemption).toLocaleDateString()}`);
    }
    
    return parts.join('\n');
}

function formatTimeRemaining(expiresAt) {
    const now = Date.now();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '< 1m';
}

function getCategoryColor(category) {
    return CODE_CATEGORIES[category]?.color || 0x3498DB;
}

module.exports = {
    formatReward,
    formatCodeInfo,
    formatCodeList,
    formatRedemptionHistory,
    formatCodeStats,
    formatTimeRemaining,
    getCategoryColor
};