const db = require('../../../Core/database');
const { RARITY_PRIORITY } = require('../../../Configuration/rarity');

const COIN_REWARDS = {
    'Common': 20,
    'UNCOMMON': 50,
    'RARE': 70,
    'EPIC': 150,
    'OTHERWORLDLY': 300,
    'LEGENDARY': 1300,
    'MYTHICAL': 7000
};

const GEM_REWARDS = {
    '???': 10000,
    'ASTRAL': 25000,
    'CELESTIAL': 40000,
    'INFINITE': 100000
};

const UNSELLABLE_RARITIES = ['ETERNAL', 'TRANSCENDENT'];
const SHINY_TAG = '[✨SHINY]';
const ALG_TAG = '[🌟alG]';

class SellValidationService {
    static parseSellCommand(args) {
        if (args.length === 0) {
            return { 
                valid: false, 
                error: 'INVALID_FORMAT',
                details: 'No arguments provided'
            };
        }

        const singleMatch = args.join(' ').match(/(.+?)\((.+?)\)\s*(\[✨SHINY\]|\[🌟alG\])?\s*(\d+)/i);
        if (singleMatch) {
            const fumoBase = singleMatch[1].trim();
            const rarity = singleMatch[2].trim();
            const tag = singleMatch[3] || null;
            const quantity = parseInt(singleMatch[4]);

            return {
                valid: true,
                type: 'SINGLE',
                fumoName: `${fumoBase}(${rarity})${tag || ''}`,
                rarity,
                tag,
                quantity
            };
        }

        if (args.length === 1) {
            const bulkMatch = args[0].match(/^([A-Z\?]+)(\[✨SHINY\]|\[🌟alG\])?$/i);
            if (bulkMatch) {
                return {
                    valid: true,
                    type: 'BULK',
                    rarity: bulkMatch[1].trim(),
                    tag: bulkMatch[2] || null
                };
            }
        }

        return { 
            valid: false, 
            error: 'INVALID_FORMAT',
            details: 'Could not parse command'
        };
    }

    static checkRarityFormat(rarity) {
        const allRarities = [...Object.keys(COIN_REWARDS), ...Object.keys(GEM_REWARDS), ...UNSELLABLE_RARITIES];
        return allRarities.includes(rarity);
    }

    static isUnsellable(rarity) {
        return UNSELLABLE_RARITIES.includes(rarity);
    }

    static async validateSingleSell(userId, fumoName, quantity) {
        const rarity = this.extractRarity(fumoName);

        if (!this.checkRarityFormat(rarity)) {
            return {
                valid: false,
                error: 'INVALID_RARITY',
                details: rarity
            };
        }

        if (this.isUnsellable(rarity)) {
            return {
                valid: false,
                error: 'UNSELLABLE_RARITY',
                details: rarity
            };
        }

        if (isNaN(quantity) || quantity <= 0) {
            return {
                valid: false,
                error: 'INVALID_QUANTITY',
                details: quantity
            };
        }

        const row = await db.get(
            'SELECT SUM(quantity) as total FROM userInventory WHERE userId = ? AND fumoName = ?',
            [userId, fumoName]
        );

        if (!row || (row.total || 0) < quantity) {
            return {
                valid: false,
                error: 'INSUFFICIENT_FUMOS',
                details: { fumoName, available: row?.total || 0, requested: quantity }
            };
        }

        return { valid: true };
    }

    static async validateBulkSell(userId, rarity, tag) {
        if (!this.checkRarityFormat(rarity)) {
            return {
                valid: false,
                error: 'INVALID_RARITY',
                details: rarity
            };
        }

        if (this.isUnsellable(rarity)) {
            return {
                valid: false,
                error: 'UNSELLABLE_RARITY',
                details: rarity
            };
        }

        let query = 'SELECT fumoName, SUM(quantity) AS count FROM userInventory WHERE userId = ? AND fumoName LIKE ?';
        let params = [userId, `%(${rarity})%`];

        if (tag) {
            query += ' AND fumoName LIKE ?';
            params.push(`%${tag}%`);
        }

        query += ' GROUP BY fumoName';

        let rows = await db.all(query, params);

        if (!tag) {
            rows = rows.filter(row => !row.fumoName.endsWith(SHINY_TAG) && !row.fumoName.endsWith(ALG_TAG));
        }

        if (!rows || rows.length === 0) {
            return {
                valid: false,
                error: 'NO_FUMOS_FOUND',
                details: { rarity, tag }
            };
        }

        return { valid: true, fumos: rows };
    }

    static extractRarity(fumoName) {
        const match = fumoName.match(/\((.+?)\)/);
        return match ? match[1] : null;
    }

    static getRewardType(rarity) {
        if (COIN_REWARDS[rarity]) return 'coins';
        if (GEM_REWARDS[rarity]) return 'gems';
        return null;
    }

    static getBaseReward(rarity) {
        return COIN_REWARDS[rarity] || GEM_REWARDS[rarity] || 0;
    }
}

module.exports = SellValidationService;