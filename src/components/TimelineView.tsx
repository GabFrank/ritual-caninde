import React, { useState, useEffect } from 'react';
import { RitualTemplate, Track, GeneratedSequence, SequenceElement } from '../types';
import { generateSequence } from '../ritual-core';
import { 
  Play, 
  Pause, 
  SkipForward, 
  RotateCcw, 
  Sliders, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Info, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  Plus,
  Compass,
  Shuffle,
  Volume2
} from 'lucide-react';

interface TimelineViewProps {
  template: RitualTemplate;
  tracks: Track[];
  onBack: () => void;
}

const formatMs = (ms: number): string => {
  const totSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totSec / 3600);
  const mins = Math.floor((totSec % 3600) / 60);
  const secs = totSec % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function TimelineView({ template, tracks, onBack }: TimelineViewProps) {
  const [seed, setSeed] = useState(Math.floor(Math.random() * 9999));
  const [variability, setVariability] = useState(30); // 30%
  const [sequence, setSequence] = useState<GeneratedSequence | null>(null);
  
  // Simulated playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [userVolume, setUserVolume] = useState(80);

  // Manual seed generator
  const triggerGeneration = () => {
    const generated = generateSequence(template, tracks, { seed, variability });
    setSequence(generated);
    setCurrentIndex(0);
    setElapsedMs(0);
    setIsPlaying(false);
  };

  // Generate automatically on template load
  useEffect(() => {
    triggerGeneration();
  }, [template, tracks]);

  // Simulated player timing ticks
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && sequence && sequence.elements.length > 0) {
      interval = setInterval(() => {
        setElapsedMs(prev => {
          const currentElem = sequence.elements[currentIndex];
          if (!currentElem) return prev;
          
          const newElapsed = prev + 1000;
          if (newElapsed >= currentElem.durationMs) {
            // Next item
            if (currentIndex < sequence.elements.length - 1) {
              setCurrentIndex(idx => idx + 1);
              return 0; // reset elapsed
            } else {
              setIsPlaying(false);
              return prev;
            }
          }
          return newElapsed;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, sequence]);

  if (!sequence) return null;

  const currentPlayingElem = sequence.elements[currentIndex];

  // ----------------------------------------------------
  // MANUAL BORRADOR EDIT OPERATORS
  // ----------------------------------------------------
  const handleShiftElement = (index: number, direction: 'up' | 'down') => {
    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= sequence.elements.length) return;

    const list = [...sequence.elements];
    const temp = list[index];
    list[index] = list[nextIdx];
    list[nextIdx] = temp;

    // Recalculate start and end times dynamically for updated list
    let tallyTime = 0;
    const items = list.map(item => {
      const updated = {
        ...item,
        startTimeMs: tallyTime,
        endTimeMs: tallyTime + item.durationMs
      };
      tallyTime += item.durationMs;
      return updated;
    });

    setSequence({
      ...sequence,
      elements: items
    });
  };

  const handleRemoveElement = (index: number) => {
    let items = sequence.elements.filter((_, idx) => idx !== index);
    
    // Smooth timing re-allocation
    let tallyTime = 0;
    items = items.map(item => {
      const updated = {
        ...item,
        startTimeMs: tallyTime,
        endTimeMs: tallyTime + item.durationMs
      };
      tallyTime += item.durationMs;
      return updated;
    });

    setSequence({
      ...sequence,
      elements: items
    });

    if (currentIndex >= items.length) {
      setCurrentIndex(Math.max(0, items.length - 1));
      setElapsedMs(0);
    }
  };

  const handleAddManualSilence = () => {
    const duration = 5 * 60 * 1000; // 5 min default
    const lastElement = sequence.elements[sequence.elements.length - 1];
    const startTimeMs = lastElement ? lastElement.endTimeMs : 0;

    const newSilence: SequenceElement = {
      id: `man-sil-${Date.now()}`,
      type: 'silence',
      name: 'Silencio Añadido',
      durationMs: duration,
      startTimeMs,
      endTimeMs: startTimeMs + duration
    };

    setSequence({
      ...sequence,
      elements: [...sequence.elements, newSilence]
    });
  };

  const handleAddManualTrack = (trackId: string) => {
    const targetTrack = tracks.find(t => t.id === trackId);
    if (!targetTrack) return;

    const lastElement = sequence.elements[sequence.elements.length - 1];
    const startTimeMs = lastElement ? lastElement.endTimeMs : 0;

    const newTrackElem: SequenceElement = {
      id: `man-tr-${Date.now()}`,
      type: 'track',
      trackId: targetTrack.id,
      track: targetTrack,
      provider: targetTrack.source.provider,
      durationMs: targetTrack.durationMs,
      startTimeMs,
      endTimeMs: startTimeMs + targetTrack.durationMs
    };

    setSequence({
      ...sequence,
      elements: [...sequence.elements, newTrackElem]
    });
  };

  return (
    <div className="space-y-6" id="timeline-playback-container">
      
      {/* SECCIÓN ARRIBA: CABECERA & CONFIGURADOR DEL MOTOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="playback-header-grid">
        
        {/* METADATA & PARÁMETROS GENERATIVOS */}
        <div className="lg:col-span-6 bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-violet-400 font-mono uppercase tracking-wider">CONDUCCIÓN DEL ALTAR</span>
              <h2 className="text-xl font-bold font-display text-white" id="playback-title">{template.name}</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Visualización, sintonización fina del borrador y simulación de orquestación en vivo.
              </p>
            </div>
            <button 
              type="button" 
              onClick={onBack}
              className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 bg-zinc-950 border border-zinc-700/60 rounded cursor-pointer"
            >
              Volver
            </button>
          </div>

          <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-4" id="generation-controls-panel">
            <span className="block text-xs font-semibold text-zinc-300 uppercase tracking-widest border-b border-zinc-900 pb-1.5 flex items-center gap-1">
              <Sliders size={12} className="text-violet-500" />
              Parámetros de Orquestación Ritual
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Semilla */}
              <div>
                <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1" htmlFor="seed-input">Semilla (Espacio-Tiempo)</label>
                <div className="flex gap-2">
                  <input
                    id="seed-input"
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-zinc-900 text-white font-mono rounded px-2.5 py-1 text-xs border border-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={() => setSeed(Math.floor(Math.random() * 9999))}
                    className="p-1 px-2 bg-zinc-900 border border-zinc-800 rounded hover:border-violet-600 hover:text-violet-400 text-xs flex items-center gap-1 cursor-pointer"
                    id="shuffle-seed-btn"
                  >
                    <Shuffle size={12} />
                  </button>
                </div>
              </div>

              {/* Variabilidad slider */}
              <div>
                <div className="flex justify-between text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                  <span>Variabilidad Ritual</span>
                  <span className="font-mono text-violet-400">{variability}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={variability}
                  onChange={(e) => setVariability(parseInt(e.target.value, 10) || 0)}
                  className="w-full accent-violet-600 h-1 bg-zinc-800 rounded mt-2 cursor-pointer"
                  id="variability-slider"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={triggerGeneration}
              className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-lg text-xs hover:from-violet-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-violet-950/40 cursor-pointer"
              id="generate-playlist-btn"
            >
              Orquestar Borrador (Generación Limpia)
            </button>
          </div>

          {/* Warnings list */}
          {sequence.warnings && sequence.warnings.length > 0 && (
            <div className="space-y-1.5 p-3.5 bg-yellow-950/20 border border-yellow-900/30 rounded-lg text-[11px] text-yellow-300" id="warnings-group">
              <span className="font-bold flex items-center gap-1.5 uppercase text-[9px] tracking-wider text-yellow-400 mb-1">
                <AlertCircle size={12} />
                Advertencias del Copiloto Canindé:
              </span>
              <ul className="list-disc pl-4 space-y-1">
                {sequence.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* REPRODUCTOR VIRTUAL DE CEREMONIA */}
        <div className="lg:col-span-6 bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4" id="ceremonal-player-deck">
          <div className="border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 animate-pulse-gentle">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              CONSOLA DE FACILITADOR VIRTUAL
            </span>
            <h3 className="text-sm font-semibold font-display text-zinc-300 uppercase tracking-widest mt-1">Monitoreo Live</h3>
          </div>

          {/* Central Deck Visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-2">
            <div className="md:col-span-4 flex justify-center">
              {/* Spinning Mandala Mandala Mimic */}
              <div 
                className={`w-28 h-28 rounded-full border-2 border-dashed border-violet-500/60 p-1 bg-zinc-950 flex items-center justify-center relative ${
                  isPlaying ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '30s' }}
                id="spinning-deck-mandala"
              >
                <div className="w-full h-full rounded-full border border-violet-900 bg-gradient-to-tr from-violet-950 via-zinc-950 to-indigo-950 p-2 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-zinc-900 border border-violet-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-8 space-y-2">
              <span className="text-[9px] bg-violet-950 text-violet-300 font-mono font-bold px-1.5 py-0.5 rounded border border-violet-800 uppercase inline-block">
                {currentPlayingElem ? currentPlayingElem.type : 'Finalizado'}
              </span>

              <h4 className="text-sm font-bold text-white truncate" id="player-track-title">
                {currentPlayingElem 
                  ? (currentPlayingElem.track?.title || currentPlayingElem.name || 'Silencio Sagrado') 
                  : 'Ceremonia en Pausa'}
              </h4>
              <p className="text-xs text-zinc-400 truncate">
                {currentPlayingElem?.track?.artist ? `Artista: ${currentPlayingElem.track.artist}` : 'Estableciendo Vibración'}
              </p>

              {/* Progress bar */}
              {currentPlayingElem && (
                <div className="space-y-1">
                  <div className="h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all"
                      style={{ width: `${(elapsedMs / currentPlayingElem.durationMs) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                    <span>{formatMs(elapsedMs)}</span>
                    <span>{formatMs(currentPlayingElem.durationMs)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-zinc-950 rounded-xl border border-zinc-850" id="player-deck-panel">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCurrentIndex(0);
                  setElapsedMs(0);
                  setIsPlaying(false);
                }}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                title="Reiniciar reproducción"
                id="player-restart-btn"
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-3.5 rounded-full bg-violet-600 hover:bg-violet-500 hover:scale-105 text-white shadow-lg transition-all"
                id="player-toggle-btn"
              >
                {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentIndex < sequence.elements.length - 1) {
                    setCurrentIndex(idx => idx + 1);
                    setElapsedMs(0);
                  }
                }}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                title="Siguiente elemento"
                disabled={currentIndex >= sequence.elements.length - 1}
                id="player-skip-btn"
              >
                <SkipForward size={14} />
              </button>
            </div>

            {/* Micro Volume Slider */}
            <div className="flex items-center gap-2 w-full sm:w-44">
              <Volume2 size={14} className="text-zinc-500" />
              <input
                type="range"
                min="0"
                max="100"
                value={userVolume}
                onChange={(e) => setUserVolume(parseInt(e.target.value, 10))}
                className="w-full accent-violet-600 h-1 bg-zinc-800 rounded"
              />
              <span className="text-[10px] text-zinc-500 font-mono w-6 text-right">{userVolume}%</span>
            </div>
          </div>

        </div>

      </div>

      {/* SECCIÓN ABAJO: TIMELINE HORIZONTAL / VERTICAL Y CRUD MANUALLY (EDITABLE DRAWER) */}
      <div className="p-5 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-4" id="timeline-drawer">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-800 pb-3 gap-3">
          <div>
            <h3 className="text-sm font-semibold font-display text-white uppercase tracking-widest">
              Borrador de la Secuencia Musical
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              La playlist orquestada por el copiloto es totalmente interactiva. Modifica libremente el orden y estructura.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {tracks.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddManualTrack(e.target.value);
                    e.target.value = ''; // Reset
                  }
                }}
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded px-2.5 py-1 focus:outline-none"
              >
                <option value="">+ Insertar Tema</option>
                {tracks.map(t => (
                  <option key={t.id} value={t.id}>{t.title} ({t.artist || 'Chaman'})</option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleAddManualSilence}
              className="px-3 py-1 bg-zinc-950 border border-zinc-800 hover:border-violet-600 hover:text-violet-400 text-xs text-zinc-300 rounded flex items-center gap-1 transition-all cursor-pointer"
              id="insert-silence-btn"
            >
              <Plus size={12} /> + Silencio
            </button>
          </div>
        </div>

        {/* Timeline Items Listing */}
        {sequence.elements.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-12">La secuencia de reproducción se encuentra vacía.</p>
        ) : (
          <div className="space-y-2.5" id="timeline-elements-list">
            {sequence.elements.map((elem, idx) => {
              const isCurrent = idx === currentIndex;
              const isTrack = elem.type === 'track';

              return (
                <div 
                  key={elem.id} 
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    isCurrent 
                      ? 'border-violet-500 bg-violet-950/20 shadow-lg shadow-violet-950/20 scale-[1.01]' 
                      : 'border-zinc-800/80 bg-zinc-950 hover:bg-zinc-900/40'
                  }`}
                  id={`elem-row-${elem.id}`}
                >
                  
                  {/* Left part: Ordering icons and metadata */}
                  <div className="flex items-center gap-3 min-w-0">
                    
                    {/* Position counter badge */}
                    <span className="text-[10px] font-mono text-zinc-500 w-5 text-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* Source Icon badge */}
                    {isTrack ? (
                      <span className="text-xs shrink-0" title={`Fuente: ${elem.provider}`} id="provider-badge">
                        {elem.provider === 'spotify' ? '🟢' : elem.provider === 'youtube' ? '🔴' : '💾'}
                      </span>
                    ) : (
                      <span className="text-xs shrink-0" title="Silencio" id="silence-badge">
                        🤫
                      </span>
                    )}

                    {/* Meta info */}
                    <div className="min-w-0">
                      <span className="text-[9px] text-zinc-500 font-mono block">
                        Inicio: {formatMs(elem.startTimeMs)} - Fin: {formatMs(elem.endTimeMs)}
                      </span>
                      <h4 className="text-sm font-semibold text-white truncate pr-2">
                        {elem.track?.title || elem.name || 'Silencio de Consagración'}
                      </h4>
                      {isTrack && elem.track?.artist && (
                        <p className="text-xs text-zinc-400 truncate">
                          {elem.track.artist}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right part: Action controls */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    
                    {/* duration info */}
                    <span className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-850 px-2 py-1 rounded-md shrink-0">
                      {formatMs(elem.durationMs)}
                    </span>

                    {/* Move Up */}
                    <button
                      type="button"
                      onClick={() => handleShiftElement(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 disabled:opacity-30"
                      id={`shift-up-btn-${idx}`}
                    >
                      <ArrowUp size={12} />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      onClick={() => handleShiftElement(idx, 'down')}
                      disabled={idx === sequence.elements.length - 1}
                      className="p-1.5 rounded bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 disabled:opacity-30"
                      id={`shift-down-btn-${idx}`}
                    >
                      <ArrowDown size={12} />
                    </button>

                    {/* Delete Item */}
                    <button
                      type="button"
                      onClick={() => handleRemoveElement(idx)}
                      className="p-1.5 rounded bg-zinc-900 text-zinc-400 hover:text-red-400 border border-zinc-800"
                      id={`remove-elem-btn-${idx}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
