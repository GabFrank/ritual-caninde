import React, { useState } from 'react';
import { AttributeDefinition, AttributeKind } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';

interface EmotionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (attr: Omit<AttributeDefinition, 'id' | 'ownerId' | 'builtIn'>) => void;
  attribute?: AttributeDefinition | null;
}

const COLOR_PRESETS = [
  '#a855f7', // Violet
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#f43f5e'  // Rose
];

export default function EmotionDialog({ isOpen, onClose, onSave, attribute }: EmotionDialogProps) {
  const [name, setName] = useState(attribute?.name || '');
  const [color, setColor] = useState(attribute?.color || COLOR_PRESETS[0]);
  const [kind, setKind] = useState<AttributeKind>(attribute?.kind || 'intensity');
  const [options, setOptions] = useState<string[]>(attribute?.options || []);
  const [newOption, setNewOption] = useState('');

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      color,
      kind,
      options: kind === 'category' ? options : undefined,
      min: kind === 'intensity' ? 1 : undefined,
      max: kind === 'intensity' ? 10 : undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="emotion-dialog-container">
      <div className="w-full max-w-md border bg-zinc-900 border-zinc-800 rounded-xl p-6 shadow-2xl relative" id="emotion-dialog">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
          id="close-emotion-dialog-btn"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-medium font-display text-white mb-4" id="emotion-dialog-title">
          {attribute ? 'Editar Dimensión Emocional' : 'Crear Clasificación Emocional'}
        </h3>

        <div className="space-y-4" id="emotion-dialog-form">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1" htmlFor="emotion-name">
              Nombre de la Emoción o Categoría
            </label>
            <input
              id="emotion-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Trance, Calidez, Intención"
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* Tipo / Métrica */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
              Método de Clasificación
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setKind('intensity')}
                className={`py-2 px-3 text-xs rounded-lg border text-center font-medium transition-all ${
                  kind === 'intensity' 
                    ? 'border-violet-600 bg-violet-950/40 text-violet-300' 
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
                id="kind-intensity-btn"
              >
                Intensidad (1-10)
              </button>
              <button
                type="button"
                onClick={() => setKind('category')}
                className={`py-2 px-3 text-xs rounded-lg border text-center font-medium transition-all ${
                  kind === 'category' 
                    ? 'border-violet-600 bg-violet-950/40 text-violet-300' 
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
                id="kind-category-btn"
              >
                Selección Única
              </button>
              <button
                type="button"
                onClick={() => setKind('flag')}
                className={`py-2 px-3 text-xs rounded-lg border text-center font-medium transition-all ${
                  kind === 'flag' 
                    ? 'border-violet-600 bg-violet-950/40 text-violet-300' 
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
                id="kind-flag-btn"
              >
                Activación (Si/No)
              </button>
            </div>
          </div>

          {/* Paleta de Colores */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Color Distintivo del Ritual
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  id={`color-preset-${c}`}
                />
              ))}
            </div>
          </div>

          {/* Opciones Adicionales para Selección Única */}
          {kind === 'category' && (
            <div className="border border-zinc-800 p-3 rounded-lg bg-zinc-950" id="options-category-panel">
              <label className="block text-xs font-medium text-zinc-300 mb-1" htmlFor="new-option-input">
                Opciones Disponibles
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  id="new-option-input"
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Ej. Tambor Chamánico, Canto"
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white p-1 rounded"
                  id="add-option-btn"
                >
                  <Plus size={16} />
                </button>
              </div>

              {options.length === 0 ? (
                <p className="text-zinc-500 text-xs text-center py-1">Sin opciones definidas aún.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {options.map((opt, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center gap-1 bg-zinc-900 text-zinc-300 border border-zinc-800 px-2 py-0.5 rounded text-xs"
                    >
                      {opt}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveOption(i)} 
                        className="text-zinc-500 hover:text-red-400"
                        id={`remove-option-${i}`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3" id="emotion-dialog-actions">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            id="cancel-emotion-dialog-btn"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-all rounded-lg font-medium shadow-md shadow-violet-950/50"
            id="save-emotion-dialog-btn"
          >
            Guardar Dimensión
          </button>
        </div>
      </div>
    </div>
  );
}
