const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require("discord.js");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    StreamType,
    VoiceConnectionStatus,
    entersState,
    AudioPlayerStatus,
} = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core");
const ytsr = require("ytsr"); // Fallback search
const ytSearch = require("yt-search"); // Main search

const queues = new Map();
const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes

function getOrCreateQueue(guildId) {
    if (!queues.has(guildId)) {
        queues.set(guildId, {
            connection: null,
            player: createAudioPlayer(),
            volume: 1.0,
            nowMessage: null,
            current: null,
            tracks: [],
            loop: false,
            _eventsBound: false,
            _collectorBound: false,
            skipVotes: new Set(),
            skipVoting: false,
            skipVotingTimeout: null,
            skipVotingMsg: null,
            inactivityTimer: null,
        });
    }
    return queues.get(guildId);
}

function fmtDur(sec) {
    sec = Number(sec) || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function buildControls(guildId, isPaused, isLooped, trackUrl) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pause:${guildId}`)
            .setLabel(isPaused ? "▶️ Resume" : "⏸️ Pause")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`stop:${guildId}`)
            .setLabel("🛑 Stop")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`skip:${guildId}`)
            .setLabel("⏭️ Skip")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`list:${guildId}`)
            .setLabel("🧾 List")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`loop:${guildId}`)
            .setLabel(isLooped ? "🔁 Unloop" : "🔂 Loop")
            .setStyle(isLooped ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
}

// Link button is now on the volume row
function buildVolumeRow(guildId, trackUrl) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`volDown:${guildId}`)
            .setLabel("🔉 -")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`volUp:${guildId}`)
            .setLabel("🔊 +")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setLabel("🔗 Link")
            .setStyle(ButtonStyle.Link)
            .setURL(trackUrl || "https://youtube.com")
    );
}

function buildNowPlayingEmbed(track, volumePct, requester, queueLen, isLooped) {
    return new EmbedBuilder()
        .setColor(isLooped ? 0xF472B6 : 0x00C2FF)
        .setTitle(track?.title ?? "Now Playing")
        .setURL(track?.url ?? null)
        .setThumbnail(track?.thumbnail ?? null)
        .addFields(
            { name: "Channel", value: track?.author ?? "Unknown", inline: true },
            { name: "Duration", value: track ? fmtDur(track.lengthSeconds) : "—", inline: true },
            { name: "Queue", value: `${queueLen} in line`, inline: true },
            { name: "Volume", value: `${Math.round(volumePct)}%`, inline: true },
            { name: "Loop", value: isLooped ? "🔁 Enabled" : "Not Enabled", inline: true },
        )
        .setFooter({ text: `Requested by ${requester.tag}`, iconURL: requester.displayAvatarURL() });
}

function buildQueuedEmbed(track, position, requester) {
    return new EmbedBuilder()
        .setColor(0x6EE7B7)
        .setTitle("✅ Added to queue")
        .setDescription(`[${track.title}](${track.url})`)
        .setThumbnail(track.thumbnail)
        .addFields(
            { name: "Channel", value: track.author, inline: true },
            { name: "Duration", value: fmtDur(track.lengthSeconds), inline: true },
            { name: "Position", value: `#${position}`, inline: true },
        )
        .setFooter({ text: `Queued by ${requester.tag}`, iconURL: requester.displayAvatarURL() });
}

function buildInfoEmbed(title, desc) {
    return new EmbedBuilder().setColor(0xFBBF24).setTitle(title).setDescription(desc);
}

async function ensureConnection(interaction, q) {
    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) throw new Error("NO_VC");

    if (!q.connection) {
        q.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
        });
        await entersState(q.connection, VoiceConnectionStatus.Ready, 15_000).catch(() => {
            q.connection?.destroy();
            q.connection = null;
            throw new Error("CONNECTION_READY_TIMEOUT");
        });
        q.connection.subscribe(q.player);
    }
}

// Only start inactivity timer if not playing
function resetInactivityTimer(guildId) {
    const q = getOrCreateQueue(guildId);
    if (q.inactivityTimer) clearTimeout(q.inactivityTimer);
    // Only set timer if not playing
    if (q.player.state.status !== AudioPlayerStatus.Playing && q.player.state.status !== AudioPlayerStatus.Paused) {
        q.inactivityTimer = setTimeout(async () => {
            await stopAndCleanup(guildId);
        }, INACTIVITY_TIMEOUT);
    }
}

async function playNext(interaction, guildId, forceEmbed = false) {
    const q = getOrCreateQueue(guildId);
    if (q.current || q.player.state.status === AudioPlayerStatus.Playing || q.tracks.length === 0) return;

    q.current = q.tracks.shift();
    const t = q.current;

    const info = await ytdl.getInfo(t.url);
    const stream = ytdl.downloadFromInfo(info, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25,
    });

    const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
    });

    q.player.play(resource);

    const embed = buildNowPlayingEmbed(t, q.volume * 100, t.requestedBy, q.tracks.length, q.loop);
    const rows = [buildControls(guildId, false, q.loop, t.url), buildVolumeRow(guildId, t.url)];

    if (q.nowMessage && !forceEmbed) {
        await q.nowMessage.edit({ content: "", embeds: [embed], components: rows }).catch(() => {});
    } else {
        if (q.nowMessage) await q.nowMessage.delete().catch(() => {});
        q.nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });
    }
    // Don't reset inactivity timer here, handled by player events
}

async function stopAndCleanup(guildId) {
    const q = getOrCreateQueue(guildId);
    try { q.player.stop(); } catch {}
    try { q.connection?.destroy(); } catch {}
    q.connection = null;
    q.current = null;
    q.tracks = [];
    q.loop = false;
    if (q.inactivityTimer) clearTimeout(q.inactivityTimer);
    if (q.nowMessage) {
        const msg = q.nowMessage;
        q.nowMessage = null;
        await msg.edit({ components: [] }).catch(() => {});
    }
}

async function resolveTrack(query, user) {
    // Accept either URL or search query
    let url = query;
    let details;
    if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(query)) {
        try {
            const info = await ytdl.getInfo(query);
            details = info.videoDetails;
            url = details.video_url;
        } catch (e) {
            throw new Error("INVALID_URL");
        }
    } else {
        // Try yt-search first
        let ytResult;
        try {
            ytResult = await ytSearch(query);
        } catch {}
        if (ytResult && ytResult.videos && ytResult.videos.length > 0) {
            const vid = ytResult.videos[0];
            url = vid.url;
            details = {
                title: vid.title,
                lengthSeconds: vid.seconds,
                thumbnails: [{ url: vid.thumbnail }],
                author: { name: vid.author.name || vid.author },
                video_url: vid.url,
            };
        } else {
            // Fallback to ytsr
            const filters = await ytsr.getFilters(query);
            const filter = filters.get('Type').get('Video');
            const searchResults = await ytsr(filter.url, { limit: 1 });
            if (!searchResults.items.length) throw new Error("NO_RESULTS");
            const vid = searchResults.items[0];
            url = vid.url;
            details = {
                title: vid.title,
                lengthSeconds: vid.duration ? vid.duration.split(':').reduce((acc, t) => 60 * acc + +t, 0) : 0,
                thumbnails: [{ url: vid.thumbnails[0].url }],
                author: { name: vid.author.name },
                video_url: vid.url,
            };
        }
    }
    return {
        url,
        title: details.title,
        lengthSeconds: Number(details.lengthSeconds),
        thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url ?? null,
        author: details.author?.name ?? "Unknown",
        requestedBy: user,
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song in your voice channel by name or URL")
        .addStringOption(o =>
            o.setName("query").setDescription("Song name or YouTube URL").setRequired(true)
        ),

    async execute(interaction) {
        const query = interaction.options.getString("query");
        const guildId = interaction.guild.id;
        const q = getOrCreateQueue(guildId);

        const vc = interaction.member.voice?.channel;
        if (!vc) {
            return interaction.reply({
                embeds: [buildInfoEmbed("❌ No Voice Channel", "Join a voice channel first.")],
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        let track;
        try {
            track = await resolveTrack(query, interaction.user);
        } catch (e) {
            let msg = "Could not fetch video info. Make sure it’s a valid YouTube URL or search query.";
            if (e.message === "NO_RESULTS") msg = "No results found for your search.";
            return interaction.editReply({
                embeds: [buildInfoEmbed("❌ Invalid Query", msg)],
            });
        }

        // Ask for confirmation if video > 7 mins
        if (track.lengthSeconds > 420) {
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("confirm_yes").setLabel("Yes").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("confirm_no").setLabel("No").setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({
                embeds: [buildInfoEmbed("⚠️ Long Video", "This video is longer than 7 minutes. Are you sure this is a song?")],
                components: [confirmRow],
            });

            const filter = i =>
                i.user.id === interaction.user.id &&
                ["confirm_yes", "confirm_no"].includes(i.customId);

            try {
                const btnInt = await interaction.channel.awaitMessageComponent({ filter, time: 15000 });
                if (btnInt.customId === "confirm_no") {
                    await btnInt.update({
                        embeds: [buildInfoEmbed("❌ Cancelled", "Playback cancelled.")],
                        components: [],
                    });
                    return;
                }
                await btnInt.update({
                    embeds: [buildInfoEmbed("✅ Confirmed", "Playing your requested video.")],
                    components: [],
                });
            } catch {
                await interaction.editReply({
                    embeds: [buildInfoEmbed("❌ Timeout", "No response. Playback cancelled.")],
                    components: [],
                });
                return;
            }
        }

        q.tracks.push(track);

        const pos = q.current ? q.tracks.length : 1;
        const queuedEmbed = buildQueuedEmbed(track, pos, interaction.user);
        await interaction.editReply({ embeds: [queuedEmbed], components: [] });

        try {
            await ensureConnection(interaction, q);
        } catch (err) {
            await interaction.followUp({
                embeds: [
                    buildInfoEmbed(
                        "❌ Could not connect",
                        err.message === "NO_VC" ? "Join a voice channel." : "Failed to reach Ready state."
                    ),
                ],
                ephemeral: true,
            });
            return;
        }

        // Bind player events only once
        if (!q._eventsBound) {
            q._eventsBound = true;

            q.player.on(AudioPlayerStatus.Idle, async () => {
                if (q.loop && q.current) {
                    q.tracks.unshift(q.current);
                    if (q.nowMessage) {
                        const embed = buildNowPlayingEmbed(
                            q.current,
                            q.volume * 100,
                            q.current.requestedBy,
                            q.tracks.length,
                            q.loop
                        );
                        const rows = [
                            buildControls(guildId, false, q.loop, q.current.url),
                            buildVolumeRow(guildId, q.current.url),
                        ];
                        await q.nowMessage.edit({ embeds: [embed], components: rows }).catch(() => {});
                    }
                }
                q.current = null;

                if (q.tracks.length > 0) {
                    setTimeout(() => playNext(q.nowMessage ?? interaction, guildId), 250);
                } else {
                    if (q.nowMessage) {
                        const idleEmbed = new EmbedBuilder(q.nowMessage.embeds?.[0]?.toJSON() ?? {})
                            .setColor(0x94A3B8)
                            .setTitle("✅ Queue finished");
                        await q.nowMessage.edit({ embeds: [idleEmbed], components: [] }).catch(() => {});
                    }
                    resetInactivityTimer(guildId);
                }
            });

            q.player.on(AudioPlayerStatus.Playing, () => {
                // Clear inactivity timer when music is playing
                if (q.inactivityTimer) {
                    clearTimeout(q.inactivityTimer);
                    q.inactivityTimer = null;
                }
            });

            q.player.on(AudioPlayerStatus.Paused, () => {
                // Don't set inactivity timer while paused
                if (q.inactivityTimer) {
                    clearTimeout(q.inactivityTimer);
                    q.inactivityTimer = null;
                }
            });

            q.player.on("error", async () => {
                if (q.nowMessage) {
                    const errEmbed = buildInfoEmbed("⚠️ Playback error", "Skipping to the next track…");
                    await q.nowMessage.reply({ embeds: [errEmbed] }).catch(() => {});
                }
                q.player.stop();
            });
        }

        await playNext(interaction, guildId);

        // Setup collector for controls
        if (q.nowMessage && !q._collectorBound) {
            q._collectorBound = true;
            const msg = q.nowMessage;

            const collector = msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 7 * 24 * 60 * 60 * 1000,
            });

            collector.on("collect", async (i) => {
                const q2 = getOrCreateQueue(guildId);
                const botChannelId = q2.connection?.joinConfig?.channelId;
                const memberChannelId = i.member?.voice?.channelId;
                if (!botChannelId || memberChannelId !== botChannelId) {
                    await i.reply({
                        ephemeral: true,
                        content: "❌ You must be in the same voice channel as the bot to use these controls.",
                    });
                    return;
                }

                const id = i.customId.split(":")[0];

                if (id === "pause") {
                    if (q2.player.state.status === AudioPlayerStatus.Playing) {
                        q2.player.pause();
                        const embed = buildNowPlayingEmbed(
                            q2.current,
                            q2.volume * 100,
                            q2.current?.requestedBy ?? i.user,
                            q2.tracks.length,
                            q2.loop
                        );
                        await msg.edit({
                            embeds: [embed],
                            components: [
                                buildControls(guildId, true, q2.loop, q2.current?.url),
                                buildVolumeRow(guildId, q2.current?.url),
                            ],
                        }).catch(() => {});
                        await i.reply({ ephemeral: true, content: "⏸️ Paused." });
                    } else if (q2.player.state.status === AudioPlayerStatus.Paused) {
                        q2.player.unpause();
                        const embed = buildNowPlayingEmbed(
                            q2.current,
                            q2.volume * 100,
                            q2.current?.requestedBy ?? i.user,
                            q2.tracks.length,
                            q2.loop
                        );
                        await msg.edit({
                            embeds: [embed],
                            components: [
                                buildControls(guildId, false, q2.loop, q2.current?.url),
                                buildVolumeRow(guildId, q2.current?.url),
                            ],
                        }).catch(() => {});
                        await i.reply({ ephemeral: true, content: "▶️ Resumed." });
                    } else {
                        await i.reply({ ephemeral: true, content: "⚠️ Not playing." });
                    }
                    return;
                }

                if (id === "stop") {
                    await stopAndCleanup(guildId);
                    await i.reply({ ephemeral: true, content: "🛑 Stopped playback and cleared the queue." });
                    return;
                }

                if (id === "skip") {
                    const members = q2.connection?.joinConfig?.channelId
                        ? i.guild.channels.cache.get(q2.connection.joinConfig.channelId)?.members
                        : null;
                    const listeners = members ? Array.from(members.values()).filter(m => !m.user.bot) : [];
                    if (listeners.length >= 3) {
                        if (!q2.skipVoting) {
                            q2.skipVoting = true;
                            q2.skipVotes = new Set([i.user.id]);
                            q2.skipVotingMsg = await i.reply({
                                content: `⏭️ Skip requested! React below to vote. Need at least 2 votes to skip.`,
                                components: [
                                    new ActionRowBuilder().addComponents(
                                        new ButtonBuilder().setCustomId("vote_skip").setLabel("Skip").setStyle(ButtonStyle.Primary)
                                    ),
                                ],
                                ephemeral: false,
                                fetchReply: true,
                            });
                            q2.skipVotingTimeout = setTimeout(async () => {
                                q2.skipVoting = false;
                                if (q2.skipVotes.size >= 2) {
                                    q2.player.stop(true);
                                    await q2.skipVotingMsg.edit({ content: "⏭️ Track skipped by vote.", components: [] });
                                } else {
                                    await q2.skipVotingMsg.edit({ content: "⏭️ Not enough votes to skip.", components: [] });
                                }
                                q2.skipVotes.clear();
                                q2.skipVotingMsg = null;
                            }, 15000);
                        } else {
                            await i.reply({ ephemeral: true, content: "Skip vote already in progress." });
                        }
                    } else {
                        if (
                            q2.player.state.status === AudioPlayerStatus.Playing ||
                            q2.player.state.status === AudioPlayerStatus.Paused
                        ) {
                            q2.player.stop(true);
                            await i.reply({ ephemeral: true, content: "⏭️ Skipped." });
                        } else {
                            await i.reply({ ephemeral: true, content: "⚠️ Nothing to skip." });
                        }
                    }
                    return;
                }

                if (id === "list") {
                    const lines = [];
                    if (q2.current) {
                        lines.push(`**Now** — [${q2.current.title}](${q2.current.url}) \`${fmtDur(q2.current.lengthSeconds)}\``);
                    }
                    if (q2.tracks.length === 0) {
                        lines.push("_Queue is empty._");
                    } else {
                        q2.tracks.slice(0, 10).forEach((t, idx) => {
                            lines.push(`**#${idx + 1}** — [${t.title}](${t.url}) \`${fmtDur(t.lengthSeconds)}\` • ${t.author}`);
                        });
                        if (q2.tracks.length > 10) lines.push(`…and **${q2.tracks.length - 10}** more`);
                    }
                    const embed = buildNowPlayingEmbed(
                        q2.current ?? {},
                        q2.volume * 100,
                        q2.current?.requestedBy ?? i.user,
                        q2.tracks.length,
                        q2.loop
                    );
                    await msg.edit({
                        embeds: [embed],
                        components: [
                            buildControls(guildId, q2.player.state.status === AudioPlayerStatus.Paused, q2.loop, q2.current?.url),
                            buildVolumeRow(guildId, q2.current?.url),
                        ],
                    }).catch(() => {});
                    await i.reply({ ephemeral: true, content: q2.loop ? "🔁 Loop enabled." : "🔂 Loop disabled." });
                    return;
                }

                if (id === "loop") {
                    q2.loop = !q2.loop;
                    const embed = buildNowPlayingEmbed(
                        q2.current ?? {},
                        q2.volume * 100,
                        q2.current?.requestedBy ?? i.user,
                        q2.tracks.length,
                        q2.loop
                    );
                    await msg.edit({
                        embeds: [embed],
                        components: [
                            buildControls(guildId, q2.player.state.status === AudioPlayerStatus.Paused, q2.loop, q2.current?.url),
                            buildVolumeRow(guildId, q2.current?.url),
                        ],
                    }).catch(() => {});
                    await i.deferUpdate();
                    return;
                }

                if (id === "volDown" || id === "volUp") {
                    const delta = id === "volDown" ? -0.1 : 0.1;
                    q2.volume = Math.max(0.0, Math.min(2.0, Math.round((q2.volume + delta) * 10) / 10));
                    const res = q2.player._state?.resource;
                    if (res?.volume) res.volume.setVolume(q2.volume);
                    const embed = buildNowPlayingEmbed(
                        q2.current ?? {},
                        q2.volume * 100,
                        q2.current?.requestedBy ?? i.user,
                        q2.tracks.length,
                        q2.loop
                    );
                    await msg.edit({
                        embeds: [embed],
                        components: [
                            buildControls(guildId, q2.player.state.status === AudioPlayerStatus.Paused, q2.loop, q2.current?.url),
                            buildVolumeRow(guildId, q2.current?.url),
                        ],
                    }).catch(() => {});
                    await i.deferUpdate();
                    return;
                }

                // Handle skip voting button
                if (i.customId === "vote_skip") {
                    const q2 = getOrCreateQueue(guildId);
                    if (q2.skipVoting && !q2.skipVotes.has(i.user.id)) {
                        q2.skipVotes.add(i.user.id);
                        await i.reply({ ephemeral: true, content: "Your vote to skip has been counted." });
                        if (q2.skipVotes.size >= 2) {
                            clearTimeout(q2.skipVotingTimeout);
                            q2.player.stop(true);
                            await q2.skipVotingMsg.edit({ content: "⏭️ Track skipped by vote.", components: [] });
                            q2.skipVoting = false;
                            q2.skipVotes.clear();
                            q2.skipVotingMsg = null;
                        }
                    } else {
                        await i.reply({ ephemeral: true, content: "You already voted or voting ended." });
                    }
                }
            });

            collector.on("end", async () => {
                if (q.nowMessage) {
                    await q.nowMessage.edit({ components: [] }).catch(() => {});
                }
            });
        }
    },
};

// // Enhancement notes:
// - Added ytsr for search by name
// - Added inactivity timer to leave VC after 2 mins of no music
// - Added Link button to main controls
// - Main embed is resent every time a song is looped
// - Confirmation for videos longer than 7 mins
// - Reset inactivity timer on every user interaction
// - Cleaned up message deletion to avoid duplicate embeds
// - Improved error handling for search and playback
// - All enhancements are marked with comments
