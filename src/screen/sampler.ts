export class ScreenSampler {
  private stream: MediaStream | null = null;
  /* Made public so per-key screen mirror engine can grab frames directly. */
  public video: HTMLVideoElement | null = null;

  async start(onEnded?: () => void): Promise<void> {
    this.stop();

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5, width: { ideal: 320 }, height: { ideal: 180 } },
      });

      this.stream = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      this.video = video;
      await video.play();

      const [track] = stream.getVideoTracks();
      track?.addEventListener('ended', () => {
        if (this.stream === stream) {
          this.stop();
          onEnded?.();
        }
      });
    } catch (e) {
      this.stop();
      throw e;
    }
  }

  stop(): void {
    const stream = this.stream;
    this.stream = null;
    stream?.getTracks().forEach(track => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;
  }

  isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }

}
