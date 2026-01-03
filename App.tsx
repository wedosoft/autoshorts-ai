
import React, { useState, useCallback, useEffect } from 'react';
import { AppState, GeneratedAssets, ScriptData } from './types';
import * as gemini from './services/geminiService';
import { StepIndicator } from './components/StepIndicator';
import { Player } from './components/Player';
import { Wand2, FileText, Image as ImageIcon, Mic, AlertCircle, RefreshCcw, Camera, Sparkles, Ghost, PenTool, Brush, Waves } from 'lucide-react';

const VISUAL_STYLES = [
  { 
    id: 'realistic', 
    label: '실사 (Realistic)', 
    icon: <Camera size={18} />, 
    prompt: 'High-end commercial photography, realistic RAW photo, cinematic lighting, 8k resolution, shot on 35mm f/1.8 lens. Deep focus, realistic skin texture and natural lighting. ABSOLUTELY NO ARTISTIC EFFECTS, NO PAINTING, NO ILLUSTRATION. 100% REAL PHOTOGRAPH.' 
  },
  { 
    id: 'anime', 
    label: '애니메이션 (Anime)', 
    icon: <Sparkles size={18} />, 
    prompt: 'Premium modern Japanese anime style, Makoto Shinkai and CoMix Wave inspired, clean cel-shading, vibrant atmospheric lighting, high-fidelity background details.' 
  },
  { 
    id: '3d_cartoon', 
    label: '3D 툰 (Pixar)', 
    icon: <Ghost size={18} />, 
    prompt: 'High-end 3D movie animation style, Pixar/Disney aesthetic, subsurface scattering on skin, soft studio lighting, Octane Render quality, expressive character shapes.' 
  },
  { 
    id: 'cyberpunk', 
    label: '사이버펑크 (Neon)', 
    icon: <Wand2 size={18} />, 
    prompt: 'Cyberpunk 2077 cinematic aesthetic, volumetric neon lighting, rainy futuristic city, high contrast purple and cyan palette, film grain, sci-fi atmosphere.' 
  },
  { 
    id: 'oil_painting', 
    label: '유화 (Oil Paint)', 
    icon: <Brush size={18} />, 
    prompt: 'Classic thick oil painting on textured canvas, heavy impasto strokes, rich pigment textures, dramatic chiaroscuro lighting, museum fine art quality.' 
  },
  { 
    id: 'sketch', 
    label: '스케치 (Sketch)', 
    icon: <PenTool size={18} />, 
    prompt: 'Artistic charcoal and graphite pencil drawing, textured paper, realistic sketching technique, masterfully shaded, monochrome graphite aesthetic.' 
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
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) await window.aistudio.openSelectKey();
      }
    };
    checkKey();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setError(null);
    const styleObj = VISUAL_STYLES.find(s => s.id === selectedStyle) || VISUAL_STYLES[0];
    
    try {
      // 1. Script Generation with Character Consistency logic
      setState(AppState.GENERATING_SCRIPT);
      const scriptData = await gemini.generateScript(topic, styleObj.prompt);
      setAssets(prev => ({ ...prev, script: scriptData }));
      
      const sceneCount = 5; 
      const imageUrls: string[] = [];
      setProgress({ current: 0, total: sceneCount });

      // 2. Image Generation (5 Scenes) - Character descriptions are now embedded in each scene prompt
      setState(AppState.GENERATING_IMAGE);
      for (let i = 0; i < sceneCount; i++) {
        setProgress({ current: i + 1, total: sceneCount });
        const base64Img = await gemini.generateSceneImage(scriptData.globalStyle, scriptData.scenes[i].visualPrompt);
        imageUrls.push(`data:image/png;base64,${base64Img}`);
        setAssets(prev => ({ ...prev, videoUrls: [...imageUrls] }));
      }

      // 3. Narration Generation
      setState(AppState.GENERATING_AUDIO);
      const audioBuffer = await gemini.generateNarrationAudio(scriptData.scenes.map(s => s.narration).join(' '));
      
      setAssets(prev => ({ ...prev, videoUrls: imageUrls, audioBuffer }));
      setState(AppState.COMPLETED);
    } catch (err: any) {
      setError(err.message || "생성 중 오류가 발생했습니다.");
      setState(AppState.ERROR);
    }
  }, [topic, selectedStyle]);

  const resetApp = () => {
    setState(AppState.IDLE);
    setTopic('');
    setAssets({ script: null, videoUrls: [], audioBuffer: null });
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 font-sans">
      <div className="text-center mb-16 space-y-4 animate-fade-in">
        <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/10 border border-white/20 shadow-xl mb-4">
          <Waves className="w-10 h-10 text-cyan-400 animate-pulse" />
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-cyan-500 uppercase">
          AutoShorts AI
        </h1>
        <p className="text-cyan-100/60 text-lg md:text-xl max-w-lg mx-auto word-keep-all leading-relaxed">
          인물과 배경의 일관성을 유지하는 <b>하이브리드 엔진</b>이 탑재되었습니다.<br/>
          5개의 장면으로 끊김 없는 이야기를 완성하세요.
        </p>
      </div>

      <div className="w-full max-w-5xl flex flex-col items-center">
        {state !== AppState.IDLE && state !== AppState.ERROR && (
           <StepIndicator steps={[
             { title: '스토리 기획', icon: <FileText size={18}/>, isActive: state === AppState.GENERATING_SCRIPT, isCompleted: state !== AppState.GENERATING_SCRIPT },
             { title: '이미지 렌더링', icon: <ImageIcon size={18}/>, isActive: state === AppState.GENERATING_IMAGE, isCompleted: ![AppState.GENERATING_SCRIPT, AppState.GENERATING_IMAGE].includes(state) },
             { title: '나레이션', icon: <Mic size={18}/>, isActive: state === AppState.GENERATING_AUDIO, isCompleted: state === AppState.COMPLETED },
           ]} />
        )}

        {state === AppState.IDLE && (
          <div className="w-full max-w-2xl animate-fade-in-up space-y-12">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
              <div className="relative bg-white/10 border border-white/20 rounded-2xl p-1.5 flex items-center shadow-2xl backdrop-blur-md">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="무엇에 대한 영상을 만들까요? (예: 파리의 아침을 걷는 소녀)"
                  className="flex-1 bg-transparent border-none text-white px-6 py-4 focus:ring-0 placeholder-cyan-200/40 text-lg outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
                <button
                  onClick={handleGenerate}
                  disabled={!topic.trim()}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-30"
                >
                  제작 시작
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {VISUAL_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-5 rounded-2xl border transition-all text-left space-y-3 backdrop-blur-sm ${selectedStyle === style.id ? 'bg-white/20 border-cyan-400 ring-2 ring-cyan-400/50 shadow-lg' : 'bg-white/5 border-white/10 text-cyan-200/50 hover:bg-white/10'}`}
                  >
                    <div className={`p-3 rounded-xl inline-flex ${selectedStyle === style.id ? 'bg-cyan-500 text-white' : 'bg-white/10'}`}>{style.icon}</div>
                    <div className="font-bold">{style.label}</div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {(state !== AppState.IDLE && state !== AppState.COMPLETED && state !== AppState.ERROR) && (
            <div className="mt-20 text-center space-y-8 animate-pulse">
                <div className="w-24 h-24 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto"></div>
                <div className="space-y-4">
                    <div className="text-3xl font-light text-white uppercase tracking-widest">{state.replace('_', ' ')}...</div>
                    {progress && <div className="text-cyan-400 font-black text-6xl">{progress.current} / {progress.total}</div>}
                    <p className="text-xs text-white/40 mt-4">인물의 일관성을 유지하기 위해 정밀 연산을 수행 중입니다.</p>
                </div>
            </div>
        )}

        {state === AppState.COMPLETED && (
            <Player videoUrls={assets.videoUrls} audioBuffer={assets.audioBuffer} script={assets.script?.scenes.map(s => s.narration).join('\n\n') || ''} onReset={resetApp} />
        )}

        {state === AppState.ERROR && (
            <div className="mt-8 p-10 bg-white/5 border border-red-500/30 rounded-3xl max-w-md w-full text-center shadow-2xl">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">생성 실패</h3>
                <p className="text-cyan-100/60 mb-8 text-sm">{error}</p>
                <button onClick={handleGenerate} className="w-full px-6 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all">다시 시도</button>
            </div>
        )}
      </div>
    </div>
  );
}
