import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { StepProps } from '../types';

interface Props {
  steps: StepProps[];
}

export const StepIndicator: React.FC<Props> = ({ steps }) => {
  return (
    <div className="flex w-full justify-between items-center mb-16 px-6 max-w-3xl mx-auto">
      {steps.map((step, idx) => (
        <div key={idx} className="flex flex-col items-center relative z-10 group">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 backdrop-blur-xl ${
              step.isCompleted
                ? 'bg-cyan-500 border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                : step.isActive
                ? 'bg-white/20 border-cyan-400 text-white shadow-[0_0_25px_rgba(34,211,238,0.6)] animate-pulse'
                : 'bg-white/5 border-white/10 text-cyan-200/30'
            }`}
          >
            {step.isCompleted ? (
              <CheckCircle2 size={24} />
            ) : step.isActive ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <Circle size={24} />
            )}
          </div>
          <span
            className={`absolute -bottom-8 text-xs font-bold tracking-wider uppercase whitespace-nowrap transition-colors duration-500 ${
              step.isActive || step.isCompleted ? 'text-cyan-300' : 'text-cyan-100/20'
            }`}
          >
            {step.title}
          </span>
          {/* Connector Line */}
          {idx < steps.length - 1 && (
            <div
              className={`absolute top-6 left-full w-[calc(100vw/6)] max-w-[100px] h-[3px] -translate-y-1/2 -z-10 transition-all duration-1000 ${
                step.isCompleted ? 'bg-gradient-to-r from-cyan-400 to-cyan-500' : 'bg-white/5'
              }`}
            >
                {step.isCompleted && (
                    <div className="absolute inset-0 bg-cyan-300 blur-sm"></div>
                )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};