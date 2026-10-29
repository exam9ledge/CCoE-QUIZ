import React from 'react';
import { Award, Laptop, Users, ShieldCheck, Maximize2, Minimize2 } from 'lucide-react';

interface HeaderProps {
  currentView: 'student' | 'host' | 'admin';
  onNavigate: (view: 'student' | 'host' | 'admin') => void;
  quizCode?: string;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, quizCode }) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <header className="border-b border-indigo-900/60 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 backdrop-blur sticky top-0 z-40 px-4 py-3 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Canara Bank Branding */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('student')}>
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-amber-500/20 ring-2 ring-amber-300/40">
            CB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-lg sm:text-xl text-white tracking-wide flex items-center gap-1.5">
                Canara COE <span className="text-amber-400">Knowledge Challenge</span>
              </span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30">
                <Award className="w-3 h-3" /> Canara Centre of Excellence
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 font-medium">
              By Punit Dhull | Senior Manager, Canara Centre of Excellence
            </p>
          </div>
        </div>

        {/* View Switchers & Projector Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('student')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              currentView === 'student'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 ring-1 ring-amber-300'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Trainee Portal</span>
          </button>

          <button
            onClick={() => onNavigate('host')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              currentView === 'host'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Host & Projector</span>
            {quizCode && (
              <span className="bg-indigo-950 px-1.5 py-0.5 rounded text-[11px] font-mono text-amber-300 font-bold ml-1">
                {quizCode}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              currentView === 'admin'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Library</span>
          </button>

          <button
            onClick={toggleFullscreen}
            title="Toggle Classroom Fullscreen"
            className="p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
