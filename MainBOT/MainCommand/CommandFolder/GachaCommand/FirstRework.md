# Re-WORKING Gacha Folder Structure

```
MainBOT/
├── MainCommand/
│   └── Gacha/
│       ├── commands/              # User-facing commands
│       │   ├── crategacha.js     # Main gacha command
│       │   ├── eventgacha.js     # Event gacha command
│       │   ├── flip.js           # Coin flip game
│       │   ├── gamble.js         # PvP gambling
│       │   ├── mysterycrate.js   # Mystery crate game
│       │   └── slot.js           # Slot machine game
│       │
│       ├── services/           
│       │   ├── gacha/
│       │   │   ├── rarityCalculator.js    # Rarity roll logic
│       │   │   ├── pitySystem.js          # Pity counter management
│       │   │   ├── boostManager.js        # Boost calculations
│       │   │   └── autoRollService.js     # Auto-roll logic
│       │   │
│       │   ├── games/
│       │   │   ├── flipService.js         # Flip game logic
│       │   │   ├── gambleService.js       # Gamble game logic
│       │   │   ├── crateService.js        # Mystery crate logic
│       │   │   └── slotService.js         # Slot machine logic
│       │   │
│       │   └── inventory/
│       │       ├── fumoManager.js         # Add/remove fumos
│       │       └── balanceManager.js      # Coins/gems operations
│       │
│       ├── utils/                 # Shared utilities
│       │   ├── database.js        # DB helper functions (ONE PLACE)
│       │   ├── formatting.js      # Number formatting, text utils
│       │   ├── validation.js      # Input validation & parsing
│       │   ├── cooldowns.js       # Cooldown management
│       │   └── sessions.js        # Active session tracking
│       │
│       ├── middleware/            # Request interceptors
│       │   ├── restrictions.js   # Maintenance & ban checks
│       │   ├── rateLimiter.js    # Rate limiting logic
│       │   └── buttonOwnership.js # Button interaction validation
│       │
│       ├── config/               # Configuration files
│       │   ├── gacha.config.js   # Gacha-specific config
│       │   ├── games.config.js   # Games config (flip, slot, etc.)
│       │   └── rewards.config.js # Reward multipliers & payouts
│       │
│       └── models/               # Data structures (optional)
│           ├── GachaResult.js
│           ├── GameSession.js
│           └── UserStats.js
```

---

## Why This Structure?

### 1. **Separation of Concerns**
- **Commands** = Handle Discord interactions only
- **Services** = Pure business logic (reusable, testable)
- **Utils** = Helper functions used everywhere
- **Middleware** = Cross-cutting concerns (auth, logging, etc.)

### 2. **Single Responsibility**
Each file does ONE thing well:
- ❌ Before: `crategacha.js` = 1800 lines doing everything
- ✅ After: `crategacha.js` (150 lines) calls services that do the work

### 3. **Reusability**
Services can be used by multiple commands:
```javascript
// Multiple commands can use the same service
const { deductBalance, addBalance } = require('../services/inventory/balanceManager');
```

### 4. **Testability**
Services have no Discord dependencies, so you can unit test them easily:
```javascript
// Easy to test without mocking Discord.js
const { calculateRarity } = require('../services/gacha/rarityCalculator');
const result = calculateRarity(userId, boosts, hasBook);
```

---

## Migration Strategy

Don't refactor everything at once! Here's the order:

### **Phase 1: Extract Shared Code (Week 1)**
1. Create `utils/database.js` - Move all DB helpers here
2. Create `utils/formatting.js` - Move `formatNumber`, etc.
3. Create `utils/validation.js` - Move `parseBet`, input validation
4. Create `middleware/restrictions.js` - Move ban/maintenance checks
5. Update all 6 command files to import from these utils

**Result**: ~500 lines of duplication removed

---

### **Phase 2: Extract Configuration (Week 2)**
1. Create `config/gacha.config.js`
2. Move all constants (COOLDOWN_DURATION, RARITY_PRIORITY, etc.)
3. Create `config/games.config.js` for game-specific settings
4. Create `config/rewards.config.js` for payout tables

**Result**: Easy to tweak game balance without touching code

---

### **Phase 3: Extract Services (Week 3-4)**
Start with the most complex: `crategacha.js`

1. Create `services/gacha/rarityCalculator.js`
   - Extract `calculateRarity()` function
   - Extract `updatePityCounters()` function

2. Create `services/gacha/boostManager.js`
   - Extract `getUserBoosts()` function
   - Extract `calculateTotalLuckMultiplier()` function

3. Create `services/inventory/fumoManager.js`
   - Extract `selectAndAddFumo()` function

4. Update `crategacha.js` to call these services

**Result**: Main command file becomes orchestrator, not implementer

---

### **Phase 4: Clean Up & Polish (Week 5)**
1. Add JSDoc comments to all services
2. Remove dead code
3. Add proper error logging
4. Implement session cleanup
5. Add input validation middleware

---

## Code Examples

### Before (crategacha.js - excerpt):
```javascript
const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
};

async function getUserBoosts(userId) {
    // 100 lines of boost logic...
}

async function calculateRarity(userId, boosts, row, hasBook) {
    // 50 lines of rarity calculation...
}

client.on('messageCreate', async message => {
    // 200 lines of command handling...
    const boosts = await getUserBoosts(userId);
    const result = await calculateRarity(userId, boosts, row, hasBook);
    // ...
});
```

### After (crategacha.js):
```javascript
const { get, run, all } = require('../utils/database');
const { checkRestrictions } = require('../middleware/restrictions');
const { formatNumber } = require('../utils/formatting');
const boostManager = require('../services/gacha/boostManager');
const rarityCalculator = require('../services/gacha/rarityCalculator');
const { GACHA_CONFIG } = require('../config/gacha.config');

module.exports = (client, fumos) => {
    client.on('messageCreate', async message => {
        if (!message.content.startsWith('.crategacha')) return;

        // Middleware checks
        const restriction = await checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        // Fetch data
        const userData = await get(
            'SELECT * FROM userCoins WHERE userId = ?',
            [message.author.id]
        );

        const boosts = await boostManager.getUserBoosts(message.author.id);
        
        // Display shop
        const embed = createShopEmbed(userData, boosts);
        await message.channel.send({ embeds: [embed], components: [createButtons()] });
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;
        
        const [action, userId] = interaction.customId.split('_');
        
        if (action === 'buy1fumo') {
            await handleSingleRoll(interaction, fumos, userId);
        }
        // ... other handlers
    });
};

// Helper functions stay in this file since they're UI-specific
function createShopEmbed(userData, boosts) { /* ... */ }
function createButtons() { /* ... */ }
```

### New Service File (services/gacha/boostManager.js):
```javascript
const { get, all, run } = require('../../utils/database');

/**
 * Fetches all active boosts for a user
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object>} Boost multipliers and flags
 */
async function getUserBoosts(userId) {
    const now = Date.now();
    
    const [ancientRelic, mysteriousCube, petBoosts] = await Promise.all([
        get(
            `SELECT multiplier, expiresAt FROM activeBoosts 
             WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`,
            [userId]
        ),
        get(
            `SELECT multiplier, expiresAt FROM activeBoosts 
             WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`,
            [userId]
        ),
        all(
            `SELECT multiplier FROM activeBoosts 
             WHERE userId = ? AND type = 'luck'`,
            [userId]
        )
    ]);

    return {
        ancientLuckMultiplier: (ancientRelic && ancientRelic.expiresAt > now) 
            ? ancientRelic.multiplier 
            : 1,
        mysteriousLuckMultiplier: (mysteriousCube && mysteriousCube.expiresAt > now) 
            ? mysteriousCube.multiplier 
            : 1,
        petBoost: petBoosts.reduce((acc, row) => acc * row.multiplier, 1)
    };
}

/**
 * Calculates total luck multiplier from all sources
 * @param {Object} boosts - Boost object from getUserBoosts()
 * @param {boolean} isBoostActive - Is user in boost mode?
 * @param {number} rollsLeft - Bonus rolls remaining
 * @returns {number} Final multiplier
 */
function calculateTotalLuckMultiplier(boosts, isBoostActive, rollsLeft) {
    let multiplier = boosts.ancientLuckMultiplier *
        boosts.mysteriousLuckMultiplier *
        boosts.petBoost;

    if (isBoostActive) {
        multiplier *= 25;
    } else if (rollsLeft > 0) {
        multiplier *= 2;
    }

    return multiplier;
}

module.exports = {
    getUserBoosts,
    calculateTotalLuckMultiplier
};
```

---

## Benefits of This Structure

### ✅ **Easy to Find Things**
- Need to change rarity chances? → `config/gacha.config.js`
- Bug in boost calculation? → `services/gacha/boostManager.js`
- Add new validation? → `utils/validation.js`

### ✅ **Easy to Test**
```javascript
// test/services/gacha/boostManager.test.js
const { calculateTotalLuckMultiplier } = require('../../../services/gacha/boostManager');

test('Boost mode multiplies by 25', () => {
    const boosts = { ancientLuckMultiplier: 2, mysteriousLuckMultiplier: 1, petBoost: 1 };
    const result = calculateTotalLuckMultiplier(boosts, true, 0);
    expect(result).toBe(50); // 2 * 25
});
```

### ✅ **Easy to Extend**
Want to add a new gacha type?
1. Create `commands/newgacha.js` (copy structure from existing)
2. Reuse services from `services/gacha/`
3. Add config to `config/gacha.config.js`
4. Done!

### ✅ **Easy to Debug**
- Logs clearly show which service failed
- Services are small and focused
- No 1800-line files to search through

---

## Getting Started

1. **Create the folder structure** (just empty folders/files first)
2. **Start with utils** - Extract database helpers (biggest win)
3. **One file at a time** - Don't try to refactor everything at once
4. **Test as you go** - Make sure each refactored piece still works
5. **Delete old code** - Once migrated, remove the old duplicate code

**Time estimate**: 2-4 weeks working a few hours per day

**Reward**: Maintainable, professional codebase you'll be proud of

Ready to start? I'd suggest beginning with `utils/database.js` - want me to show you exactly how to write that file?


MainBOT/
├── FumoBOTMain.js
│
├── config/                                # NEW - just settings
│   └── constants.js                       # Rarities, rates, limits
│
├── MainCommand/
│   ├── Database/
│   │   ├── db.js
│   │   ├── schema.js
│   │   ├── backup.js
│   │   ├── PassiveIncome/
│   │   │   └── income.js
│   │   └── utils/                         # NEW - shared DB utilities
│   │       └── retry.js                   # Move runAsync here
│   │
│   ├── Farming/
│   │   ├── FarmManagement.js              # Keep as-is for now
│   │   ├── useFragment.js
│   │   └── utils/                         # NEW - farming utilities
│   │       └── fumoStats.js               # getStatsByRarity, getRarity
│   │
│   ├── Gacha/                             # Keep as-is
│   ├── Market/                            # Keep as-is
│   ├── PetManagement/                     # Keep as-is
│   ├── UserData/                          # Keep as-is
│   ├── Admin/                             # Keep as-is
│   ├── Storage/                           # Keep as-is
│   ├── Craft/                             # Keep as-is
│   ├── PrayCMD/                           # Keep as-is
│   ├── FumoData/                          # Keep as-is
│   ├── Tutorial/                          # Keep as-is
│   ├── Banned/                            # Keep as-is
│   └── Maintenace/                        # Keep as-is
│
├── SubCommand/                            # Keep as-is
│   ├── API-Website/
│   ├── BasicCommand/
│   └── MusicFunction/
│
└── utils/                                 # NEW - shared utilities
    ├── accessControl.js                   # Ban/maintenance check
    ├── formatting.js                      # formatNumber, etc.
    └── embedBuilder.js                    # Reusable embeds



    