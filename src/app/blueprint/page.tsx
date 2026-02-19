'use client';

import React, { useEffect, useState } from 'react';
import { BlueprintVisualizer } from '@/components/quote/BlueprintVisualizer';
import { APP_CONFIG } from '@/config/constants';
import { Layers } from 'lucide-react';
import { Input } from '@/components/ui/Input';

export default function BlueprintPage() {
  const [dimensions, setDimensions] = useState<any>(null);
  const [bleed, setBleed] = useState<number>(APP_CONFIG.BLUEPRINT.BLEED);
  const [hingeGap, setHingeGap] = useState<number>(APP_CONFIG.BLUEPRINT.HINGE_GAP);
  const [turnIn, setTurnIn] = useState<number>(APP_CONFIG.BLUEPRINT.TURN_IN);

  useEffect(() => {
    // Listen for data from parent window
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'BLUEPRINT_DATA') {
        const data = event.data.dimensions;
        setDimensions(data);
        setBleed(data.bleed);
        setHingeGap(data.hingeGap);
        setTurnIn(data.turnIn);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request data from opener
    if (window.opener) {
      window.opener.postMessage({ type: 'REQUEST_BLUEPRINT_DATA' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!dimensions) {
    return (
      <div className="h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading blueprint data...</p>
        </div>
      </div>
    );
  }

  const updatedDimensions = {
    ...dimensions,
    bleed,
    hingeGap,
    turnIn
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5cm;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-full {
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 1cm !important;
            background: white !important;
          }
          
          .print-full * {
            background: white !important;
          }
        }
      `}</style>

      <div className="h-screen bg-background text-foreground flex overflow-hidden">
        {/* Left Sidebar - Controls */}
        <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 p-4 flex flex-col gap-4 overflow-y-auto no-print">
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">Blueprint Settings</h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Bleed (mm)</label>
                <Input
                  type="number"
                  value={bleed}
                  onChange={(e) => setBleed(Number(e.target.value))}
                  step="0.5"
                  min="0"
                  className="h-8"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Hinge Gap (mm)</label>
                <Input
                  type="number"
                  value={hingeGap}
                  onChange={(e) => setHingeGap(Number(e.target.value))}
                  step="0.5"
                  min="0"
                  className="h-8"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Turn-in (mm)</label>
                <Input
                  type="number"
                  value={turnIn}
                  onChange={(e) => setTurnIn(Number(e.target.value))}
                  step="0.5"
                  min="0"
                  className="h-8"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 mb-2">Book Dimensions</h3>
            <div className="space-y-1 text-xs text-zinc-500">
              <div className="flex justify-between">
                <span>Width:</span>
                <span className="font-mono text-zinc-300">{dimensions.boardWidth}mm</span>
              </div>
              <div className="flex justify-between">
                <span>Height:</span>
                <span className="font-mono text-zinc-300">{dimensions.boardHeight}mm</span>
              </div>
              <div className="flex justify-between">
                <span>Spine:</span>
                <span className="font-mono text-zinc-300">{dimensions.spineWidth.toFixed(1)}mm</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="mt-auto text-xs text-zinc-400 hover:text-white transition-colors px-3 py-2 border border-zinc-700 rounded hover:border-zinc-600"
          >
            Print / Save PDF
          </button>
        </aside>

        {/* Main Content - Blueprint */}
        <main className="flex-1 overflow-hidden print-full">
          <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md no-print">
            <div className="px-4 h-14 flex items-center">
              <div className="flex items-center gap-3">
                <div className="bg-primary p-1 rounded text-zinc-900">
                  <Layers size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="font-bold text-lg tracking-tight text-white leading-none">
                    Blueprint<span className="text-primary font-mono">Preview</span>
                  </h1>
                </div>
              </div>
            </div>
          </header>

          <div className="h-[calc(100vh-3.5rem)] p-6">
            <BlueprintVisualizer dimensions={updatedDimensions} />
          </div>
        </main>
      </div>
    </>
  );
}
