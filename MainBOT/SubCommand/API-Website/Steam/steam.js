const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

const { maintenance, developerID } = require("../../../MainCommand/Configuration/Maintenance/maintenanceConfig.js");
const { isBanned } = require("../../../MainCommand/Administrator/BannedList/BanUtils.js");

// Optional: Add your Steam Web API key here (get it from https://steamcommunity.com/dev/apikey)
const STEAM_API_KEY = process.env.STEAM_API_KEY || '';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steam')
        .setDescription('Steam game utilities')
        .addSubcommand(subcommand =>
            subcommand
                .setName('sale')
                .setDescription('Find games on sale with a minimum discount percentage')
                .addIntegerOption(option =>
                    option
                        .setName('discount')
                        .setDescription('Minimum discount percentage (0-100, 0 = free games)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)
                )
                .addBooleanOption(option =>
                    option
                        .setName('detailed')
                        .setDescription('Show detailed info (owners, ratings) from SteamSpy')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        // Check for bans and maintenance
        const banData = await isBanned(interaction.user.id);

        if ((maintenance === "yes" && interaction.user.id !== developerID) || banData) {
            let description = '';
            let footerText = '';

            if (maintenance === "yes" && interaction.user.id !== developerID) {
                description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
                footerText = "Thank you for your patience";
            } else if (banData) {
                description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

                if (banData.expiresAt) {
                    const remaining = banData.expiresAt - Date.now();
                    const seconds = Math.floor((remaining / 1000) % 60);
                    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

                    const timeString = [
                        days ? `${days}d` : '',
                        hours ? `${hours}h` : '',
                        minutes ? `${minutes}m` : '',
                        seconds ? `${seconds}s` : ''
                    ].filter(Boolean).join(' ');

                    description += `\n**Time Remaining:** ${timeString}`;
                } else {
                    description += `\n**Ban Type:** Permanent`;
                }

                footerText = "Ban enforced by developer";
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                .setDescription(description)
                .setFooter({ text: footerText })
                .setTimestamp();

            console.log(`[${new Date().toISOString()}] Blocked user (${interaction.user.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Handle subcommands
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'sale') {
            await handleSaleCommand(interaction);
        }
    }
};

// Fetch game details from SteamSpy
async function getSteamSpyData(appId) {
    try {
        const response = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appId}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`[SteamSpy Error for ${appId}]`, error.message);
        return null;
    }
}

// Fetch USD price details from Steam Store API
async function getUSDPriceDetails(appId) {
    try {
        const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&filters=price_overview`);
        if (!response.ok) return null;
        const data = await response.json();

        if (data[appId]?.success && data[appId]?.data?.price_overview) {
            const priceData = data[appId].data.price_overview;
            return {
                currency: priceData.currency,
                initial: priceData.initial / 100, // Convert cents to dollars
                final: priceData.final / 100,
                discount_percent: priceData.discount_percent
            };
        }
        return null;
    } catch (error) {
        console.error(`[Price API Error for ${appId}]`, error.message);
        return null;
    }
}

// Format owners count from SteamSpy
function formatOwners(ownersString) {
    if (!ownersString) return 'Unknown';
    const parts = ownersString.split('..');
    if (parts.length === 2) {
        const min = parseInt(parts[0].replace(/,/g, '').trim());
        const max = parseInt(parts[1].replace(/,/g, '').trim());
        const avg = Math.floor((min + max) / 2);

        if (avg >= 1000000) {
            return `~${(avg / 1000000).toFixed(1)}M`;
        } else if (avg >= 1000) {
            return `~${(avg / 1000).toFixed(0)}K`;
        }
        return `~${avg}`;
    }
    return ownersString;
}

async function handleSaleCommand(interaction) {
    const minDiscount = interaction.options.getInteger('discount');
    const showDetailed = interaction.options.getBoolean('detailed') || false;

    await interaction.deferReply();

    try {
        await interaction.editReply({ content: '🔍 Searching Steam store for games on sale...' });

        // Use Steam Search/Browse API to get TONS of games on sale
        let allGames = [];

        // METHOD: Steam search with specials filter (this can return 100s of games)
        try {
            // Fetch multiple pages of results
            const maxResults = 300; // Fetch up to 300 games
            const resultsPerPage = 100;
            const pages = Math.ceil(maxResults / resultsPerPage);

            for (let page = 0; page < pages; page++) {
                const start = page * resultsPerPage;

                // Steam search API with specials filter
                const searchUrl = `https://store.steampowered.com/search/results/?query&start=${start}&count=${resultsPerPage}&dynamic_data=&sort_by=_ASC&specials=1&snr=1_7_7_151_7&filter=topsellers&infinite=1`;

                const response = await fetch(searchUrl, {
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                if (!response.ok) {
                    console.log(`[Steam Search] Failed to fetch page ${page + 1}`);
                    break;
                }

                const html = await response.text();

                // Parse the JSON from the response
                let data;
                try {
                    data = JSON.parse(html);
                } catch (e) {
                    console.log(`[Steam Search] Failed to parse page ${page + 1}`);
                    break;
                }

                if (!data.results_html) break;

// DEBUG: Log a sample of the HTML to see the actual structure
                if (page === 0) {
                    const sampleHTML = data.results_html.substring(0, 3000);
                    console.log(`[DEBUG] Sample HTML structure:\n${sampleHTML}\n`);
                }
                
                // Extract game data from HTML using regex - IMPROVED PATTERNS
                const gameMatches = [...data.results_html.matchAll(/data-ds-appid="(\d+)"/g)];
                const nameMatches = [...data.results_html.matchAll(/<span class="title">([^<]+)<\/span>/g)];
                const discountMatches = [...data.results_html.matchAll(/<div class="discount_pct">-(\d+)%<\/div>/g)];
                
                // More flexible price patterns that handle various formats
                const originalPriceMatches = [...data.results_html.matchAll(/<div class="discount_original_price">([^<]+)<\/div>/g)];
                const finalPriceMatches = [...data.results_html.matchAll(/<div class="discount_final_price">([^<]+)<\/div>/g)];
                
                console.log(`[Steam Search] Page ${page + 1}: Parsing results...`);
                console.log(`  - Found ${gameMatches.length} game IDs`);
                console.log(`  - Found ${nameMatches.length} game names`);
                console.log(`  - Found ${discountMatches.length} discounts`);
                console.log(`  - Found ${originalPriceMatches.length} original prices`);
                console.log(`  - Found ${finalPriceMatches.length} final prices`);
                
                // DEBUG: Show first few price matches
                if (page === 0 && originalPriceMatches.length > 0) {
                    console.log(`[DEBUG] First 3 original prices: ${originalPriceMatches.slice(0, 3).map(m => m[1]).join(', ')}`);
                    console.log(`[DEBUG] First 3 final prices: ${finalPriceMatches.slice(0, 3).map(m => m[1]).join(', ')}`);
                }
                
                for (let i = 0; i < gameMatches.length; i++) {
                    const gameId = parseInt(gameMatches[i][1]);
                    const gameName = nameMatches[i] ? nameMatches[i][1] : `Game ${gameId}`;
                    
                    if (discountMatches[i] && originalPriceMatches[i] && finalPriceMatches[i]) {
                        // Parse prices - handle different formats
                        let originalPrice = originalPriceMatches[i][1].trim();
                        let finalPrice = finalPriceMatches[i][1].trim();
                        
                        // Remove currency symbols and extract numbers
                        originalPrice = parseFloat(originalPrice.replace(/[^0-9.]/g, ''));
                        finalPrice = parseFloat(finalPrice.replace(/[^0-9.]/g, ''));
                        
                        // Handle "Free" games
                        if (isNaN(finalPrice) || finalPrice === 0) {
                            finalPrice = 0;
                        }
                        
                        const gameData = {
                            id: gameId,
                            name: gameName,
                            discount_percent: parseInt(discountMatches[i][1]),
                            original_price: originalPrice,
                            final_price: finalPrice
                        };
                        
                        // fix price remember 

                        console.log(`  ✓ Game ${i + 1}: [${gameId}] ${gameName} - ${gameData.discount_percent}% off (${gameData.original_price} → ${gameData.final_price})`);
                        allGames.push(gameData);
                    } else {
                        console.log(`  ✗ Game ${i + 1}: [${gameId}] ${gameName} - MISSING DATA (discount: ${!!discountMatches[i]}, orig: ${!!originalPriceMatches[i]}, final: ${!!finalPriceMatches[i]})`);
                        
                        // DEBUG: Show what we got for this game
                        if (page === 0 && i < 3) {
                            console.log(`     DEBUG - Discount: ${discountMatches[i] ? discountMatches[i][1] : 'NONE'}`);
                            console.log(`     DEBUG - Original: ${originalPriceMatches[i] ? originalPriceMatches[i][1] : 'NONE'}`);
                            console.log(`     DEBUG - Final: ${finalPriceMatches[i] ? finalPriceMatches[i][1] : 'NONE'}`);
                        }
                    }
                }
                
                console.log(`[Steam Search] Page ${page + 1}: Successfully parsed ${allGames.length - (page * resultsPerPage)} games from this page`);

                // Small delay between pages
                if (page < pages - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } catch (error) {
            console.log('[Steam Search API Error]', error.message);
        }

        // Fallback: If search fails, use featured API
        if (allGames.length === 0) {
            try {
                const featuredResponse = await fetch('https://store.steampowered.com/api/featuredcategories?cc=us&l=english');
                const featuredData = await featuredResponse.json();

                if (featuredData.specials?.items) {
                    allGames = featuredData.specials.items.map(game => ({
                        id: game.id,
                        name: game.name,
                        discount_percent: game.discount_percent,
                        original_price: game.original_price / 100,
                        final_price: game.final_price / 100
                    }));
                }
            } catch (error) {
                console.log('[Featured API Error]', error.message);
            }
        }

        // Remove duplicates
        const uniqueGames = [];
        const seenIds = new Set();
        for (const game of allGames) {
            if (!seenIds.has(game.id) && game.discount_percent > 0) {
                seenIds.add(game.id);
                uniqueGames.push(game);
            }
        }
        allGames = uniqueGames;

        console.log(`[Steam Sale] Found ${allGames.length} total games on sale before filtering`);

        if (allGames.length === 0) {
            return interaction.editReply({
                content: '❌ Unable to fetch Steam sales data. Please try again later.',
                ephemeral: true
            });
        }

        // Filter games by discount percentage
        let filteredGames = allGames.filter(game => {
            if (minDiscount === 0) {
                return game.discount_percent === 100;
            } else {
                return game.discount_percent >= minDiscount;
            }
        });

        // Sort by discount percentage (highest first)
        filteredGames.sort((a, b) => b.discount_percent - a.discount_percent);

        console.log(`[Steam Sale] ${filteredGames.length} games match ${minDiscount}% discount filter`);

        if (filteredGames.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#1b2838')
                .setTitle('🎮 No Games Found')
                .setDescription(minDiscount === 0
                    ? 'No games are currently free (100% off).'
                    : `No games found with at least ${minDiscount}% discount.`)
                .setFooter({ text: 'Try a lower discount percentage' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // Since we already have prices from search, we don't need to fetch them again
        // But we'll verify they're in USD format and structure them properly
        const enrichedGames = filteredGames.map(game => ({
            ...game,
            usdPrice: {
                currency: 'USD',
                initial: game.original_price,
                final: game.final_price,
                discount_percent: game.discount_percent
            }
        }));

        console.log(`[Steam Sale] Processing ${enrichedGames.length} games with prices`);

        if (enrichedGames.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#1b2838')
                .setTitle('🎮 No Games Found')
                .setDescription('Unable to fetch USD prices. Please try again later.')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], components: [] });
        }

        filteredGames = enrichedGames;

        // If detailed mode, fetch SteamSpy data
        if (showDetailed) {
            await interaction.editReply({ content: '📊 Fetching detailed stats from SteamSpy...' });

            const gamesToEnrich = filteredGames.slice(0, 15);
            for (let game of gamesToEnrich) {
                const spyData = await getSteamSpyData(game.id);
                if (spyData) {
                    game.owners = spyData.owners;
                    game.positive = spyData.positive;
                    game.negative = spyData.negative;
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // Pagination setup
        const ITEMS_PER_PAGE = 5;
        const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE);
        let currentPage = 0;

        // Function to generate embed for current page
        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const gamesOnPage = filteredGames.slice(start, end);

            const embed = new EmbedBuilder()
                .setColor('#1b2838')
                .setTitle(minDiscount === 0 ? '🆓 Free Games on Steam' : `💰 Steam Games (${minDiscount}%+ Off)`)
                .setDescription(
                    minDiscount === 0
                        ? `Games that are currently free! (Page ${page + 1}/${totalPages})`
                        : `Found ${filteredGames.length} game(s) with ${minDiscount}% or more discount (Page ${page + 1}/${totalPages})`
                )
                .setTimestamp()
                .setFooter({
                    text: `Steam Deal Hunter • Prices in USD • Page ${page + 1}/${totalPages}${showDetailed && page === 0 ? ' • Enhanced with SteamSpy' : ''}`
                });

            // Add fields for games on current page
            gamesOnPage.forEach(game => {
                const originalPrice = game.usdPrice.initial.toFixed(2);
                const finalPrice = game.usdPrice.final.toFixed(2);
                const discount = game.usdPrice.discount_percent;

                let priceText = '';
                if (discount === 100 || finalPrice === '0.00') {
                    priceText = `~~$${originalPrice}~~ → **FREE** (100% OFF)`;
                } else {
                    priceText = `~~$${originalPrice}~~ → **$${finalPrice}** (${discount}% OFF)`;
                }

                let additionalInfo = '';

                // Add SteamSpy data if available
                if (showDetailed && game.owners) {
                    const totalReviews = (game.positive || 0) + (game.negative || 0);
                    const rating = totalReviews > 0
                        ? Math.round((game.positive / totalReviews) * 100)
                        : 0;

                    additionalInfo += `\n📊 Owners: ${formatOwners(game.owners)}`;
                    if (totalReviews > 0) {
                        const emoji = rating >= 80 ? '👍' : rating >= 60 ? '👌' : '👎';
                        additionalInfo += ` | ${emoji} ${rating}% (${totalReviews.toLocaleString()} reviews)`;
                    }
                }

                embed.addFields({
                    name: `${game.name}`,
                    value: `${priceText}${additionalInfo}\n[View on Steam](https://store.steampowered.com/app/${game.id})`,
                    inline: false
                });
            });

            return embed;
        };

        // Function to generate buttons
        const generateButtons = (page) => {
            const row = new ActionRowBuilder();

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('◀ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0)
            );

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('page_info')
                    .setLabel(`Page ${page + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages - 1)
            );

            return row;
        };

        // Send initial message with buttons
        const embed = generateEmbed(currentPage);
        const message = totalPages > 1
            ? await interaction.editReply({ content: null, embeds: [embed], components: [generateButtons(currentPage)] })
            : await interaction.editReply({ content: null, embeds: [embed] });

        if (totalPages <= 1) return;

        // Create button collector
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                return buttonInteraction.reply({
                    content: '❌ This is not your command! Run `/steam sale` yourself.',
                    ephemeral: true
                });
            }

            if (buttonInteraction.customId === 'prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (buttonInteraction.customId === 'next') {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            }

            await buttonInteraction.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('◀ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('page_info')
                    .setLabel(`Page ${currentPage + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true)
            );

            message.edit({ components: [disabledRow] }).catch(() => { });
        });

    } catch (error) {
        console.error('[Steam Sale Command Error]', error);
        return interaction.editReply({
            content: '❌ An error occurred while fetching Steam sales. Please try again later.',
            ephemeral: true
        });
    }
}