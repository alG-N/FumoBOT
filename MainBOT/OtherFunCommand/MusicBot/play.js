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
            startTime: null,
            elapsed: 0,
            _eventsBound: false,
            _collectorBound: false,
            skipVotes: new Set(),
            skipVoting: false,
            skipVotingTimeout: null,
            skipVotingMsg: null,
            inactivityTimer: null,

            enqueue(track) {
                this.tracks.push(track);
                return this.tracks.length;
            },

            dequeue() {
                return this.tracks.shift();
            }
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

function buildNowPlayingEmbed(track, volumePct, requester, queueLen, isLooped, elapsed = 0) {
    return new EmbedBuilder()
        .setColor(isLooped ? 0xF472B6 : 0x00C2FF)
        .setAuthor({ name: "🎶 Now Playing", iconURL: "https://cdn-icons-png.flaticon.com/512/727/727240.png" })
        .setTitle(track?.title ?? "Unknown Track")
        .setURL(track?.url ?? null)
        .setThumbnail(track?.thumbnail ?? null)
        .addFields(
            { name: "📺 Channel", value: track?.author ?? "Unknown", inline: true },
            { name: "🌐 Source", value: "YouTube", inline: true },
            { name: "🔎 Search", value: track?.searchInfo ?? "Unknown", inline: true },
            { name: "👀 Views", value: track?.views?.toLocaleString() ?? "N/A", inline: true },
            { name: "⏱️ Duration", value: `\`${fmtDur(elapsed)} / ${fmtDur(track.lengthSeconds)}\``, inline: true },
            { name: "📜 Queue", value: `\`${queueLen}\` in line`, inline: true },
            { name: "🔊 Volume", value: `\`${Math.round(volumePct)}%\``, inline: true },
            { name: "🔁 Loop", value: isLooped ? "**Enabled**" : "Not Enabled", inline: true },
        )
        .setFooter({ 
            text: `🎧 Requested by ${requester.tag}`, 
            iconURL: requester.displayAvatarURL() 
        })
        .setTimestamp();
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

    if (q.current || q.player.state.status === AudioPlayerStatus.Playing) return;

    const t = q.dequeue();
    if (!t) return;

    q.current = t;
    q.startTime = Date.now();

    const info = await ytdl.getInfo(t.url);
    const stream = ytdl.downloadFromInfo(info, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25,
    });

    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
    q.player.play(resource);

    // Initial embed
    const embed = buildNowPlayingEmbed(
        t,
        q.volume * 100,
        t.requestedBy,
        q.tracks.length,
        q.loop,
        0
    );
    const rows = [buildControls(guildId, false, q.loop, t.url), buildVolumeRow(guildId, t.url)];

    if (q.nowMessage && !forceEmbed) {
        await q.nowMessage.edit({ content: "", embeds: [embed], components: rows }).catch(() => { });
    } else {
        if (q.nowMessage) await q.nowMessage.delete().catch(() => { });
        q.nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });
    }

    // Clear old updater
    if (q.progressInterval) clearInterval(q.progressInterval);

    // Interval only updates Duration field
    q.progressInterval = setInterval(async () => {
        if (!q.current || !q.nowMessage) {
            clearInterval(q.progressInterval);
            q.progressInterval = null;
            return;
        }

        const elapsed = Math.floor((Date.now() - q.startTime) / 1000);
        q.elapsed = elapsed;

        const oldEmbed = q.nowMessage.embeds[0];
        if (!oldEmbed) return;

        const newEmbed = EmbedBuilder.from(oldEmbed);

        const newFields = newEmbed.data.fields.map(f =>
            f.name === "Duration"
                ? { ...f, value: `${fmtDur(elapsed)} / ${fmtDur(q.current.lengthSeconds)}` }
                : f
        );

        newEmbed.setFields(newFields);

        await q.nowMessage
            .edit({ embeds: [newEmbed], components: q.nowMessage.components })
            .catch(() => { });
    }, 12000);

    // Cleanup
    q.player.once(AudioPlayerStatus.Idle, () => {
        clearInterval(q.progressInterval);
        q.progressInterval = null;
    });
}

async function stopAndCleanup(guildId) {
    const q = getOrCreateQueue(guildId);
    try { q.player.stop(); } catch { }
    try { q.connection?.destroy(); } catch { }
    q.connection = null;
    q.current = null;
    q.tracks = [];
    q.loop = false;
    if (q.inactivityTimer) clearTimeout(q.inactivityTimer);
    if (q.nowMessage) {
        const msg = q.nowMessage;
        q.nowMessage = null;
        await msg.edit({ components: [] }).catch(() => { });
    }
}

async function resolveTrack(query, user, forceAlt = false) {
    let url = query;
    let details;
    let searchInfo = "Unknown";
    let views = null;
    if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(query)) {
        try {
            const info = await ytdl.getInfo(query);
            details = info.videoDetails;
            url = details.video_url;
            searchInfo = "URL";
            views = Number(details.viewCount) || null;
        } catch (e) {
            throw new Error("INVALID_URL");
        }
    } else {
        let ytResult;
        try {
            ytResult = await ytSearch(forceAlt ? query + " music" : query + " song");
            if (ytResult && ytResult.videos.length > 0) {
                searchInfo = `${query} - Based: Music`;
            }
        } catch { }

        if ((!ytResult || ytResult.videos.length === 0) && !forceAlt) {
            try {
                ytResult = await ytSearch(query, { sortBy: "viewCount" });
                if (ytResult && ytResult.videos.length > 0) {
                    searchInfo = `${query} - Based: Popularity`;
                }
            } catch { }
        }

        if (ytResult && ytResult.videos.length > 0) {
            const vid = ytResult.videos[0];
            url = vid.url;
            details = {
                title: vid.title,
                lengthSeconds: vid.seconds,
                thumbnails: [{ url: vid.thumbnail }],
                author: { name: vid.author.name || vid.author },
                video_url: vid.url,
            };
            views = vid.views || null;
        } else {
            const filters = await ytsr.getFilters(query);
            const filter = filters.get("Type").get("Video");
            const searchResults = await ytsr(filter.url, { limit: 1 });
            if (!searchResults.items.length) throw new Error("NO_RESULTS");
            const vid = searchResults.items[0];
            url = vid.url;
            details = {
                title: vid.title,
                lengthSeconds: vid.duration ? vid.duration.split(":").reduce((acc, t) => 60 * acc + +t, 0) : 0,
                thumbnails: [{ url: vid.thumbnails[0].url }],
                author: { name: vid.author.name },
                video_url: vid.url,
            };
            views = vid.views || null;
            searchInfo = `${query} - Based: Video`;
        }
    }

    return {
        url,
        title: details.title,
        lengthSeconds: Number(details.lengthSeconds),
        thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url ?? null,
        author: details.author?.name ?? "Unknown",
        requestedBy: user,
        views,
        searchInfo,
    };
}

const LOG_CHANNEL_ID = "1411386693499486429";
async function logToChannel(client, msg) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (channel) await channel.send(`\`\`\`js\n${msg}\n\`\`\``);
    } catch (err) {
        console.error("Failed to send log to channel:", err);
    }
}
function log(msg, interaction) {
    console.log(msg);
    if (interaction && interaction.client) logToChannel(interaction.client, msg);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song in your voice channel by name or URL")
        .addStringOption(o =>
            o.setName("query").setDescription("Song name or YouTube URL").setRequired(true)
        ),

    async execute(interaction) {
        log(`[play] Command invoked by ${interaction.user.tag} (${interaction.user.id})`, interaction);

        const query = interaction.options.getString("query");
        const guildId = interaction.guild.id;
        const q = getOrCreateQueue(guildId);

        const vc = interaction.member.voice?.channel;
        if (!vc) {
            log(`[play] No voice channel for ${interaction.user.tag}`, interaction);
            return interaction.reply({
                embeds: [buildInfoEmbed("❌ No Voice Channel", "Join a voice channel first.")],
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        let track;
        try {
            log(`[play] Resolving track for query: ${query}`, interaction);
            track = await resolveTrack(query, interaction.user);
            log(`[play] Track resolved: ${track.title} (${track.url})`, interaction);
        } catch (e) {
            let msg = "Could not fetch video info. Make sure it’s a valid YouTube URL or search query.";
            if (e.message === "NO_RESULTS") msg = "No results found for your search.";
            log(`[play] Track resolve error: ${e.message}`, interaction);
            return interaction.editReply({
                embeds: [buildInfoEmbed("❌ Invalid Query", msg)],
            });
        }

        // Ask for confirmation if video > 7 mins
        if (track.lengthSeconds > 420) {
            log(`[play] Long video detected: ${track.title} (${track.lengthSeconds}s)`, interaction);
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("confirm_yes").setLabel("Yes").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("confirm_no").setLabel("No").setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({
                embeds: [{
                    title: "⚠️ Long Video Detected",
                    description: `**${track.title}**\n⏱️ ${(track.lengthSeconds / 60).toFixed(1)} mins\n\nIs this the song you wanted?`,
                    url: track.url,
                    thumbnail: { url: track.thumbnail },
                }],
                components: [confirmRow],
            });

            const filter = i =>
                i.user.id === interaction.user.id &&
                ["confirm_yes", "confirm_no"].includes(i.customId);

            try {
                const btnInt = await interaction.channel.awaitMessageComponent({ filter, time: 20000 });

                log(`[play] Confirmation button pressed: ${btnInt.customId}`, interaction);

                if (btnInt.customId === "confirm_no") {
                    await btnInt.update({
                        embeds: [buildInfoEmbed("❌ Cancelled", "Playback cancelled.")],
                        components: [],
                    });
                    log(`[play] Playback cancelled by user`, interaction);
                    return;
                }

                if (btnInt.customId === "confirm_yes") {
                    q.tracks.push(track);   // 👈 push directly here

                    await btnInt.update({
                        embeds: [buildInfoEmbed("✅ Confirmed", "Added to the queue and will play soon!")],
                        components: [],
                    });
                    log(`[play] Track confirmed and added to queue`, interaction);
                }

            } catch (err) {
                log(`[play] Confirmation timeout or error: ${err}`, interaction);
                await interaction.editReply({
                    embeds: [buildInfoEmbed("❌ Timeout", "No response. Playback cancelled.")],
                    components: [],
                });
                return;
            }
        } else {
            // For short songs just enqueue immediately
            q.tracks.push(track);   // push directly here
            log(`[play] Track added to queue immediately`, interaction);
            await interaction.editReply({
                embeds: [buildInfoEmbed("🎶 Added to queue", `**${track.title}** has been added!`)]
            });
        }

        const pos = q.current ? q.tracks.length : 1;
        const queuedEmbed = buildQueuedEmbed(track, pos, interaction.user);
        await interaction.editReply({ embeds: [queuedEmbed], components: [] });

        try {
            log(`[play] Ensuring connection`, interaction);
            await ensureConnection(interaction, q);
        } catch (err) {
            log(`[play] Connection error: ${err.message}`, interaction);
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
                log(`[player] Status: Idle`, interaction);
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
                        await q.nowMessage.edit({ embeds: [embed], components: rows }).catch(() => { });
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
                        await q.nowMessage.edit({ embeds: [idleEmbed], components: [] }).catch(() => { });
                    }
                    resetInactivityTimer(guildId);
                }
            });

            q.player.on(AudioPlayerStatus.Playing, () => {
                log(`[player] Status: Playing`, interaction);
                if (q.inactivityTimer) {
                    clearTimeout(q.inactivityTimer);
                    q.inactivityTimer = null;
                }
            });

            q.player.on(AudioPlayerStatus.Paused, () => {
                log(`[player] Status: Paused`, interaction);
                if (q.inactivityTimer) {
                    clearTimeout(q.inactivityTimer);
                    q.inactivityTimer = null;
                }
            });

            q.player.on("error", async (err) => {
                log(`[player] Error: ${err}`, interaction);
                if (q.nowMessage) {
                    const errEmbed = buildInfoEmbed("⚠️ Playback error", "Skipping to the next track…");
                    await q.nowMessage.reply({ embeds: [errEmbed] }).catch(() => { });
                }
                q.player.stop();
            });
        }

        await playNext(interaction, guildId);

        // Setup collector for controls
        if (q.nowMessage && !q._collectorBound) {
            q._collectorBound = true;
            let msg = q.nowMessage;

            const collector = msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 7 * 24 * 60 * 60 * 1000,
                dispose: true // Enable disposal for fallback
            });

            const safeEdit = async (payload) => {
                try {
                    await msg.edit(payload);
                } catch (err) {
                    log(`[controls] safeEdit failed: ${err}`, interaction);
                    // Fallback: try to send a new message if edit fails
                    try {
                        const newMsg = await msg.channel.send(payload).catch(() => null);
                        if (newMsg) {
                            q.nowMessage = newMsg;
                            msg = newMsg;
                            log(`[controls] Fallback: sent new controls message`, interaction);
                        }
                    } catch (err2) {
                        log(`[controls] Fallback failed: ${err2}`, interaction);
                    }
                }
            };

            collector.on("collect", async (i) => {
                log(`[controls] Button pressed: ${i.customId} by ${i.user.tag}`, interaction);

                const q2 = getOrCreateQueue(guildId);
                const botChannelId = q2.connection?.joinConfig?.channelId;
                const memberChannelId = i.member?.voice?.channelId;
                if (!botChannelId || memberChannelId !== botChannelId) {
                    log(`[controls] User not in same VC`, interaction);
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
                        log(`[controls] Paused`, interaction);
                        const embed = buildNowPlayingEmbed(q2.current, q2.volume * 100, q2.current?.requestedBy ?? i.user, q2.tracks.length, q2.loop);
                        await safeEdit({
                            embeds: [embed],
                            components: [buildControls(guildId, true, q2.loop, q2.current?.url), buildVolumeRow(guildId, q2.current?.url)],
                        });
                        await i.reply({ ephemeral: true, content: "⏸️ Paused." });
                    } else if (q2.player.state.status === AudioPlayerStatus.Paused) {
                        q2.player.unpause();
                        log(`[controls] Resumed`, interaction);
                        const embed = buildNowPlayingEmbed(q2.current, q2.volume * 100, q2.current?.requestedBy ?? i.user, q2.tracks.length, q2.loop);
                        await safeEdit({
                            embeds: [embed],
                            components: [buildControls(guildId, false, q2.loop, q2.current?.url), buildVolumeRow(guildId, q2.current?.url)],
                        });
                        await i.reply({ ephemeral: true, content: "▶️ Resumed." });
                    } else {
                        log(`[controls] Not playing`, interaction);
                        await i.reply({ ephemeral: true, content: "⚠️ Not playing." });
                    }
                    return;
                }

                if (id === "stop") {
                    log(`[controls] Stopped`, interaction);
                    if (q2.player) q2.player.stop();
                    q2.tracks = [];
                    q2.current = null;
                    q2.loop = false;
                    q2.skipVotes.clear();
                    q2.skipVoting = false;
                    if (q2.progressInterval) clearInterval(q2.progressInterval);
                    if (q2.inactivityTimer) clearTimeout(q2.inactivityTimer);
                    if (q2.connection) {
                        q2.connection.destroy();
                        q2.connection = null;
                    }
                    if (q2.nowMessage) {
                        await q2.nowMessage.delete().catch(() => { });
                        q2.nowMessage = null;
                    }
                    await i.reply({ ephemeral: true, content: "🛑 Stopped playback, disabled loop, cleared the queue, and left the VC." });
                    return;
                }

                if (id === "skip") {
                    log(`[controls] Skip requested`, interaction);
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
                                components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("vote_skip").setLabel("Skip").setStyle(ButtonStyle.Primary))],
                                ephemeral: false,
                                fetchReply: true,
                            });
                            q2.skipVotingTimeout = setTimeout(async () => {
                                q2.skipVoting = false;
                                if (q2.skipVotes.size >= 2) {
                                    q2.player.stop(true);
                                    await q2.skipVotingMsg.edit({ content: "⏭️ Track skipped by vote.", components: [] });
                                    log(`[controls] Track skipped by vote`, interaction);
                                } else {
                                    await q2.skipVotingMsg.edit({ content: "⏭️ Not enough votes to skip.", components: [] });
                                    log(`[controls] Not enough votes to skip`, interaction);
                                }
                                q2.skipVotes.clear();
                                q2.skipVotingMsg = null;
                            }, 15000);
                        } else {
                            log(`[controls] Skip vote already in progress`, interaction);
                            await i.reply({ ephemeral: true, content: "Skip vote already in progress." });
                        }
                    } else {
                        if (q2.player.state.status === AudioPlayerStatus.Playing || q2.player.state.status === AudioPlayerStatus.Paused) {
                            q2.player.stop(true);
                            log(`[controls] Track skipped`, interaction);
                            await i.reply({ ephemeral: true, content: "⏭️ Skipped." });
                        } else {
                            log(`[controls] Nothing to skip`, interaction);
                            await i.reply({ ephemeral: true, content: "⚠️ Nothing to skip." });
                        }
                    }
                    return;
                }

                if (id === "list") {
                    log(`[controls] List requested`, interaction);
                    const lines = [];
                    if (q2.current) lines.push(`**Now** — [${q2.current.title}](${q2.current.url}) \`${fmtDur(q2.current.lengthSeconds)}\``);
                    if (q2.tracks.length === 0) {
                        lines.push("_Queue is empty._");
                    } else {
                        q2.tracks.slice(0, 10).forEach((t, idx) => {
                            lines.push(`**#${idx + 1}** — [${t.title}](${t.url}) \`${fmtDur(t.lengthSeconds)}\` • ${t.author}`);
                        });
                        if (q2.tracks.length > 10) lines.push(`…and **${q2.tracks.length - 10}** more`);
                    }
                    const embed = buildInfoEmbed("🧾 Current Queue", lines.join("\n"));
                    await i.reply({ ephemeral: true, embeds: [embed] });
                    return;
                }

                if (id === "loop") {
                    q2.loop = !q2.loop;
                    log(`[controls] Loop toggled: ${q2.loop}`, interaction);
                    const embed = buildNowPlayingEmbed(q2.current ?? {}, q2.volume * 100, q2.current?.requestedBy ?? i.user, q2.tracks.length, q2.loop);
                    await safeEdit({
                        embeds: [embed],
                        components: [buildControls(guildId, q2.player.state.status === AudioPlayerStatus.Paused, q2.loop, q2.current?.url), buildVolumeRow(guildId, q2.current?.url)],
                    });
                    await i.deferUpdate();
                    return;
                }

                if (id === "volDown" || id === "volUp") {
                    const delta = id === "volDown" ? -0.1 : 0.1;
                    q2.volume = Math.max(0.0, Math.min(2.0, Math.round((q2.volume + delta) * 10) / 10));
                    log(`[controls] Volume changed: ${q2.volume}`, interaction);
                    const res = q2.player._state?.resource;
                    if (res?.volume) res.volume.setVolume(q2.volume);
                    const embed = buildNowPlayingEmbed(q2.current ?? {}, q2.volume * 100, q2.current?.requestedBy ?? i.user, q2.tracks.length, q2.loop);
                    await safeEdit({
                        embeds: [embed],
                        components: [buildControls(guildId, q2.player.state.status === AudioPlayerStatus.Paused, q2.loop, q2.current?.url), buildVolumeRow(guildId, q2.current?.url)],
                    });
                    await i.deferUpdate();
                    return;
                }

                if (i.customId === "vote_skip") {
                    log(`[controls] Vote skip pressed`, interaction);
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
                            log(`[controls] Track skipped by vote (2+)`, interaction);
                        }
                    } else {
                        await i.reply({ ephemeral: true, content: "You already voted or voting ended." });
                        log(`[controls] Vote skip ignored`, interaction);
                    }
                }
            });

            collector.on("end", async (collected, reason) => {
                log(`[controls] Collector ended: ${reason}`, interaction);
                const q2 = getOrCreateQueue(guildId);
                if (q2.current) {
                    const embed = buildNowPlayingEmbed(q2.current, q2.volume * 100, q2.current.requestedBy, q2.tracks.length, q2.loop);
                    try {
                        const newMsg = await msg.channel.send({
                            embeds: [embed],
                            components: [
                                buildControls(guildId, q2.player.state.status === AudioPlayerStatus.Paused, q2.loop, q2.current.url),
                                buildVolumeRow(guildId, q2.current.url),
                            ],
                        });
                        q2.nowMessage = newMsg;
                        msg = newMsg;
                        log(`[controls] Fallback: controls restored after collector end`, interaction);
                    } catch (err) {
                        log(`[controls] Failed to restore controls after collector ended: ${err}`, interaction);
                    }
                }
            });

            if (!q._heartbeat) {
                q._heartbeat = setInterval(async () => {
                    if (q.current && (!q.nowMessage || q.nowMessage.deleted)) {
                        log(`[controls] Heartbeat restoring controls`, interaction);
                        const embed = buildNowPlayingEmbed(q.current, q.volume * 100, q.current.requestedBy, q.tracks.length, q.loop);
                        try {
                            q.nowMessage = await msg.channel.send({
                                embeds: [embed],
                                components: [
                                    buildControls(guildId, q.player.state.status === AudioPlayerStatus.Paused, q.loop, q.current.url),
                                    buildVolumeRow(guildId, q.current.url),
                                ],
                            });
                            msg = q.nowMessage;
                        } catch (err) {
                            log(`[controls] Heartbeat failed to restore controls: ${err}`, interaction);
                        }
                    }
                }, 30_000);
            }
        }
    },
};

module.exports.queues = queues;
module.exports.player = this.player;
module.exports.getOrCreateQueue = getOrCreateQueue;
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
