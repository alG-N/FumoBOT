const FumoPool = require('../../../Data/FumoPool');
const { all } = require('../../../Core/database');
const { CATEGORIES } = require('../../../Configuration/libraryConfig');

class LibraryDataService {
    static async getUserLibraryData(userId) {
        try {
            const libraryFumos = FumoPool.getForLibrary();
            const userInventory = await all(
                `SELECT fumoName FROM userInventory WHERE userId = ?`,
                [userId]
            );

            const discovered = this.processDiscoveredFumos(userInventory);
            const categorized = this.categorizeFumos(libraryFumos, discovered);
            const stats = this.calculateStats(discovered, libraryFumos.length);

            return {
                categories: categorized,
                stats,
                totalFumos: libraryFumos.length,
                userId
            };
        } catch (error) {
            console.error(`[LibraryDataService] Error: ${error.message}`);
            return null;
        }
    }

    static processDiscoveredFumos(inventory) {
        const discovered = {};
        let shinyCount = 0;
        let algCount = 0;
        let voidCount = 0;      // FIX: Initialize voidCount
        let glitchedCount = 0;  // FIX: Initialize glitchedCount

        for (const row of inventory) {
            if (!row.fumoName) continue;

            const baseName = this.stripTags(row.fumoName);
            
            if (!discovered[baseName]) {
                discovered[baseName] = { base: false, shiny: false, alg: false, void: false, glitched: false };
            }

            discovered[baseName].base = true;

            if (row.fumoName.includes('[✨SHINY]')) {
                discovered[baseName].shiny = true;
                shinyCount++;
            }
            if (row.fumoName.includes('[🌟alG]')) {
                discovered[baseName].alg = true;
                algCount++;
            }
            if (row.fumoName.includes('[🌀VOID]')) {
                discovered[baseName].void = true;
                voidCount++;
            }
            if (row.fumoName.includes('[🔮GLITCHED]')) {
                discovered[baseName].glitched = true;
                glitchedCount++;
            }
        }

        return { discovered, shinyCount, algCount, voidCount, glitchedCount };
    }

    static categorizeFumos(libraryFumos, { discovered }) {
        const categories = {};
        
        for (const category of CATEGORIES) {
            categories[category] = [];
        }

        for (const fumo of libraryFumos) {
            const baseName = this.stripTags(fumo.name);
            const rarity = this.extractRarity(fumo.name);

            if (!rarity || !categories[rarity]) continue;

            const userData = discovered[baseName] || {};
            const hasBase = !!userData.base;
            const hasShiny = !!userData.shiny;
            const hasAlg = !!userData.alg;
            const hasVoid = !!userData.void;
            const hasGlitched = !!userData.glitched;

            categories[rarity].push({
                name: hasBase ? fumo.name : '???',
                hasBase,
                hasShiny,
                hasAlg,
                hasVoid,
                hasGlitched,
                baseName
            });
        }

        return categories;
    }

    static calculateStats(discovered, totalFumos) {
        const discoveredCount = Object.values(discovered.discovered).filter(f => f.base).length;
        const percentage = Math.round((discoveredCount / totalFumos) * 100);

        return {
            discoveredCount,
            totalFumos,
            percentage,
            shinyCount: discovered.shinyCount,
            algCount: discovered.algCount,
            voidCount: discovered.voidCount,
            glitchedCount: discovered.glitchedCount
        };
    }

    static stripTags(name) {
        if (typeof name !== 'string') return '';
        return name.replace(/\s*\[.*?\]/g, '').trim();
    }

    static extractRarity(name) {
        const match = name.match(/\(([^)]+)\)/);
        return match ? match[1] : null;
    }

    static getRarityEmoji(rarity) {
        const emojiMap = {
            'Common': '⚪',
            'UNCOMMON': '🟢',
            'RARE': '🔵',
            'EPIC': '🟣',
            'OTHERWORLDLY': '🌌',
            'LEGENDARY': '🟠',
            'MYTHICAL': '🔴',
            'EXCLUSIVE': '💎',
            '???': '❓',
            'ASTRAL': '🌠',
            'CELESTIAL': '✨',
            'INFINITE': '♾️',
            'ETERNAL': '🪐',
            'TRANSCENDENT': '🌈'
        };
        return emojiMap[rarity] || '⚪';
    }
}

module.exports = LibraryDataService;