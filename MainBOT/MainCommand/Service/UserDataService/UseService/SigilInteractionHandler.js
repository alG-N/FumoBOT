const { confirmSigilActivation, cancelSigilActivation } = require('./ItemUseHandler/SgilHandler');
const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');

let isRegistered = false;

function registerSigilInteractionHandler(client) {
    if (isRegistered) return;
    isRegistered = true;

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        
        const customId = interaction.customId;
        
        if (customId.startsWith('sigil_confirm_')) {
            if (!checkButtonOwnership(interaction, 'sigil_confirm', null, false)) {
                return interaction.reply({ 
                    content: "❌ You can't use someone else's button.", 
                    ephemeral: true 
                });
            }
            await confirmSigilActivation(interaction, client);
        } else if (customId.startsWith('sigil_cancel_')) {
            if (!checkButtonOwnership(interaction, 'sigil_cancel', null, false)) {
                return interaction.reply({ 
                    content: "❌ You can't use someone else's button.", 
                    ephemeral: true 
                });
            }
            await cancelSigilActivation(interaction, client);
        }
    });
}

module.exports = { registerSigilInteractionHandler };
