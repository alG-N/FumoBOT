const youtubedl = require("youtube-dl-exec");
const { createAudioResource, StreamType } = require("@discordjs/voice");
const { ytdlpOptions, processOptions } = require('../Configuration/playerConfig');
const audioPlayerService = require('./AudioPlayerService');

class StreamService {
    async createStream(track, queue) {
        console.log(`[StreamService] Creating stream for: ${track.title}`);

        let stderrData = '';

        const ytdlpProc = youtubedl.exec(track.url, ytdlpOptions, processOptions);

        audioPlayerService.setYtdlpProcess(queue, ytdlpProc);

        ytdlpProc.stderr.on('data', (data) => {
            const output = data.toString();
            stderrData += output;

            if (!output.includes('[download]') || output.includes('ERROR') || output.includes('WARNING')) {
                console.error('[StreamService] yt-dlp:', output.trim());
            }
        });

        const resource = createAudioResource(ytdlpProc.stdout, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
        });

        if (resource.volume) {
            resource.volume.setVolume(queue.volume);
        }

        ytdlpProc.catch((err) => {
            if (err.signal === 'SIGKILL' || err.killed) {
                return;
            }
            console.error(`[StreamService] yt-dlp process error: ${err.message}`);
        });

        ytdlpProc.on("error", (err) => {
            if (err.signal !== 'SIGKILL' && !err.killed) {
                console.error(`[StreamService] Process error: ${err.message}`);
            }
        });

        ytdlpProc.on("close", (code, signal) => {
            audioPlayerService.setYtdlpProcess(queue, null);
            if (signal !== 'SIGKILL' && code !== 0 && code !== null) {
                console.error(`[StreamService] Process exited with code ${code}`);
                if (stderrData) {
                    console.error(`[StreamService] stderr output:\n${stderrData}`);
                }
            }
        });

        console.log("[StreamService] Resource created successfully");
        return resource;
    }

    killStream(queue) {
        audioPlayerService.killYtdlpProcess(queue);
    }
}

module.exports = new StreamService();