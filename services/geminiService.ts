
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptData, Scene } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env 파일에 GEMINI_API_KEY를 설정해주세요.');
  }
  return new GoogleGenAI({ apiKey });
};

// 1. Generate Script (Storyboard with 5 scenes and AUTHORITATIVE character consistency)
export const generateScript = async (topic: string, stylePreference: string): Promise<ScriptData> => {
  const ai = getAI();
  
  const prompt = `Create a high-quality 35-second YouTube Short storyboard about: "${topic}".
  
  CRITICAL INSTRUCTION FOR CHARACTER CONSISTENCY:
  1. Define a "Visual Identity Anchor" for the protagonist. This MUST include: 
     - Specific Ethnicity (e.g., "Korean", "African", "Hispanic", etc.)
     - Specific Age, hair color/style, facial features, and a fixed outfit.
  2. Define a "Setting Anchor" (e.g., "A modern neon-lit cafe in Tokyo" or "A sunlit Mediterranean balcony").
  3. Every single "visualPrompt" in the JSON output MUST start with this exact identity anchor and setting anchor. 
  4. DO NOT use pronouns like "she" or "the man" alone; repeat the physical descriptors in every scene.
  
  SCENE COUNT: Exactly 5 scenes.
  
  STYLE ENFORCEMENT: The user selected: "${stylePreference}".
  - The "globalStyle" field should be technical English description (camera, lighting, film type).
  - If "Realistic" is chosen, focus on: "photorealistic, raw photo, fujifilm, 8k, natural skin texture, no smoothing".
  
  Output JSON format:
  {
    "title": "Korean Title",
    "globalStyle": "Technical visual style guide in English.",
    "scenes": [
      { 
        "visualPrompt": "MANDATORY STRUCTURE: [Full Character Description] + [Full Setting Description] + [Specific Action of this scene]. (English)",
        "narration": "Korean narration (해요체)."
      }
    ]
  }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview", // Use Pro for superior reasoning on cross-scene consistency
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

  try {
    const data = JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
    // Verification: ensure we have exactly 5 scenes
    data.scenes = data.scenes.slice(0, 5);
    return data as ScriptData;
  } catch (e) {
    throw new Error("스크립트 일관성 생성 엔진에 오류가 발생했습니다. 다시 시도해주세요.");
  }
};

// 2. Generate Image with Style & Anchored Content
export const generateSceneImage = async (stylePrompt: string, scenePrompt: string): Promise<string> => {
  const ai = getAI();
  
  // Construct a prompt that places style first, then the anchored character/setting/action
  const fullPrompt = `[VISUAL STYLE: ${stylePrompt}]. [SCENE CONTENT: ${scenePrompt}]. 
  Aspect Ratio 9:16. Cinematic lighting, ultra-high resolution, masterpiece quality.
  STRICT ADHERENCE: If the style is REALISTIC, you MUST produce a PHOTOGRAPH. No illustration, no painting, no 3D render look. 
  Consistency check: Ensure the face and environment perfectly match the provided description.`;
  
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
  throw new Error("이미지 생성 단계에서 오류가 발생했습니다.");
};

// 3. Generate Audio Narration
export const generateNarrationAudio = async (text: string): Promise<AudioBuffer> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { 
          voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: 'Kore' } 
          } 
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("오디오 생성 실패");
  
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  buffer.getChannelData(0).set(Array.from(dataInt16).map(v => v / 32768.0));
  return buffer;
};
