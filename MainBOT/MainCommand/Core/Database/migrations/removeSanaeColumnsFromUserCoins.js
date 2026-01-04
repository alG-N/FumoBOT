/**
 * Migration: Remove unused Sanae columns from userCoins table
 * 
 * These columns have been replaced by the separate sanaeBlessings table
 * and are no longer in use.
 * 
 * Run with: node removeSanaeColumnsFromUserCoins.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'fumos.db');

const COLUMNS_TO_REMOVE = [
    'sanaeFaithPoints',
    'sanaeRerollsUsed',
    'sanaeCraftDiscount',
    'sanaeCraftDiscountExpiry',
    'sanaeFreeCraftsExpiry',
    'sanaePrayImmunityExpiry',
    'sanaeGuaranteedRarityRolls',
    'sanaeLuckForRolls',
    'sanaeCraftProtection'
];

async function runMigration() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error('❌ Failed to open database:', err.message);
            process.exit(1);
        }
        console.log('✅ Connected to fumos.db');
    });

    const dbRun = (sql) => new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    const dbAll = (sql) => new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    try {
        // Get current columns in userCoins
        const tableInfo = await dbAll('PRAGMA table_info(userCoins)');
        const existingColumns = tableInfo.map(row => row.name);
        
        console.log('\n📋 Current userCoins columns:', existingColumns.length);
        
        // Find which Sanae columns exist
        const columnsToRemove = COLUMNS_TO_REMOVE.filter(col => existingColumns.includes(col));
        
        if (columnsToRemove.length === 0) {
            console.log('\n✅ No Sanae columns found in userCoins table. Nothing to remove.');
            db.close();
            return;
        }

        console.log('\n🎯 Columns to remove:', columnsToRemove.join(', '));
        
        // SQLite 3.35.0+ supports ALTER TABLE DROP COLUMN
        // For older versions, we'd need to recreate the table
        
        console.log('\n🚀 Starting column removal...\n');
        
        let removed = 0;
        let failed = 0;
        
        for (const column of columnsToRemove) {
            try {
                await dbRun(`ALTER TABLE userCoins DROP COLUMN ${column}`);
                console.log(`  ✅ Removed column: ${column}`);
                removed++;
            } catch (err) {
                if (err.message.includes('no such column')) {
                    console.log(`  ⏭️  Column already removed: ${column}`);
                } else if (err.message.includes('cannot drop')) {
                    console.log(`  ⚠️  Cannot drop column ${column}: ${err.message}`);
                    failed++;
                } else {
                    console.log(`  ❌ Failed to remove ${column}: ${err.message}`);
                    failed++;
                }
            }
        }

        // Verify removal
        const updatedTableInfo = await dbAll('PRAGMA table_info(userCoins)');
        const remainingColumns = updatedTableInfo.map(row => row.name);
        
        const stillExist = COLUMNS_TO_REMOVE.filter(col => remainingColumns.includes(col));
        
        console.log('\n📊 Migration Summary:');
        console.log(`   Columns removed: ${removed}`);
        console.log(`   Columns failed: ${failed}`);
        console.log(`   Remaining Sanae columns: ${stillExist.length > 0 ? stillExist.join(', ') : 'None'}`);
        console.log(`   Total columns in userCoins: ${remainingColumns.length}`);
        
        if (stillExist.length === 0) {
            console.log('\n✅ Migration completed successfully!');
        } else {
            console.log('\n⚠️  Some columns could not be removed. You may need SQLite 3.35.0+ or recreate the table.');
        }

    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
    } finally {
        db.close((err) => {
            if (err) console.error('Error closing database:', err.message);
            else console.log('\n🔒 Database connection closed.');
        });
    }
}

// Run if called directly
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration, COLUMNS_TO_REMOVE };
