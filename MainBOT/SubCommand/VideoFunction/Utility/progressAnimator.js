const { EventEmitter } = require('events');

/**
 * ProgressAnimator - Handles animated progress bars and status updates for Discord embeds
 */
class ProgressAnimator extends EventEmitter {
    constructor() {
        super();
        
        // Animation frames for different states
        this.animations = {
            downloading: ['⬇️', '📥', '⬇️', '📦'],
            processing: ['⚙️', '🔧', '⚙️', '🔩'],
            compressing: ['📦', '📥', '📤', '💾'],
            uploading: ['📤', '☁️', '📤', '✨'],
            spinner: ['◐', '◓', '◑', '◒'],
            dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
            bars: ['▰▱▱▱▱', '▰▰▱▱▱', '▰▰▰▱▱', '▰▰▰▰▱', '▰▰▰▰▰'],
            wave: ['🌊', '🌊', '💧', '💧'],
        };

        // Progress bar styles
        this.progressStyles = {
            default: { filled: '█', empty: '░', length: 12 },
            modern: { filled: '▓', empty: '░', length: 12 },
            blocks: { filled: '🟩', empty: '⬜', length: 10 },
            circles: { filled: '🔵', empty: '⚪', length: 10 },
            squares: { filled: '🟦', empty: '⬛', length: 10 },
        };

        // Status icons
        this.statusIcons = {
            pending: '⏳',
            active: '🔄',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
        };

        this.frameIndex = 0;
        this.animationInterval = null;
    }

    /**
     * Create an animated progress bar
     * @param {number} percent - Progress percentage (0-100)
     * @param {string} style - Progress bar style
     * @returns {string} Progress bar string
     */
    createProgressBar(percent, style = 'default') {
        const config = this.progressStyles[style] || this.progressStyles.default;
        const filledLength = Math.round((percent / 100) * config.length);
        const emptyLength = config.length - filledLength;
        
        const filled = config.filled.repeat(filledLength);
        const empty = config.empty.repeat(emptyLength);
        
        return `${filled}${empty} ${percent.toFixed(0)}%`;
    }

    /**
     * Create a detailed progress display
     * @param {Object} options - Progress options
     * @returns {string} Formatted progress string
     */
    createDetailedProgress(options = {}) {
        const {
            percent = 0,
            downloaded = 0,
            total = 0,
            speed = 0,
            eta = 0,
            style = 'default'
        } = options;

        const progressBar = this.createProgressBar(percent, style);
        const parts = [`\`${progressBar}\``];

        if (total > 0) {
            parts.push(`📊 ${this.formatBytes(downloaded)} / ${this.formatBytes(total)}`);
        } else if (downloaded > 0) {
            parts.push(`📊 ${this.formatBytes(downloaded)}`);
        }

        if (speed > 0) {
            parts.push(`⚡ ${this.formatBytes(speed)}/s`);
        }

        if (eta > 0) {
            parts.push(`⏱️ ETA: ${this.formatTime(eta)}`);
        }

        return parts.join('\n');
    }

    /**
     * Get current animation frame
     * @param {string} type - Animation type
     * @returns {string} Animation frame
     */
    getAnimationFrame(type = 'spinner') {
        const frames = this.animations[type] || this.animations.spinner;
        const frame = frames[this.frameIndex % frames.length];
        this.frameIndex++;
        return frame;
    }

    /**
     * Create a status line with animation
     * @param {string} status - Status text
     * @param {string} animationType - Animation type
     * @returns {string} Animated status line
     */
    createAnimatedStatus(status, animationType = 'spinner') {
        const frame = this.getAnimationFrame(animationType);
        return `${frame} ${status}`;
    }

    /**
     * Create multi-step progress display
     * @param {Array} steps - Array of step objects {name, status, detail}
     * @returns {string} Formatted steps display
     */
    createStepsDisplay(steps) {
        return steps.map((step, index) => {
            const icon = this.statusIcons[step.status] || this.statusIcons.pending;
            const detail = step.detail ? ` - ${step.detail}` : '';
            const connector = index < steps.length - 1 ? '\n│' : '';
            return `${icon} **${step.name}**${detail}${connector}`;
        }).join('\n');
    }

    /**
     * Format bytes to human readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }

    /**
     * Format seconds to human readable time
     * @param {number} seconds - Seconds to format
     * @returns {string} Formatted time string
     */
    formatTime(seconds) {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs}s`;
    }

    /**
     * Generate a fancy border box
     * @param {string} content - Content to wrap
     * @param {string} title - Optional title
     * @returns {string} Boxed content
     */
    createBox(content, title = null) {
        const lines = content.split('\n');
        const maxLength = Math.max(...lines.map(l => l.length), title ? title.length + 4 : 0);
        
        let box = '';
        if (title) {
            box += `╭─ ${title} ${'─'.repeat(Math.max(0, maxLength - title.length - 3))}╮\n`;
        } else {
            box += `╭${'─'.repeat(maxLength + 2)}╮\n`;
        }
        
        lines.forEach(line => {
            box += `│ ${line.padEnd(maxLength)} │\n`;
        });
        
        box += `╰${'─'.repeat(maxLength + 2)}╯`;
        return `\`\`\`\n${box}\n\`\`\``;
    }

    /**
     * Create a quality badge
     * @param {string} quality - Quality string (e.g., "1080p", "720p")
     * @returns {string} Quality badge
     */
    createQualityBadge(quality) {
        const badges = {
            '2160p': '🎬 4K Ultra HD',
            '1440p': '🎬 2K QHD',
            '1080p': '🎬 Full HD',
            '720p': '🎥 HD',
            '480p': '📺 SD',
            '360p': '📱 Low',
            '240p': '📱 Min',
            '144p': '📱 Tiny',
        };
        return badges[quality] || `📹 ${quality}`;
    }

    /**
     * Create platform-specific styling
     * @param {string} platformId - Platform identifier
     * @returns {Object} Platform style object
     */
    getPlatformStyle(platformId) {
        const styles = {
            'tiktok': { color: '#000000', emoji: '🎵', gradient: ['#00f2ea', '#ff0050'] },
            'twitter': { color: '#1DA1F2', emoji: '𝕏', gradient: ['#1DA1F2', '#14171A'] },
            'instagram': { color: '#E4405F', emoji: '📷', gradient: ['#F58529', '#DD2A7B', '#8134AF'] },
            'youtube': { color: '#FF0000', emoji: '▶️', gradient: ['#FF0000', '#CC0000'] },
            'youtube-shorts': { color: '#FF0000', emoji: '📱', gradient: ['#FF0000', '#CC0000'] },
            'reddit': { color: '#FF4500', emoji: '🤖', gradient: ['#FF4500', '#FF5700'] },
            'facebook': { color: '#1877F2', emoji: '📘', gradient: ['#1877F2', '#3b5998'] },
            'twitch': { color: '#9146FF', emoji: '🎮', gradient: ['#9146FF', '#6441A4'] },
            'vimeo': { color: '#1AB7EA', emoji: '🎬', gradient: ['#1AB7EA', '#162221'] },
            'web': { color: '#7289DA', emoji: '🌐', gradient: ['#7289DA', '#5865F2'] },
        };
        return styles[platformId] || styles.web;
    }
}

module.exports = new ProgressAnimator();
