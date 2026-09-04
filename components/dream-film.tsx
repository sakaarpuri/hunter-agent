"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Pause, Play, X } from "@phosphor-icons/react";
import story from "@/media/what-if/story.json";
import timing from "@/media/what-if/timing.json";
import styles from "./dream-film.module.css";

type PlaybackState = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";

export function DreamFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const watchRef = useRef<HTMLButtonElement>(null);
  const dialogOpen = useRef(false);
  const fullRequest = useRef(0);
  const previousOverflow = useRef<string | null>(null);
  const controlsRef = useRef({ togglePlayback: () => {}, suspend: () => {}, reconcile: () => {} });
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  const [fullStatus, setFullStatus] = useState("");
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = story[sceneIndex];

  const syncScene = useCallback((video: HTMLVideoElement, time = video.currentTime) => {
    const index = Math.max(0, story.findLastIndex((item) => time >= item.start));
    setSceneIndex((current) => current === index ? current : index);
    const remaining = story[index].start + story[index].duration - time;
    if (headlineRef.current) headlineRef.current.style.opacity = String(Math.min(1, Math.max(0, remaining / .18)));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const fullVideo = fullVideoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const portrait = window.matchMedia("(max-width: 600px)");
    const supportsObservation = typeof IntersectionObserver !== "undefined";
    let visible = false;
    let userPaused = false;
    let manualPlayback = false;
    let autoBlocked = false;
    let loaded = false;
    let pending = false;
    let position = 0;
    let requestId = 0;
    let disposed = false;
    let frameCallback: number | undefined;

    function onFrame(_now: number, metadata: VideoFrameCallbackMetadata) {
      if (disposed) return;
      syncScene(video!, metadata.mediaTime);
      frameCallback = video!.requestVideoFrameCallback(onFrame);
    }
    if (typeof video.requestVideoFrameCallback === "function") frameCallback = video.requestVideoFrameCallback(onFrame);

    function suspend(detach = true) {
      requestId++;
      pending = false;
      if (loaded && Number.isFinite(video!.currentTime)) position = video!.currentTime;
      video!.pause();
      if (loaded && detach) {
        // Pausing alone can keep downloading. Detach sources until playback is wanted again.
        loaded = false;
        video!.querySelectorAll("source").forEach((source) => source.removeAttribute("src"));
        video!.removeAttribute("src");
        video!.load();
      }
      if (!disposed) setPlayback((current) => current === "playing" || current === "loading" ? "paused" : current);
    }

    async function start(manual: boolean) {
      if (disposed || document.hidden || dialogOpen.current || pending) return;
      if (!manual && !video!.paused) return;
      if (!manual && (!supportsObservation || !visible || motion.matches || userPaused || autoBlocked)) return;
      if (manual) {
        manualPlayback = true;
        userPaused = false;
        autoBlocked = false;
      } else {
        manualPlayback = false;
        video!.muted = true;
      }
      pending = true;
      const attempt = ++requestId;
      setPlayback("loading");
      try {
        if (!loaded) {
          video!.querySelectorAll<HTMLSourceElement>("source").forEach((source) => {
            if (source.dataset.src) source.src = source.dataset.src;
          });
          loaded = true;
          video!.load();
        }
        if (position > 0) video!.currentTime = position;
        await video!.play();
        if (disposed || attempt !== requestId) return;
        setPlayback("playing");
      } catch (error) {
        if (disposed || attempt !== requestId) return;
        autoBlocked = true;
        setPlayback(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "error");
        suspend();
      } finally {
        if (attempt === requestId) pending = false;
      }
    }

    function reconcile() {
      if (!visible || document.hidden || dialogOpen.current || (motion.matches && !manualPlayback)) suspend();
      else void start(false);
      if (document.hidden) fullVideoRef.current?.pause();
    }

    function paused() {
      setPlayback((current) => current === "playing" ? "paused" : current);
    }
    function mediaError() {
      if (!loaded || disposed) return;
      autoBlocked = true;
      setPlayback("error");
      suspend();
    }

    function changeFormat() {
      const wasPlaying = !video!.paused || pending;
      suspend();
      if (wasPlaying) void start(manualPlayback);
    }

    controlsRef.current = {
      togglePlayback: () => {
        if (!video.paused || pending) {
          userPaused = true;
          suspend(false);
        } else void start(true);
      },
      suspend,
      reconcile,
    };
    video.muted = true;
    video.addEventListener("pause", paused);
    video.addEventListener("error", mediaError);
    document.addEventListener("visibilitychange", reconcile);
    motion.addEventListener("change", reconcile);
    portrait.addEventListener("change", changeFormat);
    const observer = !supportsObservation ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
      reconcile();
    }, { threshold: [0, 0.55], rootMargin: "0px" });
    observer?.observe(video);
    function checkFallbackVisibility() {
      const rect = video!.getBoundingClientRect();
      const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      visible = rect.width * rect.height > 0 && (height * width) / (rect.width * rect.height) >= 0.55;
      if (!visible) suspend();
    }
    if (!observer) {
      checkFallbackVisibility();
      window.addEventListener("scroll", checkFallbackVisibility, { passive: true });
      window.addEventListener("resize", checkFallbackVisibility);
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("scroll", checkFallbackVisibility);
      window.removeEventListener("resize", checkFallbackVisibility);
      document.removeEventListener("visibilitychange", reconcile);
      motion.removeEventListener("change", reconcile);
      portrait.removeEventListener("change", changeFormat);
      if (frameCallback !== undefined) video.cancelVideoFrameCallback(frameCallback);
      video.removeEventListener("pause", paused);
      video.removeEventListener("error", mediaError);
      suspend();
      controlsRef.current = { togglePlayback: () => {}, suspend: () => {}, reconcile: () => {} };
      dialogOpen.current = false;
      fullVideo?.pause();
      fullVideo?.removeAttribute("src");
      fullVideo?.load();
      if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current;
    };
  }, [syncScene]);

  const playing = playback === "playing" || playback === "loading";
  const playLabel = playing ? "Pause preview" : "Play preview";

  function openFilm() {
    const dialog = dialogRef.current;
    const fullVideo = fullVideoRef.current;
    if (!dialog || !fullVideo || dialog.open) return;
    dialogOpen.current = true;
    const request = ++fullRequest.current;
    controlsRef.current.suspend();
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setFullStatus("");
    dialog.showModal();
    fullVideo.src = `${window.matchMedia("(max-width: 600px)").matches
      ? "/films/what-if-portrait.mp4" : "/films/what-if-landscape.mp4"}?v=${timing.revision}`;
    fullVideo.load();
    void fullVideo.play().catch(() => {
      if (dialog.open && dialogOpen.current && request === fullRequest.current) setFullStatus(fullVideo.error
        ? "The film could not load. Close it and try again."
        : "Press play to start the film.");
    });
  }

  function closeFilm() {
    fullRequest.current++;
    dialogOpen.current = false;
    const fullVideo = fullVideoRef.current;
    if (fullVideo) {
      fullVideo.pause();
      fullVideo.removeAttribute("src");
      fullVideo.load();
    }
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
    watchRef.current?.focus({ preventScroll: true });
    controlsRef.current.reconcile();
  }

  return (
    <div className={styles.heroFilm} id="the-what-if">
      <link rel="preload" as="image" href="/films/what-if-hero-poster.jpg" fetchPriority="high" />
      <div className={styles.aperture} data-ending={Boolean(scene.ending)} data-scene={sceneIndex}>
      <video
        ref={videoRef}
        id="dream-film-player"
        className={styles.player}
        muted
        loop
        playsInline
        preload="none"
        poster="/films/what-if-hero-poster.jpg"
        aria-label="Dream-job possibilities: an Arctic photographer, ocean scientist, remote professional and a woman leading a Seoul board meeting"
        onTimeUpdate={(event) => syncScene(event.currentTarget)}
        onSeeked={(event) => syncScene(event.currentTarget)}
        onLoadedData={(event) => syncScene(event.currentTarget)}
        onEmptied={(event) => syncScene(event.currentTarget, 0)}
      >
        <source data-src={`/films/what-if-hero-portrait.mp4?v=${timing.revision}`} type="video/mp4" media="(max-width: 600px)" />
        <source data-src={`/films/what-if-hero.mp4?v=${timing.revision}`} type="video/mp4" />
        Your browser cannot play this film. <a href="/films/what-if-landscape.mp4">Download the film</a>.
      </video>
        {scene.ending && <svg className={styles.endGraphic} viewBox="0 0 240 240" fill="none" aria-hidden="true">
          {[35, 60, 85, 110].map((radius) => <circle key={radius} cx="120" cy="120" r={radius} stroke="currentColor" strokeWidth="1.5" strokeDasharray={`${radius * 4.5} ${radius * 1.8}`} />)}
        </svg>}
        <div className={styles.heroContent}>
          <div ref={headlineRef} className={styles.headline} data-reflection={Boolean(scene.reflection)}>
            <p className={styles.eyebrow} aria-hidden="true">{scene.label}</p>
            <h1 id="hero-title" aria-label="What if this was work?" key={sceneIndex}>
              {scene.lines.map((line) => <span key={line} aria-hidden="true">{line}</span>)}
            </h1>
            <span key={`underline-${sceneIndex}`} className={styles.underline} aria-hidden="true" />
          </div>
          <div className={styles.invitation}>
            <p className={styles.description}>
              Your AI job scout searches for roles that fit your experience and what you want next, then emails a shortlist worth considering.
            </p>
            <div className={`${styles.actions} hero-actions`}>
              <Link className={`button ${styles.cta}`} href="/dashboard">
                Find my what if <ArrowUpRight size={19} aria-hidden="true" />
              </Link>
              <button ref={watchRef} type="button" className={styles.watch} onClick={openFilm} aria-haspopup="dialog">
                <Play size={14} weight="fill" aria-hidden="true" /> Watch the film
              </button>
            </div>
            <p className={styles.heroStatus} role="status">
              {playback === "error" ? "Preview unavailable. You can still watch the film." : ""}
            </p>
          </div>
        </div>
        <button className={styles.previewControl} type="button" onClick={() => controlsRef.current.togglePlayback()} aria-label={playLabel} aria-controls="dream-film-player">
          {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
        </button>
      </div>
      <div className={styles.afterword}>
        <a href="#try-it">Explore the possibilities <ArrowDown size={16} aria-hidden="true" /></a>
      </div>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="dream-film-title" onClose={closeFilm}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
        }}>
        <div className={styles.dialogHeading}>
          <h2 id="dream-film-title">Find your what if.</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close film"><X size={22} aria-hidden="true" /></button>
        </div>
        <video ref={fullVideoRef} className={styles.fullPlayer} controls playsInline preload="none"
          aria-label="HunterAgent: Find your what if, the full film"
          onPlaying={() => setFullStatus("")}
          onError={() => { if (dialogOpen.current) setFullStatus("The film could not load. Close it and try again."); }}>
          <track kind="descriptions" src="/films/what-if-descriptions.vtt" srcLang="en" label="English visual descriptions" />
        </video>
        <p className={styles.playbackStatus} role="status">{fullStatus}</p>
      </dialog>
    </div>
  );
}
