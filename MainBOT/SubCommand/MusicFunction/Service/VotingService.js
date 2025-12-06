const { SKIP_VOTE_TIMEOUT } = require('../Configuration/MusicConfig');

class VotingService {
    getMinVotesRequired(listenerCount) {
        if (listenerCount >= 5) return 3;
        return Math.ceil(listenerCount / 2);
    }

    startSkipVote(queue, userId, listenerCount) {
        queue.skipVoting = true;
        queue.skipVotes = new Set([userId]);
        queue.skipVoteListenerCount = listenerCount; 
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
        const listenerCount = queue.skipVoteListenerCount || 3;
        const minVotes = this.getMinVotesRequired(listenerCount);
        return queue.skipVotes.size >= minVotes;
    }

    isVoting(queue) {
        return queue.skipVoting;
    }

    endVoting(queue) {
        queue.skipVoting = false;
        const voteCount = queue.skipVotes.size;
        queue.skipVotes.clear();
        queue.skipVoteListenerCount = null;
        
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

    startPriorityVote(queue, userId, listenerCount) {
        queue.priorityVoting = true;
        queue.priorityVotes = new Set([userId]);
        queue.priorityVoteListenerCount = listenerCount;
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
        const listenerCount = queue.priorityVoteListenerCount || 3;
        const minVotes = this.getMinVotesRequired(listenerCount);
        return queue.priorityVotes.size >= minVotes;
    }

    isPriorityVoting(queue) {
        return queue.priorityVoting;
    }

    endPriorityVoting(queue) {
        queue.priorityVoting = false;
        const voteCount = queue.priorityVotes?.size || 0;
        queue.priorityVotes = new Set();
        queue.priorityVoteListenerCount = null;
        return voteCount;
    }
}

module.exports = new VotingService();