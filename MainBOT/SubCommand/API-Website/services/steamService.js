const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

class SteamService {
    constructor() {
        this.apiKey = process.env.STEAM_API_KEY || '';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    }

    async fetchSteamSales(maxResults = 300) {
        const allGames = [];
        const resultsPerPage = 100;
        const pages = Math.ceil(maxResults / resultsPerPage);

        for (let page = 0; page < pages; page++) {
            try {
                const games = await this._fetchSalesPage(page, resultsPerPage);
                if (!games || games.length === 0) break;
                allGames.push(...games);

                if (page < pages - 1) {
                    await this._delay(500);
                }
            } catch (error) {
                console.error(`[Steam Search] Failed to fetch page ${page + 1}:`, error.message);
                break;
            }
        }

        // Fetch USD prices for all games
        const gamesWithUsdPrices = await this._fetchUsdPrices(allGames);
        return this._deduplicateGames(gamesWithUsdPrices);
    }

    async _fetchSalesPage(page, resultsPerPage) {
        const start = page * resultsPerPage;
        // Force US region with cc=us parameter
        const searchUrl = `https://store.steampowered.com/search/results/?query&start=${start}&count=${resultsPerPage}&dynamic_data=&sort_by=_ASC&specials=1&snr=1_7_7_151_7&filter=topsellers&infinite=1&cc=us`;

        const response = await fetch(searchUrl, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': this.userAgent,
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        let data;

        try {
            data = JSON.parse(html);
        } catch {
            throw new Error('Failed to parse response');
        }

        if (!data.results_html) return [];

        return this._parseGamesFromHtml(data.results_html, page);
    }

    _parseGamesFromHtml(html, page) {
        const games = [];

        const gameMatches = [...html.matchAll(/data-ds-appid="(\d+)"/g)];
        const nameMatches = [...html.matchAll(/<span class="title">([^<]+)<\/span>/g)];
        const discountMatches = [...html.matchAll(/<div class="discount_pct">-(\d+)%<\/div>/g)];
        const originalPriceMatches = [...html.matchAll(/<div class="discount_original_price">([^<]+)<\/div>/g)];
        const finalPriceMatches = [...html.matchAll(/<div class="discount_final_price">([^<]+)<\/div>/g)];

        console.log(`[Steam Search] Page ${page + 1}: Found ${gameMatches.length} games`);

        for (let i = 0; i < gameMatches.length; i++) {
            if (!discountMatches[i]) continue;

            const gameId = parseInt(gameMatches[i][1]);
            const gameName = nameMatches[i] ? nameMatches[i][1] : `Game ${gameId}`;
            const discountPercent = parseInt(discountMatches[i][1]);

            // Parse prices - these may be in local currency from HTML
            let originalPrice = 0;
            let finalPrice = 0;

            if (originalPriceMatches[i]) {
                originalPrice = this._parsePrice(originalPriceMatches[i][1]);
            }
            if (finalPriceMatches[i]) {
                finalPrice = this._parsePrice(finalPriceMatches[i][1]);
            }

            games.push({
                id: gameId,
                name: gameName,
                discount_percent: discountPercent,
                original_price: originalPrice,
                final_price: finalPrice,
                needsUsdPrice: true // Flag to fetch USD price
            });
        }

        return games;
    }

    _parsePrice(priceStr) {
        if (!priceStr) return 0;
        // Remove currency symbols and parse number
        const cleaned = priceStr.trim().replace(/[^0-9.,]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    }

    async _fetchUsdPrices(games) {
        if (games.length === 0) return games;

        // Batch fetch USD prices (max 50 at a time due to API limits)
        const batchSize = 50;
        const enrichedGames = [...games];

        for (let i = 0; i < games.length; i += batchSize) {
            const batch = games.slice(i, i + batchSize);
            const appIds = batch.map(g => g.id).join(',');

            try {
                const response = await fetch(
                    `https://store.steampowered.com/api/appdetails?appids=${appIds}&cc=us&filters=price_overview`,
                    {
                        headers: {
                            'User-Agent': this.userAgent,
                            'Accept-Language': 'en-US,en;q=0.9'
                        }
                    }
                );

                if (response.ok) {
                    const data = await response.json();

                    for (const game of batch) {
                        const gameIndex = enrichedGames.findIndex(g => g.id === game.id);
                        if (gameIndex === -1) continue;

                        const appData = data[game.id];
                        if (appData?.success && appData?.data?.price_overview) {
                            const priceInfo = appData.data.price_overview;
                            enrichedGames[gameIndex].original_price = priceInfo.initial / 100;
                            enrichedGames[gameIndex].final_price = priceInfo.final / 100;
                            enrichedGames[gameIndex].discount_percent = priceInfo.discount_percent;
                            enrichedGames[gameIndex].currency = 'USD';
                        }
                    }
                }

                // Rate limit delay
                if (i + batchSize < games.length) {
                    await this._delay(300);
                }
            } catch (error) {
                console.log(`[Steam USD Price] Batch fetch error:`, error.message);
            }
        }

        return enrichedGames;
    }

    _deduplicateGames(games) {
        const uniqueGames = [];
        const seenIds = new Set();

        for (const game of games) {
            if (!seenIds.has(game.id) && game.discount_percent > 0) {
                seenIds.add(game.id);
                uniqueGames.push(game);
            }
        }

        return uniqueGames;
    }

    async fetchFeaturedSales() {
        try {
            // Force US region
            const response = await fetch('https://store.steampowered.com/api/featuredcategories?cc=us&l=english');
            const data = await response.json();

            if (data.specials?.items) {
                return data.specials.items.map(game => ({
                    id: game.id,
                    name: game.name,
                    discount_percent: game.discount_percent,
                    original_price: game.original_price / 100,
                    final_price: game.final_price / 100,
                    currency: 'USD'
                }));
            }

            return [];
        } catch (error) {
            console.error('[Featured API Error]', error.message);
            return [];
        }
    }

    async getSteamSpyData(appId) {
        try {
            const response = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appId}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error(`[SteamSpy Error for ${appId}]`, error.message);
            return null;
        }
    }

    filterGamesByDiscount(games, minDiscount) {
        return games.filter(game => {
            if (minDiscount === 0) {
                return game.discount_percent === 100;
            }
            return game.discount_percent >= minDiscount;
        }).sort((a, b) => b.discount_percent - a.discount_percent);
    }

    formatOwners(ownersString) {
        if (!ownersString) return 'Unknown';
        const parts = ownersString.split('..');
        if (parts.length === 2) {
            const min = parseInt(parts[0].replace(/,/g, '').trim());
            const max = parseInt(parts[1].replace(/,/g, '').trim());
            const avg = Math.floor((min + max) / 2);

            if (avg >= 1000000) return `~${(avg / 1000000).toFixed(1)}M`;
            if (avg >= 1000) return `~${(avg / 1000).toFixed(0)}K`;
            return `~${avg}`;
        }
        return ownersString;
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new SteamService();
