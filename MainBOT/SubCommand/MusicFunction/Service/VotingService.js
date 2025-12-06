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

    startPriorityVote(queue, userId) {
        queue.priorityVoting = true;
        queue.priorityVotes = new Set([userId]);
        return queue.priorityVotes.size;
    }

    addPriorityVote(queue, userId) {
        if (!queue.priorityVoting) {
            return { added: false, count: 0 };
        }

        if (queue.priorityVotes.has(userId)) {
            return { added: false, count: queue.priorityVotes.size };
        }

        queue.priorityVotes.add(userId);
        return { added: true, count: queue.priorityVotes.size };
    }

    hasEnoughPriorityVotes(queue) {
        return queue.priorityVotes.size >= MIN_VOTES_REQUIRED;
    }

    isPriorityVoting(queue) {
        return queue.priorityVoting;
    }

    endPriorityVoting(queue) {
        queue.priorityVoting = false;
        const voteCount = queue.priorityVotes?.size || 0;
        queue.priorityVotes = new Set();
        return voteCount;
    }
}

module.exports = new VotingService();