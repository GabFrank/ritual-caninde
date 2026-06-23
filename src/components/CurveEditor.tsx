import React, { useRef, useState, useEffect } from 'react';
import { CurvePoint } from '../types';
import { Trash2, PlusCircle, Volume2 } from 'lucide-react';

interface CurveEditorProps {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  height?: number;
}

export default function CurveEditor({ points, onChange, height = 240 }: CurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);

  // Ensure first and last points are always present
  useEffect(() => {
    let updated = [...points];
    let changed = false;

    if (updated.length === 0) {
      updated = [
        { t: 0, energy: 20 },
        { t: 100, energy: 20 }
      ];
      changed = true;
    } else {
      // Sort points by t
      updated.sort((a, b) => a.t - b.t);
      if (updated[0].t !== 0) {
        updated[0].t = 0;
        changed = true;
      }
      if (updated[updated.length - 1].t !== 100) {
        updated[updated.length - 1].t = 100;
        changed = true;
      }
    }

    if (changed) {
      onChange(updated);
    }
  }, [points]);

  const getSVGCoords = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const t = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
    const energy = Math.max(0, Math.min(100, Math.round(100 - (y / rect.height) * 100)));

    return { t, energy };
  };

  const handleMouseDown = (index: number) => {
    setDraggedPointIndex(index);
    setActivePointIndex(index);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (draggedPointIndex === null) return;
    const coords = getSVGCoords(e);
    if (!coords) return;

    const updated = [...points];
    
    // Y (energy) can always be dragged between 0 and 100
    updated[draggedPointIndex].energy = coords.energy;

    // X (t/time) can only drag between neighboring points to preserve ordering (except start and end points)
    if (draggedPointIndex > 0 && draggedPointIndex < points.length - 1) {
      const minT = points[draggedPointIndex - 1].t + 1;
      const maxT = points[draggedPointIndex + 1].t - 1;
      updated[draggedPointIndex].t = Math.max(minT, Math.min(maxT, coords.t));
    }

    onChange(updated);
  };

  const handleMouseUp = () => {
    setDraggedPointIndex(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getSVGCoords(e);
    if (!coords) return;

    // Check that we aren't clicking exactly on an existing point
    const threshold = 3;
    const isClose = points.some(p => Math.abs(p.t - coords.t) < threshold);
    if (isClose) return;

    // Create and insert coordinate
    const newPoint: CurvePoint = { t: coords.t, energy: coords.energy };
    const updated = [...points, newPoint].sort((a, b) => a.t - b.t);
    
    onChange(updated);
    
    // Focus the newly added point
    const newIndex = updated.findIndex(p => p.t === coords.t);
    if (newIndex !== -1) {
      setActivePointIndex(newIndex);
    }
  };

  const handleDeleteActivePoint = () => {
    if (activePointIndex === null) return;
    // Cannot delete origin (0%) or terminus (100%)
    if (activePointIndex === 0 || activePointIndex === points.length - 1) return;

    const updated = points.filter((_, idx) => idx !== activePointIndex);
    onChange(updated);
    setActivePointIndex(null);
  };

  // Build SVG Path strings
  const svgWidth = 1000;
  const svgHeight = 240;

  const getPointsCoordsStr = () => {
    if (points.length === 0) return '';
    return points
      .map(p => {
        const x = (p.t / 100) * svgWidth;
        const y = (1 - p.energy / 100) * svgHeight;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const pointsCoords = points.map(p => ({
    x: (p.t / 100) * svgWidth,
    y: (1 - p.energy / 100) * svgHeight,
    p
  }));

  const pathD = pointsCoords.reduce((acc, coord, idx) => {
    if (idx === 0) return `M ${coord.x} ${coord.y}`;
    
    // Add smooth cubic bezier curve
    const prev = pointsCoords[idx - 1];
    const cp1x = prev.x + (coord.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (coord.x - prev.x) / 2;
    const cp2y = coord.y;
    
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${coord.x} ${coord.y}`;
  }, '');

  // Fill path closing at bottoms (0, svgHeight) then (svgWidth, svgHeight)
  const fillD = pathD ? `${pathD} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z` : '';

  return (
    <div className="space-y-3" id="curve-editor-block">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse-gentle" />
          Haz doble clic para crear un punto. Arrastra para modular la energía.
        </span>
        {activePointIndex !== null && activePointIndex !== 0 && activePointIndex !== points.length - 1 && (
          <button
            type="button"
            onClick={handleDeleteActivePoint}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-950/40 border border-red-900/30 text-red-300 hover:bg-red-900/50 transition-colors cursor-pointer"
            id="delete-curve-point-btn"
          >
            <Trash2 size={13} />
            Eliminar punto seleccionado
          </button>
        )}
      </div>

      <div 
        className="w-full bg-zinc-950 rounded-xl border border-zinc-800 p-2 overflow-hidden relative shadow-inner"
        style={{ height: `${height}px` }}
        id="curve-editor-svg-container"
      >
        {/* Ambient Horizontal Grid lines */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 py-8 opacity-25">
          <div className="w-full border-t border-dashed border-zinc-800 flex justify-between text-[9px] font-mono"><span className="text-violet-400">⚡ Máxima Energía (Éxtasis)</span><span>100%</span></div>
          <div className="w-full border-t border-dashed border-zinc-800 flex justify-between text-[9px] font-mono"><span className="text-zinc-500">🧘‍♀️ Trance / Meditación</span><span>50%</span></div>
          <div className="w-full border-t border-dashed border-zinc-800 flex justify-between text-[9px] font-mono"><span className="text-zinc-600">🐚 Inicio / Silencio Sagrado</span><span>0%</span></div>
        </div>

        {/* SVG Editor */}
        <svg
          ref={svgRef}
          className="w-full h-full cursor-crosshair select-none relative z-10"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          id="curve-editor-svg"
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#09090b" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Area under curve */}
          {fillD && <path d={fillD} fill="url(#areaGrad)" />}

          {/* Golden Line curve */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="4"
              filter="url(#glow)"
              strokeLinecap="round"
            />
          )}

          {/* Dots handles */}
          {pointsCoords.map((coord, idx) => {
            const isActive = activePointIndex === idx;
            const isBound = idx === 0 || idx === points.length - 1;

            return (
              <g key={idx}>
                {/* Visual pulsating halo for active point */}
                {isActive && (
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r="15"
                    fill="#a855f7"
                    className="animate-pulse-gentle opacity-40 pointer-events-none"
                  />
                )}
                {/* Main clickable handle */}
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r={isActive ? "7.5" : "5.5"}
                  fill={isBound ? "#f43f5e" : "#ffffff"}
                  stroke={isActive ? "#d946ef" : "#a855f7"}
                  strokeWidth={isActive ? "3.5" : "2"}
                  className="cursor-pointer transition-all hover:scale-125"
                  onMouseDown={() => handleMouseDown(idx)}
                  onTouchStart={() => handleMouseDown(idx)}
                  id={`curve-handle-${idx}`}
                />
              </g>
            );
          })}
        </svg>

        {/* Footer indicators */}
        <div className="absolute bottom-1 horizontal-gradient left-2 right-2 flex justify-between text-[8px] font-mono text-zinc-500 pointer-events-none">
          <span>0% Tiempo (Ritual Inicio)</span>
          <span>50% Mitad del Altar</span>
          <span>100% Cierre del Viaje</span>
        </div>
      </div>
    </div>
  );
}
