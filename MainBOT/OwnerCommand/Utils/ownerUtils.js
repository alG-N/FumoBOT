/**
 * Owner Utilities
 * Shared utility functions for owner commands
 */

const { AMOUNT_SUFFIXES } = require('../Config/ownerConfig');

function parseAmount(amountStr) {
    if (!amountStr) return null;
    const str = amountStr.toLowerCase().trim();
    
    for (const [suffix, multiplier] of Object.entries(AMOUNT_SUFFIXES)) {
        if (str.endsWith(suffix)) {
            const numPart = parseFloat(str.slice(0, -suffix.length));
            if (!isNaN(numPart)) return Math.floor(numPart * multiplier);
        }
    }
    
    const num = parseFloat(str);
    return isNaN(num) ? null : Math.floor(num);
}

function formatNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString();
}

function getAge(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;
    
    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}mo`);
    if (remainingDays > 0 || parts.length === 0) parts.push(`${remainingDays}d`);
    
    return {
        days,
        years,
        months,
        formatted: parts.join(' ')
    };
}

function isValidUserId(userId) {
    return /^\d{17,19}$/.test(userId);
}

module.exports = {
    parseAmount,
    formatNumber,
    getAge,
    isValidUserId
};
