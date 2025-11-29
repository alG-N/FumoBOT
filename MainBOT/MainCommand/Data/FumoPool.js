const fs = require('fs');
const path = require('path');

const fumoDataPath = path.join(__dirname, 'fumos.json');
let fumoData;

try {
  const rawData = fs.readFileSync(fumoDataPath, 'utf8');
  fumoData = JSON.parse(rawData);
  console.log(`✅ Loaded ${fumoData.totalFumos} fumos from database`);
} catch (error) {
  console.error('❌ Failed to load fumos.json:', error.message);
  console.error('   Make sure to run the migration script first!');
  process.exit(1);
}

class FumoPool {
  static getForCrate() {
    return fumoData.fumos
      .filter(f => f.availability.crate)
      .map(f => ({
        name: `${f.name}(${f.rarity})`,
        picture: f.picture,
        rarity: f.rarity
      }));
  }

  static getForEvent() {
    return fumoData.fumos
      .filter(f => f.availability.event)
      .map(f => ({
        name: `${f.name}(${f.rarity})`,
        rarity: f.rarity,
        picture: f.picture
      }));
  }

  static getForPray() {
    return fumoData.fumos
      .filter(f => f.availability.pray)
      .map(f => ({
        name: `${f.name}(${f.rarity})`,
        picture: f.picture,
        rarity: f.rarity
      }));
  }
  static getForLibrary() {
    return fumoData.fumos
      .filter(f => f.availability.library)
      .map(f => ({
        name: `${f.name}(${f.rarity})`
      }));
  }

  static getForMarket() {
    return fumoData.fumos
      .filter(f => f.availability.market && f.marketPrice !== null)
      .map(f => ({
        name: `${f.name}(${f.rarity})`,
        price: f.marketPrice
      }));
  }

  static getRaw() {
    return fumoData.fumos;
  }

  static getById(id) {
    return fumoData.fumos.find(f => f.id === id) || null;
  }

  static getByRarity(rarity, pool = null) {
    let fumos = fumoData.fumos.filter(f => f.rarity === rarity);
    
    if (pool) {
      fumos = fumos.filter(f => f.availability[pool]);
    }
    
    return fumos.map(f => ({
      name: `${f.name}(${f.rarity})`,
      picture: f.picture,
      rarity: f.rarity
    }));
  }

  static search(query) {
    const lowerQuery = query.toLowerCase();
    return fumoData.fumos
      .filter(f => f.name.toLowerCase().includes(lowerQuery))
      .map(f => ({
        name: `${f.name}(${f.rarity})`,
        picture: f.picture,
        rarity: f.rarity,
        availability: f.availability
      }));
  }

  static getRandom(pool) {
    if (!pool || pool.length === 0) {
      throw new Error('Cannot get random fumo from empty pool');
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  static getStats() {
    const byRarity = {};
    const byAvailability = {
      crate: 0,
      event: 0,
      pray: 0,
      library: 0,
      market: 0
    };

    fumoData.fumos.forEach(f => {
      byRarity[f.rarity] = (byRarity[f.rarity] || 0) + 1;
      Object.keys(f.availability).forEach(key => {
        if (f.availability[key]) byAvailability[key]++;
      });
    });

    return {
      total: fumoData.totalFumos,
      byRarity,
      byAvailability,
      version: fumoData.version,
      generatedAt: fumoData.generatedAt
    };
  }

  static validate() {
    const errors = [];
    const seenIds = new Set();

    fumoData.fumos.forEach((fumo, idx) => {
      if (!fumo.id) errors.push(`Fumo ${idx}: Missing ID`);
      if (!fumo.name) errors.push(`Fumo ${idx}: Missing name`);
      if (!fumo.rarity) errors.push(`Fumo ${idx}: Missing rarity`);

      if (seenIds.has(fumo.id)) {
        errors.push(`Duplicate ID: ${fumo.id}`);
      }
      seenIds.add(fumo.id);

      const inGacha = fumo.availability.crate || fumo.availability.event || fumo.availability.pray;
      if (inGacha && !fumo.picture) {
        errors.push(`${fumo.name}(${fumo.rarity}): No picture but available in gacha`);
      }

      if (fumo.availability.market && !fumo.marketPrice) {
        errors.push(`${fumo.name}(${fumo.rarity}): Available in market but no price`);
      }
    });

    if (errors.length > 0) {
      console.error('❌ Fumo validation failed:');
      errors.forEach(err => console.error(`   ${err}`));
      return { valid: false, errors };
    }

    console.log(`✅ Validated ${fumoData.totalFumos} fumos successfully`);
    return { valid: true, errors: [] };
  }

  static getMetadata() {
    return {
      version: fumoData.version,
      generatedAt: fumoData.generatedAt,
      totalFumos: fumoData.totalFumos
    };
  }
}

if (process.env.NODE_ENV === 'development' || process.env.VALIDATE_FUMOS === 'true') {
  const validation = FumoPool.validate();
  if (!validation.valid) {
    console.error('⚠️  Fumo database has validation errors!');
    console.error('   The bot will continue running, but some features may not work correctly.');
  }
}

module.exports = FumoPool;
module.exports.getCrateFumos = FumoPool.getForCrate;
module.exports.getEventFumos = FumoPool.getForEvent;
module.exports.getPrayFumos = FumoPool.getForPray;
module.exports.getLibraryFumos = FumoPool.getForLibrary;
module.exports.getMarketFumos = FumoPool.getForMarket;