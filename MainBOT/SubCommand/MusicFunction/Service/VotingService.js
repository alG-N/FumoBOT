const { SKIP_VOTE_TIMEOUT, MIN_VOTES_REQUIRED } = require('../Configuration/MusicConfig');

class VotingService {
    startSkipVote(queue, userId) {
        queue.skipVoting = true;
        queue.skipVotes = new Set([userId]);
        return queue.skipVotes.size;
    }

    addSkipVote(queue, userId) {
        if (!queue.skipVoting) {
            return { added: false, count: 0 };
        }

        if (queue.skipVotes.has(userId)) {
            return { added: false, count: queue.skipVotes.size };
        }

        queue.skipVotes.add(userId);
        return { added: true, count: queue.skipVotes.size };
    }

    hasEnoughVotes(queue) {
        return queue.skipVotes.size >= MIN_VOTES_REQUIRED;
    }

    isVoting(queue) {
        return queue.skipVoting;
    }

    endVoting(queue) {
        queue.skipVoting = false;
        const voteCount = queue.skipVotes.size;
        queue.skipVotes.clear();
        
        if (queue.skipVotingTimeout) {
            clearTimeout(queue.skipVotingTimeout);
            queue.skipVotingTimeout = null;
        }
        
        queue.skipVotingMsg = null;
        return voteCount;
    }

    setVotingTimeout(queue, callback) {
        queue.skipVotingTimeout = setTimeout(() => {
            callback();
        }, SKIP_VOTE_TIMEOUT);
    }

    setVotingMessage(queue, message) {
        queue.skipVotingMsg = message;
    }

    getVotingMessage(queue) {
        return queue.skipVotingMsg;
    }

    getVoteCount(queue) {
        return queue.skipVotes.size;
    }

    clearVoting(queue) {
        this.endVoting(queue);
    }

    hasUserVoted(queue, userId) {
        return queue.skipVotes.has(userId);
    }
}

module.exports = new VotingService();