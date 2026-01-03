
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RefreshCw, Film, Loader2, Video, Check, Settings, X, Volume2, ArrowRightLeft } from 'lucide-react';

interface Props {
  videoUrls: string[];
  audioBuffer: AudioBuffer | null;
  script: string;
  onReset: () => void;
}

const BGM_URL = "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112778.mp3";
const TRANSITION_DURATION = 0.8; // Seconds

type TransitionType = 'dissolve' | 'slide' | 'zoom';

export const Player: React.FC<Props> = ({ videoUrls, audioBuffer, script, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exported, setExported] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.1);
  const [narrationVolume, setNarrationVolume] = useState(1.0);
  const [transitionType, setTransitionType] = useState<TransitionType>('dissolve');

  const audioContextRef = useRef<AudioContext | null>(null);
  const narrationSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [bgmBuffer, setBgmBuffer] = useState<AudioBuffer | null>(null);

  // Gain Nodes Refs
  const narrationGainRef = useRef<GainNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);

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

  useEffect(() => {
    if (narrationGainRef.current) narrationGainRef.current.gain.value = narrationVolume;
    if (bgmGainRef.current) bgmGainRef.current.gain.value = bgmVolume;
  }, [narrationVolume, bgmVolume]);

  useEffect(() => {
    if (isPlaying && audioBuffer) {
      const sceneDuration = (audioBuffer.duration / videoUrls.length) * 1000;
      const interval = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= videoUrls.length - 1) {
            setIsPlaying(false);
            stopAudio();
            return 0;
          }
          return prev + 1;
        });
      }, sceneDuration);
      return () => clearInterval(interval);
    }
  }, [isPlaying, videoUrls.length, audioBuffer]);

  const playAudio = () => {
    if (!audioBuffer) return;
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioContextRef.current;
    
    const narrSource = ctx.createBufferSource();
    narrSource.buffer = audioBuffer;
    const narrGain = ctx.createGain();
    narrGain.gain.value = narrationVolume;
    narrSource.connect(narrGain);
    narrGain.connect(ctx.destination);
    
    narrationSourceRef.current = narrSource;
    narrationGainRef.current = narrGain;
    
    if (bgmBuffer) {
      const bgmSource = ctx.createBufferSource();
      bgmSource.buffer = bgmBuffer;
      bgmSource.loop = true;
      const bgmGain = ctx.createGain();
      bgmGain.gain.value = bgmVolume;
      bgmSource.connect(bgmGain);
      bgmGain.connect(ctx.destination);
      
      bgmSource.start(0);
      bgmSourceRef.current = bgmSource;
      bgmGainRef.current = bgmGain;
    }

    narrSource.start(0);
  };

  const stopAudio = () => {
    narrationSourceRef.current?.stop();
    bgmSourceRef.current?.stop();
    audioContextRef.current?.close();
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      if (currentIndex === 0) playAudio();
      setIsPlaying(true);
    }
  };

  const handleExport = async () => {
    if (isExporting || !audioBuffer) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 1280;
      const ctx = canvas.getContext('2d')!;
      
      const stream = canvas.captureStream(30); 
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      
      const narrNode = audioCtx.createBufferSource();
      narrNode.buffer = audioBuffer;
      const narrGain = audioCtx.createGain();
      narrGain.gain.value = narrationVolume;
      narrNode.connect(narrGain);
      narrGain.connect(dest);
      
      if (bgmBuffer) {
        const bgmNode = audioCtx.createBufferSource();
        bgmNode.buffer = bgmBuffer;
        const bgmGain = audioCtx.createGain();
        bgmGain.gain.value = bgmVolume;
        bgmNode.connect(bgmGain);
        bgmGain.connect(dest);
        bgmNode.start(0);
      }

      const mimeTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm'
      ];
      const selectedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
      
      const recorder = new MediaRecorder(new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]), { 
        mimeType: selectedMime, 
        videoBitsPerSecond: 8000000 
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
        a.download = `autoshorts_${transitionType}.${ext}`;
        a.click();
        setIsExporting(false);
        setExported(true);
        setTimeout(() => setExported(false), 3000);
      };

      const images: HTMLImageElement[] = [];
      for (const url of videoUrls) {
        const img = new Image();
        img.src = url;
        await new Promise(resolve => img.onload = resolve);
        images.push(img);
      }

      recorder.start();
      narrNode.start(0);

      const sceneDuration = audioBuffer.duration / videoUrls.length;
      const totalDuration = audioBuffer.duration;
      const recordingStartTime = Date.now();

      const renderFrame = async () => {
        const elapsed = (Date.now() - recordingStartTime) / 1000;
        if (elapsed >= totalDuration) {
          recorder.stop();
          audioCtx.close();
          return;
        }

        setExportProgress(Math.round((elapsed / totalDuration) * 100));
        const sceneIndex = Math.floor(elapsed / sceneDuration);
        const sceneProgress = elapsed % sceneDuration;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Helper for Ken Burns effect scaling
        const drawImage = (img: HTMLImageElement, progress: number, alpha: number = 1, tx: number = 0, scaleMult: number = 1) => {
          const kenBurnsScale = 1 + progress * 0.05; 
          const finalScale = kenBurnsScale * scaleMult;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(canvas.width / 2 + tx, canvas.height / 2);
          ctx.scale(finalScale, finalScale);
          ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
          ctx.restore();
        };

        if (sceneIndex < images.length) {
          const p = sceneProgress / TRANSITION_DURATION;
          const isTransitioning = sceneIndex > 0 && sceneProgress < TRANSITION_DURATION;

          if (isTransitioning) {
            if (transitionType === 'slide') {
              // Slide Left
              drawImage(images[sceneIndex - 1], 1, 1, -canvas.width * p);
              drawImage(images[sceneIndex], sceneProgress / sceneDuration, 1, canvas.width * (1 - p));
            } else if (transitionType === 'zoom') {
              // Zoom In/Cross Fade
              drawImage(images[sceneIndex - 1], 1, 1 - p);
              // Incoming image starts zoomed in (1.5x) and scales down to normal
              const zoomScale = 1.5 - (0.5 * p); 
              drawImage(images[sceneIndex], sceneProgress / sceneDuration, p, 0, zoomScale);
            } else {
              // Dissolve (Default)
              drawImage(images[sceneIndex - 1], 1, 1);
              drawImage(images[sceneIndex], sceneProgress / sceneDuration, p);
            }
          } else {
            drawImage(images[sceneIndex], sceneProgress / sceneDuration, 1);
          }
        }
        requestAnimationFrame(renderFrame);
      };
      renderFrame();

    } catch (e) {
      console.error("Export Error:", e);
      setIsExporting(false);
    }
  };

  // Helper to generate preview classes based on transition type
  const getPreviewClasses = (index: number) => {
    const isCurrent = index === currentIndex;
    const isPast = index < currentIndex;
    
    // Base styles
    let classes = "absolute inset-0 w-full h-full object-cover transition-all ease-in-out ";
    
    // Timing
    // For 'slide' we need faster transitions for the movement, 'dissolve' can be slower/smoother
    const duration = isPlaying ? (transitionType === 'slide' ? 'duration-700' : 'duration-[5000ms]') : 'duration-700';
    classes += duration;

    if (transitionType === 'slide') {
      classes += ' opacity-100'; // Always visible opacity-wise for slide
      if (isCurrent) classes += ' translate-x-0 z-10';
      else if (isPast) classes += ' -translate-x-full z-0';
      else classes += ' translate-x-full z-0';
    } else if (transitionType === 'zoom') {
      if (isCurrent) classes += ' opacity-100 scale-100 z-10';
      else classes += ' opacity-0 scale-150 z-0'; // Fades out while zoomed in
    } else {
      // Dissolve
      classes += isCurrent ? ' opacity-100 scale-110' : ' opacity-0 scale-100';
    }

    return classes;
  };

  return (
    <div className="flex flex-col md:flex-row gap-12 w-full max-w-5xl p-6 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-2xl animate-scale-in relative">
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#001219] border border-cyan-500/30 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-scale-in relative">
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            
            <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
              <Settings className="text-cyan-400" /> Export Settings
            </h3>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="flex justify-between text-white/90 font-medium">
                  <div className="flex items-center gap-2"><Volume2 size={18} className="text-cyan-400"/> Narration Volume</div>
                  <span className="text-cyan-400 font-bold">{Math.round(narrationVolume * 100)}%</span>
                </label>
                <input 
                  type="range" min="0" max="2" step="0.1" 
                  value={narrationVolume} onChange={(e) => setNarrationVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:bg-white/20 transition-colors"
                />
              </div>

              <div className="space-y-3">
                 <label className="flex justify-between text-white/90 font-medium">
                  <div className="flex items-center gap-2"><Volume2 size={18} className="text-purple-400"/> BGM Volume</div>
                  <span className="text-purple-400 font-bold">{Math.round(bgmVolume * 100)}%</span>
                </label>
                 <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:bg-white/20 transition-colors"
                />
              </div>

              <div className="space-y-3">
                <label className="flex justify-between text-white/90 font-medium">
                  <div className="flex items-center gap-2"><ArrowRightLeft size={18} className="text-emerald-400"/> Transition Effect</div>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dissolve', 'slide', 'zoom'] as TransitionType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTransitionType(t)}
                      className={`py-3 rounded-xl text-sm font-bold capitalize transition-all border ${
                        transitionType === t 
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' 
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="w-full mt-10 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-bold text-lg hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Viewport */}
      <div className="mx-auto md:mx-0 relative w-[320px] h-[570px] bg-black rounded-[3.5rem] border-[10px] border-white/10 shadow-2xl overflow-hidden shrink-0 z-0">
        <div className="w-full h-full relative overflow-hidden">
          {videoUrls.map((url, index) => (
            <img 
              key={index}
              src={url} 
              className={getPreviewClasses(index)}
              style={{ filter: 'brightness(1.05)' }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-20"></div>
        </div>

        {isExporting && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-8 text-center space-y-6 z-50">
              <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
              <div>
                <h4 className="text-white font-black text-xl mb-2 uppercase tracking-tighter">Exporting</h4>
                <p className="text-cyan-400 font-bold text-2xl">{exportProgress}%</p>
                <p className="text-[10px] text-white/40 mt-4 leading-relaxed uppercase tracking-widest">Applying {transitionType} transition & H.264 encoding</p>
              </div>
          </div>
        )}

        {!isPlaying && !isExporting && (
          <div onClick={togglePlay} className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer group z-40">
            <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-2xl flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                <Play fill="white" className="ml-1 text-white" size={40} />
            </div>
          </div>
        )}
      </div>

      {/* Info & Controls */}
      <div className="flex-1 flex flex-col justify-center space-y-8">
        <div>
          <h2 className="text-4xl font-black text-white mb-4 uppercase leading-tight tracking-tight">Cinematic Edit</h2>
          <p className="text-cyan-100/60 text-lg leading-relaxed">
            5개 장면의 <b>{transitionType.toUpperCase()} Transition</b> 효과가 적용되었습니다.<br/>
            전문가가 편집한 듯한 쇼츠를 지금 다운로드하세요.
          </p>
        </div>

        <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-2xl max-h-72 overflow-y-auto">
            <h3 className="text-cyan-400 font-black mb-4 flex items-center gap-2 text-sm uppercase border-b border-white/10 pb-2">
              <Film size={18}/> Story Script
            </h3>
            <div className="text-white/80 leading-relaxed whitespace-pre-wrap text-sm italic">"{script}"</div>
        </div>

        <div className="flex gap-4">
            <button 
              onClick={togglePlay} 
              disabled={isExporting}
              className="flex-[1] py-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all flex items-center justify-center disabled:opacity-20"
            >
                {isPlaying ? <Pause size={28}/> : <Play size={28}/>}
            </button>
            <button 
              onClick={handleExport} 
              disabled={isExporting}
              className="flex-[4] py-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xl transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
            >
                {isExporting ? <Loader2 className="animate-spin" size={28}/> : exported ? <Check size={28}/> : <Video size={28}/>}
                {isExporting ? `RENDERING ${exportProgress}%` : exported ? 'SAVED!' : 'DOWNLOAD MP4'}
            </button>
            <button 
              onClick={() => setShowSettings(true)} 
              disabled={isExporting}
              className="flex-1 py-5 rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all flex items-center justify-center disabled:opacity-20"
            >
              <Settings size={28}/>
            </button>
            <button 
              onClick={onReset} 
              disabled={isExporting}
              className="flex-1 py-5 rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all disabled:opacity-20"
            >
              <RefreshCw className="mx-auto" size={28}/>
            </button>
        </div>
        <div className="flex justify-center gap-6 opacity-40">
           <span className="text-[10px] text-white font-bold uppercase tracking-widest border border-white/20 px-2 py-1 rounded">H.264 Encoding</span>
           <span className="text-[10px] text-white font-bold uppercase tracking-widest border border-white/20 px-2 py-1 rounded">QuickTime Ready</span>
        </div>
      </div>
    </div>
  );
};
