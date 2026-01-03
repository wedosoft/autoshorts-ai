
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptData, Scene } from "../types";

// Helper to get a fresh AI instance with the current key
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// 1. Generate Script (Storyboard with exactly 5 scenes)
export const generateScript = async (topic: string, stylePreference: string): Promise<ScriptData> => {
  const ai = getAI();
  
  const prompt = `Create a 40-second high-quality YouTube Short storyboard about: "${topic}".
  CRITICAL: You MUST provide exactly 5 distinct scenes. Not 3, not 4. Exactly 5.
  The story must be consistent, featuring the same main character or setting across all 5 scenes.
  
  STYLE ENFORCEMENT: 
  The user has selected the following style: "${stylePreference}".
  You MUST describe the "globalStyle" in English so that an image generator can STRICTLY follow it.
  If the style is "Realistic/Photographic", emphasize camera settings (35mm, f/1.8), real human skin textures, and natural lighting. 
  DO NOT allow any artistic, illustrative, or painterly descriptions if "Realistic" is chosen.
  
  Output JSON format:
  {
    "title": "Korean Title",
    "globalStyle": "Detailed, technical description of the art style. Be extremely specific about textures, lighting, and medium. (English)",
    "scenes": [
      { 
        "visualPrompt": "Detailed visual description for scene 1. Focus on action and composition. (English).",
        "narration": "Korean narration (해요체)."
      },
      ... repeat for exactly 5 scenes ...
    ]
  }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          globalStyle: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            minItems: 5,
            maxItems: 5,
            items: {
              type: Type.OBJECT,
              properties: {
                visualPrompt: { type: Type.STRING },
                narration: { type: Type.STRING },
              },
              required: ["visualPrompt", "narration"],
            },
          },
        },
        required: ["title", "globalStyle", "scenes"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("스크립트 생성에 실패했습니다.");

  try {
    const data = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    data.scenes = data.scenes.slice(0, 5);
    return data as ScriptData;
  } catch (e) {
    throw new Error("스크립트 형식이 올바르지 않습니다.");
  }
};

// 2. Generate Image for a Scene (Returns base64)
export const generateSceneImage = async (stylePrompt: string, scenePrompt: string): Promise<string> => {
  const ai = getAI();
  // We place the style prompt first and use authoritative language to override model defaults
  const fullPrompt = `[CORE STYLE: ${stylePrompt}]. [SCENE: ${scenePrompt}]. 
  Vertical 9:16 aspect ratio. High fidelity, masterpiece. 
  STRICT ADHERENCE TO CORE STYLE IS MANDATORY. NO DEVIATION.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: fullPrompt }] },
    config: { 
      imageConfig: { 
        aspectRatio: "9:16"
      } 
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return part.inlineData.data;
  }
  throw new Error("이미지 생성 실패");
};

// 3. Generate Video (Veo) with Fallback Logic
export const generateVeoVideo = async (imageBase64: string, prompt: string): Promise<string | null> => {
  const aiWithKey = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    let operation = await aiWithKey.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Cinematic subtle movement, high quality rendering. ${prompt}`,
      image: {
        imageBytes: imageBase64,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await aiWithKey.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) return null;

    const videoRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    if (!videoRes.ok) return null;
    
    const blob = await videoRes.blob();
    return URL.createObjectURL(blob);

  } catch (error: any) {
    console.warn("Veo generation failed, falling back to static image.", error);
    return null;
  }
};

// 4. Generate Narration (TTS)
export const generateNarrationAudio = async (text: string): Promise<AudioBuffer> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("오디오 생성 실패");

  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  return await decodePCM(bytes, audioContext);
};

async function decodePCM(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
}
