/**
 * Admin Command - Bot Owner Only
 * Combined command for giving items, fumos, currency
 */

const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { OWNER_IDS, DEVELOPER_ID, isOwner, ITEM_RARITIES, FUMO_TRAITS, CURRENCY_TYPES, AMOUNT_SUFFIXES } = require('../Config/ownerConfig');

// Lazy load to avoid circular deps
let db, FumoPool;

function getDb() {
    if (!db) db = require('../../MainCommand/Core/Database/dbSetting');
    return db;
}

function getFumoPool() {
    if (!FumoPool) FumoPool = require('../../MainCommand/Data/FumoPool');
    return FumoPool;
}

function isAuthorized(userId) {
    return userId === DEVELOPER_ID || OWNER_IDS.includes(userId);
}

function parseAmount(amountStr) {
    if (!amountStr) return null;
    const str = amountStr.toLowerCase().trim();
    
    for (const [suffix, multiplier] of Object.entries(AMOUNT_SUFFIXES)) {
        if (str.endsWith(suffix)) {
            const numPart = parseFloat(str.slice(0, -suffix.length));
            if (!isNaN(numPart)) return Math.floor(numPart * multiplier);
        }
    }
    
    const num = parseFloat(str);
    return isNaN(num) ? null : Math.floor(num);
}

async function addItem(userId, itemName, rarity, quantity) {
    const db = getDb();
    const fullItemName = `${itemName}(${rarity})`;
    
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO userInventory (userId, fumoName, quantity, rarity) 
             VALUES (?, ?, ?, ?)
             ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`,
            [userId, fullItemName, quantity, rarity, quantity],
            (err) => err ? reject(err) : resolve({ success: true, itemName: fullItemName })
        );
    });
}

async function addFumo(userId, fumoName, rarity, trait, quantity) {
    const db = getDb();
    let fullName = fumoName;
    
    const traitInfo = FUMO_TRAITS.find(t => t.value === trait);
    if (traitInfo && traitInfo.suffix) {
        fullName = `${fumoName}${traitInfo.suffix}`;
    }
    
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO userInventory (userId, fumoName, quantity, rarity) 
             VALUES (?, ?, ?, ?)
             ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`,
            [userId, fullName, quantity, rarity, quantity],
            (err) => err ? reject(err) : resolve({ success: true, fumoName: fullName })
        );
    });
}

async function addCurrency(userId, currencyType, amount) {
    const db = getDb();
    const column = currencyType === 'coins' ? 'coins' : 'gems';
    
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE userCoins SET ${column} = ${column} + ? WHERE userId = ?`,
            [amount, userId],
            function(err) {
                if (err) return reject(err);
                if (this.changes === 0) {
                    // User doesn't exist, create them
                    db.run(
                        `INSERT INTO userCoins (userId, ${column}) VALUES (?, ?)`,
                        [userId, amount],
                        (err2) => err2 ? reject(err2) : resolve({ success: true })
                    );
                } else {
                    resolve({ success: true });
                }
            }
        );
    });
}

async function removeCurrency(userId, currencyType, amount) {
    const db = getDb();
    const column = currencyType === 'coins' ? 'coins' : 'gems';
    
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE userCoins SET ${column} = MAX(0, ${column} - ?) WHERE userId = ?`,
            [amount, userId],
            (err) => err ? reject(err) : resolve({ success: true })
        );
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('owneradmin')
        .setDescription('Bot owner admin commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('additem')
            .setDescription('Add an item to a user')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption(opt => opt.setName('item').setDescription('Item name').setRequired(true))
            .addStringOption(opt => opt
                .setName('rarity')
                .setDescription('Item rarity')
                .setRequired(true)
                .addChoices(...ITEM_RARITIES.map(r => ({ name: r.label, value: r.value }))))
            .addStringOption(opt => opt.setName('quantity').setDescription('Amount to add (e.g., 10, 1k, 1m)').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('addfumo')
            .setDescription('Add a fumo to a user')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption(opt => opt.setName('fumo').setDescription('Fumo name').setRequired(true).setAutocomplete(true))
            .addStringOption(opt => opt
                .setName('trait')
                .setDescription('Fumo trait')
                .setRequired(false)
                .addChoices(...FUMO_TRAITS.map(t => ({ name: t.label, value: t.value }))))
            .addStringOption(opt => opt.setName('quantity').setDescription('Amount to add').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('addcurrency')
            .setDescription('Add currency to a user')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption(opt => opt
                .setName('type')
                .setDescription('Currency type')
                .setRequired(true)
                .addChoices(...CURRENCY_TYPES.map(c => ({ name: c.label, value: c.value }))))
            .addStringOption(opt => opt.setName('amount').setDescription('Amount to add (e.g., 10k, 1m, 1b)').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('removecurrency')
            .setDescription('Remove currency from a user')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption(opt => opt
                .setName('type')
                .setDescription('Currency type')
                .setRequired(true)
                .addChoices(...CURRENCY_TYPES.map(c => ({ name: c.label, value: c.value }))))
            .addStringOption(opt => opt.setName('amount').setDescription('Amount to remove').setRequired(true))),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        
        if (focused.name === 'fumo') {
            try {
                const pool = getFumoPool();
                const fumos = pool.getRaw();
                const search = focused.value.toLowerCase();
                
                const matches = fumos
                    .filter(f => f.name.toLowerCase().includes(search))
                    .slice(0, 25)
                    .map(f => ({ name: `${f.name} (${f.rarity})`, value: f.name }));
                
                await interaction.respond(matches);
            } catch {
                await interaction.respond([]);
            }
        }
    },

    async execute(interaction) {
        const userId = interaction.user.id;
        
        if (!isAuthorized(userId)) {
            return interaction.reply({ content: '❌ This command is restricted to bot owners only.', ephemeral: true });
        }
        
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            let result;
            let embed;
            
            switch (subcommand) {
                case 'additem': {
                    const itemName = interaction.options.getString('item');
                    const rarity = interaction.options.getString('rarity');
                    const quantity = parseAmount(interaction.options.getString('quantity')) || 1;
                    
                    result = await addItem(targetUser.id, itemName, rarity, quantity);
                    embed = new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('✅ Item Added')
                        .setDescription(`Added **${quantity}x ${result.itemName}** to ${targetUser}`)
                        .setTimestamp();
                    break;
                }
                
                case 'addfumo': {
                    const fumoName = interaction.options.getString('fumo');
                    const trait = interaction.options.getString('trait') || 'normal';
                    const quantity = parseAmount(interaction.options.getString('quantity')) || 1;
                    
                    const pool = getFumoPool();
                    const fumo = pool.getRaw().find(f => f.name === fumoName);
                    if (!fumo) {
                        return interaction.editReply({ content: `❌ Fumo "${fumoName}" not found.` });
                    }
                    
                    result = await addFumo(targetUser.id, fumoName, fumo.rarity, trait, quantity);
                    embed = new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('✅ Fumo Added')
                        .setDescription(`Added **${quantity}x ${result.fumoName}** (${fumo.rarity}) to ${targetUser}`)
                        .setTimestamp();
                    break;
                }
                
                case 'addcurrency': {
                    const currencyType = interaction.options.getString('type');
                    const amount = parseAmount(interaction.options.getString('amount'));
                    
                    if (!amount || amount <= 0) {
                        return interaction.editReply({ content: '❌ Invalid amount.' });
                    }
                    
                    await addCurrency(targetUser.id, currencyType, amount);
                    const emoji = currencyType === 'coins' ? '💰' : '💎';
                    embed = new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('✅ Currency Added')
                        .setDescription(`Added **${amount.toLocaleString()} ${emoji}** to ${targetUser}`)
                        .setTimestamp();
                    break;
                }
                
                case 'removecurrency': {
                    const currencyType = interaction.options.getString('type');
                    const amount = parseAmount(interaction.options.getString('amount'));
                    
                    if (!amount || amount <= 0) {
                        return interaction.editReply({ content: '❌ Invalid amount.' });
                    }
                    
                    await removeCurrency(targetUser.id, currencyType, amount);
                    const emoji = currencyType === 'coins' ? '💰' : '💎';
                    embed = new EmbedBuilder()
                        .setColor('Orange')
                        .setTitle('✅ Currency Removed')
                        .setDescription(`Removed **${amount.toLocaleString()} ${emoji}** from ${targetUser}`)
                        .setTimestamp();
                    break;
                }
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('[OwnerAdmin] Error:', error);
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
    }
};
