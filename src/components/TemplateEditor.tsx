import React, { useState } from 'react';
import { RitualTemplate, AttributeDefinition, Track, Region, Anchor, Silence, CurvePoint } from '../types';
import { validateAppTemplate } from '../services/coreMapping';
import type { ValidationResult } from '../ritual-core';
import CurveEditor from './CurveEditor';
import { 
  ChevronLeft, 
  Save, 
  Plus, 
  Trash2, 
  Clock, 
  Sparkles, 
  Volume2, 
  Compass, 
  Anchor as AnchorIcon, 
  ListPlus, 
  Coffee 
} from 'lucide-react';

interface TemplateEditorProps {
  template: RitualTemplate;
  attributes: AttributeDefinition[];
  tracks: Track[];
  onBack: () => void;
  onSave: (template: RitualTemplate) => void;
}

export default function TemplateEditor({ template, attributes, tracks, onBack, onSave }: TemplateEditorProps) {
  const [name, setName] = useState(template.name || '');
  const [hours, setHours] = useState(Math.floor((template.totalDurationMs || 7200000) / 3600000));
  const [minutes, setMinutes] = useState(Math.round(((template.totalDurationMs || 7200000) % 3600000) / 60000));
  const [curve, setCurve] = useState<CurvePoint[]>(template.curve || [{ t: 0, energy: 20 }, { t: 100, energy: 20 }]);
  const [regions, setRegions] = useState<Region[]>(template.regions || []);
  const [anchors, setAnchors] = useState<Anchor[]>(template.anchors || []);
  const [silences, setSilences] = useState<Silence[]>(template.silences || []);
  const [ambient, setAmbient] = useState({
    enabled: template.ambient?.enabled || false,
    trackId: template.ambient?.trackId || '',
    baseVolume: template.ambient?.baseVolume || 35
  });

  // State to expand/collapse regions or edit target sliders
  const [activeRegionId, setActiveRegionId] = useState<string | null>(regions[0]?.id || null);

  // Resultado de la última validación del núcleo (errores bloquean; avisos no).
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const handleSave = () => {
    if (!name.trim()) return;

    const totalDurationMs = (hours * 3600000) + (minutes * 60000) || 7200000;

    const updatedTemplate: RitualTemplate = {
      ...template,
      name: name.trim(),
      totalDurationMs,
      curve,
      regions,
      anchors,
      silences,
      ambient: {
        enabled: ambient.enabled,
        trackId: ambient.trackId || undefined,
        baseVolume: ambient.baseVolume
      }
    };

    // Validación del núcleo ANTES de persistir (chequea refs: anclas→tracks, targets→atributos).
    const result = validateAppTemplate(updatedTemplate, tracks, attributes);
    setValidation(result);
    if (!result.ok) return; // errores estructurales: no se guarda

    if (result.warnings.length > 0) {
      const proceed = confirm(
        'La plantilla tiene avisos (no bloqueantes):\n\n- ' +
          result.warnings.join('\n- ') +
          '\n\n¿Guardar de todas formas?'
      );
      if (!proceed) return;
    }

    onSave(updatedTemplate);
  };

  // ----------------------------------------------------
  // REGION CRUD
  // ----------------------------------------------------
  const handleAddRegion = () => {
    const id = `reg-${Date.now()}`;
    const startingTime = regions.length > 0 ? Math.min(95, regions[regions.length - 1].endT) : 0;
    const endingTime = Math.min(100, startingTime + 20);

    const newRegion: Region = {
      id,
      name: `Fase Nueva (${regions.length + 1})`,
      startT: startingTime,
      endT: endingTime,
      targets: []
    };

    setRegions([...regions, newRegion]);
    setActiveRegionId(id);
  };

  const handleUpdateRegion = (id: string, updatedFields: Partial<Region>) => {
    setRegions(prev => prev.map(r => r.id === id ? { ...r, ...updatedFields } : r));
  };

  const handleRemoveRegion = (id: string) => {
    setRegions(prev => prev.filter(r => r.id !== id));
    if (activeRegionId === id) {
      setActiveRegionId(null);
    }
  };

  const handleAddRegionTarget = (regionId: string, defId: string) => {
    setRegions(prev => prev.map(r => {
      if (r.id !== regionId) return r;
      // check if exists
      if (r.targets.some(t => t.defId === defId)) return r;
      
      return {
        ...r,
        targets: [...r.targets, { defId, weight: 80, min: 5, max: 10 }]
      };
    }));
  };

  const handleUpdateRegionTarget = (regionId: string, defId: string, value: Partial<{ weight: number, min: number, max: number, equals: string }>) => {
    setRegions(prev => prev.map(r => {
      if (r.id !== regionId) return r;
      return {
        ...r,
        targets: r.targets.map(t => t.defId === defId ? { ...t, ...value } : t)
      };
    }));
  };

  const handleRemoveRegionTarget = (regionId: string, defId: string) => {
    setRegions(prev => prev.map(r => {
      if (r.id !== regionId) return r;
      return {
        ...r,
        targets: r.targets.filter(t => t.defId !== defId)
      };
    }));
  };

  // ----------------------------------------------------
  // SILENCE CRUD
  // ----------------------------------------------------
  const handleAddSilence = () => {
    const newSilence: Silence = {
      id: `sil-${Date.now()}`,
      t: 50, // midpoint
      durationMs: 5 * 60 * 1000 // 5 mins
    };
    setSilences([...silences, newSilence]);
  };

  const handleUpdateSilence = (id: string, updated: Partial<Silence>) => {
    setSilences(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  };

  const handleRemoveSilence = (id: string) => {
    setSilences(prev => prev.filter(s => s.id !== id));
  };

  // ----------------------------------------------------
  // ANCHOR CRUD
  // ----------------------------------------------------
  const handleAddAnchor = () => {
    if (tracks.length === 0) return;
    const newAnchor: Anchor = {
      id: `anc-${Date.now()}`,
      trackId: tracks[0].id,
      placement: 30
    };
    setAnchors([...anchors, newAnchor]);
  };

  const handleUpdateAnchor = (id: string, updated: Partial<Anchor>) => {
    setAnchors(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
  };

  const handleRemoveAnchor = (id: string) => {
    setAnchors(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-6" id="template-editor-workspace">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-zinc-900/10 border border-zinc-800/60 rounded-2xl gap-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] dot-pattern" />
        <div className="flex items-center gap-4 relative z-10">
          <button 
            type="button" 
            onClick={onBack} 
            className="p-2 rounded-full bg-zinc-900/80 border border-zinc-800/80 hover:text-white hover:border-zinc-700 transition-all cursor-pointer shadow-md"
            id="back-btn"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <span className="text-[9px] text-violet-400 font-mono tracking-[0.25em] uppercase font-bold">MODO DISEÑADOR DE VIAJES</span>
            <h2 className="text-xl font-serif italic text-white" id="template-editor-heading">
              {template.id ? 'Editar Plantilla Ritual' : 'Nueva Plantilla'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end relative z-10">
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full sm:w-auto px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all cursor-pointer"
            id="save-template-btn"
          >
            Guardar Plantilla
          </button>
        </div>
      </div>

      {/* PANEL DE VALIDACIÓN (núcleo): errores bloquean el guardado; avisos son sugerencias */}
      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-3" id="template-validation-panel">
          {validation.errors.length > 0 && (
            <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl text-[11px] text-red-300">
              <span className="font-bold flex items-center gap-1.5 uppercase text-[9px] tracking-wider text-red-400 mb-1.5">
                No se puede guardar — corrige estos errores:
              </span>
              <ul className="list-disc pl-4 space-y-1">
                {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="p-4 bg-yellow-950/20 border border-yellow-900/30 rounded-xl text-[11px] text-yellow-300">
              <span className="font-bold flex items-center gap-1.5 uppercase text-[9px] tracking-wider text-yellow-400 mb-1.5">
                Avisos del Copiloto (no bloqueantes):
              </span>
              <ul className="list-disc pl-4 space-y-1">
                {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="template-editor-grid">
        
        {/* COLUMNA 1: CONFIGURACIÓN GENERAL Y CURVA DE ENERGÍA (8/12) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Ficha General */}
          <div className="p-6 bg-zinc-900/10 border border-zinc-800/60 rounded-2xl space-y-5 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] dot-pattern" />
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.2em] relative z-10 pb-2 border-b border-zinc-800/50">
              General del Altar
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
              {/* Nombre */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5" htmlFor="template-name">
                  Nombre de la Ceremonia / Intención *
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Viaje Curativo de Tambor Solsticio"
                  className="w-full bg-zinc-900/40 border border-zinc-800 text-white rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* Duración */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Duración Total (Horas)
                </label>
                <div className="flex items-center gap-2 bg-zinc-900/40 px-4 py-2 rounded-full border border-zinc-800">
                  <Clock size={12} className="text-zinc-500" />
                  <input
                    type="number"
                    min="0"
                    max="12"
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-transparent focus:outline-none text-white text-xs font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">hrs</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Duración Total (Minutos)
                </label>
                <div className="flex items-center gap-2 bg-zinc-900/40 px-4 py-2 rounded-full border border-zinc-800">
                  <Clock size={12} className="text-zinc-500" />
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    className="w-full bg-transparent focus:outline-none text-white text-sm"
                  />
                  <span className="text-xs text-zinc-500">min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Curva de Energía */}
          <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-4">
            <h3 className="text-sm font-semibold font-display text-zinc-300 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={16} className="text-violet-500" />
              Arco de Energía de la Ceremonia
            </h3>
            <p className="text-xs text-zinc-400">
              Presiona sobre la curva para añadir puntos claves de intensidad energética. El motor de Ritmo ajustará la mezcla de las canciones de la biblioteca para seguir esta topografía de manera fiel.
            </p>
            
            <CurveEditor points={curve} onChange={setCurve} />
          </div>

          {/* Silencios y Capa Ambiental Naturaleza */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Silencios Sagrados */}
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
              <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                <h3 className="text-xs font-semibold font-display text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Coffee size={14} className="text-violet-400" />
                  Silencios Sagrados
                </h3>
                <button
                  type="button"
                  onClick={handleAddSilence}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold uppercase flex items-center gap-0.5 cursor-pointer"
                  id="add-silence-btn"
                >
                  <Plus size={12} /> Añadir
                </button>
              </div>

              {silences.length === 0 ? (
                <p className="text-[11px] text-zinc-500 text-center py-6">Sin silencios planificados.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {silences.map((sil) => (
                    <div key={sil.id} className="flex items-center gap-2 bg-zinc-950 p-2 rounded-lg border border-zinc-800" id={`silence-row-${sil.id}`}>
                      {/* t position */}
                      <span className="text-[10px] text-zinc-500 font-mono w-10 shrink-0">Rel {sil.t}%</span>
                      <input
                        type="range"
                        min="1"
                        max="99"
                        value={sil.t}
                        onChange={(e) => handleUpdateSilence(sil.id, { t: parseInt(e.target.value, 10) })}
                        className="flex-1 accent-violet-600 h-1 bg-zinc-800 rounded"
                        id={`silence-slider-${sil.id}`}
                      />
                      
                      {/* durationMs */}
                      <select
                        value={sil.durationMs}
                        onChange={(e) => handleUpdateSilence(sil.id, { durationMs: parseInt(e.target.value, 10) })}
                        className="bg-zinc-900 text-zinc-300 text-[10px] font-mono border border-zinc-850 px-1 py-0.5 rounded cursor-pointer"
                        id={`silence-dur-${sil.id}`}
                      >
                        <option value={60000}>1m</option>
                        <option value={180000}>3m</option>
                        <option value={300000}>5m</option>
                        <option value={600000}>10m</option>
                        <option value={900000}>15m</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveSilence(sil.id)}
                        className="text-zinc-500 hover:text-red-400 p-0.5"
                        id={`remove-silence-${sil.id}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Capa de Ambiente / Naturaleza */}
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                <h3 className="text-xs font-semibold font-display text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Volume2 size={14} className="text-violet-400" />
                  Capa de Sonido Ambiente
                </h3>
                <label className="relative inline-flex items-center cursor-pointer" id="ambient-toggle">
                  <input
                    type="checkbox"
                    checked={ambient.enabled}
                    onChange={(e) => setAmbient({ ...ambient, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-violet-600 peer-checked:after:bg-whiteScale"></div>
                </label>
              </div>

              {ambient.enabled ? (
                <div className="space-y-3 p-1.5 rounded bg-zinc-950 border border-zinc-900" id="ambient-inputs-group">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1" htmlFor="ambient-track">
                      Tema de Fondo Natural
                    </label>
                    <select
                      id="ambient-track"
                      value={ambient.trackId}
                      onChange={(e) => setAmbient({ ...ambient, trackId: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 focus:outline-none"
                    >
                      <option value="">-- Por defecto (Naturaleza Estándar) --</option>
                      {tracks.map(t => (
                        <option key={t.id} value={t.id}>{t.title} {t.artist ? ` - ${t.artist}` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                      <span>Volumen de Fondo</span>
                      <span className="font-mono">{ambient.baseVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={ambient.baseVolume}
                      onChange={(e) => setAmbient({ ...ambient, baseVolume: parseInt(e.target.value, 15) || 50 })}
                      className="w-full accent-violet-600 h-1 bg-zinc-800 rounded"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 text-center py-6">La capa de sonido ambiente está deshabilitada.</p>
              )}
            </div>

          </div>

          {/* Anclas de Audio (Tracks obligatorios) */}
          <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
              <h3 className="text-xs font-semibold font-display text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                <AnchorIcon size={14} className="text-violet-400" />
                Anclas Obligatorias de Ceremonia
              </h3>
              <button
                type="button"
                onClick={handleAddAnchor}
                disabled={tracks.length === 0}
                className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold uppercase flex items-center gap-0.5 disabled:opacity-40 cursor-pointer"
                id="add-anchor-btn"
              >
                <Plus size={12} /> Forzar Tema
              </button>
            </div>

            {anchors.length === 0 ? (
              <p className="text-[11px] text-zinc-500 text-center py-6">
                {tracks.length === 0 
                  ? 'Agregá temas a tu biblioteca primero para poder arrastrar anclas.' 
                  : 'No has fijado ningún tema obligatorio en la ceremonia.'}
              </p>
            ) : (
              <div className="space-y-3" id="anchors-list">
                {anchors.map((anc) => {
                  return (
                    <div key={anc.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800" id={`anchor-row-${anc.id}`}>
                      {/* track choice */}
                      <div className="md:col-span-7">
                        <label className="block text-[8px] font-semibold text-zinc-500 uppercase mb-0.5">Canción Forzada</label>
                        <select
                          value={anc.trackId}
                          onChange={(e) => handleUpdateAnchor(anc.id, { trackId: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs rounded px-2 py-1 focus:outline-none"
                          id={`anchor-select-${anc.id}`}
                        >
                          {tracks.map(t => (
                            <option key={t.id} value={t.id}>{t.title} {t.artist ? `(${t.artist})` : ''}</option>
                          ))}
                        </select>
                      </div>

                      {/* placement slider */}
                      <div className="md:col-span-4 flex items-center gap-2">
                        <div className="w-full">
                          <div className="flex justify-between text-[8px] font-semibold text-zinc-500 uppercase mb-0.5">
                            <span>Posición Relativa</span>
                            <span className="font-mono text-violet-400">{anc.placement}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={anc.placement}
                            onChange={(e) => handleUpdateAnchor(anc.id, { placement: parseInt(e.target.value, 10) })}
                            className="w-full accent-violet-600 h-1 bg-zinc-800 rounded"
                            id={`anchor-slider-${anc.id}`}
                          />
                        </div>
                      </div>

                      {/* remove handle */}
                      <div className="md:col-span-1 flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveAnchor(anc.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 bg-zinc-900 border border-zinc-800 rounded hover:border-red-950"
                          id={`remove-anchor-${anc.id}`}
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

        {/* COLUMNA 2: REGIONES CON CLIMA EMOCIONAL (4/12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-3">
              <div>
                <h3 className="text-sm font-semibold font-display text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                  <ListPlus size={16} className="text-violet-500" />
                  Regiones / Fase Emocionales
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">Divide el viaje en fases y calibra su energía y clima espiritual.</p>
              </div>
              <button
                type="button"
                onClick={handleAddRegion}
                className="px-2.5 py-1 text-xs bg-violet-950/60 hover:bg-violet-900/50 text-violet-300 border border-violet-800/50 rounded-lg flex items-center gap-1 transition-all font-medium cursor-pointer"
                id="add-region-btn"
              >
                <Plus size={14} /> Región
              </button>
            </div>

            {regions.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm">
                Sin fases creadas. Las fases mapean intenciones en fragmentos del tiempo.
              </div>
            ) : (
              <div className="space-y-3" id="regions-accordion">
                {regions.map((reg) => {
                  const isExpanded = activeRegionId === reg.id;

                  return (
                    <div 
                      key={reg.id} 
                      className={`rounded-xl border transition-all ${
                        isExpanded 
                          ? 'border-violet-800 bg-zinc-950' 
                          : 'border-zinc-800/80 bg-zinc-900/10 hover:bg-zinc-900/35'
                      }`}
                      id={`region-box-${reg.id}`}
                    >
                      {/* Region Header line */}
                      <div className="p-3 select-none flex justify-between items-center cursor-pointer" onClick={() => setActiveRegionId(isExpanded ? null : reg.id)}>
                        <div className="flex-1 min-w-0 pr-3">
                          <input
                            type="text"
                            value={reg.name || ''}
                            onClick={(e) => e.stopPropagation()} // Prevent collapse toggling when writing
                            onChange={(e) => handleUpdateRegion(reg.id, { name: e.target.value })}
                            placeholder="Nombre de la Fase"
                            className="bg-transparent text-white text-xs font-semibold focus:outline-none w-full border-b border-transparent focus:border-zinc-700 pb-0.5"
                          />
                          <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 mt-0.5">
                            <Clock size={10} />
                            <span>Intervalo: {reg.startT}% - {reg.endT}% de la Duración</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleRemoveRegion(reg.id)}
                            className="text-zinc-500 hover:text-red-400 p-1"
                            id={`remove-region-${reg.id}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Settings */}
                      {isExpanded && (
                        <div className="p-3.5 border-t border-zinc-850 bg-zinc-950/80 rounded-b-xl space-y-4" id={`region-expanded-${reg.id}`}>
                          {/* Duration Range sliders */}
                          <div className="space-y-2.5">
                            <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Límites del Intervalo Relativo</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[8px] text-zinc-500" htmlFor={`region-start-${reg.id}`}>Inicio (%)</label>
                                <input
                                  id={`region-start-${reg.id}`}
                                  type="number"
                                  min="0"
                                  max={reg.endT - 1}
                                  value={reg.startT}
                                  onChange={(e) => handleUpdateRegion(reg.id, { startT: Math.max(0, Math.min(reg.endT - 1, parseInt(e.target.value, 10) || 0)) })}
                                  className="w-full bg-zinc-900 border border-zinc-800 text-[10.5px] font-mono text-zinc-300 rounded px-2 py-1"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] text-zinc-500" htmlFor={`region-end-${reg.id}`}>Fin (%)</label>
                                <input
                                  id={`region-end-${reg.id}`}
                                  type="number"
                                  min={reg.startT + 1}
                                  max="100"
                                  value={reg.endT}
                                  onChange={(e) => handleUpdateRegion(reg.id, { endT: Math.max(reg.startT + 1, Math.min(100, parseInt(e.target.value, 10) || 100)) })}
                                  className="w-full bg-zinc-900 border border-zinc-800 text-[10.5px] font-mono text-zinc-300 rounded px-2 py-1"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Target Intentions */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Filtro de Clima Emocional</span>
                              
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAddRegionTarget(reg.id, e.target.value);
                                    e.target.value = ''; // reset Select
                                  }
                                }}
                                className="bg-zinc-900 text-zinc-400 text-[9px] border border-zinc-800 rounded px-1.5 py-0.5 cursor-pointer max-w-28"
                              >
                                <option value="">+ Añadir</option>
                                {attributes.map(at => (
                                  <option key={at.id} value={at.id}>{at.name}</option>
                                ))}
                              </select>
                            </div>

                            {reg.targets.length === 0 ? (
                              <p className="text-[10px] text-zinc-600 text-center py-2 italic">Sin filtros. Cualquier tema de la biblioteca puede sonar aquí.</p>
                            ) : (
                              <div className="space-y-2.5" id={`region-targets-${reg.id}`}>
                                {reg.targets.map(tg => {
                                  const attr = attributes.find(at => at.id === tg.defId);
                                  if (!attr) return null;

                                  return (
                                    <div key={tg.defId} className="p-2 bg-zinc-900/60 rounded border border-zinc-850 text-xs space-y-1.5" id={`reg-target-${reg.id}-${tg.defId}`}>
                                      <div className="flex justify-between items-center text-[11px] font-medium text-white">
                                        <span className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: attr.color }} />
                                          {attr.name}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveRegionTarget(reg.id, tg.defId)}
                                          className="text-zinc-500 hover:text-red-400 font-bold"
                                        >
                                          ×
                                        </button>
                                      </div>

                                      {attr.kind === 'intensity' && (
                                        <div className="space-y-1 text-[9px] text-zinc-400">
                                          <div className="flex justify-between">
                                            <span>Intensidad Recomendada</span>
                                            <span className="font-mono text-violet-400">Entre {tg.min || 1} y {tg.max || 10}</span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <span className="text-[8px] text-zinc-500">Mínimo</span>
                                              <input
                                                type="number"
                                                min="1"
                                                max={tg.max || 10}
                                                value={tg.min || 1}
                                                onChange={(e) => handleUpdateRegionTarget(reg.id, tg.defId, { min: Math.max(1, Math.min(tg.max || 10, parseInt(e.target.value, 10) || 1)) })}
                                                className="w-full bg-zinc-950 border border-zinc-800 text-center rounded text-[10px] py-0.5"
                                              />
                                            </div>
                                            <div>
                                              <span className="text-[8px] text-zinc-500">Máximo</span>
                                              <input
                                                type="number"
                                                min={tg.min || 1}
                                                max="10"
                                                value={tg.max || 10}
                                                onChange={(e) => handleUpdateRegionTarget(reg.id, tg.defId, { max: Math.max(tg.min || 1, Math.min(10, parseInt(e.target.value, 10) || 10)) })}
                                                className="w-full bg-zinc-950 border border-zinc-800 text-center rounded text-[10px] py-0.5"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {attr.kind === 'category' && (
                                        <div className="space-y-1 text-[9px] text-zinc-400">
                                          <span className="block text-[8px] text-zinc-500">Debe calzar con:</span>
                                          <select
                                            value={tg.equals || ''}
                                            onChange={(e) => handleUpdateRegionTarget(reg.id, tg.defId, { equals: e.target.value })}
                                            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 text-[10px] rounded px-1.5 py-0.5"
                                          >
                                            <option value="">Cualquier opción</option>
                                            {attr.options?.map((opt, oIdx) => (
                                              <option key={oIdx} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}

                                      {attr.kind === 'flag' && (
                                        <p className="text-[9px] text-zinc-500 italic">Forzará canciones con esta etiqueta activada.</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
