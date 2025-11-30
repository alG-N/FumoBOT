const { get } = require('../../Core/database');
const { PRAY_LIMITS } = require('../../Configuration/prayConfig');

const usageTracker = new Map();
const activePrayers = new Set();

function checkActiveSession(userId) {
    if (activePrayers.has(userId)) {
        return {
            valid: false,
            error: 'ACTIVE_SESSION',
            message: 'You already have an ongoing offer! Please accept or decline it before praying again.'
        };
    }
    return { valid: true };
}

async function checkTicketAvailability(userId) {
    const ticket = await get(
        `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, PRAY_LIMITS.ticketRequired]
    );

    if (!ticket || ticket.quantity <= 0) {
        return {
            valid: false,
            error: 'NO_TICKET',
            message: `You need at least **1 ${PRAY_LIMITS.ticketRequired}** in your inventory to use this command.`
        };
    }

    return { valid: true, currentQuantity: ticket.quantity };
}

function checkUsageLimit(userId) {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (!usageTracker.has(userId)) {
        usageTracker.set(userId, []);
    }

    const timestamps = usageTracker.get(userId).filter(ts => now - ts < oneHour);
    usageTracker.set(userId, timestamps);

    if (timestamps.length >= PRAY_LIMITS.maxUsagePerHour) {
        const nextAvailable = new Date(timestamps[0] + oneHour);
        const timeRemaining = Math.ceil((nextAvailable - now) / 1000);
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;

        return {
            valid: false,
            error: 'LIMIT_REACHED',
            message: `You've used the \`/pray\` command **${PRAY_LIMITS.maxUsagePerHour} times** in the past hour.\nPlease wait **${minutes}m ${seconds}s** before praying again.`
        };
    }

    return { valid: true };
}

function trackUsage(userId) {
    const timestamps = usageTracker.get(userId) || [];
    timestamps.push(Date.now());
    usageTracker.set(userId, timestamps);
}

function addActiveSession(userId) {
    activePrayers.add(userId);
}

function removeActiveSession(userId) {
    activePrayers.delete(userId);
}

function clearExpiredSessions() {
    activePrayers.clear();
}

async function validatePrayRequest(userId) {
    const sessionCheck = checkActiveSession(userId);
    if (!sessionCheck.valid) return sessionCheck;

    const ticketCheck = await checkTicketAvailability(userId);
    if (!ticketCheck.valid) return ticketCheck;

    const limitCheck = checkUsageLimit(userId);
    if (!limitCheck.valid) return limitCheck;

    return { valid: true };
}

module.exports = {
    validatePrayRequest,
    checkActiveSession,
    checkTicketAvailability,
    checkUsageLimit,
    trackUsage,
    addActiveSession,
    removeActiveSession,
    clearExpiredSessions,
    usageTracker,
    activePrayers
};