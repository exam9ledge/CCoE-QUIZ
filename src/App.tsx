import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StudentView } from './components/StudentView';
import { HostDashboard } from './components/HostDashboard';
import { AdminQuizzes } from './components/AdminQuizzes';
import { storage } from './lib/api';

export default function App() {
  const [currentView, setCurrentView] = useState<'student' | 'host' | 'admin'>('student');
  const [activeQuizCode, setActiveQuizCode] = useState<string>('726849');
  const [adminToken, setAdminToken] = useState<string | null>(storage.get('coe_admin_token', null));

  // Inspect URL parameters on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    const urlCode = params.get('code');
    if (urlCode && /^\d{6}$/.test(urlCode)) {
      setActiveQuizCode(urlCode);
    }

    if (params.has('host') || hash === '#host') {
      setCurrentView('host');
    } else if (params.has('admin') || hash === '#admin') {
      setCurrentView('admin');
    }
  }, []);

  const handlePresentQuiz = (code: string) => {
    setActiveQuizCode(code);
    setCurrentView('host');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-900">
      {/* Brand Header */}
      <Header
        currentView={currentView}
        onNavigate={setCurrentView}
        quizCode={activeQuizCode}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {currentView === 'student' && (
          <StudentView initialCode={activeQuizCode} />
        )}

        {currentView === 'host' && (
          <HostDashboard
            code={activeQuizCode}
            token={adminToken || undefined}
            onOpenLibrary={() => setCurrentView('admin')}
            onEditQuiz={(code) => {
              setActiveQuizCode(code);
              setCurrentView('admin');
            }}
          />
        )}

        {currentView === 'admin' && (
          <AdminQuizzes
            onPresentQuiz={handlePresentQuiz}
            adminToken={adminToken}
            onTokenChange={setAdminToken}
          />
        )}
      </main>

      {/* Corporate Banking Training Footer */}
      <footer className="border-t border-indigo-950 bg-slate-950/80 text-center py-4 px-4 text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <b>Canara Centre of Excellence</b> · Training & Development Division
          </div>
          <div className="text-slate-400">
            Knowledge Challenge Platform · Created by <span className="text-amber-400 font-bold">Punit Dhull</span>, Senior Manager
          </div>
          <div className="text-[11px] text-slate-600">
            Secure Server-Side Scoring & Isolated Sessions · v2.0
          </div>
        </div>
      </footer>
    </div>
  );
}
