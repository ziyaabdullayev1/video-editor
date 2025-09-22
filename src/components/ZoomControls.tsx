'use client';

import { useEffect, useState } from 'react';

interface ZoomControlsProps {
  viewStart: number;
  viewEnd: number;
  selEffStart: number;
  selEffEnd: number;
  effDuration: number;
  effSpan: number;
  onZoomFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomSelection: () => void;
  onZoomToTimeSpan: (seconds: number) => void;
}

const ZoomControls = ({
  viewStart,
  viewEnd,
  selEffStart,
  selEffEnd,
  effDuration,
  effSpan,
  onZoomFit,
  onZoomIn,
  onZoomOut,
  onZoomSelection,
  onZoomToTimeSpan,
}: ZoomControlsProps) => {
  const [activePreset, setActivePreset] = useState<number | null>(null);

  // Calculate zoom label
  const getZoomLabel = () => {
    const innerW = 800; // Approximate timeline width
    const z = (innerW / effSpan) / (innerW / Math.max(effDuration, 1e-6));
    const span = effSpan;
    const msIndicator = span <= 10 ? ' 🕐ms' : '';
    return (z < 1 ? (1 / z).toFixed(2) + '× out' : z.toFixed(2) + '× in') + msIndicator;
  };

  // Update active preset
  useEffect(() => {
    const currentSpan = effSpan;
    const presets = [30, 10, 5, 1, 0.5];
    const active = presets.find(preset => Math.abs(currentSpan - preset) < 0.5);
    setActivePreset(active || null);
  }, [effSpan]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return; // Don't interfere with inputs

      switch (e.key.toLowerCase()) {
        case 'f':
          e.preventDefault();
          onZoomFit();
          break;
        case 'z':
          e.preventDefault();
          onZoomSelection();
          break;
        case '+':
        case '=':
          e.preventDefault();
          onZoomIn();
          break;
        case '-':
          e.preventDefault();
          onZoomOut();
          break;
        case '1':
          if (e.ctrlKey) {
            e.preventDefault();
            onZoomToTimeSpan(1);
          }
          break;
        case '5':
          if (e.ctrlKey) {
            e.preventDefault();
            onZoomToTimeSpan(5);
          }
          break;
        case '0':
          if (e.ctrlKey) {
            e.preventDefault();
            onZoomToTimeSpan(10);
          }
          break;
        case '3':
          if (e.ctrlKey) {
            e.preventDefault();
            onZoomToTimeSpan(30);
          }
          break;
        case '.':
          e.preventDefault();
          onZoomToTimeSpan(0.5); // 500ms view
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onZoomFit, onZoomSelection, onZoomIn, onZoomOut, onZoomToTimeSpan]);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button onClick={onZoomFit} className="btn" title="Fit All (F)">
        📐 Fit
      </button>
      <button onClick={onZoomOut} className="btn" title="Zoom Out (-)">
        🔍−
      </button>
      <span className="pill">
        Zoom: <span>{getZoomLabel()}</span>
      </span>
      <button onClick={onZoomIn} className="btn" title="Zoom In (+)">
        🔍+
      </button>
      <button onClick={onZoomSelection} className="btn btn-ok" title="Zoom to Selection (Z)">
        🎯 Seçim
      </button>
      
      <div className="flex gap-1">
        {[
          { seconds: 30, label: '30s', title: '30s görünüm' },
          { seconds: 10, label: '10s', title: '10s görünüm (ms göster)' },
          { seconds: 5, label: '5s', title: '5s görünüm (ms göster)' },
          { seconds: 1, label: '1s', title: '1s görünüm (ms göster)' },
          { seconds: 0.5, label: '500ms', title: '500ms görünüm (hassas)' },
        ].map(({ seconds, label, title }) => (
          <button
            key={seconds}
            className={`btn zoom-preset ${activePreset === seconds ? 'active' : ''}`}
            title={title}
            onClick={() => onZoomToTimeSpan(seconds)}
          >
            {label}
          </button>
        ))}
      </div>
      
      <span className="text-xs text-[#cdd6e5] opacity-80 max-w-md">
        Ctrl+Wheel=Zoom • Z=Seçime zoom • F=Tümü • +/-=Zoom • .=500ms • Double-click=Zoom noktası • 10s≤ = milisaniye gösterir
      </span>
    </div>
  );
};

export default ZoomControls;

