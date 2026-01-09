const { SlashCommandBuilder, EmbedBuilder, ComponentType } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const anilistService = require('../services/anilistService');
const animeRepository = require('../repositories/animeRepository');
const animeHandler = require('../handlers/animeHandler');

// Cache for active anime sessions
const animeSessionCache = new Map();
// Cache for autocomplete results
const autocompleteCache = new Map();
const AUTOCOMPLETE_CACHE_DURATION = 60000; // 1 minute

async function handleAnimeSearch(context, animeName, isSlash = true) {
    try {
        const anime = await anilistService.searchAnime(animeName);
        if (!anime) throw new Error('Anime not found.');

        const userId = isSlash ? context.user.id : context.author.id;
        const title = anime.title.romaji || anime.title.english || anime.title.native;

        let favourited = await animeRepository.isFavourited(userId, anime.id);
        let notifyEnabled = await animeRepository.isNotifyEnabled(userId, anime.id);

        const embed = await animeHandler.createAnimeEmbed(anime);
        const row = animeHandler.createActionRow(userId, anime.id, favourited, notifyEnabled, anime.siteUrl);

        let msg;
        if (isSlash) {
            msg = await context.editReply({ embeds: [embed], components: [row] });
        } else {
            msg = await context.reply({ embeds: [embed], components: [row] });
        }

        // Store session data
        animeSessionCache.set(`${userId}_${anime.id}`, { anime, title, embed });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120 * 1000, // Extended to 2 minutes
            filter: i => i.user.id === userId
        });

        collector.on('collect', async (i) => {
            try {
                await handleButtonInteraction(i, anime, userId, title, embed, msg);
            } catch (error) {
                console.error('[Anime Button Error]', error.message);
                // Don't try to reply if interaction already failed
            }
        });

        collector.on('end', async () => {
            animeSessionCache.delete(`${userId}_${anime.id}`);
            try {
                await msg.edit({ components: [] });
            } catch {}
        });

    } catch (err) {
        console.error('[Anime Search Error]', err);
        const errorMsg = `❌ Could not find anime: **${animeName}**.`;
        if (isSlash) {
            await context.editReply({ content: errorMsg }).catch(() => {});
        } else {
            await context.reply({ content: errorMsg }).catch(() => {});
        }
    }
}

async function handleButtonInteraction(i, anime, userId, title, embed, msg) {
    // Check if this button belongs to this user
    if (!i.customId.includes(`_${userId}_`) && !i.customId.endsWith(`_${userId}`)) {
        try {
            await i.reply({ content: '❌ This button is not for you!', ephemeral: true });
        } catch {}
        return;
    }

    // Always defer first to prevent timeout
    try {
        if (!i.deferred && !i.replied) {
            await i.deferUpdate();
        }
    } catch (error) {
        console.log('[Anime] Interaction already handled or expired');
        return;
    }

    let favourited = await animeRepository.isFavourited(userId, anime.id);
    let notifyEnabled = await animeRepository.isNotifyEnabled(userId, anime.id);

    // Handle favourite button
    if (i.customId.startsWith('anime_fav_')) {
        if (favourited) {
            await animeRepository.removeFavourite(userId, anime.id);
            await animeRepository.disableNotify(userId, anime.id);
            favourited = false;
            notifyEnabled = false;

            const row = animeHandler.createActionRow(userId, anime.id, favourited, notifyEnabled, anime.siteUrl);
            await i.editReply({
                embeds: [EmbedBuilder.from(embed).setColor('#e74c3c').setFooter({ text: 'Removed from favourites ❌' })],
                components: [row]
            }).catch(() => {});
        } else {
            await animeRepository.addFavourite(userId, anime.id, title);
            favourited = true;

            const row = animeHandler.createActionRow(userId, anime.id, favourited, notifyEnabled, anime.siteUrl);
            await i.editReply({
                embeds: [EmbedBuilder.from(embed).setColor('#2ecc71').setFooter({ text: 'Added to favourites ✅' })],
                components: [row]
            }).catch(() => {});

            // Show appropriate follow-up prompt
            if (anime.format === 'MOVIE') {
                await showMoviePrompt(i, anime, userId, title);
            } else {
                await showNotifyPrompt(i, anime, userId, title, embed, msg);
            }
        }
        return;
    }

    // Handle notify toggle button
    if (i.customId.startsWith('anime_notify_') && !i.customId.includes('yes') && !i.customId.includes('no')) {
        if (!favourited) {
            return;
        }

        if (notifyEnabled) {
            await animeRepository.disableNotify(userId, anime.id);
            notifyEnabled = false;
        } else {
            await animeRepository.enableNotify(userId, anime.id);
            notifyEnabled = true;
        }

        const row = animeHandler.createActionRow(userId, anime.id, favourited, notifyEnabled, anime.siteUrl);
        await i.editReply({
            content: notifyEnabled ? '🔔 Notifications enabled.' : '🔕 Stopped notifications.',
            embeds: [embed],
            components: [row]
        }).catch(() => {});
        return;
    }

    // Handle favourite list button
    if (i.customId.startsWith('anime_favlist_')) {
        const favEmbed = await animeHandler.createFavouriteListEmbed(userId, i.user.username);
        await i.followUp({ embeds: [favEmbed], ephemeral: true }).catch(() => {});
        return;
    }
}

async function showMoviePrompt(i, anime, userId, title) {
    const movieRow = animeHandler.createMoviePromptRow(userId, anime.id);

    const movieEmbed = new EmbedBuilder()
        .setTitle(`🎬 Watch ${title}?`)
        .setDescription(`You just added **${title}** to your favourites.\nWould you like to watch this movie?`)
        .setColor('#f1c40f')
        .setThumbnail(anime.coverImage?.large);

    try {
        const prompt = await i.followUp({
            embeds: [movieEmbed],
            components: [movieRow],
            ephemeral: true
        });

        const confirm = await prompt.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30_000,
            filter: btnInt => btnInt.user.id === userId
        });

        if (confirm.customId.includes('watchyes')) {
            await confirm.update({
                embeds: [new EmbedBuilder()
                    .setTitle('🍿 Enjoy the movie!')
                    .setDescription(`Have fun watching **${title}** 🎥`)
                    .setColor('#2ecc71')],
                components: []
            });
        } else {
            await confirm.update({
                embeds: [new EmbedBuilder()
                    .setTitle('👌 Maybe later')
                    .setDescription(`You can always watch **${title}** whenever you like!`)
                    .setColor('#95a5a6')],
                components: []
            });
        }
    } catch {
        // Timeout - silently ignore
    }
}

async function showNotifyPrompt(i, anime, userId, title, embed, msg) {
    const notifyRow = animeHandler.createNotifyPromptRow(userId, anime.id);

    const notifyEmbed = new EmbedBuilder()
        .setTitle('🔔 Notifications')
        .setDescription(`Would you like to be notified when new episodes of **${title}** release?`)
        .setColor('#3498db')
        .setThumbnail(anime.coverImage?.large);

    try {
        const prompt = await i.followUp({
            embeds: [notifyEmbed],
            components: [notifyRow],
            ephemeral: true
        });

        const confirm = await prompt.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30_000,
            filter: btnInt => btnInt.user.id === userId
        });

        if (confirm.customId.includes('notifyyes')) {
            await animeRepository.enableNotify(userId, anime.id);

            const nextSeason = await anilistService.findNextOngoingSeason(anime.id);
            if (nextSeason && nextSeason.id !== anime.id) {
                await animeRepository.enableNotify(userId, nextSeason.id);
                await i.followUp({
                    embeds: [animeHandler.createNotificationEmbed(
                        nextSeason.title.english || nextSeason.title.romaji,
                        'nextSeason'
                    )],
                    ephemeral: true
                }).catch(() => {});
            } else if (anime.status !== 'RELEASING' && !nextSeason) {
                await i.followUp({
                    embeds: [animeHandler.createNotificationEmbed(title, 'noSeason')],
                    ephemeral: true
                }).catch(() => {});
            }

            await confirm.update({
                embeds: [animeHandler.createNotificationEmbed(title, 'enabled')],
                components: []
            });

            // Update main message
            const favourited = await animeRepository.isFavourited(userId, anime.id);
            const row = animeHandler.createActionRow(userId, anime.id, favourited, true, anime.siteUrl);
            if (msg.editable) {
                await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
            }
        } else {
            await confirm.update({
                embeds: [animeHandler.createNotificationEmbed(title, 'disabled')],
                components: []
            });
        }
    } catch {
        // Timeout - silently ignore
    }
}

async function notifyUsers(client) {
    try {
        const notifications = await animeRepository.getEnabledNotifications();
        if (!notifications.length) return;

        for (const row of notifications) {
            try {
                const anime = await anilistService.getAnimeById(row.anime_id);
                if (!anime?.nextAiringEpisode) continue;

                const now = Math.floor(Date.now() / 1000);
                const delta = anime.nextAiringEpisode.airingAt - now;

                let message = null;

                if (delta < 3600 && delta > 0) {
                    message = `⏰ A new episode of **${anime.title.romaji}** (Ep ${anime.nextAiringEpisode.episode}) airs in less than 1 hour!`;
                } else if (anime.nextAiringEpisode.episode === anime.episodes && delta > 0 && delta < 86400) {
                    message = `🔥 The **final episode** of **${anime.title.romaji}** (Ep ${anime.nextAiringEpisode.episode}) airs within 24 hours!`;
                }

                if (message) {
                    try {
                        const user = await client.users.fetch(row.user_id);
                        await user.send(message);
                        console.log(`[Anime Notify] Sent DM to ${user.tag}`);
                    } catch (dmErr) {
                        console.warn(`[Anime Notify] Failed to DM user ${row.user_id}: ${dmErr.message}`);
                    }
                }

            } catch (e) {
                console.error('[Anime Notify] Error:', e.message);
            }
        }
    } catch (err) {
        console.error('[Anime Notify] Failed to fetch notifications:', err);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anime')
        .setDescription('Search for an anime')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Anime name')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();

        if (!focused || focused.length < 2) {
            return interaction.respond([]).catch(() => {});
        }

        try {
            // Check cache first
            const cacheKey = focused.toLowerCase();
            const cached = autocompleteCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < AUTOCOMPLETE_CACHE_DURATION) {
                return interaction.respond(cached.choices).catch(() => {});
            }

            // Set timeout for autocomplete (must respond within 3 seconds)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 2500)
            );

            const searchPromise = anilistService.searchAnimeAutocomplete(focused, 10);
            const results = await Promise.race([searchPromise, timeoutPromise]);

            const choices = results.map(anime => {
                const title = anime.title.english || anime.title.romaji || anime.title.native;
                const year = anime.seasonYear ? ` (${anime.seasonYear})` : '';
                const format = anime.format ? ` [${anime.format}]` : '';
                const score = anime.averageScore ? ` ⭐${anime.averageScore}` : '';
                
                const displayName = `${title}${year}${format}${score}`.slice(0, 100);
                
                return {
                    name: displayName,
                    value: (anime.title.romaji || anime.title.english || anime.title.native).slice(0, 100)
                };
            });

            // Cache the results
            autocompleteCache.set(cacheKey, {
                choices,
                timestamp: Date.now()
            });

            await interaction.respond(choices).catch(() => {});
        } catch (error) {
            console.log('[Anime Autocomplete] Timeout or error');
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        // Access control check
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const animeName = interaction.options.getString('name');
        await interaction.deferReply();
        await handleAnimeSearch(interaction, animeName, true);
    },

    async onMessage(message) {
        if (!message.content.startsWith('!anime ')) return;
        const animeName = message.content.slice(7).trim();
        if (!animeName) {
            await message.reply('Please provide an anime name.');
            return;
        }
        await handleAnimeSearch(message, animeName, false);
    },

    notifyUsers,
    handleAnimeSearch
};
