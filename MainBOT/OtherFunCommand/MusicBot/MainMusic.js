const fs = require("fs");
const path = require("path");

module.exports = (client) => {
    const musicCommandsPath = path.join(__dirname);
    const commandFiles = fs.readdirSync(musicCommandsPath).filter(file => file.endsWith(".js") && file !== "MainMusic.js");

    for (const file of commandFiles) {
        const command = require(path.join(musicCommandsPath, file));
        if (command && command.data && command.data.name) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`Command in file ${file} is missing 'data' or 'data.name' property.`);
        }
    }
};
