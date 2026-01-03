import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptData, Scene } from "../types";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateScript = async (topic: string, stylePreference: string): Promise<ScriptData> => {
  const ai = getAI();
  
  const prompt = `Create a high-quality YouTube Short storyboard about: "${topic}".
  CRITICAL: Provide exactly 5 scenes.
  STYLE ENFORCEMENT: The user has selected: "${stylePreference}".
  You MUST describe the "globalStyle" in English such that an image generator STRICTLY follows it.
  If "Realistic" is chosen, focus on "photographic realism", "natural textures", "no artistic bias".
  If "Anime" is chosen, focus on "high-end cel shading", "modern Japanese animation".
  
  Output JSON format:
  {
    "title": "Korean Title",
    "globalStyle": "EXTREMELY technical description of the visual style. (English)",
    "scenes": [
      { 
        "visualPrompt": "Scene description focusing on action/composition. (English)",
        "narration": "Korean narration (해요체)."
      }
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

  const data = JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
  data.scenes = data.scenes.slice(0, 5);
  return data as ScriptData;
};

export const generateSceneImage = async (stylePrompt: string, scenePrompt: string): Promise<string> => {
  const ai = getAI();
  // Style prompt is prefixed and wrapped in [CORE STYLE] to give it maximum weight
  const fullPrompt = `[CORE STYLE: ${stylePrompt}]. [SCENE: ${scenePrompt}]. 
  Vertical 9:16. Hyper-detailed, masterpiece quality. 
  STRICT ADHERENCE TO STYLE IS MANDATORY. DO NOT USE ILLUSTRATION IF STYLE IS PHOTOREALISTIC.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: fullPrompt }] },
    config: { imageConfig: { aspectRatio: "9:16" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return part.inlineData.data;
  }
  throw new Error("이미지 생성 실패");
};

export const generateVeoVideo = async (imageBase64: string, prompt: string): Promise<string | null> => {
  const aiWithKey = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    let operation = await aiWithKey.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Cinematic subtle movement, slow motion. ${prompt}`,
      image: { imageBytes: imageBase64, mimeType: 'image/png' },
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' }
    });
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await aiWithKey.operations.getVideosOperation({ operation: operation });
    }
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) return null;
    const videoRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    return URL.createObjectURL(await videoRes.blob());
  } catch (error) { return null; }
};

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
  const binaryString = atob(base64Audio!);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  buffer.getChannelData(0).set(Array.from(dataInt16).map(v => v / 32768.0));
  return buffer;
};
