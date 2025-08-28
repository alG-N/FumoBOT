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
const sayCommand = require("../FumoBOT/MainBOT/BotTrollinCommand(Owner)/say.js");
if ("data" in sayCommand && "execute" in sayCommand) {
    commands.push(sayCommand.data.toJSON());
} else {
    console.warn("⚠️ say.js is missing 'data' or 'execute'.");
}

const afkCommand = require("../FumoBOT/MainBOT/OtherFunCommand/afk");
if ("data" in afkCommand && "execute" in afkCommand) {
    commands.push(afkCommand.data.toJSON());
} else {
    console.warn("⚠️ afk.js is missing 'data' or 'execute'.");
}

const animeCommand = require("../FumoBOT/MainBOT/OtherFunCommand/anime");
if ("data" in animeCommand && "execute" in animeCommand) {
    commands.push(animeCommand.data.toJSON());
} else {
    console.warn("⚠️ anime.js is missing 'data' or 'execute'.");
}

// Auto-load everything from MusicBot folder
loadCommandsFrom(path.join(__dirname, "../FumoBOT/MainBOT/OtherFunCommand/MusicBot"));

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
