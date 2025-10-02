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
const youtubedl = require("youtube-dl-exec");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { promisify } = require("util");

const queues = new Map();
const INACTIVITY_TIMEOUT = 2 * 60 * 1000;

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
            currentYtdlpProcess: null,

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

function buildNowPlayingEmbed(track, volumePct, requester, queueLen, isLooped) {
    return new EmbedBuilder()
        .setColor(isLooped ? 0xF472B6 : 0x00C2FF)
        .setAuthor({
            name: "🇳 🇴 🇼  🇵 🇱 🇦 🇾 🇮 🇳 🇬",
            iconURL: "https://cdn-icons-png.flaticon.com/512/727/727240.png"
        })
        .setTitle(track?.title ?? "Unknown Track")
        .setURL(track?.url ?? null)
        .setThumbnail(track?.thumbnail ?? null)
        .addFields(
            { name: "📺 Channel", value: track?.author ?? "Unknown", inline: true },
            { name: "🌐 Source", value: track?.source ?? "YouTube", inline: true },
            { name: "🔎 Search", value: track?.searchInfo ?? "Unknown", inline: true },
            { name: "👀 Views", value: track?.views?.toLocaleString() ?? "N/A", inline: true },
            { name: "⏱️ Duration", value: `\`${fmtDur(track.lengthSeconds)}\``, inline: true },
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

function enhancedLog(msg, interaction) {
    const now = new Date();
    const ts = now.toLocaleString("en-US", { hour12: false });
    const guild = interaction?.guild?.name ?? "UnknownGuild";
    const user = interaction?.user?.tag ?? "UnknownUser";
    console.log(`[${ts}] [${guild}] [${user}] ${msg}`);
    if (interaction && interaction.client) logToChannel(interaction.client, `[${ts}] ${msg}`);
}
const log = enhancedLog;

async function sendSongFinishedEmbed(channel, track) {
    return channel.send({
        embeds: [buildInfoEmbed("✅ Song Finished", `**${track.title}** has finished playing.`)]
    });
}

async function sendDisconnectedEmbed(channel) {
    return channel.send({
        embeds: [buildInfoEmbed(
            "🛑 Disconnected",
            "The bot has been disconnected and cleared all of the queues after 2 mins of inactivity, thank you for using it."
        )]
    });
}

async function sendNoUserVCEmbed(channel) {
    return channel.send({
        embeds: [buildInfoEmbed(
            "🛑 Disconnected",
            "No users are currently in the voice channel. The bot has disconnected immediately."
        )]
    });
}

function monitorVCUsers(guildId, channel, q) {
    if (q._vcMonitor) clearInterval(q._vcMonitor);
    q._vcMonitor = setInterval(async () => {
        if (!q.connection) return;
        const vcId = q.connection.joinConfig.channelId;
        const vc = channel.guild.channels.cache.get(vcId);
        if (!vc) return;
        const listeners = Array.from(vc.members.values()).filter(m => !m.user.bot);
        if (listeners.length === 0) {
            log(`[VCMonitor] No users in VC, disconnecting`, { guild: channel.guild, user: { tag: "System" } });
            await stopAndCleanup(guildId);
            await sendNoUserVCEmbed(channel);
            clearInterval(q._vcMonitor);
            q._vcMonitor = null;
        }
    }, 60_000); // 1 min
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
        monitorVCUsers(interaction.guild.id, interaction.channel, q);
    }
}

function resetInactivityTimer(guildId, channel = null) {
    const q = getOrCreateQueue(guildId);
    if (q.inactivityTimer) clearTimeout(q.inactivityTimer);
    if (q.player.state.status !== AudioPlayerStatus.Playing && q.player.state.status !== AudioPlayerStatus.Paused) {
        q.inactivityTimer = setTimeout(async () => {
            log(`[Inactivity] Disconnected after 2 mins inactivity`, { guild: channel?.guild, user: { tag: "System" } });
            await stopAndCleanup(guildId, channel, true);
        }, INACTIVITY_TIMEOUT);
    }
}

async function stopAndCleanup(guildId, channel = null, inactivity = false) {
    const q = getOrCreateQueue(guildId);
    try { q.player.stop(); } catch { }
    try { q.connection?.destroy(); } catch { }
    q.connection = null;
    q.current = null;
    q.tracks = [];
    q.loop = false;
    if (q.inactivityTimer) clearTimeout(q.inactivityTimer);
    if (q._vcMonitor) clearInterval(q._vcMonitor);
    q._vcMonitor = null;
    if (q.nowMessage) {
        const msg = q.nowMessage;
        q.nowMessage = null;
        await msg.edit({ components: [] }).catch(() => { });
    }
    if (inactivity && channel) {
        await sendDisconnectedEmbed(channel);
    }
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

const streamPipeline = promisify(pipeline);
async function resolveTrack(query, user) {
    let url = query;
    let details = {};
    let searchInfo = "Unknown";
    let views = null;
    let source = "YouTube";

    try {
        if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(query)) {
            console.log("[resolveTrack] Trying youtube-dl-exec: URL");
            const info = await youtubedl(query, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
                preferFreeFormats: true,
                addHeader: [
                    'referer:youtube.com',
                    'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
                ]
            });
            url = info.webpage_url;
            details = {
                title: info.title,
                lengthSeconds: Number(info.duration),
                thumbnails: [{ url: info.thumbnail }],
                author: { name: info.uploader || info.channel || "Unknown" },
                video_url: info.webpage_url,
            };
            views = Number(info.view_count) || null;
            searchInfo = "youtube-dl-exec: URL";
            source = "YouTube (youtube-dl-exec)";
            console.log(`[resolveTrack] youtube-dl-exec: URL success: ${details.title}`);
        } else {
            console.log("[resolveTrack] Trying youtube-dl-exec: search");
            const searchInfoResult = await youtubedl(`ytsearch1:${query}`, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
                preferFreeFormats: true,
                addHeader: [
                    'referer:youtube.com',
                    'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
                ]
            });
            if (searchInfoResult.entries && searchInfoResult.entries.length > 0) {
                const v = searchInfoResult.entries[0];
                url = v.webpage_url;
                details = {
                    title: v.title,
                    lengthSeconds: Number(v.duration),
                    thumbnails: [{ url: v.thumbnail }],
                    author: { name: v.uploader || v.channel || "Unknown" },
                    video_url: v.webpage_url,
                };
                views = Number(v.view_count) || null;
                searchInfo = `youtube-dl-exec: ${query}`;
                source = "YouTube (youtube-dl-exec)";
                console.log(`[resolveTrack] youtube-dl-exec: search success: ${details.title}`);
            } else {
                console.log("[resolveTrack] youtube-dl-exec: search found no entries");
            }
        }
    } catch (e) {
        console.log(`[resolveTrack] youtube-dl-exec failed: ${e.message}`);
        throw new Error("NO_RESULTS");
    }

    if (!details.title) {
        console.log("[resolveTrack] youtube-dl-exec did not return a valid track, throwing NO_RESULTS");
        throw new Error("NO_RESULTS");
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
        source,
    };
}

async function downloadToTempFile(url) {
    const tmpDir = path.resolve("D:/DiscordBOTCore/MainBOTCore/FumoBOT/MainBOT/OtherFunCommand/MusicFunction/MusicDB");
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    const fileName = `fumo_music_${Date.now()}_${Math.floor(Math.random() * 10000)}.webm`;
    const filePath = path.join(tmpDir, fileName);

    return new Promise((resolve, reject) => {
        const ytdlProc = youtubedl.exec(url, {
            output: "-",
            format: "bestaudio[ext=webm]/bestaudio/best",
            quiet: true,
            limitRate: "1M",
        }, { stdio: ["ignore", "pipe", "ignore"] });

        const writeStream = fs.createWriteStream(filePath);

        ytdlProc.stdout.pipe(writeStream);

        ytdlProc.stdout.on("error", (err) => {
            writeStream.destroy();
            fs.unlink(filePath, () => { });
            reject(err);
        });

        writeStream.on("finish", () => {
            resolve(filePath);
        });

        writeStream.on("error", (err) => {
            fs.unlink(filePath, () => { });
            reject(err);
        });

        ytdlProc.on("error", (err) => {
            writeStream.destroy();
            fs.unlink(filePath, () => { });
            reject(err);
        });

        ytdlProc.on("close", (code) => {
            if (code !== 0) {
                writeStream.destroy();
                fs.unlink(filePath, () => { });
                reject(new Error(`youtube-dl-exec exited with code ${code}`));
            }
        });
    });
}

async function playNext(interaction, guildId) {
    const q = getOrCreateQueue(guildId);

    // Kill any existing yt-dlp process before starting new one
    if (q.currentYtdlpProcess) {
        try {
            q.currentYtdlpProcess.kill('SIGKILL');
        } catch (e) {
            // Ignore kill errors
        }
        q.currentYtdlpProcess = null;
    }

    if (q.current || q.player.state.status === AudioPlayerStatus.Playing) {
        return;
    }

    const t = q.dequeue();
    if (!t) {
        return;
    }

    q.current = t;
    q.startTime = Date.now();

    let resource;
    let used = "";
    let tempFilePath = null;

    try {
        if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(t.url)) {
            console.log(`[playNext] Trying direct stream for: ${t.title}`);
            const ytdlpProc = youtubedl.exec(t.url, {
                output: '-',
                format: 'bestaudio[ext=webm]/bestaudio/best',
                quiet: true,
                limitRate: '1M',
            }, { stdio: ['ignore', 'pipe', 'pipe'] });

            q.currentYtdlpProcess = ytdlpProc;

            resource = createAudioResource(ytdlpProc.stdout, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true,
            });

            used = "direct-stream";
            console.log("[playNext] Using resource from:", used);

            ytdlpProc.catch((err) => {
                if (err.signal === 'SIGKILL' || err.killed) {
                    return;
                }
                console.log(`[playNext] yt-dlp error: ${err.message}`);
            });

            ytdlpProc.on("error", (err) => {
                if (err.signal !== 'SIGKILL' && !err.killed) {
                    console.log(`[playNext] Direct stream error: ${err.message}`);
                }
            });

            ytdlpProc.on("close", (code, signal) => {
                q.currentYtdlpProcess = null;
                if (signal !== 'SIGKILL' && code !== 0 && code !== null) {
                    console.log(`[playNext] Direct stream exited with code ${code}`);
                }
            });
        }
    } catch (e) {
        console.log(`[playNext] Direct stream failed: ${e.message}`);
    }

    if (!resource) {
        try {
            console.log(`[playNext] Falling back to temp file for: ${t.title}`);
            tempFilePath = await downloadToTempFile(t.url);
            resource = createAudioResource(tempFilePath, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true,
            });
            used = "tempfile";
            console.log(`[playNext] Temp file ready: ${tempFilePath}`);
        } catch (e) {
            console.log(`[playNext] Temp file download failed: ${e.message}`);
            await interaction.channel.send({
                embeds: [buildInfoEmbed("❌ Error", "Could not play this track (both stream and download failed).")]
            });
            q.current = null;
            if (tempFilePath) fs.unlink(tempFilePath, () => { });
            return;
        }
    }

    if (!resource) {
        console.log("[playNext] No resource, aborting playback.");
        await interaction.channel.send({
            embeds: [buildInfoEmbed("❌ Error", "Could not play this track (no resource).")]
        });
        q.current = null;
        if (tempFilePath) fs.unlink(tempFilePath, () => { });
        return;
    }

    resource.playStream.on("close", () => {
        if (tempFilePath) {
            fs.unlink(tempFilePath, () => { });
        }
    });

    q.player.play(resource);

    if (q.nowMessage) {
        const disabledRows = q.nowMessage.components?.map(row => {
            return ActionRowBuilder.from(row).setComponents(
                row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
            );
        }) ?? [];
        await q.nowMessage.edit({ components: disabledRows }).catch(() => { });
        q.nowMessage = null;
    }

    const embed = buildNowPlayingEmbed(
        t,
        q.volume * 100,
        t.requestedBy,
        q.tracks.length,
        q.loop
    );
    const rows = [buildControls(guildId, false, q.loop, t.url), buildVolumeRow(guildId, t.url)];
    q.nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });

    monitorVCUsers(guildId, interaction.channel, q);

    if (q.nowMessage) {
        setupCollector(q, guildId, interaction);
    }

    console.log(`[playNext] Now playing using: ${used}`);
}

function setupCollector(q, guildId, interaction) {
    let msg = q.nowMessage;
    if (!msg) return;

    const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 7 * 24 * 60 * 60 * 1000,
        dispose: true
    });

    const safeEdit = async (payload) => {
        try {
            await msg.edit(payload);
        } catch (err) {
            log(`[controls] safeEdit failed: ${err}`, interaction);
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
                const disabledRows = q2.nowMessage.components?.map(row => {
                    return ActionRowBuilder.from(row).setComponents(
                        row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                    );
                }) ?? [];
                await q2.nowMessage.edit({ components: disabledRows }).catch(() => { });
                q2.nowMessage = null;
            }
            await i.reply({ ephemeral: true, content: "🛑 Stopped playback, disabled loop, cleared the queue, and left the VC." });
            return;
        }

        if (id === "skip") {
            log(`[controls] Skip requested`, interaction);

            // Kill any running yt-dlp process immediately
            if (q2.currentYtdlpProcess) {
                q2.currentYtdlpProcess.kill('SIGKILL');
                q2.currentYtdlpProcess = null;
            }

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
                            // Kill process before stopping player
                            if (q2.currentYtdlpProcess) {
                                q2.currentYtdlpProcess.kill('SIGKILL');
                                q2.currentYtdlpProcess = null;
                            }
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

    collector.on("end", async (reason) => {
        log(`[controls] Collector ended: ${reason}`, interaction);
        const q2 = getOrCreateQueue(guildId);
        if (q2.current) {
            const disabledRows = msg.components?.map(row => {
                return ActionRowBuilder.from(row).setComponents(
                    row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                );
            }) ?? [];
            try {
                await msg.edit({
                    components: disabledRows
                });
                q2.nowMessage = null;
                log(`[controls] Disabled controls after collector end`, interaction);
            } catch (err) {
                log(`[controls] Failed to disable controls after collector ended: ${err}`, interaction);
            }
        }
    });
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
                    q.tracks.push(track);

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
            q.tracks.push(track);
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

        if (!q._eventsBound) {
            q._eventsBound = true;
            q.player.on(AudioPlayerStatus.Idle, async () => {
                log(`[player] Status: Idle`, interaction);
                if (q.loop && q.current) {
                    q.tracks.unshift(q.current);
                    if (q.nowMessage) {
                        const disabledRows = q.nowMessage.components?.map(row => {
                            return ActionRowBuilder.from(row).setComponents(
                                row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                            );
                        }) ?? [];
                        await q.nowMessage.edit({ components: disabledRows }).catch(() => { });
                        q.nowMessage = null;
                    }
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
                    q.nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });
                    await sendSongFinishedEmbed(interaction.channel, q.current);
                    if (q.nowMessage) setupCollector(q, guildId, interaction);
                } else if (q.current) {
                    await sendSongFinishedEmbed(interaction.channel, q.current);
                }
                q.current = null;

                if (q.tracks.length > 0) {
                    setTimeout(() => playNext(q.nowMessage ?? interaction, guildId), 250);
                } else {
                    if (q.nowMessage) {
                        const disabledRows = q.nowMessage.components?.map(row => {
                            return ActionRowBuilder.from(row).setComponents(
                                row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                            );
                        }) ?? [];
                        await q.nowMessage.edit({ components: disabledRows }).catch(() => { });
                        q.nowMessage = null;
                    }
                    const idleEmbed = buildInfoEmbed("✅ Queue finished", "All songs have been played.");
                    await interaction.channel.send({ embeds: [idleEmbed] });
                    resetInactivityTimer(guildId, interaction.channel);
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
    }
}

module.exports.queues = queues;
module.exports.player = this.player;
module.exports.getOrCreateQueue = getOrCreateQueue;

