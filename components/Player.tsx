import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RefreshCw, Film, Loader2, Download, Share2, Check } from 'lucide-react';

interface Props {
  videoUrls: string[];
  audioBuffer: AudioBuffer | null;
  script: string;
  onReset: () => void;
}

const BGM_URL = "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112778.mp3";

export const Player: React.FC<Props> = ({ videoUrls, audioBuffer, script, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const narrationSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [bgmBuffer, setBgmBuffer] = useState<AudioBuffer | null>(null);

  useEffect(() => {
    const loadBgm = async () => {
      try {
        const response = await fetch(BGM_URL);
        const arrayBuffer = await response.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        setBgmBuffer(decoded);
        ctx.close();
      } catch (e) { console.error(e); }
    };
    loadBgm();
    return () => stopAudio();
  }, []);

  const isImage = (url: string) => url.startsWith('data:image');

  useEffect(() => {
    if (isPlaying && !isImage(videoUrls[currentVideoIndex]) && videoRef.current) {
        videoRef.current.play().catch(() => {});
    } else if (isPlaying && isImage(videoUrls[currentVideoIndex])) {
        // High quality images are timed to match typical narration (approx 7s)
        const timer = setTimeout(() => {
            handleMediaEnded();
        }, 7000);
        return () => clearTimeout(timer);
    }
  }, [currentVideoIndex, isPlaying]);

  const handleMediaEnded = () => {
    const nextIndex = (currentVideoIndex + 1) % videoUrls.length;
    if (nextIndex === 0) {
        setIsPlaying(false);
        stopAudio();
    } else {
        setCurrentVideoIndex(nextIndex);
    }
  };

  const playAudio = () => {
    if (!audioBuffer) return;
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioContextRef.current;
    
    const narrSource = ctx.createBufferSource();
    narrSource.buffer = audioBuffer;
    narrSource.connect(ctx.destination);
    
    if (bgmBuffer) {
      const bgmSource = ctx.createBufferSource();
      bgmSource.buffer = bgmBuffer;
      bgmSource.loop = true;
      const bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.08;
      bgmSource.connect(bgmGain);
      bgmGain.connect(ctx.destination);
      bgmSource.start(0);
      bgmSourceRef.current = bgmSource;
    }

    narrSource.onended = () => {
        setIsPlaying(false);
        stopAudio();
        setCurrentVideoIndex(0);
    };
    narrSource.start(0);
    narrationSourceRef.current = narrSource;
  };

  const stopAudio = () => {
    narrationSourceRef.current?.stop();
    bgmSourceRef.current?.stop();
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
      videoRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (currentVideoIndex === 0) playAudio();
      setIsPlaying(true);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // 1. Download Script as Text
      const scriptBlob = new Blob([script], { type: 'text/plain' });
      const scriptUrl = URL.createObjectURL(scriptBlob);
      const scriptLink = document.createElement('a');
      scriptLink.href = scriptUrl;
      scriptLink.download = 'script.txt';
      scriptLink.click();

      // 2. Download Media Assets
      for (let i = 0; i < videoUrls.length; i++) {
        const url = videoUrls[i];
        const link = document.createElement('a');
        link.href = url;
        link.download = `scene_${i + 1}.${isImage(url) ? 'png' : 'mp4'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Small delay to prevent browser from blocking multiple downloads
        await new Promise(r => setTimeout(r, 300));
      }

      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AutoShorts AI Video',
          text: script.slice(0, 100) + '...',
          url: window.location.href,
        });
      } catch (e) { console.error(e); }
    }
  };

  const currentMediaUrl = videoUrls[currentVideoIndex];

  return (
    <div className="flex flex-col md:flex-row gap-12 w-full max-w-5xl p-6 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-2xl animate-scale-in">
      {/* Phone Frame */}
      <div className="mx-auto md:mx-0 relative w-[320px] h-[570px] bg-black rounded-[3.5rem] border-[10px] border-white/10 shadow-2xl overflow-hidden shrink-0">
        {currentMediaUrl ? (
          isImage(currentMediaUrl) ? (
              <div className="w-full h-full overflow-hidden relative bg-[#001219]">
                  <img 
                    src={currentMediaUrl} 
                    className={`w-full h-full object-cover transition-all duration-[7500ms] ease-out ${isPlaying ? 'scale-150 translate-x-4 -translate-y-4' : 'scale-110 translate-x-0 translate-y-0'}`}
                    style={{ filter: 'brightness(1.1) contrast(1.05)' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60"></div>
              </div>
          ) : (
              <video 
                key={currentMediaUrl}
                ref={videoRef}
                src={currentMediaUrl}
                className="w-full h-full object-cover"
                muted
                playsInline
                onEnded={handleMediaEnded}
              />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#001219]">
             <Loader2 className="animate-spin text-cyan-500" />
          </div>
        )}

        <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black via-black/40 to-transparent pt-20 pointer-events-none">
          <div className="flex items-center gap-2 mb-4">
             <div className="bg-cyan-500 px-3 py-1 rounded-full text-[10px] font-black text-white shadow-lg">
                SCENE {currentVideoIndex + 1} / {videoUrls.length}
             </div>
             {currentMediaUrl && isImage(currentMediaUrl) && (
                 <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-[10px] font-bold text-cyan-200 uppercase tracking-widest">Cinematic Image</div>
             )}
          </div>
        </div>

        {!isPlaying && (
          <div onClick={togglePlay} className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer group">
            <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-2xl flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform shadow-2xl">
                <Play fill="white" className="ml-1 text-white" size={40} />
            </div>
          </div>
        )}
      </div>

      {/* Info & Controls */}
      <div className="flex-1 flex flex-col justify-center space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-4xl font-black text-white mb-4 leading-tight uppercase">Rendering Done</h2>
            <p className="text-cyan-100/60 leading-relaxed word-keep-all text-lg">
              SaaS 하이브리드 엔진이 모든 자산을 생성했습니다. <br/>
              이제 비디오를 저장하거나 친구들과 공유해보세요.
            </p>
          </div>
          <button 
            onClick={handleShare}
            className="p-4 rounded-full bg-white/5 border border-white/10 text-cyan-300 hover:bg-white/10 transition-all active:scale-95"
          >
            <Share2 size={24} />
          </button>
        </div>

        <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-2xl max-h-72 overflow-y-auto shadow-inner">
            <h3 className="text-cyan-400 font-black mb-4 flex items-center gap-2 text-sm uppercase tracking-widest border-b border-white/10 pb-2">
              <Film size={18}/> Story Script
            </h3>
            <div className="text-white/80 text-base leading-relaxed whitespace-pre-wrap font-medium">{script}</div>
        </div>

        <div className="flex flex-col gap-4">
            <div className="flex gap-4">
                <button 
                  onClick={togglePlay} 
                  className="flex-[3] py-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xl transition-all flex items-center justify-center gap-3 shadow-xl active:scale-[0.98]"
                >
                    {isPlaying ? <Pause size={28}/> : <Play size={28}/>} {isPlaying ? 'PAUSE' : 'PLAY VIDEO'}
                </button>
                <button 
                  onClick={handleExport} 
                  disabled={isExporting}
                  className={`flex-[1.5] py-5 rounded-2xl border flex items-center justify-center gap-2 font-bold transition-all shadow-lg active:scale-[0.98] ${
                    exported 
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                    : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                  }`}
                >
                    {isExporting ? <Loader2 className="animate-spin" size={24}/> : exported ? <Check size={24}/> : <Download size={24}/>}
                    {exported ? 'DONE' : 'EXPORT'}
                </button>
                <button 
                  onClick={onReset} 
                  className="flex-1 py-5 rounded-2xl border border-white/10 bg-white/5 text-white font-bold transition-all hover:bg-white/10 shadow-lg active:scale-[0.98]"
                >
                  <RefreshCw className="mx-auto" size={28}/>
                </button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 opacity-40">
                <span className="text-[10px] text-white font-bold uppercase tracking-widest">Hybrid V3.5</span>
                <span className="text-[10px] text-white font-bold uppercase tracking-widest">Gemini 2.5 Pro</span>
                <span className="text-[10px] text-white font-bold uppercase tracking-widest">Veo 3.1 Fast</span>
            </div>
        </div>
      </div>
    </div>
  );
};
