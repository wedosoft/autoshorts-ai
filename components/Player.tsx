import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RefreshCw, Film, Loader2, Download, Share2, Check, Video } from 'lucide-react';

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
  const [exportProgress, setExportProgress] = useState(0);
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
        const timer = setTimeout(() => {
            handleMediaEnded();
        }, 5000); // Default 5s per image for preview
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
      
      // Mix Audio
      const narrNode = audioCtx.createBufferSource();
      narrNode.buffer = audioBuffer;
      narrNode.connect(dest);
      
      if (bgmBuffer) {
        const bgmNode = audioCtx.createBufferSource();
        bgmNode.buffer = bgmBuffer;
        const bgmGain = audioCtx.createGain();
        bgmGain.gain.value = 0.1;
        bgmNode.connect(bgmGain);
        bgmGain.connect(dest);
        bgmNode.start(0);
      }

      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 5000000 });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `autoshorts_video.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
        a.click();
        setIsExporting(false);
        setExported(true);
        setTimeout(() => setExported(false), 3000);
      };

      recorder.start();
      narrNode.start(0);

      // Scene Rendering Loop
      const sceneDuration = audioBuffer.duration / videoUrls.length;
      for (let i = 0; i < videoUrls.length; i++) {
        setExportProgress(Math.round(((i + 1) / videoUrls.length) * 100));
        const url = videoUrls[i];
        
        if (isImage(url)) {
          const img = new Image();
          img.src = url;
          await new Promise(resolve => img.onload = resolve);
          
          const startTime = Date.now();
          while (Date.now() - startTime < sceneDuration * 1000) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            await new Promise(r => requestAnimationFrame(r));
          }
        } else {
          const video = document.createElement('video');
          video.src = url;
          video.muted = true;
          video.playsInline = true;
          await video.play();
          
          const startTime = Date.now();
          while (Date.now() - startTime < sceneDuration * 1000) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            await new Promise(r => requestAnimationFrame(r));
            if (video.ended) break;
          }
          video.pause();
        }
      }

      recorder.stop();
      audioCtx.close();

    } catch (e) {
      console.error("Export failed", e);
      setIsExporting(false);
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

        {/* Progress Bar in Phone */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10">
            <div 
              className="h-full bg-cyan-400 transition-all duration-300" 
              style={{ width: `${((currentVideoIndex + 1) / videoUrls.length) * 100}%` }}
            ></div>
        </div>

        {!isPlaying && !isExporting && (
          <div onClick={togglePlay} className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer group">
            <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-2xl flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform shadow-2xl">
                <Play fill="white" className="ml-1 text-white" size={40} />
            </div>
          </div>
        )}

        {isExporting && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-cyan-400 font-bold text-xs">{exportProgress}%</div>
              </div>
              <div>
                <h4 className="text-white font-black text-xl mb-2">MP4 병합 중...</h4>
                <p className="text-cyan-100/40 text-xs leading-relaxed">배경에서 고화질 영상을 렌더링하고 있습니다. 잠시만 기다려주세요.</p>
              </div>
          </div>
        )}
      </div>

      {/* Info & Controls */}
      <div className="flex-1 flex flex-col justify-center space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-4xl font-black text-white mb-4 leading-tight uppercase">Ready to Download</h2>
            <p className="text-cyan-100/60 leading-relaxed word-keep-all text-lg">
              SaaS 하이브리드 엔진이 모든 장면을 완성했습니다.<br/>
              <b>단일 MP4 파일</b>로 병합하여 저장할 수 있습니다.
            </p>
          </div>
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
                  disabled={isExporting}
                  className="flex-[2] py-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black text-xl transition-all flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] disabled:opacity-20"
                >
                    {isPlaying ? <Pause size={28}/> : <Play size={28}/>}
                </button>
                <button 
                  onClick={handleExport} 
                  disabled={isExporting}
                  className={`flex-[4] py-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xl transition-all flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] disabled:opacity-50 ${exported ? 'ring-4 ring-emerald-500/50' : ''}`}
                >
                    {isExporting ? <Loader2 className="animate-spin" size={28}/> : exported ? <Check size={28}/> : <Video size={28}/>}
                    {isExporting ? `EXPORTING ${exportProgress}%` : exported ? 'SAVED!' : 'DOWNLOAD MP4'}
                </button>
                <button 
                  onClick={onReset} 
                  disabled={isExporting}
                  className="flex-1 py-5 rounded-2xl border border-white/10 bg-white/5 text-white font-bold transition-all hover:bg-white/10 shadow-lg active:scale-[0.98] disabled:opacity-20"
                >
                  <RefreshCw className="mx-auto" size={28}/>
                </button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 opacity-40">
                <span className="text-[10px] text-white font-bold uppercase tracking-widest">Single MP4 Export</span>
                <span className="text-[10px] text-white font-bold uppercase tracking-widest">High Bitrate</span>
                <span className="text-[10px] text-white font-bold uppercase tracking-widest">Audio Mastered</span>
            </div>
        </div>
      </div>
    </div>
  );
};
