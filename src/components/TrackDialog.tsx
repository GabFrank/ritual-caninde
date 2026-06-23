import React, { useState, useEffect } from 'react';
import { Track, AttributeDefinition, TrackTag } from '../types';
import { X, Music, AlertTriangle, Link2, CheckCircle2, Loader2 } from 'lucide-react';
import { parseSourceUrl, fetchSourceMeta, fetchSpotifyMeta, describeKind, type ParsedSource, type SourceMeta } from '../services/sourceUrl';
import { getAccessToken } from '../services/auth/oauthSessions';

interface TrackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  attributes: AttributeDefinition[];
  onSave: (track: Omit<Track, 'id' | 'ownerId'>) => void;
  track?: Track | null;
}

// Convert Milliseconds to M:SS
const msToMSS = (ms: number): string => {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Convert M:SS to Milliseconds
const mssToMs = (mss: string): number => {
  const parts = mss.split(':');
  if (parts.length === 0) return 0;
  if (parts.length === 1) {
    const seconds = parseInt(parts[0], 10);
    return isNaN(seconds) ? 0 : seconds * 1000;
  }
  const min = parseInt(parts[0], 10);
  const sec = parseInt(parts[1], 10);
  return ( (isNaN(min) ? 0 : min * 60) + (isNaN(sec) ? 0 : sec) ) * 1000;
};

export default function TrackDialog({ isOpen, onClose, attributes, onSave, track }: TrackDialogProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [durationString, setDurationString] = useState('5:00');
  const [provider, setProvider] = useState<'spotify' | 'youtube' | 'local'>('spotify');
  const [externalId, setExternalId] = useState('');
  const [sourceUri, setSourceUri] = useState<string | undefined>(undefined);

  // Pegar-URL: detección de fuente + autocompletado.
  const [urlInput, setUrlInput] = useState('');
  const [parsed, setParsed] = useState<ParsedSource | null>(null);
  const [urlTouched, setUrlTouched] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);

  // Track tags state mapped as: { [defId]: value }
  const [tagMap, setTagMap] = useState<Record<string, string | number | boolean>>({});

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setDurationString(msToMSS(track.durationMs));
      setProvider(track.source?.provider || 'spotify');
      setExternalId(track.source?.externalId || '');
      setSourceUri(track.source?.uri);
      setUrlInput('');
      setParsed(null);
      setUrlTouched(false);

      // Load current tags
      const currentTags: Record<string, string | number | boolean> = {};
      track.tags.forEach(t => {
        currentTags[t.defId] = t.value;
      });
      setTagMap(currentTags);
    } else {
      setTitle('');
      setArtist('');
      setDurationString('5:00');
      setProvider('spotify');
      setExternalId('');
      setSourceUri(undefined);
      setUrlInput('');
      setParsed(null);
      setUrlTouched(false);

      // Setup initial tag maps
      const initialTags: Record<string, string | number | boolean> = {};
      attributes.forEach(attr => {
        if (attr.kind === 'intensity') {
          initialTags[attr.id] = 5; // Mid value
        } else if (attr.kind === 'category') {
          initialTags[attr.id] = attr.options?.[0] || '';
        } else {
          initialTags[attr.id] = false;
        }
      });
      setTagMap(initialTags);
    }
  }, [track, isOpen, attributes]);

  if (!isOpen) return null;

  // Aplica metadatos sin pisar lo que el usuario ya escribió.
  const applyMeta = (meta: SourceMeta) => {
    if (meta.title) setTitle((prev) => prev.trim() || meta.title!.trim());
    if (meta.artist) setArtist((prev) => prev.trim() || meta.artist!.trim());
    // La duración sólo se autocompleta si sigue en el valor por defecto.
    if (meta.durationMs) setDurationString((prev) => (prev === '5:00' ? msToMSS(meta.durationMs!) : prev));
  };

  // Pegar URL → detecta plataforma + ID y, best-effort, autocompleta título/artista/duración.
  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    setUrlTouched(value.trim().length > 0);
    const result = parseSourceUrl(value);
    setParsed(result);
    if (!result) return;

    setProvider(result.provider);
    setExternalId(result.externalId);
    setSourceUri(result.uri);

    setFetchingMeta(true);
    (async () => {
      // Spotify: si hay sesión, la Web API trae artista + duración. Si no, oEmbed (sólo título).
      if (result.provider === 'spotify') {
        const token = await getAccessToken('spotify').catch(() => null);
        if (token) {
          try {
            applyMeta(await fetchSpotifyMeta(result, token));
            return;
          } catch { /* cae al oEmbed */ }
        }
      }
      // oEmbed público (YouTube: título + canal; Spotify sin sesión: sólo título).
      try {
        applyMeta(await fetchSourceMeta(result));
      } catch { /* sin metadatos: quedan plataforma + ID */ }
    })().finally(() => setFetchingMeta(false));
  };

  const handleTagChange = (defId: string, value: string | number | boolean) => {
    setTagMap(prev => ({
      ...prev,
      [defId]: value
    }));
  };

  const handleSave = () => {
    if (!title.trim()) return;

    // Build the clean array tag list
    const tags: TrackTag[] = Object.keys(tagMap).map(defId => ({
      defId,
      value: tagMap[defId]
    }));

    // Convert duration to milliseconds
    const durationMs = mssToMs(durationString) || 300000;

    // Invisible Audio Metadata is randomized/pre-calculated to mock reality
    const defaultMeta = track?.audioMeta || {
      keyCamelot: `${Math.floor(Math.random() * 12) + 1}${Math.random() > 0.5 ? 'A' : 'B'}`,
      bpm: Math.floor(Math.random() * 50) + 70
    };

    onSave({
      title: title.trim(),
      artist: artist.trim() || undefined,
      durationMs,
      source: {
        provider,
        externalId: externalId.trim() || `id_${Date.now()}`,
        ...(sourceUri ? { uri: sourceUri } : {})
      },
      tags,
      audioMeta: defaultMeta
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" id="track-dialog-container">
      <div className="w-full max-w-2xl border bg-zinc-950 border-zinc-800 rounded-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" id="track-dialog">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
          id="close-track-dialog-btn"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-medium font-display text-white mb-6 flex items-center gap-2" id="track-dialog-title">
          <Music className="text-violet-500" size={20} />
          {track ? 'Editar Tema de Ritual' : 'Agregar Tema a la Biblioteca'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="track-dialog-body">
          
          {/* COLUMNA 1: Datos de Origen y Reproductor */}
          <div className="space-y-4">
            <h4 className="text-sm border-b border-zinc-800 pb-1 font-medium text-violet-400 uppercase tracking-wider">Identificación y Enlace</h4>

            {/* Pegar URL (Spotify / YouTube) → autocompleta plataforma + ID */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1" htmlFor="track-url">
                Pegar enlace (Spotify / YouTube)
              </label>
              <div className="relative">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  id="track-url"
                  type="url"
                  inputMode="url"
                  value={urlInput}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://open.spotify.com/...  ó  https://youtu.be/..."
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* Feedback de detección */}
              {parsed && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>
                    Detectado: <strong className="capitalize">{parsed.provider}</strong> · {describeKind(parsed.kind)}
                    {fetchingMeta && <Loader2 size={11} className="inline ml-1.5 animate-spin" />}
                  </span>
                </div>
              )}
              {parsed && !parsed.isSingleTrack && (
                <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-400/90">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>Esto es un {describeKind(parsed.kind)}, no un tema único. La reproducción espera un tema/video individual.</span>
                </div>
              )}
              {urlTouched && !parsed && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>No reconocí el enlace. Podés completar los campos manualmente.</span>
                </div>
              )}
            </div>

            {/* Título */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1" htmlFor="track-title">
                Título del Tema *
              </label>
              <input
                id="track-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Caminante del Viento"
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            {/* Artista */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1" htmlFor="track-artist">
                Artista o Círculo
              </label>
              <input
                id="track-artist"
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Ej. Ayla Schafer o Tradicional"
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            {/* Duración */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1" htmlFor="track-duration">
                Duración (Minutos:Segundos)
              </label>
              <input
                id="track-duration"
                type="text"
                value={durationString}
                onChange={(e) => setDurationString(e.target.value)}
                placeholder="Ej. 6:45 o 4:20"
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
              />
            </div>

            {/* Fuente de Audio */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                Plataforma de Origen
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['spotify', 'youtube', 'local'] as const).map(src => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => { setProvider(src); setSourceUri(undefined); setParsed(null); }}
                    className={`py-2 px-1 text-xs rounded-lg border text-center font-medium capitalize transition-all ${
                      provider === src 
                        ? 'border-violet-600 bg-violet-950/40 text-violet-300' 
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                    }`}
                    id={`provider-${src}`}
                  >
                    {src === 'spotify' && '🟢 Spotify'}
                    {src === 'youtube' && '🔴 YouTube'}
                    {src === 'local' && '💾 Local'}
                  </button>
                ))}
              </div>
            </div>

            {/* ID Externo */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1" htmlFor="track-external-id">
                {provider === 'spotify' && 'ID de Spotify / URI (ej. 4xSg7A0...)'}
                {provider === 'youtube' && 'ID de Video YouTube (ej. dQrR1B_)'}
                {provider === 'local' && 'Nombre del Archivo / Ref Local'}
              </label>
              <input
                id="track-external-id"
                type="text"
                value={externalId}
                onChange={(e) => { setExternalId(e.target.value); setSourceUri(undefined); }}
                placeholder={provider === 'spotify' ? 'Ej. 3Z9O678a9B' : provider === 'youtube' ? 'Ej. mB-OuhqAnK8' : 'Ej. tambor_medicina.mp3'}
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono text-xs"
              />
            </div>
            
            <div className="p-3 bg-violet-950/20 rounded-lg border border-violet-900/30 text-xs text-violet-300 flex gap-2">
              <AlertTriangle size={18} className="shrink-0 text-violet-400" />
              <span>
                <strong>Importante:</strong> Ritual Canindé trata las plataformas como iguales. Este tema se integrará en el algoritmo de mezcla en base pura a las propiedades emocionales.
              </span>
            </div>
          </div>

          {/* COLUMNA 2: Perfil y Clasificaciones Emocionales */}
          <div className="space-y-4">
            <h4 className="text-sm border-b border-zinc-800 pb-1 font-medium text-violet-400 uppercase tracking-wider">Perfil Emocional</h4>
            
            {attributes.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No tienes dimensiones emocionales creadas. Agrégalas desde el panel principal.
              </div>
            ) : (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {attributes.map(attr => {
                  const currentValue = tagMap[attr.id] ?? (attr.kind === 'intensity' ? 5 : attr.kind === 'category' ? '' : false);

                  return (
                    <div key={attr.id} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800/60" id={`tag-field-${attr.id}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-2 text-sm font-medium text-white">
                          <span 
                            className="w-2.5 h-2.5 rounded-full inline-block" 
                            style={{ backgroundColor: attr.color }} 
                          />
                          {attr.name}
                        </span>
                        
                        {attr.kind === 'intensity' && (
                          <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-violet-400 border border-zinc-700">
                            {currentValue}/10
                          </span>
                        )}
                        {attr.kind === 'flag' && (
                          <span className="text-xs text-zinc-400">
                            {currentValue ? 'Sí' : 'No'}
                          </span>
                        )}
                      </div>

                      {/* INTENSIDAD: Slider 1 a 10 */}
                      {attr.kind === 'intensity' && (
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={Number(currentValue)}
                            onChange={(e) => handleTagChange(attr.id, Number(e.target.value))}
                            className="w-full accent-violet-500 h-1bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                            id={`tag-slider-${attr.id}`}
                          />
                        </div>
                      )}

                      {/* SELECCION CATEGORICA */}
                      {attr.kind === 'category' && (
                        <select
                          value={String(currentValue)}
                          onChange={(e) => handleTagChange(attr.id, e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                          id={`tag-select-${attr.id}`}
                        >
                          <option value="">-- Sin asignar --</option>
                          {attr.options?.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {/* FLAG / ACTIVADO */}
                      {attr.kind === 'flag' && (
                        <label className="relative inline-flex items-center cursor-pointer py-1" id={`tag-toggle-${attr.id}`}>
                          <input
                            type="checkbox"
                            checked={Boolean(currentValue)}
                            onChange={(e) => handleTagChange(attr.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[6px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600 peer-checked:after:bg-white"></div>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-zinc-800 pt-4 flex justify-end gap-3" id="track-dialog-footer">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            id="cancel-track-dialog-btn"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-5 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-all rounded-lg font-medium shadow-md shadow-violet-950/50"
            id="save-track-dialog-btn"
          >
            {track ? 'Actualizar Tema' : 'Guardar en Biblioteca'}
          </button>
        </div>
      </div>
    </div>
  );
}
