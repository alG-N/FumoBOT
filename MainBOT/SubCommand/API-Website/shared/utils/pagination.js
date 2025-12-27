const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createPaginationButtons(currentPage, totalPages, prefix, userId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefix}_prev_${userId}`)
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`${prefix}_page_${userId}`)
            .setLabel(`Page ${currentPage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`${prefix}_next_${userId}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || currentPage >= totalPages - 1)
    );
}

function disablePaginationButtons(currentPage, totalPages, prefix, userId) {
    return createPaginationButtons(currentPage, totalPages, prefix, userId, true);
}

class PaginationState {
    constructor(expiryMs = 300000) {
        this.states = new Map();
        this.expiryMs = expiryMs;

        // Auto cleanup every 5 minutes
        setInterval(() => this._cleanup(), 300000);
    }

    set(userId, key, value) {
        const userKey = `${userId}_${key}`;
        this.states.set(userKey, {
            value,
            timestamp: Date.now()
        });
    }

    get(userId, key) {
        const userKey = `${userId}_${key}`;
        const entry = this.states.get(userKey);

        if (!entry) return undefined;

        if (Date.now() - entry.timestamp > this.expiryMs) {
            this.states.delete(userKey);
            return undefined;
        }

        return entry.value;
    }

    delete(userId, key) {
        const userKey = `${userId}_${key}`;
        this.states.delete(userKey);
    }

    clear(userId) {
        for (const key of this.states.keys()) {
            if (key.startsWith(`${userId}_`)) {
                this.states.delete(key);
            }
        }
    }

    _cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.states.entries()) {
            if (now - entry.timestamp > this.expiryMs) {
                this.states.delete(key);
            }
        }
    }
}

module.exports = {
    createPaginationButtons,
    disablePaginationButtons,
    PaginationState
};
