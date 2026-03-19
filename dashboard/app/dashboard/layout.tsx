'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!mounted) return null;

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-[#0F172A] overflow-hidden relative selection:bg-indigo-500/30 selection:text-indigo-200">
        {/* Background Gradients & Noise */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[70%] rounded-full bg-indigo-900/20 blur-[120px] mix-blend-screen animate-blob" />
          <div className="absolute top-[20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/20 blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />
          <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px] mix-blend-screen animate-blob animation-delay-4000" />
          <div className="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay" /> 
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex w-full h-screen">
          <Sidebar />
          
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent p-4 lg:p-8">
              <div className="w-full min-w-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
