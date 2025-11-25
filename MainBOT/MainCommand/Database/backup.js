const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');

// Configuration
const DB_PATH = './fumos.db';
const BACKUP_DIR = './backup';
const CHANNEL_ID = '1367500981809447054';

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

/**
 * Format file size in a human-readable way
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
function formatSize(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Backup database and send to Discord channel
 * @param {Client} client - Discord client instance
 */
async function backupAndSendDB(client) {
    try {
        console.log('🚀 Starting backup process...');

        // Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const tempDir = path.join(BACKUP_DIR, `temp_${timestamp}`);
        fs.mkdirSync(tempDir);

        const filesToBackup = ['fumos.db', 'fumos.db-wal', 'fumos.db-shm'];
        const copiedFiles = [];

        // Copy database files
        for (const file of filesToBackup) {
            const sourcePath = path.join(path.dirname(DB_PATH), file);
            const destPath = path.join(tempDir, file);
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
                copiedFiles.push(file);
                console.log(`📄 Copied ${file}`);
            } else {
                console.log(`⚠️ Skipped missing file: ${file}`);
            }
        }

        // Create zip file
        const zipPath = path.join(BACKUP_DIR, `fumos_backup_${timestamp}.zip`);
        const zip = new AdmZip();
        zip.addLocalFolder(tempDir);
        zip.writeZip(zipPath);
        console.log(`🗜️ Created zip: ${zipPath}`);

        // Clean up temp folder
        fs.rmSync(tempDir, { recursive: true, force: true });

        const zipSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
        const MAX_DISCORD_FILE_SIZE = 25 * 1024 * 1024; // 25MB
        const actualSize = fs.statSync(zipPath).size;

        // Build file stats
        const fileStats = copiedFiles.map(file => {
            const originalPath = path.join(path.dirname(DB_PATH), file);
            const originalSize = fs.existsSync(originalPath) ? fs.statSync(originalPath).size : 0;
            return `📄 \`${file}\` → 🗃️ ${formatSize(originalSize)}`;
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 Database Backup Completed')
            .setColor(actualSize <= MAX_DISCORD_FILE_SIZE ? 0x2ECC71 : 0xE67E22)
            .addFields(
                {
                    name: 'Included Files',
                    value: fileStats.length > 0 ? fileStats.join('\n') : '⚠️ No files were copied.'
                },
                {
                    name: 'Backup Zip',
                    value: `\`${path.basename(zipPath)}\`\n💾 Size: **${zipSize} MB**`
                }
            )
            .setTimestamp();

        // Send message to channel
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (channel && channel.isTextBased()) {
            if (actualSize <= MAX_DISCORD_FILE_SIZE) {
                await channel.send({
                    content: `✅ Backup successful and uploaded below.`,
                    embeds: [embed],
                    files: [zipPath]
                });
            } else {
                embed.addFields({
                    name: 'Note',
                    value: `⚠️ File too large to upload (limit is 25MB).\n` +
                        `You can retrieve the backup manually from the server:\n\`${zipPath}\``
                });

                await channel.send({
                    embeds: [embed]
                });
            }
        }

        // Delete old zip backups (keep last 5)
        const zipFiles = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('fumos_backup_') && f.endsWith('.zip'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        const oldZips = zipFiles.slice(5);
        for (const f of oldZips) {
            fs.unlinkSync(path.join(BACKUP_DIR, f.name));
            console.log(`🗑️ Deleted old zip: ${f.name}`);
        }

        console.log(`✅ Backup finished. Total kept: ${zipFiles.length}, Deleted: ${oldZips.length}`);
    } catch (error) {
        console.error('❌ Error during backup:', error);
    }
}

/**
 * Schedule automatic backups
 * @param {Client} client - Discord client instance
 */
function scheduleBackups(client) {
    // Schedule backup every 12 hours (at midnight and noon)
    cron.schedule('0 */12 * * *', () => {
        console.log('⏰ Running scheduled backup...');
        backupAndSendDB(client);
    });
    console.log('✅ Backup scheduler initialized (runs every 12 hours)');
}

module.exports = {
    backupAndSendDB,
    scheduleBackups
};