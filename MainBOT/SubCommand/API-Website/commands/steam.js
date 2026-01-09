const { SlashCommandBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const { handleSaleCommand } = require('../handlers/steamSaleHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steam')
        .setDescription('Steam game utilities')
        .addSubcommand(subcommand =>
            subcommand
                .setName('sale')
                .setDescription('Find games on sale with a minimum discount percentage')
                .addIntegerOption(option =>
                    option
                        .setName('discount')
                        .setDescription('Minimum discount percentage (0-100, 0 = free games)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)
                )
                .addBooleanOption(option =>
                    option
                        .setName('detailed')
                        .setDescription('Show detailed info (owners, ratings) from SteamSpy')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const accessCheck = await checkAccess(interaction, AccessType.SUB);
        if (accessCheck.blocked) {
            return interaction.reply({ embeds: [accessCheck.embed], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'sale') {
            await handleSaleCommand(interaction);
        }
    }
};