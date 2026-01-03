import React, { useState, useCallback, useEffect } from 'react';
import { AppState, GeneratedAssets, ScriptData } from './types';
import * as gemini from './services/geminiService';
import { StepIndicator } from './components/StepIndicator';
import { Player } from './components/Player';
import { Wand2, FileText, Image as ImageIcon, Video, Mic, AlertCircle, RefreshCcw, Info, Camera, Sparkles, Ghost, PenTool, Brush, Waves, Key } from 'lucide-react';

const VISUAL_STYLES = [
  { 
    id: 'realistic', 
    label: '실사 (Realistic)', 
    icon: <Camera size={18} />, 
    prompt: 'Hyper-realistic RAW photo, cinematic 8k UHD, Fujifilm XT4 quality, realistic skin textures, natural lighting, shot on 35mm lens. ABSOLUTELY NO ILLUSTRATION, NO CARTOON, NO PAINTING, NO ARTISTIC SKETCH.' 
  },
  { 
    id: 'anime', 
    label: '애니메이션 (Anime)', 
    icon: <Sparkles size={18} />, 
    prompt: 'High-quality modern Japanese anime style, vibrant Makoto Shinkai aesthetic, clean cel-shaded lines, detailed background art.' 
  },
  { 
    id: '3d_cartoon', 
    label: '3D 툰 (Pixar)', 
    icon: <Ghost size={18} />, 
    prompt: 'Professional 3D animation style, Disney/Pixar movie quality, soft lighting, expressive character design, high-end 3D rendering.' 
  },
  { 
    id: 'cyberpunk', 
    label: '사이버펑크 (Neon)', 
    icon: <Wand2 size={18} />, 
    prompt: 'Dark cyberpunk city aesthetic, volumetric neon lighting, rainy futuristic atmosphere, high contrast purple and cyan palette.' 
  },
  { 
    id: 'oil_painting', 
    label: '유화 (Oil Paint)', 
    icon: <Brush size={18} />, 
    prompt: 'Classic thick oil painting on canvas, heavy impasto brushstrokes, rich textures, fine art museum quality.' 
  },
  { 
    id: 'sketch', 
    label: '스케치 (Sketch)', 
    icon: <PenTool size={18} />, 
    prompt: 'Hand-drawn charcoal and graphite pencil sketch, artistic hatching, realistic portrait sketch style on paper.' 
  },
];

export default function App() {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(VISUAL_STYLES[0].id);
  const [assets, setAssets] = useState<GeneratedAssets>({
    script: null,
    videoUrls: [],
    audioBuffer: null
  });
  const [error, setError] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<{current: number, total: number} | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) await window.aistudio.openSelectKey();
      }
    };
    checkKey();
  }, []);

  const handleGenerate = useCallback(async (forcedTopic?: string) => {
    const currentTopic = forcedTopic || topic;
    const styleObj = VISUAL_STYLES.find(s => s.id === selectedStyle) || VISUAL_STYLES[0];
    if (!currentTopic.trim()) return;
    setError(null);
    
    try {
      setState(AppState.GENERATING_SCRIPT);
      const scriptData = await gemini.generateScript(currentTopic, styleObj.prompt);
      setAssets(prev => ({ ...prev, script: scriptData }));
      
      const sceneCount = scriptData.scenes.length;
      const finalUrls: string[] = [];
      let isQuotaExhausted = false;

      for (let i = 0; i < sceneCount; i++) {
        setVideoProgress({ current: i + 1, total: sceneCount });
        setState(AppState.GENERATING_IMAGE);
        const base64Img = await gemini.generateSceneImage(scriptData.globalStyle, scriptData.scenes[i].visualPrompt);
        
        if (!isQuotaExhausted) {
          setState(AppState.GENERATING_VIDEO);
          try {
            const videoUrl = await gemini.generateVeoVideo(base64Img, scriptData.scenes[i].visualPrompt);
            finalUrls.push(videoUrl || `data:image/png;base64,${base64Img}`);
          } catch (veoErr: any) {
            isQuotaExhausted = true;
            finalUrls.push(`data:image/png;base64,${base64Img}`);
          }
        } else {
          finalUrls.push(`data:image/png;base64,${base64Img}`);
        }
        setAssets(prev => ({ ...prev, videoUrls: [...finalUrls] }));
      }

      setState(AppState.GENERATING_AUDIO);
      const audioBuffer = await gemini.generateNarrationAudio(scriptData.scenes.map(s => s.narration).join(' '));
      setAssets(prev => ({ ...prev, videoUrls: finalUrls, audioBuffer }));
      setState(AppState.COMPLETED);
    } catch (err: any) {
      setError(err.message || "오류가 발생했습니다.");
      setState(AppState.ERROR);
    }
  }, [topic, selectedStyle]);

  const resetApp = () => {
    setState(AppState.IDLE);
    setTopic('');
    setAssets({ script: null, videoUrls: [], audioBuffer: null });
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 font-sans">
      <div className="text-center mb-16 space-y-4 animate-fade-in">
        <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_0_30px_rgba(0,180,216,0.3)] mb-4">
          <Waves className="w-10 h-10 text-cyan-400 animate-pulse" />
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-cyan-200 to-cyan-500 uppercase">
          AutoShorts AI
        </h1>
        <p className="text-cyan-100/70 text-lg md:text-xl max-w-lg mx-auto leading-relaxed word-keep-all drop-shadow-md">
          사용자의 스타일 선택을 엄격히 준수합니다.<br/>
          이제 완성된 프로젝트를 <b>단일 MP4 파일</b>로 소장하세요.
        </p>
      </div>

      <div className="w-full max-w-5xl flex flex-col items-center">
        {state !== AppState.IDLE && state !== AppState.ERROR && (
           <StepIndicator steps={[
             { title: '기획', icon: <FileText size={18}/>, isActive: state === AppState.GENERATING_SCRIPT, isCompleted: state !== AppState.GENERATING_SCRIPT },
             { title: '에셋 생성', icon: <ImageIcon size={18}/>, isActive: [AppState.GENERATING_IMAGE, AppState.GENERATING_VIDEO].includes(state), isCompleted: ![AppState.GENERATING_SCRIPT, AppState.GENERATING_IMAGE, AppState.GENERATING_VIDEO].includes(state) },
             { title: '나레이션', icon: <Mic size={18}/>, isActive: state === AppState.GENERATING_AUDIO, isCompleted: state === AppState.COMPLETED },
           ]} />
        )}

        {state === AppState.IDLE && (
          <div className="w-full max-w-2xl animate-fade-in-up space-y-12">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
              <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-1.5 flex items-center shadow-2xl">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="쇼츠 주제를 입력하세요..."
                  className="flex-1 bg-transparent border-none text-white px-6 py-4 focus:ring-0 placeholder-cyan-200/40 text-lg outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
                <button
                  onClick={() => handleGenerate()}
                  disabled={!topic.trim()}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-8 py-4 rounded-xl font-bold transition-all duration-300 disabled:opacity-30 m-1 whitespace-nowrap flex items-center gap-3 shadow-xl"
                >
                  <Wand2 size={20} /> 제작 시작
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {VISUAL_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-5 rounded-2xl border transition-all duration-500 text-left space-y-3 backdrop-blur-md ${selectedStyle === style.id ? 'bg-white/20 border-cyan-400 ring-2 ring-cyan-400/50 shadow-lg' : 'bg-white/5 border-white/10 text-cyan-200/50 hover:bg-white/10'}`}
                  >
                    <div className={`p-3 rounded-xl inline-flex ${selectedStyle === style.id ? 'bg-cyan-500 text-white' : 'bg-white/10'}`}>{style.icon}</div>
                    <div className="font-bold text-base">{style.label}</div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {(state !== AppState.IDLE && state !== AppState.COMPLETED && state !== AppState.ERROR) && (
            <div className="mt-20 text-center space-y-8 animate-pulse">
                <div className="relative"><div className="w-24 h-24 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto"></div></div>
                <div className="space-y-4">
                    <div className="text-3xl font-light text-white tracking-widest uppercase">{state.replace('_', ' ')}...</div>
                    {videoProgress && <div className="text-cyan-400 font-black text-6xl">{videoProgress.current} <span className="text-2xl opacity-50">/</span> {videoProgress.total}</div>}
                    <p className="text-cyan-200/40 text-sm max-w-sm mx-auto">선택하신 비주얼 스타일을 관철시키기 위해 정밀 렌더링 중입니다.</p>
                </div>
            </div>
        )}

        {state === AppState.COMPLETED && (
            <Player videoUrls={assets.videoUrls} audioBuffer={assets.audioBuffer} script={assets.script?.scenes.map(s => s.narration).join('\n\n') || ''} onReset={resetApp} />
        )}

        {state === AppState.ERROR && (
            <div className="mt-8 p-10 bg-white/10 backdrop-blur-2xl border border-red-500/30 rounded-3xl max-w-md w-full text-center shadow-2xl">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">오류 발생</h3>
                <p className="text-cyan-100/60 mb-8 text-sm leading-relaxed">{error}</p>
                <button onClick={() => handleGenerate()} className="w-full px-6 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                  <RefreshCcw size={20}/> 다시 시도
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
