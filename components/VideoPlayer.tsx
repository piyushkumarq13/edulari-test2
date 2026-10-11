"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: { Player: new (el: unknown, opts: unknown) => YoutubePlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YoutubePlayer = {
  playVideo(): void;
  pauseVideo(): void;
  getDuration(): number;
  getCurrentTime(): number;
  seekTo(t: number, allowSeekAhead: boolean): void;
  getVolume(): number;
  setVolume(v: number): void;
  getPlayerState(): number;
  setPlaybackRate(r: number): void;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_SPEED_INDEX = 2;

/** Port of edulariYoutubeId() in public/partials/video_player.php. */
export function youtubeId(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === "") return null;
  let value = trimmed;
  if (/<iframe/i.test(value)) {
    const m = value.match(/src\s*=\s*["']([^"']+)["']/i);
    if (m) value = m[1];
  }
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /youtube(?:-nocookie)?\.com\/(embed|shorts|live|v|e)\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/attribution_link\?.*[?&]?v=([A-Za-z0-9_-]{6,})/,
  ];
  for (const p of patterns) {
    const m = value.match(p);
    if (m) return m[m.length - 1];
  }
  return null;
}

/** Port of edulariVimeoId() in public/partials/video_player.php. */
export function vimeoId(url: string): string | null {
  let m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return m[1];
  m = url.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (m) return m[1];
  return null;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const secPart = s % 60;
  return (h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + ":" + String(secPart).padStart(2, "0");
}

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
}

type Adapter = {
  getDuration(): number;
  getCurrent(): number;
  seekTo(t: number): void;
  togglePlay(): void;
  getVolume(): number;
  setVolume(v: number): void;
  setSpeed(s: number): void;
};

type Props = { videoUrl: string; title?: string };

/**
 * Port of edulariVideoPlayer() (partials/video_player.php) +
 * window.EdulariVideoPlayer (assets/js/video-player.js): same evp-* class
 * names, same control markup, same speed list/default, same YouTube player
 * vars, same nocookie host and error copy.
 */
export default function VideoPlayer({ videoUrl, title = "Lesson video" }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<Adapter | null>(null);
  const rafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [time, setTime] = useState({ current: 0, duration: 0 });

  const vimeo = youtubeId(videoUrl) === null ? vimeoId(videoUrl) : null;

  const togglePlay = useCallback(() => {
    adapterRef.current?.togglePlay();
  }, []);

  const enterFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
      (el as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
    }
  }, []);

  // YouTube adapter
  useEffect(() => {
    const id = youtubeId(videoUrl);
    if (!id) return;
    let cancelled = false;
    let player: YoutubePlayer | null = null;

    loadYouTubeApi().then(() => {
      if (cancelled || !rootRef.current) return;
      const host = rootRef.current.querySelector(".evp-yt");
      if (!host || !window.YT) return;
      const p = new window.YT.Player(host, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          controls: 0, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1,
          origin: window.location.origin, disablekb: 1, fs: 0, iv_load_policy: 3, cc_load_policy: 0,
        },
        events: {
          onReady: () => setPlaying(false),
          onStateChange: (ev: { data: number }) => setPlaying(ev.data === 1),
          onError: () => setFailed("This video could not be loaded. Please check the URL or try again later."),
        },
      });
      player = p as unknown as YoutubePlayer;
      adapterRef.current = {
        getDuration: () => { try { return player!.getDuration(); } catch { return 0; } },
        getCurrent: () => { try { return player!.getCurrentTime(); } catch { return 0; } },
        seekTo: (t) => { try { player!.seekTo(t, true); } catch { /* not ready */ } },
        togglePlay: () => {
          try {
            if (player!.getPlayerState() === 1) player!.pauseVideo();
            else player!.playVideo();
          } catch { /* not ready */ }
        },
        getVolume: () => { try { return player!.getVolume() / 100; } catch { return 1; } },
        setVolume: (v) => { try { player!.setVolume(Math.round(v * 100)); } catch { /* not ready */ } },
        setSpeed: (s) => { try { player!.setPlaybackRate(s); } catch { /* not ready */ } },
      };
    });

    return () => {
      cancelled = true;
      adapterRef.current = null;
    };
  }, [videoUrl]);

  // rAF loop keeps the seek bar + time label in sync (same as wireControls).
  // Reads happen inside the callback (not during render) and land in state.
  useEffect(() => {
    if (vimeo) return;
    const loop = () => {
      const adapter = adapterRef.current;
      setTime({ current: adapter?.getCurrent() ?? 0, duration: adapter?.getDuration() ?? 0 });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [vimeo]);

  // Self-hosted <video> adapter
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v || youtubeId(videoUrl)) return;
    adapterRef.current = {
      getDuration: () => v.duration,
      getCurrent: () => v.currentTime,
      seekTo: (t) => { v.currentTime = t; },
      togglePlay: () => {
        if (v.paused) v.play();
        else v.pause();
      },
      getVolume: () => v.volume,
      setVolume: (x) => { v.volume = x; },
      setSpeed: (s) => { v.playbackRate = s; },
    };
  }, [videoUrl]);

  if (vimeo) {
    return (
      <div className="evp-player" style={{ aspectRatio: "16/9", position: "relative" }}>
        <iframe
          src={`https://player.vimeo.com/video/${vimeo}`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title={title}
        />
      </div>
    );
  }

  const { current, duration } = time;
  const yt = youtubeId(videoUrl) !== null;

  return (
    <div
      id={`evp-${hashId(`${videoUrl}${title}`)}`}
      ref={rootRef}
      className={`evp-player ${playing ? "" : "evp-paused"}`}
      aria-label={title}
    >
      <div className="evp-media">
        {yt ? <div className="evp-yt" /> : <video ref={videoRef} playsInline preload="metadata" src={videoUrl}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onError={() => setFailed("This video could not be loaded. Please try refreshing the page or contact support if the problem persists.")} />}
      </div>
      <div className="evp-topshade" />
      <div className="evp-shield" onClick={togglePlay} />
      <div className={`evp-center ${playing ? "evp-center--playing" : ""}`} role="button" aria-label="Play" onClick={togglePlay}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/images/edulari-logo.png" alt="Edulari" />
        <svg className="evp-pause-ic" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
      </div>

      <div className="evp-controls">
        <button type="button" className="evp-play" aria-label="Play/Pause" onClick={togglePlay}>
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <input
          type="range"
          className="evp-seek"
          min={0}
          max={1000}
          value={duration > 0 ? Math.floor((current / duration) * 1000) : 0}
          aria-label="Seek"
          onChange={(e) => adapterRef.current?.seekTo((Number(e.target.value) / 1000) * (duration || 0))}
        />
        <span className="evp-time">{fmt(current)} / {fmt(duration)}</span>
        <input
          type="range"
          className="evp-vol"
          min={0}
          max={1}
          step={0.05}
          defaultValue={1}
          aria-label="Volume"
          onChange={(e) => adapterRef.current?.setVolume(Number(e.target.value))}
        />
        <select
          className="evp-speedsel"
          aria-label="Playback speed"
          defaultValue={String(DEFAULT_SPEED_INDEX)}
          onChange={(e) => adapterRef.current?.setSpeed(SPEEDS[Number(e.target.value)])}
        >
          {SPEEDS.map((s, i) => (
            <option key={s} value={i} selected={i === DEFAULT_SPEED_INDEX}>{s}×</option>
          ))}
        </select>
        <button type="button" className="evp-fs" aria-label="Fullscreen" onClick={enterFullscreen}>
          <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
        </button>
      </div>

      {failed ? <div className="evp-error">{failed}</div> : null}
    </div>
  );
}

function hashId(input: string): string {
  // Deterministic 10-char id, mirroring substr(md5(...), 0, 10) closely enough
  // for React keys / DOM ids (no cross-request uniqueness requirement).
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(10, "0").slice(0, 10);
}
