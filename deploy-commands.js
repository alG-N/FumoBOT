const path = require("path");
const fs = require("fs");
const { REST, Routes } = require("discord.js");
const { clientId, guildId, token } = require("../FumoBOT/MainBOT/config.json");

// Array to collect all commands
const commands = [];

/**
 * Load commands from a specific folder
 */
function loadCommandsFrom(folderPath) {
    const files = fs.readdirSync(folderPath).filter(file => file.endsWith(".js"));

    for (const file of files) {
        const command = require(path.join(folderPath, file));
        if ("data" in command && "execute" in command) {
            commands.push(command.data.toJSON());
            console.log(`✅ Loaded: ${file}`);
        } else {
            console.warn(`⚠️ ${file} in ${folderPath} is missing "data" or "execute".`);
        }
    }
}

/**
 * Load a single command file
 */
function loadCommand(filePath, commandName) {
    try {
        const command = require(filePath);
        if ("data" in command && "execute" in command) {
            commands.push(command.data.toJSON());
            console.log(`✅ Loaded: ${commandName}`);
        } else {
            console.warn(`⚠️ ${commandName} is missing 'data' or 'execute'.`);
        }
    } catch (error) {
        console.error(`❌ Failed to load ${commandName}:`, error.message);
    }
}

// node deploy-commands.js
// ---------------- Load Commands ---------------- \\

// Basic Commands
loadCommand("./MainBOT/SubCommand/BasicCommand/afk.js", "afk");
loadCommand("./MainBOT/SubCommand/BasicCommand/avatar.js", "avatar");
loadCommand("./MainBOT/SubCommand/BasicCommand/groupInform.js", "groupInform");
loadCommand("./MainBOT/SubCommand/BasicCommand/ping.js", "ping");
loadCommand("./MainBOT/SubCommand/BasicCommand/roleinfo.js", "roleinfo");
loadCommand("./MainBOT/SubCommand/BasicCommand/tutorialHelp.js", "tutorialHelp");
loadCommand("./MainBOT/SubCommand/BasicCommand/invite.js", "invite");

// Interactive Commands
loadCommand("./MainBOT/SubCommand/InteractiveUserCommand/MainCommand/say.js", "say");
loadCommand("./MainBOT/SubCommand/InteractiveUserCommand/MainCommand/deathbattle.js", "deathbattle");

// API/Website Commands
loadCommand("./MainBOT/SubCommand/API-Website/Anime/anime.js", "anime");
loadCommand("./MainBOT/SubCommand/API-Website/Reddit/reddit.js", "reddit");
loadCommand("./MainBOT/SubCommand/API-Website/Pixiv/pixiv.js", "pixiv");
loadCommand("./MainBOT/SubCommand/API-Website/Steam/steam.js", "steam");
loadCommand("./MainBOT/SubCommand/API-Website/Rule34/rule34.js", "rule34");

// Video Command
loadCommand("./MainBOT/SubCommand/VideoFunction/MainCommand/video.js", "video");

// Music Commands (IMPORTANT!)
console.log("\n🎵 Loading Music Commands...");
loadCommand("./MainBOT/SubCommand/MusicFunction/MainCommand/play.js", "play");
loadCommand("./MainBOT/SubCommand/MusicFunction/MainCommand/stop.js", "stop");

// Auto-load any other commands from MusicFunction folder
console.log("\n🎵 Auto-loading additional music commands...");
loadCommandsFrom(path.join(__dirname, "../FumoBOT/MainBOT/SubCommand/MusicFunction"));

// ---------------- Deploy Commands ---------------- \\
const rest = new REST({ version: "10" }).setToken(token);

(async () => {
    try {
        console.log(`\n🔄 Started refreshing ${commands.length} application (/) commands.`);

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId), // guild deploy
            { body: commands }
        );

        console.log(`✅ Successfully reloaded ${commands.length} application (/) commands.`);
        console.log("\n📋 Deployed commands:");
        commands.forEach((cmd, i) => {
            console.log(`  ${i + 1}. /${cmd.name} - ${cmd.description}`);
        });
    } catch (error) {
        console.error("❌ Error deploying commands:", error);
    }
})();

// Uncomment to clear all commands
// (async () => {
//     try {
//         console.log('Clearing guild application (/) commands...');
//         await rest.put(
//             Routes.applicationGuildCommands(clientId, guildId),
//             { body: [] },
//         );
//         console.log(`Successfully cleared all commands in guild ${guildId}.`);
//     } catch (error) {
//         console.error(error);
//     }
// })();