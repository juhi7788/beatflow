/* ================================
   BEATFLOW — TELEGRAM.JS
   Telegram Bot API Integration
================================ */

const Telegram = {

  cachedSongs: [],

  // ===== GET CONFIG =====
  getConfig() {
    return Storage.getTelegramConfig();
  },

  getBaseUrl() {
    const { botToken } = this.getConfig();
    return `https://api.telegram.org/bot${botToken}`;
  },

  getFileBaseUrl() {
    const { botToken } = this.getConfig();
    return `https://api.telegram.org/file/bot${botToken}`;
  },

  // ===== FETCH ALL SONGS FROM CHANNEL =====
  async fetchSongs(limit = 100) {
    const config = this.getConfig();
    if (!config.botToken || !config.channelId) return [];

    try {
      // Get messages from channel
      const url = `${this.getBaseUrl()}/getUpdates?limit=${limit}&allowed_updates=["channel_post"]`;
      
      // Use forwardMessages approach - get channel history
      const response = await fetch(
        `${this.getBaseUrl()}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.channelId,
            text: '.',
          }),
        }
      );

      // Better approach: get channel messages directly
      const msgs = await this.getChannelMessages(config.channelId, limit);
      const songs = this.parseSongsFromMessages(msgs);
      this.cachedSongs = songs;

      // Cache for search
      Storage.set('telegram_songs_cache', songs);

      return songs;
    } catch (err) {
      console.error('Telegram fetch error:', err);
      // Try cached
      return Storage.get('telegram_songs_cache', []);
    }
  },

  // ===== GET CHANNEL MESSAGES =====
  async getChannelMessages(channelId, limit = 100) {
    try {
      // Use getUpdates to get messages
      const res = await fetch(
        `${this.getBaseUrl()}/getUpdates?limit=${limit}&offset=-1`
      );
      const data = await res.json();
      if (!data.ok) return [];

      // Filter messages from our channel with audio
      const messages = data.result
        .filter(update =>
          update.channel_post &&
          update.channel_post.chat.id.toString() === channelId.toString() &&
          (update.channel_post.audio || update.channel_post.document)
        )
        .map(u => u.channel_post);

      return messages;
    } catch (err) {
      console.error('Get messages error:', err);
      return [];
    }
  },

  // ===== PARSE SONGS FROM MESSAGES =====
  parseSongsFromMessages(messages) {
    return messages
      .filter(msg => msg.audio || (msg.document && msg.document.mime_type?.includes('audio')))
      .map(msg => {
        const audio = msg.audio || msg.document;
        return {
          id: `tg_${audio.file_id}`,
          fileId: audio.file_id,
          title: audio.title || audio.file_name?.replace(/\.(mp3|m4a|ogg|flac)$/i, '') || 'Unknown',
          artist: audio.performer || 'Unknown Artist',
          duration: audio.duration || 0,
          thumbnail: null, // Will be fetched separately
          source: 'Telegram',
          sourceIcon: 'send',
          messageId: msg.message_id,
          date: msg.date,
        };
      });
  },

  // ===== GET STREAM URL FOR A SONG =====
  async getStreamUrl(fileId) {
    try {
      const res = await fetch(`${this.getBaseUrl()}/getFile?file_id=${fileId}`);
      const data = await res.json();

      if (!data.ok) throw new Error('File not found');

      const filePath = data.result.file_path;
      return `${this.getFileBaseUrl()}/${filePath}`;
    } catch (err) {
      console.error('Get stream URL error:', err);
      return null;
    }
  },

  // ===== SEARCH SONGS =====
  async searchSongs(query) {
    const q = query.toLowerCase();
    let songs = this.cachedSongs;

    if (songs.length === 0) {
      songs = Storage.get('telegram_songs_cache', []);
      this.cachedSongs = songs;
    }

    return songs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.artist && s.artist.toLowerCase().includes(q))
    );
  },

  // ===== GET CACHED SONGS =====
  getCachedSongs() {
    if (this.cachedSongs.length > 0) return this.cachedSongs;
    const cached = Storage.get('telegram_songs_cache', []);
    this.cachedSongs = cached;
    return cached;
  },

  // ===== PREPARE SONG FOR PLAYING =====
  async prepareSong(song) {
    if (song.streamUrl) return song;

    showToast('Loading song...');
    const streamUrl = await this.getStreamUrl(song.fileId);

    if (!streamUrl) {
      showToast('❌ Could not load song');
      return null;
    }

    return { ...song, streamUrl };
  },

  // ===== GET THUMBNAIL =====
  async getThumbnail(fileId) {
    try {
      const res = await fetch(`${this.getBaseUrl()}/getFile?file_id=${fileId}`);
      const data = await res.json();
      if (!data.ok) return null;
      return `${this.getFileBaseUrl()}/${data.result.file_path}`;
    } catch {
      return null;
    }
  },

  // ===== SEND AUDIO (Upload) =====
  async uploadSong(file, onProgress) {
    const config = this.getConfig();
    if (!config.botToken || !config.channelId) {
      showToast('Configure Telegram first!');
      return null;
    }

    const formData = new FormData();
    formData.append('chat_id', config.channelId);
    formData.append('audio', file);

    try {
      showToast('Uploading to Telegram...');
      const res = await fetch(`${this.getBaseUrl()}/sendAudio`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.description);

      showToast('✅ Uploaded to Telegram!');

      // Add to cache
      const newSong = {
        id: `tg_${data.result.audio.file_id}`,
        fileId: data.result.audio.file_id,
        title: data.result.audio.title || file.name.replace(/\.[^/.]+$/, ''),
        artist: data.result.audio.performer || 'Unknown',
        duration: data.result.audio.duration || 0,
        source: 'Telegram',
        sourceIcon: 'send',
      };

      this.cachedSongs.unshift(newSong);
      Storage.set('telegram_songs_cache', this.cachedSongs);

      return newSong;
    } catch (err) {
      console.error('Upload error:', err);
      showToast('❌ Upload failed: ' + err.message);
      return null;
    }
  },

  // ===== TEST CONNECTION =====
  async testConnection() {
    const config = this.getConfig();
    if (!config.botToken) return false;

    try {
      const res = await fetch(`${this.getBaseUrl()}/getMe`);
      const data = await res.json();
      return data.ok;
    } catch {
      return false;
    }
  },
};
