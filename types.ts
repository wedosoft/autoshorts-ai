
import { ReactNode } from 'react';

export enum AppState {
  IDLE = 'IDLE',
  GENERATING_SCRIPT = 'GENERATING_SCRIPT',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
  GENERATING_VIDEO = 'GENERATING_VIDEO',
  GENERATING_AUDIO = 'GENERATING_AUDIO',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface Scene {
  visualPrompt: string;
  narration: string;
}

export interface ScriptData {
  title: string;
  globalStyle: string;
  scenes: Scene[];
}

export interface GeneratedAssets {
  script: ScriptData | null;
  imageUrls: string[];
  videoUrls: string[];
  audioBuffer: AudioBuffer | null;
}

export interface StepProps {
  isActive: boolean;
  isCompleted: boolean;
  title: string;
  icon: ReactNode;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
