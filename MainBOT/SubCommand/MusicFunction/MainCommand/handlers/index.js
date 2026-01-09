/**
 * Handler Index
 * Exports all music command handlers
 * 
 * Note: We export the entire handler modules (not individual functions)
 * to preserve 'this' context for internal method calls
 */

const playHandler = require('./playHandler');
const controlHandler = require('./controlHandler');
const queueHandler = require('./queueHandler');
const buttonHandler = require('./buttonHandler');
const settingsHandler = require('./settingsHandler');

module.exports = {
    // Play handlers - bind to preserve 'this'
    handlePlay: playHandler.handlePlay.bind(playHandler),
    handlePlaylistAdd: playHandler.handlePlaylistAdd.bind(playHandler),
    handleLongTrackConfirmation: playHandler.handleLongTrackConfirmation.bind(playHandler),
    handlePriorityVote: playHandler.handlePriorityVote.bind(playHandler),
    refreshNowPlayingMessage: playHandler.refreshNowPlayingMessage.bind(playHandler),
    isPlaylistUrl: playHandler.isPlaylistUrl.bind(playHandler),
    
    // Control handlers - bind to preserve 'this'
    handleStop: controlHandler.handleStop.bind(controlHandler),
    handleSkip: controlHandler.handleSkip.bind(controlHandler),
    handleVoteSkip: controlHandler.handleVoteSkip.bind(controlHandler),
    handlePause: controlHandler.handlePause.bind(controlHandler),
    handleVolume: controlHandler.handleVolume.bind(controlHandler),
    handleLoop: controlHandler.handleLoop.bind(controlHandler),
    handleShuffle: controlHandler.handleShuffle.bind(controlHandler),
    handleSeek: controlHandler.handleSeek.bind(controlHandler),
    
    // Queue handlers - bind to preserve 'this'
    handleQueue: queueHandler.handleQueue.bind(queueHandler),
    handleNowPlaying: queueHandler.handleNowPlaying.bind(queueHandler),
    handleRemove: queueHandler.handleRemove.bind(queueHandler),
    handleMove: queueHandler.handleMove.bind(queueHandler),
    handleClear: queueHandler.handleClear.bind(queueHandler),
    handleRecent: queueHandler.handleRecent.bind(queueHandler),
    
    // Button handlers - bind to preserve 'this'
    handleButton: buttonHandler.handleButton.bind(buttonHandler),
    handleButtonPause: buttonHandler.handleButtonPause.bind(buttonHandler),
    handleButtonStop: buttonHandler.handleButtonStop.bind(buttonHandler),
    handleButtonSkip: buttonHandler.handleButtonSkip.bind(buttonHandler),
    handleButtonLoop: buttonHandler.handleButtonLoop.bind(buttonHandler),
    handleButtonShuffle: buttonHandler.handleButtonShuffle.bind(buttonHandler),
    handleButtonVolume: buttonHandler.handleButtonVolume.bind(buttonHandler),
    handleButtonQueue: buttonHandler.handleButtonQueue.bind(buttonHandler),
    handleButtonLyrics: buttonHandler.handleButtonLyrics.bind(buttonHandler),
    handleButtonVoteSkip: buttonHandler.handleButtonVoteSkip.bind(buttonHandler),
    handleButtonQueuePage: buttonHandler.handleButtonQueuePage.bind(buttonHandler),
    fetchLyrics: buttonHandler.fetchLyrics.bind(buttonHandler),
    
    // Settings handlers - bind to preserve 'this'
    handleSettings: settingsHandler.handleSettings.bind(settingsHandler),
    handleSelectMenu: settingsHandler.handleSelectMenu.bind(settingsHandler),
    handleStatus: settingsHandler.handleStatus.bind(settingsHandler),
    handleVolumeSelect: settingsHandler.handleVolumeSelect.bind(settingsHandler)
};
