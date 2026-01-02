const https = require('https');
const http = require('http');
const { logToDiscord, LogLevel } = require('../../../Core/logger');

const PLACEHOLDER_IMAGE = 'https://www.firstbenefits.org/wp-content/uploads/2017/10/placeholder.png';
const IMAGE_CACHE = new Map();
const CACHE_DURATION = 3600000; // 1 hour

/**
 * Check if a URL returns a valid image
 * @param {string} url - The image URL to check
 * @param {number} timeout - Timeout in ms (default 5000)
 * @returns {Promise<{valid: boolean, statusCode?: number, error?: string}>}
 */
async function checkImageUrl(url, timeout = 5000) {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'Invalid URL' };
    }

    // Check cache first
    const cached = IMAGE_CACHE.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.result;
    }

    return new Promise((resolve) => {
        try {
            const urlObj = new URL(url);
            const lib = urlObj.protocol === 'https:' ? https : http;

            const req = lib.request(url, { method: 'HEAD', timeout }, (res) => {
                const contentType = res.headers['content-type'] || '';
                const isImage = contentType.startsWith('image/') || 
                               res.statusCode === 200 && (
                                   url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i)
                               );
                
                const result = {
                    valid: res.statusCode === 200 && isImage,
                    statusCode: res.statusCode,
                    contentType
                };

                IMAGE_CACHE.set(url, { result, timestamp: Date.now() });
                resolve(result);
            });

            req.on('error', (err) => {
                const result = { valid: false, error: err.message };
                IMAGE_CACHE.set(url, { result, timestamp: Date.now() });
                resolve(result);
            });

            req.on('timeout', () => {
                req.destroy();
                const result = { valid: false, error: 'Timeout' };
                IMAGE_CACHE.set(url, { result, timestamp: Date.now() });
                resolve(result);
            });

            req.end();
        } catch (err) {
            const result = { valid: false, error: err.message };
            resolve(result);
        }
    });
}

/**
 * Get a valid image URL or placeholder
 * @param {string} url - The original image URL
 * @returns {Promise<string>} - Valid URL or placeholder
 */
async function getValidImageUrl(url) {
    if (!url) return PLACEHOLDER_IMAGE;
    
    const check = await checkImageUrl(url);
    return check.valid ? url : PLACEHOLDER_IMAGE;
}

/**
 * Validate all fumo images and report broken ones
 * @param {Array} fumos - Array of fumo objects
 * @param {Object} client - Discord client for logging
 * @returns {Promise<{valid: number, broken: Array, missing: Array}>}
 */
async function validateAllFumoImages(fumos, client = null) {
    const results = {
        valid: 0,
        broken: [],
        missing: []
    };

    const batchSize = 10; // Process in batches to avoid overwhelming
    
    for (let i = 0; i < fumos.length; i += batchSize) {
        const batch = fumos.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (fumo) => {
            const fullName = `${fumo.name}(${fumo.rarity})`;
            
            if (!fumo.picture) {
                results.missing.push(fullName);
                return;
            }

            const check = await checkImageUrl(fumo.picture);
            if (check.valid) {
                results.valid++;
            } else {
                results.broken.push({
                    name: fullName,
                    url: fumo.picture,
                    error: check.error || `Status: ${check.statusCode}`
                });
            }
        }));

        // Small delay between batches
        if (i + batchSize < fumos.length) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    // Log to Discord if client provided
    if (client && (results.broken.length > 0 || results.missing.length > 0)) {
        await logImageValidationResults(client, results);
    }

    return results;
}

/**
 * Log validation results to Discord
 */
async function logImageValidationResults(client, results) {
    const { EmbedBuilder } = require('discord.js');
    
    const embed = new EmbedBuilder()
        .setTitle('🖼️ Fumo Image Validation Report')
        .setColor(results.broken.length > 0 || results.missing.length > 0 ? '#FFA500' : '#00FF00')
        .setTimestamp()
        .addFields(
            { name: '✅ Valid Images', value: `${results.valid}`, inline: true },
            { name: '❌ Broken Images', value: `${results.broken.length}`, inline: true },
            { name: '⚠️ Missing Images', value: `${results.missing.length}`, inline: true }
        );

    if (results.broken.length > 0) {
        const brokenList = results.broken
            .slice(0, 10)
            .map(b => `• ${b.name}: ${b.error}`)
            .join('\n');
        
        embed.addFields({
            name: '🔴 Broken Image Details (first 10)',
            value: brokenList || 'None',
            inline: false
        });
    }

    if (results.missing.length > 0) {
        const missingList = results.missing.slice(0, 10).join(', ');
        embed.addFields({
            name: '🟡 Fumos Without Images (first 10)',
            value: missingList || 'None',
            inline: false
        });
    }

    await logToDiscord(client, null, null, LogLevel.INFO, embed);
}

/**
 * Clear the image cache
 */
function clearImageCache() {
    IMAGE_CACHE.clear();
}

/**
 * Get placeholder image URL
 */
function getPlaceholderImage() {
    return PLACEHOLDER_IMAGE;
}

module.exports = {
    checkImageUrl,
    getValidImageUrl,
    validateAllFumoImages,
    clearImageCache,
    getPlaceholderImage,
    PLACEHOLDER_IMAGE
};