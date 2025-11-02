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
        } else {
            console.warn(`⚠️ ${file} in ${folderPath} is missing "data" or "execute".`);
        }
    }
}

// node deploy-commands.js
// ---------------- Load Commands ---------------- \\
// Manual single-file commands
const sayCommand = require("./MainBOT/OtherFunCommand/InteractiveUserCommand/say.js");
if ("data" in sayCommand && "execute" in sayCommand) {
    commands.push(sayCommand.data.toJSON());
} else {
    console.warn("⚠️ say.js is missing 'data' or 'execute'.");
}

const afkCommand = require("./MainBOT/OtherFunCommand/BasicCommand/afk.js");
if ("data" in afkCommand && "execute" in afkCommand) {
    commands.push(afkCommand.data.toJSON());
} else {
    console.warn("⚠️ afk.js is missing 'data' or 'execute'.");
}

const animeCommand = require("./MainBOT/OtherFunCommand/API-Website/Anime/anime.js");
if ("data" in animeCommand && "execute" in animeCommand) {
    commands.push(animeCommand.data.toJSON());
} else {
    console.warn("⚠️ anime.js is missing 'data' or 'execute'.");
}

const avatarCommand = require("./MainBOT/OtherFunCommand/BasicCommand/avatar.js");
if ("data" in avatarCommand && "execute" in avatarCommand) {
    commands.push(avatarCommand.data.toJSON());
} else {
    console.warn("⚠️ avatar.js is missing 'data' or 'execute'.");
}

const deathbattleJJKCommand = require("./MainBOT/OtherFunCommand/InteractiveUserCommand/deathbattleJJK.js");
if ("data" in deathbattleJJKCommand && "execute" in deathbattleJJKCommand) {
    commands.push(deathbattleJJKCommand.data.toJSON());
} else {
    console.warn("⚠️ deathbattleJJK.js is missing 'data' or 'execute'.");
}

const groupInformCommand = require("./MainBOT/OtherFunCommand/BasicCommand/groupInform.js");
if ("data" in groupInformCommand && "execute" in groupInformCommand) {
    commands.push(groupInformCommand.data.toJSON());
} else {
    console.warn("⚠️ groupInform.js is missing 'data' or 'execute'.");
}

const pingCommand = require("./MainBOT/OtherFunCommand/BasicCommand/ping.js");
if ("data" in pingCommand && "execute" in pingCommand) {
    commands.push(pingCommand.data.toJSON());
} else {
    console.warn("⚠️ ping.js is missing 'data' or 'execute'.");
}

const roleinfoCommand = require("./MainBOT/OtherFunCommand/BasicCommand/roleinfo.js");
if ("data" in roleinfoCommand && "execute" in roleinfoCommand) {
    commands.push(roleinfoCommand.data.toJSON());
} else {
    console.warn("⚠️ roleinfo.js is missing 'data' or 'execute'.");
}

const tutorialHelpCommand = require("./MainBOT/OtherFunCommand/BasicCommand/tutorialHelp.js");
if ("data" in tutorialHelpCommand && "execute" in tutorialHelpCommand) {
    commands.push(tutorialHelpCommand.data.toJSON());
} else {
    console.warn("⚠️ tutorialHelp.js is missing 'data' or 'execute'.");
}

const redditCommand = require("./MainBOT/OtherFunCommand/API-Website/Reddit/reddit.js");
if ("data" in redditCommand && "execute" in redditCommand) {
    commands.push(redditCommand.data.toJSON());
} else {
    console.warn("⚠️ reddit.js is missing 'data' or 'execute'.");
}

const videoCommand = require("./MainBOT/OtherFunCommand/Video/video.js");
if ("data" in videoCommand && "execute" in videoCommand) {
    commands.push(videoCommand.data.toJSON());
} else {
    console.warn("⚠️ video.js is missing 'data' or 'execute'.");
}

// Auto-load everything from MusicFunction folder
loadCommandsFrom(path.join(__dirname, "../FumoBOT/MainBOT/OtherFunCommand/MusicFunction"));

// ---------------- Deploy Commands ---------------- \\
const rest = new REST({ version: "10" }).setToken(token);

(async () => {
    try {
        console.log("🔄 Started refreshing application (/) commands.");

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId), // guild deploy
            { body: commands }
        );

        console.log("✅ Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("❌ Error deploying commands:", error);
    }
})();

// (async () => {
//     try {
//         console.log('Clearing guild application (/) commands...');

//         await rest.put(
//             Routes.applicationGuildCommands(clientId, guildId),
//             { body: [] }, // <-- empty array clears all
//         );

//         console.log(`Successfully cleared all commands in guild ${guildId}.`);
//     } catch (error) {
//         console.error(error);
//     }
// })();