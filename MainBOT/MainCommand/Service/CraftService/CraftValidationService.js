const { getRecipe } = require('./CraftRecipeService');
const { CRAFT_CONFIG } = require('../../Configuration/craftConfig');

function validateCraftAmount(amount) {
    if (!Number.isInteger(amount) || amount <= 0) {
        return {
            valid: false,
            error: 'INVALID_AMOUNT',
            message: 'Craft amount must be a positive integer.'
        };
    }

    if (amount > CRAFT_CONFIG.MAX_CRAFT_AMOUNT) {
        return {
            valid: false,
            error: 'AMOUNT_TOO_LARGE',
            message: `Cannot craft more than ${CRAFT_CONFIG.MAX_CRAFT_AMOUNT} at once.`
        };
    }

    return { valid: true };
}

function validateRecipe(itemName, craftType) {
    const recipe = getRecipe(itemName, craftType);

    if (!recipe) {
        return {
            valid: false,
            error: 'RECIPE_NOT_FOUND',
            message: `Recipe for "${itemName}" does not exist.`
        };
    }

    return { valid: true, recipe };
}

function validateResources(recipe, amount, userCoins, userGems) {
    const totalCoins = recipe.resources.coins * amount;
    const totalGems = recipe.resources.gems * amount;
    const missing = [];

    if (userCoins < totalCoins) {
        missing.push(`💰 ${totalCoins} coins (you have ${userCoins})`);
    }

    if (userGems < totalGems) {
        missing.push(`💎 ${totalGems} gems (you have ${userGems})`);
    }

    if (missing.length > 0) {
        return {
            valid: false,
            error: 'INSUFFICIENT_CURRENCY',
            missing
        };
    }

    return { valid: true, totalCoins, totalGems };
}

function validateMaterials(recipe, amount, userInventory) {
    const missing = [];

    for (const [reqItem, reqQty] of Object.entries(recipe.requires)) {
        const totalRequired = reqQty * amount;
        const owned = userInventory[reqItem] || 0;

        if (owned < totalRequired) {
            missing.push(`${totalRequired}x ${reqItem} (you have ${owned})`);
        }
    }

    if (missing.length > 0) {
        return {
            valid: false,
            error: 'INSUFFICIENT_MATERIALS',
            missing
        };
    }

    return { valid: true };
}

function validateFullCraft(itemName, amount, craftType, userData) {
    const amountCheck = validateCraftAmount(amount);
    if (!amountCheck.valid) return amountCheck;

    const recipeCheck = validateRecipe(itemName, craftType);
    if (!recipeCheck.valid) return recipeCheck;

    const { recipe } = recipeCheck;

    const materialsCheck = validateMaterials(recipe, amount, userData.inventory);
    if (!materialsCheck.valid) return materialsCheck;

    const resourcesCheck = validateResources(recipe, amount, userData.coins, userData.gems);
    if (!resourcesCheck.valid) return resourcesCheck;

    return {
        valid: true,
        recipe,
        totalCoins: resourcesCheck.totalCoins,
        totalGems: resourcesCheck.totalGems
    };
}

function calculateMaxCraftable(recipe, userInventory, userCoins, userGems) {
    let maxCraftable = Infinity;

    for (const [reqItem, reqQty] of Object.entries(recipe.requires)) {
        const availableQty = userInventory[reqItem] || 0;
        maxCraftable = Math.min(maxCraftable, Math.floor(availableQty / reqQty));
    }

    if (recipe.resources.coins > 0) {
        maxCraftable = Math.min(maxCraftable, Math.floor(userCoins / recipe.resources.coins));
    }

    if (recipe.resources.gems > 0) {
        maxCraftable = Math.min(maxCraftable, Math.floor(userGems / recipe.resources.gems));
    }

    return isFinite(maxCraftable) && maxCraftable >= 1 ? maxCraftable : 0;
}

module.exports = {
    validateCraftAmount,
    validateRecipe,
    validateResources,
    validateMaterials,
    validateFullCraft,
    calculateMaxCraftable
};