/* ================================
   BEATFLOW — YOUTUBE.JS
   YouTube Music via Piped API
   No API Key! 100% FREE!
================================ */

const YouTube = {

  // Multiple Piped servers — agar ek kaam na kare dusra try karega!
  INSTANCES: [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.projectsegfau.lt',
    'https://piped-api.garudalinux.org',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.moomoo.me',
  ],

  currentInstance: 0,

  getApi() { return this.INSTANCES[this.currentInstance]; },

  // ===== FETCH WITH FALLBACK =====
  async fetchWithFallback(path) {
    for (let i = 0; i < this.INSTANCES.length; i++) {
      try {
        const res = await fetch(`${this.INSTANCES[i]}${path}`, {
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          this.currentInstance = i;
          return await res.json();
        }
      } catch { continue; }
    }
    throw new Error('All Piped instances failed');
  },

  // ===== SEARCH =====
  async search(query) {
    try {
      const data = await this.fetchWithFallback(
        `/search?q=${encodeURIComponent(query)}&filter=music_songs`
      );
      if (!data.items) return [];
      return data.items
        .filter(item => item.type === 'stream' || item.duration > 0)
        .slice(0, 20)
        .map(item => this.parseItem(item));
    } catch (err) {
      console.error('YT search error:', err);
      return [];
    }
  },

  // ===== TRENDING =====
  async getTrending(region = 'IN') {
    try {
      const data = await this.fetchWithFallback(`/trending?region=${region}`);
      if (!Array.isArray(data)) return [];
      return data
        .filter(item => item.duration && item.duration < 600)
        .slice(0, 16)
        .map(item => this.parseItem(item));
    } catch (err) {
      console.error('Trending error:', err);
      return [];
    }
  },

  // ===== GET STREAM URL =====
  async getStreamUrl(videoId) {
    try {
      const data = await this.fetchWithFallback(`/streams/${videoId}`);
      if (!data.audioStreams?.length) throw new Error('No audio');

      const best = data.audioStreams
        .filter(s => s.mimeType?.includes('audio'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

      return {
        streamUrl: best.url,
        thumbnail: data.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: data.duration,
        title: data.title,
        artist: data.uploader,
        relatedStreams: (data.relatedStreams || []).slice(0, 10).map(s => this.parseItem(s)),
      };
    } catch (err) {
      console.error('Stream error:', err);
      return null;
    }
  },

  // ===== PARSE ITEM =====
  parseItem(item) {
    const videoId = (item.url || '').replace('/watch?v=', '') || item.videoId || '';
    return {
      id: `yt_${videoId}`,
      videoId,
      title: item.title || 'Unknown',
      artist: item.uploaderName || item.uploader || 'Unknown Artist',
      duration: item.duration || 0,
      thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      source: 'YouTube',
      sourceIcon: 'smart_display',
    };
  },

  // ===== PREPARE SONG =====
  async prepareSong(song) {
    if (song.streamUrl) return song;
    const data = await this.getStreamUrl(song.videoId);
    if (!data) return null;

    // Auto add related to queue
    if (data.relatedStreams?.length) {
      const insertAt = App.queueIndex + 1;
      const related = data.relatedStreams.map(s => this.parseItem(s));
      App.queue.splice(insertAt, 0, ...related);
      Storage.saveQueue(App.queue);
    }

    return { ...song, ...data };
  },
};


/* ===== PATCH PLAYER TO HANDLE ALL SOURCES ===== */
document.addEventListener('DOMContentLoaded', () => {
  if (!Player) return;

  Player.playSong = async function(song) {
    if (!song) return;

    let readySong = song;

    // Prepare based on source
    if (song.source === 'YouTube' && !song.streamUrl) {
      showToast('⏳ YouTube se load ho raha hai...');
      readySong = await YouTube.prepareSong(song);

    } else if (song.source === 'Telegram' && !song.streamUrl) {
      showToast('⏳ Telegram se load ho raha hai...');
      readySong = await Telegram.prepareSong(song);

    } else if (song.source === 'Drive' && !song.streamUrl) {
      readySong = await Drive.prepareSong(song);
    }

    if (!readySong?.streamUrl) {
      showToast('❌ Song load nahi hua');
      return;
    }

    // Play audio
    this.audio.pause();
    this.audio.src = readySong.streamUrl;
    this.currentSong = readySong;
    App.currentSong = readySong;

    try {
      await this.audio.play();
      this.isPlaying = true;
      App.isPlaying = true;
    } catch (err) {
      console.error('Play error:', err);
      showToast('❌ Play error');
      return;
    }

    // Save & update
    Storage.addToHistory(readySong);
    Storage.saveCurrentSong(readySong);
    this.updateUI(readySong);
    showMiniPlayer();
    Lyrics.fetch(readySong);

    // Fetch cover if missing
    if (!readySong.thumbnail) {
      Covers.fetchCover(readySong).then(thumb => {
        if (thumb) { readySong.thumbnail = thumb; this.updateUI(readySong); }
      });
    }

    showToast(`▶ ${readySong.title}`);
  };
});
