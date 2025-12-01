const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');

const CONFIG = {
    DB_DIR: path.join(__dirname),
    BACKUP_DIR: path.join(__dirname, '../../backup'),
    BACKUP_CHANNEL_ID: '1367500981809447054',
    DATABASE_FILES: ['fumos.db', 'fumos.db-wal', 'fumos.db-shm'],
    MAX_BACKUPS_TO_KEEP: 5,
    MAX_DISCORD_FILE_SIZE_MB: 25,
    MAX_DISCORD_FILE_SIZE_BYTES: 25 * 1024 * 1024,
    BACKUP_SCHEDULE: '0 */12 * * *'
};

function formatSize(bytes) {
    const megabytes = bytes / 1024 / 1024;
    return `${megabytes.toFixed(2)} MB`;
}

function generateTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`);
    }
}

function copyDatabaseFiles(tempDir) {
    const copiedFiles = [];

    for (const filename of CONFIG.DATABASE_FILES) {
        const sourcePath = path.join(CONFIG.DB_DIR, filename);
        const destPath = path.join(tempDir, filename);

        if (fs.existsSync(sourcePath)) {
            try {
                fs.copyFileSync(sourcePath, destPath);
                copiedFiles.push(filename);
                console.log(`📄 Copied: ${filename}`);
            } catch (error) {
                console.error(`⚠️ Failed to copy ${filename}:`, error.message);
            }
        } else {
            console.log(`⚠️ Skipped missing file: ${filename}`);
        }
    }

    return copiedFiles;
}

function createZipArchive(sourceDir, zipPath) {
    const zip = new AdmZip();
    zip.addLocalFolder(sourceDir);
    zip.writeZip(zipPath);
    console.log(`🗜️ Created archive: ${path.basename(zipPath)}`);
}

function getFileStats(filenames) {
    return filenames.map(filename => {
        const filePath = path.join(CONFIG.DB_DIR, filename);
        if (fs.existsSync(filePath)) {
            const size = fs.statSync(filePath).size;
            return `📄 \`${filename}\` → 🗃️ ${formatSize(size)}`;
        }
        return `📄 \`${filename}\` → ⚠️ Not found`;
    });
}

function cleanOldBackups(keepCount) {
    try {
        const zipFiles = fs.readdirSync(CONFIG.BACKUP_DIR)
            .filter(filename => filename.startsWith('fumos_backup_') && filename.endsWith('.zip'))
            .map(filename => ({
                name: filename,
                path: path.join(CONFIG.BACKUP_DIR, filename),
                time: fs.statSync(path.join(CONFIG.BACKUP_DIR, filename)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        const toDelete = zipFiles.slice(keepCount);
        
        toDelete.forEach(file => {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Deleted old backup: ${file.name}`);
        });

        if (toDelete.length > 0) {
            console.log(`✅ Cleanup complete. Kept: ${Math.min(zipFiles.length, keepCount)}, Deleted: ${toDelete.length}`);
        }

    } catch (error) {
        console.error('❌ Error during backup cleanup:', error.message);
    }
}

function createSuccessEmbed(copiedFiles, zipFilename, zipSizeBytes, canUpload) {
    const fileStats = getFileStats(copiedFiles);
    const sizeMB = formatSize(zipSizeBytes);
    
    const embed = new EmbedBuilder()
        .setTitle('📦 Database Backup Completed')
        .setColor(canUpload ? 0x2ECC71 : 0xE67E22)
        .addFields(
            {
                name: 'Included Files',
                value: fileStats.length > 0 ? fileStats.join('\n') : '⚠️ No files were copied.'
            },
            {
                name: 'Backup Archive',
                value: `\`${zipFilename}\`\n💾 Size: **${sizeMB}**`
            }
        )
        .setTimestamp();

    if (!canUpload) {
        embed.addFields({
            name: '⚠️ Upload Limitation',
            value: `File exceeds Discord's ${CONFIG.MAX_DISCORD_FILE_SIZE_MB}MB limit.\n` +
                   `Backup saved locally on the server.`
        });
    }

    return embed;
}

function createErrorEmbed(error) {
    return new EmbedBuilder()
        .setTitle('❌ Backup Failed')
        .setColor(0xE74C3C)
        .setDescription(`\`\`\`${error.message}\`\`\``)
        .addFields({
            name: 'Database Location',
            value: `\`${CONFIG.DB_DIR}\``
        })
        .setTimestamp();
}

async function sendDiscordNotification(client, embed, filePath = null) {
    try {
        const channel = await client.channels.fetch(CONFIG.BACKUP_CHANNEL_ID).catch(() => null);
        
        if (!channel || !channel.isTextBased()) {
            console.warn('⚠️ Backup channel not found or not a text channel');
            return;
        }

        const messageOptions = { embeds: [embed] };
        
        if (filePath && fs.existsSync(filePath)) {
            messageOptions.files = [filePath];
            messageOptions.content = '✅ Backup successful and uploaded below.';
        }

        await channel.send(messageOptions);
        console.log('📤 Backup notification sent to Discord');

    } catch (error) {
        console.error('❌ Failed to send Discord notification:', error.message);
    }
}

async function backupAndSendDB(client) {
    const timestamp = generateTimestamp();
    const tempDir = path.join(CONFIG.BACKUP_DIR, `temp_${timestamp}`);
    const zipPath = path.join(CONFIG.BACKUP_DIR, `fumos_backup_${timestamp}.zip`);

    try {
        console.log('🚀 Starting backup process...');
        console.log(`📂 Database location: ${CONFIG.DB_DIR}`);
        console.log(`📂 Backup destination: ${CONFIG.BACKUP_DIR}`);

        ensureDirectoryExists(CONFIG.BACKUP_DIR);
        fs.mkdirSync(tempDir);

        const copiedFiles = copyDatabaseFiles(tempDir);

        if (copiedFiles.length === 0) {
            throw new Error(`No database files found in ${CONFIG.DB_DIR}`);
        }

        createZipArchive(tempDir, zipPath);

        fs.rmSync(tempDir, { recursive: true, force: true });

        const zipSizeBytes = fs.statSync(zipPath).size;
        const canUpload = zipSizeBytes <= CONFIG.MAX_DISCORD_FILE_SIZE_BYTES;

        const embed = createSuccessEmbed(
            copiedFiles,
            path.basename(zipPath),
            zipSizeBytes,
            canUpload
        );

        await sendDiscordNotification(
            client,
            embed,
            canUpload ? zipPath : null
        );

        cleanOldBackups(CONFIG.MAX_BACKUPS_TO_KEEP);

        console.log('✅ Backup process completed successfully');

    } catch (error) {
        console.error('❌ Backup process failed:', error.message);

        const errorEmbed = createErrorEmbed(error);
        await sendDiscordNotification(client, errorEmbed);

        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}

function scheduleBackups(client) {
    cron.schedule(CONFIG.BACKUP_SCHEDULE, () => {
        console.log('⏰ Running scheduled backup...');
        backupAndSendDB(client);
    });

    console.log(`✅ Backup scheduler initialized`);
    console.log(`   - Schedule: ${CONFIG.BACKUP_SCHEDULE} (every 12 hours)`);
    console.log(`   - Database: ${CONFIG.DB_DIR}`);
    console.log(`   - Backups: ${CONFIG.BACKUP_DIR}`);
    console.log(`   - Keeping: ${CONFIG.MAX_BACKUPS_TO_KEEP} most recent backups`);
}

module.exports = {
    backupAndSendDB,
    scheduleBackups,
    
    CONFIG: Object.freeze({ ...CONFIG })
};