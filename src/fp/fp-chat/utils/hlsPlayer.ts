import Hls from "hls.js";

/**
 * Initialize HLS player for m3u8 video/audio URLs
 * @param mediaElement - HTML video or audio element to attach HLS to
 * @param mediaUrl - m3u8 URL to play
 * @returns HLS instance or null if not supported
 */
export const initializeHlsPlayer = (
  mediaElement: HTMLVideoElement | HTMLAudioElement,
  mediaUrl: string
): Hls | null => {
  if (!mediaUrl || !mediaUrl.includes(".m3u8")) {
    return null;
  }

  // Check if HLS is supported
  if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
    });

    hls.loadSource(mediaUrl);
    hls.attachMedia(mediaElement);

    // Error handling
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      }
    });

    return hls;
  } else if (mediaElement.canPlayType("application/vnd.apple.mpegurl")) {
    // Native HLS support (Safari)
    mediaElement.src = mediaUrl;
    return null; // No Hls instance needed for native support
  } else {
    return null;
  }
};

/**
 * Cleanup HLS player instance
 * @param hls - HLS instance to destroy
 */
export const cleanupHlsPlayer = (hls: Hls | null): void => {
  if (hls) {
    hls.destroy();
  }
};
