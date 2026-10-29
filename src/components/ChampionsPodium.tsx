import React, { useEffect } from 'react';
import { Trophy, RefreshCw, X } from 'lucide-react';
import { sound } from '../lib/audio';
import { triggerConfetti } from '../lib/api';

interface Champion {
  name: string;
  score: number;
  correct: number;
}

interface ChampionsPodiumProps {
  top3: Champion[];
  onClose: () => void;
}

export const ChampionsPodium: React.FC<ChampionsPodiumProps> = ({ top3, onClose }) => {
  useEffect(() => {
    sound.playApplause(6);
    triggerConfetti(5000);
    const timer = setTimeout(() => triggerConfetti(3500), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleClapAgain = () => {
    sound.playApplause(5);
    triggerConfetti(4000);
  };

  const renderCartoon = (shirtColor: string, skinColor: string, hairColor: string, place: number) => {
    return (
      <svg viewBox="0 0 120 170" className={`w-32 sm:w-40 h-44 sm:h-52 mx-auto -mb-2 toon ${place === 1 ? 'toon-1' : ''}`}>
        <g className="toon-arm-l">
          <path d="M38 78 L14 40" stroke={skinColor} strokeWidth="11" strokeLinecap="round" />
          <circle cx="13" cy="37" r="8" fill={skinColor} />
        </g>
        <g className="toon-arm-r">
          <path d="M82 78 L106 40" stroke={skinColor} strokeWidth="11" strokeLinecap="round" />
          <circle cx="107" cy="37" r="8" fill={skinColor} />
        </g>
        <rect x="44" y="132" width="13" height="34" rx="6" fill="#1e3a8a" />
        <rect x="63" y="132" width="13" height="34" rx="6" fill="#1e3a8a" />
        <ellipse cx="50" cy="166" rx="11" ry="5" fill="#111827" />
        <ellipse cx="70" cy="166" rx="11" ry="5" fill="#111827" />
        <rect x="34" y="70" width="52" height="68" rx="20" fill={shirtColor} />
        <circle
          cx="60"
          cy="100"
          r="11"
          fill={place === 1 ? "#fbbf24" : place === 2 ? "#d1d5db" : "#f59e0b"}
          stroke="#fff"
          strokeWidth="3"
        />
        <text x="60" y="105" textAnchor="middle" fontSize="13" fontWeight="800" fill="#3b2500">
          {place}
        </text>
        <path d="M52 70 L60 90 L68 70" fill="#ef4444" />
        <circle cx="60" cy="44" r="27" fill={skinColor} />
        <path d="M33 40 Q36 14 60 15 Q86 15 88 40 Q76 28 60 30 Q44 28 33 40Z" fill={hairColor} />
        <circle cx="50" cy="45" r="4" fill="#111827" />
        <circle cx="70" cy="45" r="4" fill="#111827" />
        <circle cx="51.5" cy="43.5" r="1.4" fill="#fff" />
        <circle cx="71.5" cy="43.5" r="1.4" fill="#fff" />
        <circle cx="43" cy="55" r="5" fill="#fca5a5" opacity="0.7" />
        <circle cx="77" cy="55" r="5" fill="#fca5a5" opacity="0.7" />
        <path d="M48 56 Q60 70 72 56 Z" fill="#7f1d1d" />
        {place === 1 && (
          <path d="M42 18 L48 4 L56 14 L60 2 L64 14 L72 4 L78 18 Z" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
        )}
      </svg>
    );
  };

  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl flex flex-col items-center animate-rise">
        <div className="flex items-center gap-3 text-amber-400 mb-2">
          <Trophy className="w-10 h-10 animate-bounce" />
          <h2 className="text-3xl sm:text-5xl font-heading font-black tracking-wider text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
            CANARA COE CHAMPIONS
          </h2>
          <Trophy className="w-10 h-10 animate-bounce" />
        </div>
        <p className="text-indigo-200 text-sm sm:text-base font-semibold mb-8 text-center">
          Canara Centre of Excellence – Training Excellence & Honor Roll
        </p>

        {/* Podium Pillars */}
        <div className="flex items-end justify-center gap-3 sm:gap-6 w-full max-w-3xl px-2">
          {/* 2nd Place */}
          <div className="flex-1 flex flex-col items-center">
            {second ? (
              <>
                <div className="text-center mb-2">
                  <div className="font-heading font-bold text-base sm:text-xl text-slate-200 truncate max-w-[140px] sm:max-w-[200px]">
                    {second.name}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-400">
                    {second.score.toLocaleString('en-IN')} pts · {second.correct} correct
                  </div>
                </div>
                {renderCartoon('#0ea5e9', '#e0ac69', '#111827', 2)}
                <div className="w-full h-36 sm:h-44 rounded-t-2xl bg-gradient-to-t from-slate-400 to-slate-200 text-slate-900 flex items-center justify-center font-heading font-black text-4xl sm:text-5xl shadow-2xl shadow-slate-500/30 ring-2 ring-slate-100/50">
                  2
                </div>
              </>
            ) : (
              <div className="w-full h-36 bg-slate-800/40 rounded-t-2xl" />
            )}
          </div>

          {/* 1st Place */}
          <div className="flex-1 flex flex-col items-center -mt-8">
            {first ? (
              <>
                <div className="text-center mb-2">
                  <div className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black inline-block uppercase tracking-wider mb-1">
                    Winner 🥇
                  </div>
                  <div className="font-heading font-black text-lg sm:text-2xl text-amber-300 truncate max-w-[160px] sm:max-w-[240px]">
                    {first.name}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-amber-200">
                    {first.score.toLocaleString('en-IN')} pts · {first.correct} correct
                  </div>
                </div>
                {renderCartoon('#7c3aed', '#f1c27d', '#3b2412', 1)}
                <div className="w-full h-48 sm:h-60 rounded-t-2xl bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center font-heading font-black text-5xl sm:text-7xl shadow-2xl shadow-amber-500/40 ring-4 ring-amber-300">
                  1
                </div>
              </>
            ) : (
              <div className="w-full h-48 bg-slate-800/40 rounded-t-2xl" />
            )}
          </div>

          {/* 3rd Place */}
          <div className="flex-1 flex flex-col items-center">
            {third ? (
              <>
                <div className="text-center mb-2">
                  <div className="font-heading font-bold text-base sm:text-xl text-amber-100 truncate max-w-[140px] sm:max-w-[200px]">
                    {third.name}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-amber-200/80">
                    {third.score.toLocaleString('en-IN')} pts · {third.correct} correct
                  </div>
                </div>
                {renderCartoon('#ec4899', '#c68642', '#4a2c0a', 3)}
                <div className="w-full h-28 sm:h-32 rounded-t-2xl bg-gradient-to-t from-orange-600 to-amber-500 text-white flex items-center justify-center font-heading font-black text-3xl sm:text-4xl shadow-2xl shadow-orange-500/20 ring-2 ring-orange-400/50">
                  3
                </div>
              </>
            ) : (
              <div className="w-full h-28 bg-slate-800/40 rounded-t-2xl" />
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={handleClapAgain}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-heading font-bold text-base bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 transition-transform active:scale-95"
          >
            <RefreshCw className="w-5 h-5" />
            Applause & Fanfare Again
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-heading font-bold text-base bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
            Close Podium
          </button>
        </div>
      </div>
    </div>
  );
};
