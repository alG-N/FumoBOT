const { get } = require('../../../Core/database');
const { STORAGE_CONFIG } = require('../../../Configuration/storageConfig');
const { EmbedBuilder, Colors } = require('discord.js');

class StorageLimitService {
    static async getCurrentStorage(userId) {
        // Fix: Use SUM(quantity) instead of COUNT(*) or just counting rows
        // Also handle NULL quantities by defaulting to 1
        const result = await get(
            `SELECT COALESCE(SUM(COALESCE(quantity, 1)), 0) as total 
             FROM userInventory 
             WHERE userId = ? AND fumoName IS NOT NULL`,
            [userId]
        );
        return result?.total || 0;
    }

    static async canAddFumos(userId, amount) {
        const current = await this.getCurrentStorage(userId);
        const newTotal = current + amount;
        
        return {
            canAdd: newTotal <= STORAGE_CONFIG.MAX_STORAGE,
            current,
            newTotal,
            remaining: Math.max(0, STORAGE_CONFIG.MAX_STORAGE - current),
            maxAllowed: Math.max(0, STORAGE_CONFIG.MAX_STORAGE - current),
            isFull: current >= STORAGE_CONFIG.MAX_STORAGE
        };
    }

    static async getStorageStatus(userId) {
        const current = await this.getCurrentStorage(userId);
        const percentage = (current / STORAGE_CONFIG.MAX_STORAGE) * 100;
        
        let status = 'NORMAL';
        if (current >= STORAGE_CONFIG.CRITICAL_THRESHOLD) status = 'CRITICAL';
        else if (current >= STORAGE_CONFIG.WARNING_THRESHOLD) status = 'WARNING';
        
        return {
            current,
            max: STORAGE_CONFIG.MAX_STORAGE,
            percentage: percentage.toFixed(2),
            remaining: Math.max(0, STORAGE_CONFIG.MAX_STORAGE - current),
            status
        };
    }

    static createStorageWarningEmbed(status) {
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Storage Warning')
            .setDescription(
                `Your storage is ${status.percentage}% full!\n\n` +
                `**Current:** ${status.current.toLocaleString()} / ${status.max.toLocaleString()} fumos\n` +
                `**Remaining:** ${status.remaining.toLocaleString()} fumos\n\n` +
                `Consider selling or managing your inventory to free up space.`
            )
            .setColor(status.status === 'CRITICAL' ? Colors.Red : Colors.Orange)
            .setFooter({ text: 'Use .sell or .storage to manage your inventory' });
        
        return embed;
    }

    static createStorageFullEmbed(status, attemptedAmount) {
        const embed = new EmbedBuilder()
            .setTitle('🚫 Storage Full!')
            .setDescription(
                `Cannot add ${attemptedAmount.toLocaleString()} fumos - storage limit reached!\n\n` +
                `**Current Storage:** ${status.current.toLocaleString()} / ${status.max.toLocaleString()}\n` +
                `**Space Available:** ${status.remaining.toLocaleString()} fumos\n` +
                `**Attempted to Add:** ${attemptedAmount.toLocaleString()} fumos\n\n` +
                `**What can you do?**\n` +
                `• Use \`.sell\` to sell unwanted fumos\n` +
                `• Use \`.storage\` to view your inventory\n` +
                `• Focus on selling Common to EPIC rarities`
            )
            .setColor(Colors.Red)
            .setFooter({ text: 'Storage Management Required' });
        
        return embed;
    }

    static createProgressBar(percentage, length = 20) {
        const numericPercentage = parseFloat(percentage);
        
        // Clamp percentage between 0 and 100
        const clampedPercentage = Math.max(0, Math.min(100, isNaN(numericPercentage) ? 0 : numericPercentage));
        
        const filled = Math.round((clampedPercentage / 100) * length);
        const empty = length - filled;
        
        // Ensure non-negative values
        const safeFilled = Math.max(0, filled);
        const safeEmpty = Math.max(0, empty);
        
        return `[${'█'.repeat(safeFilled)}${'░'.repeat(safeEmpty)}] ${clampedPercentage.toFixed(2)}%`;
    }

    static getColorByStatus(status) {
        switch (status) {
            case 'CRITICAL': return Colors.Red;
            case 'WARNING': return Colors.Orange;
            default: return Colors.Green;
        }
    }
}

module.exports = StorageLimitService;
