
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RefreshCw, Film, Volume2 } from 'lucide-react';

interface Props {
  videoUrls: string[];
  audioBuffer: AudioBuffer | null;
  script: string;
  onReset: () => void;
}

const BGM_URL = "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112778.mp3";

export const Player: React.FC<Props> = ({ videoUrls, audioBuffer, script, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bgmVolume, setBgmVolume] = useState(0.15);
  const [narrationVolume, setNarrationVolume] = useState(1.0);
  
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const narrationSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [bgmBuffer, setBgmBuffer] = useState<AudioBuffer | null>(null);

  useEffect(() => {
    const loadBgm = async () => {
      try {
        const response = await fetch(BGM_URL);
        const arrayBuffer = await response.arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        setBgmBuffer(decoded);
        ctx.close();
      } catch (e) { console.error(e); }
    };
    loadBgm();
  }, []);

  const playAll = async () => {
    if (!audioBuffer) return;
    
    stopAll();
    setIsPlaying(true);
    setCurrentIndex(0);

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;

    // Narration
    const narrSource = ctx.createBufferSource();
    narrSource.buffer = audioBuffer;
    const narrGain = ctx.createGain();
    narrGain.gain.value = narrationVolume;
    narrSource.connect(narrGain).connect(ctx.destination);
    narrSource.start(0);
    narrationSourceRef.current = narrSource;

    // BGM
    if (bgmBuffer) {
      const bgmSource = ctx.createBufferSource();
      bgmSource.buffer = bgmBuffer;
      bgmSource.loop = true;
      const bgmGain = ctx.createGain();
      bgmGain.gain.value = bgmVolume;
      bgmSource.connect(bgmGain).connect(ctx.destination);
      bgmSource.start(0);
      bgmSourceRef.current = bgmSource;
    }

    // Video/Scene Sync Logic
    const sceneDuration = audioBuffer.duration / videoUrls.length;
    
    for (let i = 0; i < videoUrls.length; i++) {
      if (!audioContextRef.current) break;
      setCurrentIndex(i);
      const url = videoUrls[i];
      const isImage = url.startsWith('data:image');
      
      const v = videoRefs.current[i];
      if (v && !isImage) {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
      
      await new Promise(r => setTimeout(r, sceneDuration * 1000));
      if (v && !isImage) v.pause();
    }
    
    setIsPlaying(false);
  };

  const stopAll = () => {
    narrationSourceRef.current?.stop();
    bgmSourceRef.current?.stop();
    audioContextRef.current?.close();
    audioContextRef.current = null;
    videoRefs.current.forEach(v => {
      if (v) {
        v.pause();
        v.currentTime = 0;
      }
    });
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col md:flex-row gap-12 w-full max-w-5xl p-6 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-2xl animate-scale-in">
      
      {/* Viewport */}
      <div className="mx-auto md:mx-0 relative w-[320px] h-[570px] bg-black rounded-[3.5rem] border-[10px] border-white/10 shadow-2xl overflow-hidden shrink-0">
        {videoUrls.map((url, index) => {
          const isImage = url.startsWith('data:image');
          if (isImage) {
            return (
              <img 
                key={index}
                src={url}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                alt={`Scene ${index + 1}`}
              />
            );
          }
          return (
            <video 
              key={index}
              ref={el => videoRefs.current[index] = el}
              src={url}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
              muted
              playsInline
            />
          );
        })}
        
        {!isPlaying && (
          <div onClick={playAll} className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer group z-40">
            <div className="w-20 h-20 rounded-full bg-cyan-500/80 flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(6,182,212,0.5)]">
                <Play fill="white" className="ml-1 text-white" size={32} />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-1 flex flex-col justify-center space-y-8">
        <div>
          <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">AI Cinematic</h2>
          <p className="text-cyan-400 font-bold uppercase tracking-widest text-sm mb-4">Hybrid Rendering</p>
          <p className="text-cyan-100/60 leading-relaxed italic">
            "비디오 렌더링 부하 시 이미지가 대신 사용될 수 있습니다. 고품질 스크립트와 나레이션은 그대로 유지됩니다."
          </p>
        </div>

        <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 max-h-48 overflow-y-auto">
            <h3 className="text-cyan-400 font-bold mb-3 text-xs uppercase flex items-center gap-2">
              <Film size={14}/> Narration Script
            </h3>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{script}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={isPlaying ? stopAll : playAll}
              className="py-5 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-black text-lg shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
            >
              {isPlaying ? <Pause size={24}/> : <Play size={24}/>}
              {isPlaying ? 'PAUSE' : 'PLAY SHOWCASE'}
            </button>
            <button 
              onClick={onReset}
              className="py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-3"
            >
              <RefreshCw size={24}/> NEW PROJECT
            </button>
        </div>
        
        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center gap-4">
            <Volume2 size={18} className="text-cyan-400"/>
            <input 
              type="range" min="0" max="1" step="0.1" 
              value={bgmVolume} onChange={e => setBgmVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-white/10 rounded-lg appearance-none accent-cyan-500"
            />
            <span className="text-[10px] font-bold text-white/40 uppercase">BGM</span>
          </div>
        </div>
      </div>
    </div>
  );
};
