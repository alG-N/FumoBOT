const { EmbedBuilder } = require('discord.js');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const SellValidationService = require('./SellValidationService');
const SellTransactionService = require('./SellTransactionService');
const SellUIService = require('./SellUIService');

class SellService {
    static async handleSellCommand(message, args) {
        const userId = message.author.id;
        
        const restriction = checkRestrictions(userId);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const parsed = SellValidationService.parseSellCommand(args);

        if (!parsed.valid) {
            return message.reply({ 
                embeds: [SellUIService.createErrorEmbed(parsed.error, parsed.details)] 
            });
        }

        if (parsed.type === 'SINGLE') {
            return await this.handleSingleSell(message, userId, parsed);
        } else if (parsed.type === 'BULK') {
            return await this.handleBulkSell(message, userId, parsed);
        }
    }

    static async handleSingleSell(message, userId, parsed) {
        const { fumoName, quantity } = parsed;

        const validation = await SellValidationService.validateSingleSell(userId, fumoName, quantity);
        if (!validation.valid) {
            return message.reply({ 
                embeds: [SellUIService.createErrorEmbed(validation.error, validation.details)] 
            });
        }

        const calculation = await SellTransactionService.calculateSellReward(
            userId, 
            fumoName, 
            quantity
        );

        const confirmEmbed = SellUIService.createConfirmationEmbed(
            fumoName,
            quantity,
            calculation.reward,
            calculation.rewardType,
            calculation.multipliers
        );

        const confirmMsg = await message.reply({ embeds: [confirmEmbed] });
        const confirmed = await SellUIService.awaitConfirmation(confirmMsg, userId);

        if (!confirmed) {
            return message.reply('Sale canceled.');
        }

        const result = await SellTransactionService.executeSingleSell(
            userId,
            fumoName,
            quantity,
            calculation.reward,
            calculation.rewardType
        );

        if (!result.success) {
            return message.reply({ 
                embeds: [SellUIService.createErrorEmbed('TRANSACTION_FAILED')] 
            });
        }

        return message.reply({ 
            embeds: [SellUIService.createSuccessEmbed(fumoName, quantity, calculation.reward, calculation.rewardType)] 
        });
    }

    static async handleBulkSell(message, userId, parsed) {
        const { rarity, tag } = parsed;

        const validation = await SellValidationService.validateBulkSell(userId, rarity, tag);
        if (!validation.valid) {
            return message.reply({ 
                embeds: [SellUIService.createErrorEmbed(validation.error, validation.details)] 
            });
        }

        const calculation = await SellTransactionService.calculateBulkSellReward(
            userId,
            rarity,
            tag,
            validation.fumos
        );

        const confirmEmbed = SellUIService.createBulkConfirmationEmbed(
            rarity,
            tag,
            calculation.totalFumos,
            calculation.totalReward,
            calculation.rewardType,
            calculation.multipliers
        );

        const confirmMsg = await message.reply({ embeds: [confirmEmbed] });
        const confirmed = await SellUIService.awaitConfirmation(confirmMsg, userId);

        if (!confirmed) {
            return message.reply('Sale canceled.');
        }

        const result = await SellTransactionService.executeBulkSell(
            userId,
            validation.fumos,
            calculation.totalReward,
            calculation.rewardType,
            tag
        );

        if (!result.success) {
            return message.reply({ 
                embeds: [SellUIService.createErrorEmbed('TRANSACTION_FAILED')] 
            });
        }

        return message.reply({ 
            embeds: [SellUIService.createBulkSuccessEmbed(rarity, tag, calculation.totalFumos, calculation.totalReward, calculation.rewardType)] 
        });
    }
}

module.exports = SellService;