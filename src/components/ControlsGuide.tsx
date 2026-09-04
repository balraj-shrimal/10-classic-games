import React from 'react';
import { GameInfo } from '../types';
import { Monitor, Smartphone } from 'lucide-react';

interface ControlsGuideProps {
  game: GameInfo;
}

export const ControlsGuide: React.FC<ControlsGuideProps> = ({ game }) => {
  return (
    <div className="w-full max-w-md mx-auto mt-4 p-4 rounded-2xl bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-slate-800">
      <div className="flex items-center justify-between mb-3 border-b-2 border-slate-200 pb-2">
        <h4 className="font-black text-xs uppercase tracking-wider text-black flex items-center gap-2">
          <span>🎮 HOW TO PLAY</span>
        </h4>
        <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-black text-yellow-400">
          {game.category}
        </span>
      </div>

      <div className="space-y-2.5 text-xs font-semibold">
        <div className="flex items-start gap-2.5 bg-slate-50 p-2 rounded-xl border-2 border-black/10">
          <div className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-black">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <span className="text-black font-black uppercase text-[10px] block">Desktop Keyboard / Mouse</span>
            <span className="text-slate-700 font-medium">{game.controlsInfo.desktop}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 bg-slate-50 p-2 rounded-xl border-2 border-black/10">
          <div className="w-7 h-7 rounded-lg bg-pink-500 text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-black">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <span className="text-black font-black uppercase text-[10px] block">Mobile Touch / Swipe</span>
            <span className="text-slate-700 font-medium">{game.controlsInfo.mobile}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
