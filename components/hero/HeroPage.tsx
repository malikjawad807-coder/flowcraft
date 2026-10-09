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
  RotateCcw,
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

    video.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      // Browsers allow muted autoplay
      video.muted = true;
      setIsMuted(true);
      video.play().catch(() => {});
    });

    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-[#ff6d5a] selection:text-white">
      {/* Glow ambient background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[#ff6d5a]/15 via-purple-600/10 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[35%] -left-48 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-[45%] -right-48 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Top Header / Nav */}
      <header className="relative z-20 border-b border-slate-800/80 bg-[#0c1017]/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff6d5a] to-rose-400 flex items-center justify-center text-white shadow-lg shadow-[#ff6d5a]/25">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">FlowCraft</span>
              <span className="text-[10px] font-mono font-semibold bg-[#ff6d5a]/20 text-[#ff6d5a] border border-[#ff6d5a]/30 px-1.5 py-0.5 rounded">
                n8n v2.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Autonomous AI Workflow Studio</p>
          </div>
        </div>

        {/* Quick Nav & Launch Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenExtractor}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Universal Extractor</span>
          </button>

          <button
            onClick={onOpenAiAssistant}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/60 transition-all shadow-sm"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Co-Pilot</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>API Keys</span>
          </button>

          <button
            onClick={onLaunchBuilder}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#ff6d5a] to-rose-500 hover:from-[#ff5942] hover:to-rose-600 shadow-md shadow-[#ff6d5a]/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Launch Canvas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 pt-8 pb-16 max-w-7xl mx-auto w-full">
        {/* Top Feature Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-medium text-slate-300 mb-6 shadow-md backdrop-blur-sm">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[#ff6d5a] font-semibold">New:</span>
          <span>Universal Drag & Drop Extractor + Multi-Model AI Routing</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </div>

        {/* Hero Title & Subtitle */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15] mb-5">
            Orchestrate AI Workflows.{' '}
            <span className="bg-gradient-to-r from-[#ff6d5a] via-rose-400 to-amber-300 bg-clip-text text-transparent">
              Execute at Drone Speed.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            The visual automation platform engineered for the AI era. Connect{' '}
            <strong className="text-slate-200 font-semibold">OpenAI, Claude, and Gemini</strong> with{' '}
            <strong className="text-slate-200 font-semibold">universal file email extraction</strong> and{' '}
            <strong className="text-slate-200 font-semibold">autonomous Gmail delivery</strong> on an infinite interactive canvas.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
            <button
              onClick={onLaunchBuilder}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#ff6d5a] to-rose-500 hover:from-[#ff5942] hover:to-rose-600 shadow-xl shadow-[#ff6d5a]/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Open Visual Builder</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenExtractor}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/80 shadow-lg shadow-emerald-950/30 transition-all transform hover:-translate-y-0.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Universal File Extractor</span>
            </button>

            <button
              onClick={onOpenAiAssistant}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/80 shadow-lg shadow-indigo-950/30 transition-all transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Co-Pilot</span>
            </button>
          </div>
        </div>

        {/* Video Showcase Section */}
        <div className="w-full max-w-5xl mx-auto mb-16">
          <div
            ref={containerRef}
            className="group relative rounded-2xl p-1 bg-gradient-to-b from-slate-700/60 via-slate-800/40 to-slate-900/80 border border-slate-700/60 shadow-2xl shadow-black/80 backdrop-blur-xl transition-all"
          >
            {/* Ambient Backlight reflecting glowing drone lights */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[#ff6d5a]/20 via-cyan-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition duration-700 -z-10" />

            {/* Video Container */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/90">
              {/* Zero-Lag Optimized Video Element */}
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
                className="w-full h-full object-cover rounded-xl"
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

              {/* Top Floating Telemetry Badges */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-mono text-cyan-300 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>AUTONOMOUS SURVEILLANCE ENGINE</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-emerald-400">1080p 60FPS SMOOTH</span>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-slate-300">
                    LATENCY: <span className="text-emerald-400 font-bold">14ms</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-slate-300">
                    GPU ACCELERATED
                  </div>
                </div>
              </div>

              {/* Bottom Floating Card Overlay */}
              <div className="absolute bottom-16 left-4 hidden md:flex items-center gap-3 px-3.5 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-xs text-slate-200 pointer-events-none shadow-xl">
                <div className="w-7 h-7 rounded-lg bg-[#ff6d5a]/20 border border-[#ff6d5a]/30 flex items-center justify-center text-[#ff6d5a]">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    FlowCraft Drone Neural Core
                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      LIVE
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Multi-Agent Pipeline Dispatching at Peak Velocity
                  </div>
                </div>
              </div>

              {/* Floating Right Stats Card */}
              <div className="absolute bottom-16 right-4 hidden md:flex items-center gap-3 px-3.5 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-xs text-slate-200 pointer-events-none shadow-xl">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-white">Universal Email Extractor</div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    Any Format • Deep Regex Engine Active
                  </div>
                </div>
              </div>

              {/* Interactive Video Control Bar (appears on hover or active) */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 flex flex-col gap-2 z-20 opacity-90 group-hover:opacity-100 transition-opacity">
                {/* Timeline scrubber */}
                <div
                  onClick={handleSeek}
                  className="relative w-full h-1.5 bg-slate-800/80 hover:h-2.5 rounded-full cursor-pointer transition-all overflow-hidden"
                  title="Seek video"
                >
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#ff6d5a] to-amber-400 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Control buttons & metadata */}
                <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                  <div className="flex items-center gap-3">
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
                      {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-white" />}
                    </button>

                    <button
                      onClick={handleRestart}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors hidden sm:block"
                      title="Replay from start"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {/* Speed selector */}
                    <button
                      onClick={cycleSpeed}
                      className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-mono text-cyan-300 border border-cyan-500/30 transition-colors"
                      title="Adjust playback speed (Click to toggle)"
                    >
                      {speed}x
                    </button>

                    <span className="font-mono text-[11px] text-slate-400">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono text-slate-300">
                      <span>ZERO LAG HARDWARE PIPELINE</span>
                    </div>

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
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-5xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Next-Generation Automation Architecture
            </h2>
            <p className="text-sm text-slate-400">
              Everything required to orchestrate multi-model agents and deliver emails autonomously
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Feature 1 */}
            <div className="rounded-2xl bg-gradient-to-b from-[#131924] to-[#0d121a] border border-slate-800/90 p-5 hover:border-emerald-700/60 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-800/80 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">Universal File Extractor</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Drag-and-drop any file format—Excel workbooks, CSV, JSON, PDF, TXT, or raw logs. Universal regex extracts and categorizes all valid emails instantly.
              </p>
              <button
                onClick={onOpenExtractor}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <span>Launch Extractor Tool</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl bg-gradient-to-b from-[#131924] to-[#0d121a] border border-slate-800/90 p-5 hover:border-indigo-700/60 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-indigo-950/70 border border-indigo-800/80 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-105 transition-transform">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">Multi-Model AI Switcher</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Seamlessly toggle between 9 state-of-the-art models from OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), and Google (Gemini 2.0 Flash) using custom keys.
              </p>
              <button
                onClick={onOpenAiAssistant}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <span>Try AI Assistant Panel</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl bg-gradient-to-b from-[#131924] to-[#0d121a] border border-slate-800/90 p-5 hover:border-[#ff6d5a]/60 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#ff6d5a]/15 border border-[#ff6d5a]/30 flex items-center justify-center text-[#ff6d5a] mb-4 group-hover:scale-105 transition-transform">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">Bulk & Single Gmail Delivery</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Execute automated email sequences via official Gmail API OAuth or App Passwords with live delivery queues, AI copy generation, and status logs.
              </p>
              <button
                onClick={onLaunchBuilder}
                className="text-xs font-semibold text-[#ff6d5a] hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <span>Explore Workflow Canvas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Ready-to-Run Workflow Templates */}
        <div className="w-full max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Pre-Configured AI Blueprints</h2>
              <p className="text-xs text-slate-400">Click any blueprint to launch directly onto your canvas</p>
            </div>
            <button
              onClick={onLaunchBuilder}
              className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1"
            >
              <span>View Canvas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_WORKFLOWS.map((template) => (
              <div
                key={template.id}
                onClick={() => onLoadTemplate(template)}
                className="group cursor-pointer rounded-xl bg-[#0f141d] hover:bg-[#151c28] border border-slate-800 hover:border-slate-700 p-4 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60 text-slate-200 group-hover:text-[#ff6d5a] transition-colors">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {template.nodes.length} nodes
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white group-hover:text-[#ff6d5a] transition-colors mb-1">
                  {template.name}
                </h4>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {template.description}
                </p>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-slate-200">
                  <span>Load Template</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#090d14] px-6 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">FlowCraft</span>
            <span>• Visual Multi-Agent Workflow Engine</span>
          </div>
          <div className="flex items-center gap-4">
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
