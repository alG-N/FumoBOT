const { SlashCommandBuilder } = require("discord.js");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    StreamType,
    VoiceConnectionStatus,
    entersState
} = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core");

const player = createAudioPlayer();

// 🔊 Debug player events
player.on("stateChange", (oldState, newState) => {
    console.log(`[Player] ${oldState.status} → ${newState.status}`);
});
player.on("error", error => console.error("[Player] Error:", error.message, error));

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song in your voice channel")
        .addStringOption(option =>
            option.setName("url")
                .setDescription("YouTube URL")
                .setRequired(true)
        ),
    async execute(interaction) {
        const url = interaction.options.getString("url");
        const voiceChannel = interaction.member.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply("❌ You must be in a voice channel first!");
        }

        try {
            await interaction.deferReply();
            console.log(`[Play] Requested: ${url}`);
            console.log(`[Play] Joining VC: ${voiceChannel.name}`);

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false
            });

            try {
                console.log("[Play] Waiting for Ready...");
                connection.on("stateChange", (oldState, newState) => {
                    console.log(`[Connection] ${oldState.status} → ${newState.status}`);
                });
                // setInterval(() => console.log("[Conn State]", connection.state), 2000);
                await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
                console.log("[Connection] ✅ Ready!");
            } catch (err) {
                console.error("[Connection] ❌ Failed to reach Ready:", err);
                return interaction.editReply("❌ Could not connect to VC (Ready not reached).");
            }

            console.log("[Play] Fetching stream...");
            const stream = ytdl(url, {
                filter: "audioonly",
                quality: "highestaudio",
                highWaterMark: 1 << 25,
            });

            const resource = createAudioResource(stream, {
                inputType: StreamType.Arbitrary
            });

            console.log("[Play] Starting playback...");
            player.play(resource);
            connection.subscribe(player);

            await interaction.editReply(`▶️ Now playing: ${url}`);
        } catch (err) {
            if (err.name === "AbortError") {
                console.error("[Play] Command failed: AbortError - The operation was aborted.", err);
                if (interaction.deferred) {
                    await interaction.editReply("❌ Connection to the voice channel timed out. Please try again.");
                } else {
                    await interaction.reply("❌ Connection to the voice channel timed out. Please try again.");
                }
            } else {
                console.error("[Play] Command failed:", err);
                if (interaction.deferred) {
                    await interaction.editReply("❌ Failed to play the song.");
                } else {
                    await interaction.reply("❌ Failed to play the song.");
                }
            }
        }
    },
    player
};
