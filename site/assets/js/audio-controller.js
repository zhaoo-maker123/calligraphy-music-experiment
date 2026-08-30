export class AudioController {
  constructor(onPlaybackChange = () => {}) {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.onPlaybackChange = onPlaybackChange;
    this.playToken = 0;
  }

  async play(source, onEnded = () => {}) {
    this.stop();
    const token = ++this.playToken;
    this.audio.src = source;
    this.audio.currentTime = 0;
    this.audio.onended = () => {
      if (token !== this.playToken) return;
      this.onPlaybackChange({ status: "ended", source });
      onEnded();
    };
    this.audio.onerror = () => {
      if (token !== this.playToken) return;
      this.onPlaybackChange({ status: "error", source });
    };

    this.onPlaybackChange({ status: "playing", source });
    try {
      await this.audio.play();
      return true;
    } catch {
      if (token === this.playToken) {
        this.onPlaybackChange({ status: "blocked", source });
      }
      return false;
    }
  }

  stop() {
    this.playToken += 1;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }

  destroy() {
    this.stop();
    this.audio.onended = null;
    this.audio.onerror = null;
  }
}
