class VoiceConnectionRepository {
    setConnection(queue, connection) {
        queue.connection = connection;
    }

    getConnection(queue) {
        return queue.connection;
    }

    hasConnection(queue) {
        return queue.connection !== null;
    }

    destroyConnection(queue) {
        if (queue.connection) {
            try {
                queue.connection.destroy();
            } catch (error) {
                console.error('[VoiceConnectionRepository] Error destroying connection:', error);
            }
            queue.connection = null;
        }
    }

    getChannelId(queue) {
        return queue.connection?.joinConfig?.channelId || null;
    }

    isConnected(queue) {
        return queue.connection && queue.connection.state.status !== 'destroyed';
    }

    subscribe(queue, player) {
        if (queue.connection) {
            queue.connection.subscribe(player);
        }
    }
}

module.exports = new VoiceConnectionRepository();