'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  ArrowRight,
  Layers,
  Cpu,
  Mail,
  FileSpreadsheet,
  CheckCircle2,
  Zap,
  Bot,
  Terminal,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Eye,
  EyeOff,
  Radio,
  Gauge,
  Compass,
} from 'lucide-react';
import { SAMPLE_WORKFLOWS } from '@/lib/sample-workflows';
import { WorkflowTemplate } from '@/types/workflow';

interface HeroPageProps {
  onLaunchBuilder: () => void;
  onOpenExtractor: () => void;
  onOpenAiAssistant: () => void;
  onOpenSettings: () => void;
  onLoadTemplate: (template: WorkflowTemplate) => void;
}

export function HeroPage({
  onLaunchBuilder,
  onOpenExtractor,
  onOpenAiAssistant,
  onOpenSettings,
  onLoadTemplate,
}: HeroPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [isCinemaMode, setIsCinemaMode] = useState<boolean>(false);

  // Playback speed cycle
  const cycleSpeed = () => {
    if (!videoRef.current) return;
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const currentIndex = speeds.indexOf(speed);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    videoRef.current.playbackRate = nextSpeed;
    setSpeed(nextSpeed);
  };

  // Playback control
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleRestart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Video time update
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(curr);
    if (dur > 0) {
      setProgress((curr / dur) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
    setIsVideoLoaded(true);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    videoRef.current.currentTime = ratio * duration;
    setProgress(ratio * 100);
  };

  const scrollToContent = () => {
    const el = document.getElementById('features-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Ensure autoplay starts without lag
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
    }

    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-[#ff6d5a] selection:text-white overflow-x-hidden"
    >
      {/* =========================================================================
          WHOLE-SCREEN FULL-VIEWPORT VIDEO BACKGROUND (100% SCREEN COVERAGE)
          ========================================================================= */}
      <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={() => setIsVideoLoaded(true)}
          onWaiting={() => setIsVideoBuffering(true)}
          onPlaying={() => setIsVideoBuffering(false)}
          className="w-full h-full object-cover scale-[1.01]"
          style={{
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <source src="/hero-video.mp4" type="video/mp4" />
          Your browser does not support HTML5 video.
        </video>

        {/* Ambient Dark Scrims for Perfect Readability & Visual Depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/35 to-[#07090e]/95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_30%,_rgba(7,9,14,0.75)_100%)]" />

        {/* Futuristic Subtle Grid Scanlines Overlay */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* =========================================================================
          TOP NAVIGATION BAR (GLASSMORPHIC HEADER)
          ========================================================================= */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 border-b border-white/10 bg-[#090d14]/70 backdrop-blur-xl px-4 sm:px-6 py-3 flex items-center justify-between ${
          isCinemaMode ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff6d5a] to-rose-400 flex items-center justify-center text-white shadow-lg shadow-[#ff6d5a]/25 animate-pulse">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white drop-shadow-md">
                FlowCraft
              </span>
              <span className="text-[10px] font-mono font-semibold bg-[#ff6d5a]/20 text-[#ff6d5a] border border-[#ff6d5a]/30 px-1.5 py-0.5 rounded shadow-sm">
                n8n v2.0
              </span>
            </div>
            <p className="text-[10px] text-slate-300/80 font-mono">Autonomous AI Workflow Studio</p>
          </div>
        </div>

        {/* Quick Nav & Launch Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenExtractor}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-700/60 backdrop-blur-md transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Universal Extractor</span>
          </button>

          <button
            onClick={onOpenAiAssistant}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/70 border border-indigo-700/60 backdrop-blur-md transition-all shadow-sm"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Co-Pilot</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900/70 hover:bg-slate-800/90 border border-slate-700/70 backdrop-blur-md transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">API Keys</span>
          </button>

          <button
            onClick={onLaunchBuilder}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#ff6d5a] to-rose-500 hover:from-[#ff5942] hover:to-rose-600 shadow-lg shadow-[#ff6d5a]/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Launch Canvas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          FULL-SCREEN IMMERSIVE HERO VIEWPORT (100vh)
          ========================================================================= */}
      <section className="relative z-10 min-h-[calc(100vh-60px)] flex flex-col justify-between items-center px-4 sm:px-6 lg:px-8 pt-6 pb-6 w-full max-w-7xl mx-auto">
        {/* Left Flight HUD (Telemetric Overlay) */}
        <div
          className={`hidden xl:flex flex-col gap-2.5 absolute left-6 top-24 pointer-events-none transition-all duration-300 ${
            isCinemaMode ? 'opacity-0' : 'opacity-85'
          }`}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-cyan-500/30 text-[10px] font-mono text-cyan-300 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>DRONE SURVEILLANCE FEED</span>
          </div>

          <div className="p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-mono text-slate-300 space-y-1.5 shadow-xl">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">ALTITUDE:</span>
              <span className="text-emerald-400 font-bold">128.4 m</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">VELOCITY:</span>
              <span className="text-cyan-300 font-bold">84 km/h</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">BATTERY:</span>
              <span className="text-amber-300 font-bold">96%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">STATUS:</span>
              <span className="text-emerald-400 font-bold">LOCKED & HOVERING</span>
            </div>
          </div>
        </div>

        {/* Right Flight HUD (Pipeline Telemetry) */}
        <div
          className={`hidden xl:flex flex-col gap-2.5 absolute right-6 top-24 pointer-events-none transition-all duration-300 ${
            isCinemaMode ? 'opacity-0' : 'opacity-85'
          }`}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-rose-500/30 text-[10px] font-mono text-rose-300 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span>60 FPS HARDWARE ACCELERATED</span>
          </div>

          <div className="p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-mono text-slate-300 space-y-1.5 shadow-xl">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">LATENCY:</span>
              <span className="text-emerald-400 font-bold">14 ms</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">DECODER:</span>
              <span className="text-cyan-300 font-bold">ZERO-LAG GPU</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">MULTI-MODEL:</span>
              <span className="text-purple-300 font-bold">GPT / CLAUDE / GEMINI</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">GMAIL DISPATCH:</span>
              <span className="text-emerald-400 font-bold">AUTONOMOUS</span>
            </div>
          </div>
        </div>

        {/* Center Hero Heading & Calls to Action */}
        <div
          className={`flex flex-col items-center text-center max-w-4xl mx-auto my-auto transition-all duration-500 ${
            isCinemaMode ? 'opacity-0 translate-y-6 pointer-events-none' : 'opacity-100 translate-y-0'
          }`}
        >
          {/* Top Feature Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/70 border border-slate-700/80 text-xs font-medium text-slate-200 mb-6 shadow-2xl backdrop-blur-xl">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[#ff6d5a] font-bold">Autonomous Engine:</span>
            <span>Universal File Email Extractor + Multi-Model AI Routing</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* Epic Main Heading with glowing gradient text */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6 drop-shadow-2xl">
            Orchestrate AI Workflows.{' '}
            <span className="block sm:inline bg-gradient-to-r from-[#ff6d5a] via-rose-400 to-amber-300 bg-clip-text text-transparent drop-shadow-lg">
              Execute at Drone Speed.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-200/90 max-w-2xl mx-auto leading-relaxed mb-8 drop-shadow-md font-normal">
            The next-generation visual workflow platform. Connect{' '}
            <strong className="text-white font-semibold underline decoration-rose-500/50 underline-offset-4">
              OpenAI, Claude, and Gemini
            </strong>{' '}
            with{' '}
            <strong className="text-white font-semibold underline decoration-emerald-500/50 underline-offset-4">
              universal file email extraction
            </strong>{' '}
            and autonomous Gmail delivery on an infinite interactive canvas.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-4">
            <button
              onClick={onLaunchBuilder}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#ff6d5a] to-rose-500 hover:from-[#ff5942] hover:to-rose-600 shadow-2xl shadow-[#ff6d5a]/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 ring-1 ring-white/20"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Launch Canvas Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenExtractor}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold text-emerald-200 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-600/70 shadow-xl backdrop-blur-md transition-all transform hover:-translate-y-0.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Universal File Extractor</span>
            </button>

            <button
              onClick={onOpenAiAssistant}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold text-indigo-200 bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-600/70 shadow-xl backdrop-blur-md transition-all transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>AI Co-Pilot</span>
            </button>

            <button
              onClick={scrollToContent}
              className="flex items-center gap-2 px-4 py-3.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-black/60 hover:bg-black/80 border border-white/10 shadow-lg backdrop-blur-md transition-all"
            >
              <span>Explore Blueprints</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            FLOATING VIDEO CONTROLS DOCK (GLASSMORPHIC TELEMETRY DECK)
            ========================================================================= */}
        <div className="w-full max-w-4xl mx-auto mt-auto pt-4 pb-2">
          <div className="relative rounded-2xl p-3 sm:p-3.5 bg-black/75 backdrop-blur-xl border border-white/15 shadow-2xl flex flex-col gap-2.5">
            {/* Timeline scrubber */}
            <div
              onClick={handleSeek}
              className="relative w-full h-1.5 sm:h-2 bg-slate-800/90 hover:h-3 rounded-full cursor-pointer transition-all overflow-hidden"
              title="Seek video timeline"
            >
              <div
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#ff6d5a] via-amber-400 to-cyan-400 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between text-xs text-slate-200">
              {/* Left controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={togglePlay}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                  )}
                </button>

                <button
                  onClick={handleRestart}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors hidden sm:block"
                  title="Replay from start"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Speed toggle */}
                <button
                  onClick={cycleSpeed}
                  className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-mono text-cyan-300 border border-cyan-500/30 transition-colors"
                  title="Cycle playback speed"
                >
                  {speed}x
                </button>

                {/* Timestamp */}
                <span className="font-mono text-[11px] text-slate-400 hidden sm:inline">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Center status badge */}
              <div className="hidden md:flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/70 text-[10px] font-mono text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>WHOLE-SCREEN DRONE PLAYBACK</span>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Cinema Mode Toggle (Hides text & HUD to watch pure video) */}
                <button
                  onClick={() => setIsCinemaMode(!isCinemaMode)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isCinemaMode
                      ? 'bg-[#ff6d5a] text-white shadow-md shadow-[#ff6d5a]/40'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                  title={isCinemaMode ? 'Show Interface Overlays' : 'Hide Overlays (Cinema Mode)'}
                >
                  {isCinemaMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">
                    {isCinemaMode ? 'Exit Cinema' : 'Cinema View'}
                  </span>
                </button>

                {/* Native Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Toggle Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick indicator to scroll down */}
          {!isCinemaMode && (
            <div className="flex justify-center mt-2">
              <button
                onClick={scrollToContent}
                className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white transition-colors animate-bounce"
              >
                <span>SCROLL FOR ARCHITECTURE & BLUEPRINTS</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          ARCHITECTURE & WORKFLOW TEMPLATES SECTION (BELOW THE FOLD)
          ========================================================================= */}
      <section
        id="features-section"
        className="relative z-10 w-full bg-[#07090e]/95 backdrop-blur-2xl border-t border-slate-800/80 px-4 sm:px-6 lg:px-8 py-20"
      >
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
              Next-Generation Automation Architecture
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Engineered with extreme reliability and modular nodes to coordinate LLMs, extract data,
              and automate communications seamlessly.
            </p>
          </div>

          {/* 3 Key Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {/* Feature 1 */}
            <div className="rounded-2xl bg-gradient-to-b from-[#131924]/90 to-[#0d121a]/90 border border-slate-800 p-6 hover:border-emerald-700/60 transition-all shadow-xl group">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/70 border border-emerald-800/80 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-105 transition-transform shadow-md">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Universal File Extractor</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-5">
                Drag-and-drop any file format—Excel workbooks, CSV, JSON, PDF, TXT, or raw logs. Universal
                regex extracts and categorizes all valid emails instantly into global data grids.
              </p>
              <button
                onClick={onOpenExtractor}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
              >
                <span>Launch Universal Extractor</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl bg-gradient-to-b from-[#131924]/90 to-[#0d121a]/90 border border-slate-800 p-6 hover:border-indigo-700/60 transition-all shadow-xl group">
              <div className="w-12 h-12 rounded-xl bg-indigo-950/70 border border-indigo-800/80 flex items-center justify-center text-indigo-400 mb-5 group-hover:scale-105 transition-transform shadow-md">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Multi-Model AI Switcher</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-5">
                Seamlessly toggle between state-of-the-art models from OpenAI (GPT-4o), Anthropic (Claude 3.5
                Sonnet), and Google (Gemini 2.0 Flash) using custom API keys.
              </p>
              <button
                onClick={onOpenAiAssistant}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
              >
                <span>Open AI Co-Pilot Panel</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl bg-gradient-to-b from-[#131924]/90 to-[#0d121a]/90 border border-slate-800 p-6 hover:border-[#ff6d5a]/60 transition-all shadow-xl group">
              <div className="w-12 h-12 rounded-xl bg-[#ff6d5a]/15 border border-[#ff6d5a]/30 flex items-center justify-center text-[#ff6d5a] mb-5 group-hover:scale-105 transition-transform shadow-md">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Bulk & Single Gmail Delivery</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-5">
                Execute automated email sequences via official Gmail API OAuth or App Passwords with live
                delivery queues, rate limiting, and real-time execution logs.
              </p>
              <button
                onClick={onLaunchBuilder}
                className="text-xs font-semibold text-[#ff6d5a] hover:text-rose-400 flex items-center gap-1.5 transition-colors"
              >
                <span>Open Visual Builder Canvas</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pre-Configured AI Blueprints */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                  Pre-Configured AI Blueprints
                </h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  Click any blueprint to launch directly onto your visual canvas studio
                </p>
              </div>
              <button
                onClick={onLaunchBuilder}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all self-start sm:self-auto"
              >
                <span>View All on Canvas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {SAMPLE_WORKFLOWS.map((template) => (
                <div
                  key={template.id}
                  onClick={() => onLoadTemplate(template)}
                  className="group cursor-pointer rounded-2xl bg-[#0f141d]/90 hover:bg-[#151c28] border border-slate-800 hover:border-slate-700 p-5 transition-all shadow-lg hover:shadow-2xl hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 group-hover:text-[#ff6d5a] transition-colors">
                      <Layers className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {template.nodes.length} nodes
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-[#ff6d5a] transition-colors mb-2">
                    {template.name}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 group-hover:text-[#ff6d5a]">
                    <span>Load Template</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#090d14] px-6 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">FlowCraft</span>
            <span>• Visual Multi-Agent Workflow Engine</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              onClick={onLaunchBuilder}
              className="hover:text-slate-300 transition-colors"
            >
              Canvas Studio
            </button>
            <button
              onClick={onOpenExtractor}
              className="hover:text-slate-300 transition-colors"
            >
              Email Extractor
            </button>
            <button
              onClick={onOpenAiAssistant}
              className="hover:text-slate-300 transition-colors"
            >
              AI Co-Pilot
            </button>
            <a
              href="https://github.com/malikjawad807-coder/flowcraft.git"
              target="_blank"
              rel="noreferrer"
              className="text-[#ff6d5a] hover:underline"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
