class TrackRepository {
    enqueue(queue, track) {
        queue.tracks.push(track);
        return queue.tracks.length;
    }

    dequeue(queue) {
        return queue.tracks.shift();
    }

    getQueue(queue) {
        return [...queue.tracks];
    }

    clearQueue(queue) {
        queue.tracks = [];
    }

    getQueueLength(queue) {
        return queue.tracks.length;
    }

    getTrackAtPosition(queue, position) {
        return queue.tracks[position];
    }

    removeTrackAtPosition(queue, position) {
        return queue.tracks.splice(position, 1)[0];
    }

    insertTrackAtPosition(queue, track, position) {
        queue.tracks.splice(position, 0, track);
    }

    getCurrentTrack(queue) {
        return queue.current;
    }

    setCurrentTrack(queue, track) {
        queue.current = track;
    }

    getNextTrack(queue) {
        return queue.tracks[0] || null;
    }
}

module.exports = new TrackRepository();