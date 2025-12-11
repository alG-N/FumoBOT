/**
 * Migration Script: Consolidate all fumo storage files into single JSON
 * Run this ONCE to create the unified fumos.json
 * 
 * Usage: node migrate-fumos.js
 */

const fs = require('fs');
const path = require('path');

// Import all existing storage files
const crateFumos = require('./MainBOT/MainCommand/Data/BackupOld/NormalCrateFumoStorage.js');
const eventFumos = require('./MainBOT/MainCommand/Data/BackupOld/EventFumoStorage.js');
const prayFumos = require('./MainBOT/MainCommand/Data/BackupOld/PrayFumoStorage.js');
const libraryFumos = require('./MainBOT/MainCommand/Data/BackupOld/LibraryFumoStorage.js');
const { allFumoList: marketFumos } = require('./MainBOT/MainCommand/Data/BackupOld/MarketFumoStorage.js');

/**
 * Extract clean name and rarity from fumo name string
 * "Reimu(Common)" -> { name: "Reimu", rarity: "Common" }
 */
function parseFumoName(nameStr) {
  const match = nameStr.match(/^(.+?)\((.*?)\)$/);
  if (match) {
    return { name: match[1], rarity: match[2] };
  }
  return { name: nameStr, rarity: 'Common' };
}

/**
 * Create a unique ID from name and rarity
 * "Reimu" + "Common" -> "reimu_common"
 */
function createFumoId(name, rarity) {
  return `${name}_${rarity}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Build unified fumo database
 */
function buildUnifiedDatabase() {
  const fumoMap = new Map(); // id -> fumo data
  
  console.log('🔄 Building unified fumo database...\n');
  
  // Process crate fumos (has pictures)
  console.log('📦 Processing Crate Fumos...');
  crateFumos.forEach(fumo => {
    const { name, rarity } = parseFumoName(fumo.name);
    const id = createFumoId(name, rarity);
    
    fumoMap.set(id, {
      id,
      name,
      rarity,
      picture: fumo.picture,
      marketPrice: null,
      availability: {
        crate: true,
        event: false,
        pray: false,
        library: false,
        market: false
      }
    });
  });
  console.log(`   ✅ Added ${crateFumos.length} crate fumos\n`);
  
  // Process event fumos
  console.log('🎉 Processing Event Fumos...');
  eventFumos.forEach(fumo => {
    const { name, rarity } = parseFumoName(fumo.name);
    const id = createFumoId(name, rarity);
    
    if (fumoMap.has(id)) {
      // Already exists, just mark as available in event
      fumoMap.get(id).availability.event = true;
    } else {
      // New fumo only in event
      fumoMap.set(id, {
        id,
        name,
        rarity: fumo.rarity, // Event has explicit rarity field
        picture: fumo.picture,
        marketPrice: null,
        availability: {
          crate: false,
          event: true,
          pray: false,
          library: false,
          market: false
        }
      });
    }
  });
  console.log(`   ✅ Processed ${eventFumos.length} event fumos\n`);
  
  // Process pray fumos
  console.log('🙏 Processing Pray Fumos...');
  prayFumos.forEach(fumo => {
    const { name, rarity } = parseFumoName(fumo.name);
    const id = createFumoId(name, rarity);
    
    if (fumoMap.has(id)) {
      fumoMap.get(id).availability.pray = true;
    } else {
      // New fumo only in pray
      fumoMap.set(id, {
        id,
        name,
        rarity: fumo.rarity,
        picture: fumo.picture,
        marketPrice: null,
        availability: {
          crate: false,
          event: false,
          pray: true,
          library: false,
          market: false
        }
      });
    }
  });
  console.log(`   ✅ Processed ${prayFumos.length} pray fumos\n`);
  
  // Process library fumos
  console.log('📚 Processing Library Fumos...');
  libraryFumos.forEach(fumo => {
    const { name, rarity } = parseFumoName(fumo.name);
    const id = createFumoId(name, rarity);
    
    if (fumoMap.has(id)) {
      fumoMap.get(id).availability.library = true;
    } else {
      // New fumo only in library (no picture)
      fumoMap.set(id, {
        id,
        name,
        rarity,
        picture: null, // Library doesn't have pictures
        marketPrice: null,
        availability: {
          crate: false,
          event: false,
          pray: false,
          library: true,
          market: false
        }
      });
    }
  });
  console.log(`   ✅ Processed ${libraryFumos.length} library fumos\n`);
  
  // Process market fumos (add prices)
  console.log('🏪 Processing Market Fumos...');
  marketFumos.forEach(fumo => {
    const { name, rarity } = parseFumoName(fumo.name);
    const id = createFumoId(name, rarity);
    
    if (fumoMap.has(id)) {
      fumoMap.get(id).marketPrice = fumo.price;
      fumoMap.get(id).availability.market = true;
    } else {
      console.warn(`   ⚠️  Market fumo not found in other lists: ${fumo.name}`);
    }
  });
  console.log(`   ✅ Processed ${marketFumos.length} market fumos\n`);
  
  return Array.from(fumoMap.values());
}

/**
 * Validate the unified database
 */
function validateDatabase(fumos) {
  console.log('🔍 Validating unified database...\n');
  
  const errors = [];
  const warnings = [];
  
  fumos.forEach((fumo, idx) => {
    // Required fields
    if (!fumo.id) errors.push(`Fumo ${idx}: Missing ID`);
    if (!fumo.name) errors.push(`Fumo ${idx}: Missing name`);
    if (!fumo.rarity) errors.push(`Fumo ${idx}: Missing rarity`);
    
    // Picture validation (only if available in crate/event/pray)
    const needsPicture = fumo.availability.crate || fumo.availability.event || fumo.availability.pray;
    if (needsPicture && !fumo.picture) {
      warnings.push(`${fumo.name}(${fumo.rarity}): No picture but available in gacha`);
    }
    
    // Market price validation
    if (fumo.availability.market && !fumo.marketPrice) {
      warnings.push(`${fumo.name}(${fumo.rarity}): Available in market but no price`);
    }
    
    // Check availability (at least one should be true)
    const hasAvailability = Object.values(fumo.availability).some(v => v);
    if (!hasAvailability) {
      errors.push(`${fumo.name}(${fumo.rarity}): Not available anywhere`);
    }
  });
  
  if (errors.length > 0) {
    console.error('❌ Validation Errors:');
    errors.forEach(err => console.error(`   ${err}`));
    return false;
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Validation Warnings:');
    warnings.forEach(warn => console.warn(`   ${warn}`));
  }
  
  console.log(`✅ Validation complete: ${fumos.length} fumos\n`);
  return true;
}

/**
 * Generate statistics
 */
function generateStats(fumos) {
  console.log('📊 Database Statistics:\n');
  
  const byRarity = {};
  const byAvailability = {
    crate: 0,
    event: 0,
    pray: 0,
    library: 0,
    market: 0
  };
  
  fumos.forEach(fumo => {
    // Count by rarity
    byRarity[fumo.rarity] = (byRarity[fumo.rarity] || 0) + 1;
    
    // Count by availability
    Object.keys(fumo.availability).forEach(key => {
      if (fumo.availability[key]) byAvailability[key]++;
    });
  });
  
  console.log('By Rarity:');
  Object.entries(byRarity)
    .sort((a, b) => b[1] - a[1])
    .forEach(([rarity, count]) => {
      console.log(`   ${rarity.padEnd(15)} ${count}`);
    });
  
  console.log('\nBy Availability:');
  Object.entries(byAvailability).forEach(([type, count]) => {
    console.log(`   ${type.padEnd(15)} ${count}`);
  });
  
  console.log(`\nTotal Unique Fumos: ${fumos.length}`);
  console.log('');
}

/**
 * Save to JSON file
 */
function saveToFile(fumos, outputPath) {
  const data = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalFumos: fumos.length,
    fumos
  };
  
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(outputPath, json, 'utf8');
  
  console.log(`💾 Saved to: ${outputPath}`);
  console.log(`📦 File size: ${(json.length / 1024).toFixed(2)} KB\n`);
}

/**
 * Create backup of old files
 */
function createBackup() {
  const backupDir = path.join(__dirname, 'Storage', 'backup_old');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const filesToBackup = [
    'NormalCrateFumoStorage.js',
    'EventFumoStorage.js',
    'PrayFumoStorage.js',
    'LibraryFumoStorage.js',
    'MarketFumoStorage.js'
  ];
  
  console.log('📦 Creating backup of old files...');
  filesToBackup.forEach(file => {
    const src = path.join(__dirname, 'Storage', file);
    const dest = path.join(backupDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`   ✅ Backed up: ${file}`);
    }
  });
  console.log('');
}

/**
 * Main migration function
 */
function migrate() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   Fumo Storage Migration Script v1.0     ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  try {
    // Build unified database
    const fumos = buildUnifiedDatabase();
    
    // Validate
    if (!validateDatabase(fumos)) {
      console.error('\n❌ Migration failed due to validation errors');
      process.exit(1);
    }
    
    // Generate stats
    generateStats(fumos);
    
    // Create backup
    createBackup();
    
    // Save to file
    const outputPath = path.join(__dirname, 'data', 'fumos.json');
    const dataDir = path.dirname(outputPath);
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    saveToFile(fumos, outputPath);
    
    console.log('✨ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Review the generated fumos.json');
    console.log('2. Create data/FumoPool.js (see artifact)');
    console.log('3. Update services to use FumoPool');
    console.log('4. Test thoroughly before deleting old files\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrate();
}

module.exports = { migrate, buildUnifiedDatabase, validateDatabase };