import React, { useState, useEffect } from 'react';
import { 
  auth, 
  signInWithGoogle, 
  signInDemoGuest, 
  signOutUser,
  seedUserDataIfNeeded,
  fetchAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  fetchTracks,
  createTrack,
  updateTrack,
  deleteTrack,
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  saveSequence,
  clearUserData
} from './services/firebase';
import { handleRedirectCallback } from './services/auth/oauthSessions';
import { onAuthStateChanged, User } from 'firebase/auth';
import { AttributeDefinition, Track, RitualTemplate, GeneratedSequence } from './types';
import TrackDialog from './components/TrackDialog';
import EmotionDialog from './components/EmotionDialog';
import TemplateEditor from './components/TemplateEditor';
import TimelineView from './components/TimelineView';
import { 
  Music, 
  Compass, 
  Play, 
  Sparkles, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  LogOut, 
  Flame, 
  PlayCircle,
  Layers,
  Sliders,
  CheckCircle,
  HelpCircle,
  Loader2,
  FolderLock
} from 'lucide-react';

const APP_VERSION = __APP_VERSION__;

// Diagnóstico: arma un texto legible con el código real del error (Firestore, etc.).
function describeError(err: any): string {
  const code = err?.code ? `[${err.code}] ` : '';
  return `${code}${err?.message ?? String(err)}`;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);

  // Firestore Loaded States
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [templates, setTemplates] = useState<RitualTemplate[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<'biblioteca' | 'rituales' | 'reproducir'>('biblioteca');

  // Interactive workspaces states
  const [activeTemplateForPlayback, setActiveTemplateForPlayback] = useState<RitualTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<RitualTemplate | null>(null);

  // Dialog management states
  const [isTrackDialogOpen, setIsTrackDialogOpen] = useState(false);
  const [selectedTrackForEdit, setSelectedTrackForEdit] = useState<Track | null>(null);

  const [isEmotionDialogOpen, setIsEmotionDialogOpen] = useState(false);
  const [selectedEmotionForEdit, setSelectedEmotionForEdit] = useState<AttributeDefinition | null>(null);

  // UI state for filters/searching
  const [trackSearchQuery, setTrackSearchQuery] = useState('');
  const [trackProviderFilter, setTrackProviderFilter] = useState<'all' | 'spotify' | 'youtube' | 'local'>('all');

  // 0. OAuth (Spotify/YouTube) redirect callback: si volvemos de /callback con ?code,
  // canjea el token y limpia la URL. No bloquea el flujo de Firebase Auth.
  useEffect(() => {
    handleRedirectCallback().catch((err) => console.warn('OAuth callback:', err));
  }, []);

  // 1. Auth Listener Connection
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setAuthLoading(true);
      if (authUser) {
        setUser(authUser);
        try {
          setDbLoading(true);
          // Seed new templates, emotions & tracks if initial user
          await seedUserDataIfNeeded(authUser.uid);
          // Load data from firestore
          await reloadAllUserData(authUser.uid);
        } catch (err) {
          console.error("Error setting up client workspace:", err);
          alert("No se pudo cargar/guardar en la nube: " + describeError(err));
        } finally {
          setDbLoading(false);
        }
      } else {
        setUser(null);
        setAttributes([]);
        setTracks([]);
        setTemplates([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const reloadAllUserData = async (uid: string) => {
    const [attrs, trks, tmpls] = await Promise.all([
      fetchAttributes(uid),
      fetchTracks(uid),
      fetchTemplates(uid)
    ]);
    
    // Sort attributes - built-in first
    setAttributes(attrs.sort((a, b) => (a.builtIn ? -1 : 1)));
    setTracks(trks);
    setTemplates(tmpls);
  };

  const handleSignInGoogle = async () => {
    try {
      setAuthLoading(true);
      await signInWithGoogle();
    } catch (err) {
      console.error("Login Error:", err);
      alert("Hubo un error al ingresar con Google. Puedes usar el botón 'Facilitador Invitado' para probar la app sin restricciones.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignInGuest = async () => {
    try {
      setAuthLoading(true);
      await signInDemoGuest();
    } catch (err) {
      console.error("Guest login error:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm("¿Seguro que deseas salir del altar?")) {
      await signOutUser();
      setActiveTemplateForPlayback(null);
      setEditingTemplate(null);
    }
  };

  // ----------------------------------------------------
  // TRACK ACTIONS
  // ----------------------------------------------------
  const handleSaveTrack = async (trackFields: Omit<Track, 'id' | 'ownerId'>) => {
    if (!user) return;
    setDbLoading(true);
    try {
      if (selectedTrackForEdit) {
        // Update
        const updated: Track = {
          ...selectedTrackForEdit,
          ...trackFields
        };
        await updateTrack(user.uid, updated);
      } else {
        // Create
        await createTrack(user.uid, trackFields);
      }
      await reloadAllUserData(user.uid);
    } catch (err) {
      console.error("Error saving track:", err);
      alert("No se pudo guardar el tema: " + describeError(err));
    } finally {
      setDbLoading(false);
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (!user || !confirm("¿Seguro que deseas remover este tema de tu biblioteca ritual?")) return;
    setDbLoading(true);
    try {
      await deleteTrack(user.uid, id);
      await reloadAllUserData(user.uid);
    } catch (err) {
      console.error("Error deleting track:", err);
    } finally {
      setDbLoading(false);
    }
  };

  const handleOpenTrackCreate = () => {
    setSelectedTrackForEdit(null);
    setIsTrackDialogOpen(true);
  };

  const handleOpenTrackEdit = (track: Track) => {
    setSelectedTrackForEdit(track);
    setIsTrackDialogOpen(true);
  };

  // ----------------------------------------------------
  // EMOTION ACTIONS
  // ----------------------------------------------------
  const handleSaveEmotion = async (emotionFields: Omit<AttributeDefinition, 'id' | 'ownerId' | 'builtIn'>) => {
    if (!user) return;
    setDbLoading(true);
    try {
      if (selectedEmotionForEdit) {
        // Editar (incluye la paleta de fábrica, que es editable): preserva id/owner/builtIn.
        const updated: AttributeDefinition = { ...selectedEmotionForEdit, ...emotionFields };
        await updateAttribute(user.uid, updated);
      } else {
        await createAttribute(user.uid, emotionFields);
      }
      await reloadAllUserData(user.uid);
    } catch (err) {
      console.error("Error saving emotion:", err);
      alert("No se pudo guardar la emoción: " + describeError(err));
    } finally {
      setDbLoading(false);
    }
  };

  const handleOpenEmotionEdit = (attr: AttributeDefinition) => {
    setSelectedEmotionForEdit(attr);
    setIsEmotionDialogOpen(true);
  };

  const handleDeleteEmotion = async (id: string) => {
    if (!user || !confirm("¿Seguró que deseas eliminar completamente este descriptor emocional del altar?")) return;
    setDbLoading(true);
    try {
      await deleteAttribute(user.uid, id);
      await reloadAllUserData(user.uid);
    } catch (err) {
      console.error("Error deleting emotion:", err);
    } finally {
      setDbLoading(false);
    }
  };

  // ----------------------------------------------------
  // TEMPLATE ACTIONS
  // ----------------------------------------------------
  const handleSaveWorkspaceTemplate = async (template: RitualTemplate) => {
    if (!user) return;
    setDbLoading(true);
    try {
      if (template.id) {
        await updateTemplate(user.uid, template);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...templateFields } = template;
        await createTemplate(user.uid, templateFields);
      }
      await reloadAllUserData(user.uid);
      setEditingTemplate(null);
    } catch (err) {
      console.error("Error committing template workspace:", err);
    } finally {
      setDbLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!user || !confirm("¿De verdad quieres borrar esta plantilla ceremonial? Esta acción no se puede deshacer.")) return;
    setDbLoading(true);
    try {
      await deleteTemplate(user.uid, id);
      await reloadAllUserData(user.uid);
    } catch (err) {
      console.error("Error deleting template:", err);
    } finally {
      setDbLoading(false);
    }
  };

  // Persistir un borrador generado (colección generatedSequences).
  const handleSaveDraft = async (sequence: GeneratedSequence) => {
    if (!user) return;
    await saveSequence(user.uid, sequence);
  };

  // Limpiar y re-sembrar los datos de prueba (p. ej. tras migrar de escala).
  const handleResetTestData = async () => {
    if (!user || !confirm('Esto borra TODA tu biblioteca, paleta, plantillas y borradores, y vuelve a sembrar los datos de fábrica. ¿Continuar?')) return;
    setDbLoading(true);
    try {
      await clearUserData(user.uid, true);
      await reloadAllUserData(user.uid);
      setEditingTemplate(null);
      setActiveTemplateForPlayback(null);
    } catch (err) {
      console.error('Error reiniciando datos:', err);
    } finally {
      setDbLoading(false);
    }
  };

  const handleCreateNewTemplate = () => {
    const raw: RitualTemplate = {
      id: '',
      name: '',
      totalDurationMs: 2 * 60 * 60 * 1000, // 2 Hours
      curve: [
        { t: 0, energy: 0.2 },
        { t: 0.5, energy: 0.6 },
        { t: 1, energy: 0.2 }
      ],
      regions: [
        { id: `reg-init`, name: "Espacio Inicial", startT: 0, endT: 0.4, targets: [] },
        { id: `reg-climax`, name: "Climax Ceremonial", startT: 0.4, endT: 0.8, targets: [] },
        { id: `reg-end`, name: "Integración", startT: 0.8, endT: 1, targets: [] }
      ],
      anchors: [],
      silences: [],
      ownerId: user?.uid || ''
    };
    setEditingTemplate(raw);
  };

  // Filtering Tracks List
  const filteredTracks = tracks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(trackSearchQuery.toLowerCase()) || 
                          (t.artist && t.artist.toLowerCase().includes(trackSearchQuery.toLowerCase()));
    const matchesProvider = trackProviderFilter === 'all' || t.source.provider === trackProviderFilter;
    return matchesSearch && matchesProvider;
  });

  // Calculate format MS for UI display
  const durationInMinsDisplay = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}h ${mins % 60}m`;
    }
    return `${mins} min`;
  };

  const msToMSS = (ms: number): string => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center flex-col space-y-4 text-zinc-400" id="splash-screen">
        <Loader2 className="animate-spin text-violet-500" size={32} />
        <p className="font-display tracking-widest text-xs uppercase text-zinc-500 animate-pulse-gentle">Alineando altares musicales...</p>
      </div>
    );
  }

  // ----------------------------------------------------
  // UNATHENTICATED / LOGIN SCREEN
  // ----------------------------------------------------
  if (!user) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col justify-between p-8 relative overflow-hidden" id="login-screen">
        
        {/* Subtle decorative radial purple glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-900/10 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none dot-pattern" />

        <header className="flex justify-between items-center z-10 w-full max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-violet-600 rounded-full blur-[2px] opacity-80 animate-pulse-gentle shrink-0"></div>
            <span className="font-display font-light text-xs tracking-[0.25em] uppercase text-white">Ritual <span className="font-bold">Canindé</span></span>
          </div>
          <span className="text-[9px] bg-zinc-900/80 text-zinc-500 font-mono border border-zinc-800/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Consola Facilitador · v{APP_VERSION}
          </span>
        </header>

        <main className="max-w-md mx-auto w-full py-12 flex flex-col justify-center items-center text-center space-y-8 z-10" id="login-mainframe">
          <div className="space-y-4">
            {/* Sacred vector styled sphere */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-violet-950/40 to-indigo-950/40 border border-violet-500/30 flex items-center justify-center mb-6 mx-auto shadow-2xl relative group">
              <div className="absolute inset-0.5 rounded-full bg-violet-650 blur-[8px] opacity-25 group-hover:opacity-40 transition-opacity" />
              <span className="text-2xl z-10 relative select-none">🔮</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif italic text-white tracking-wide leading-tight" id="login-heading">
              Ritual Canindé
            </h1>
            <p className="text-xs md:text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed" id="login-subtext">
              Copiloto inteligente de curaduría y orquestación musical para ceremonias medicinales, respiraciones y meditación profunda.
            </p>
          </div>

          <div className="w-full space-y-4 pt-2" id="login-actions">
            
            {/* Google Authentication */}
            <button
              onClick={handleSignInGoogle}
              className="w-full py-3 bg-zinc-900/60 hover:bg-zinc-850/80 text-zinc-100 rounded-full border border-zinc-800/85 font-medium text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md hover:border-zinc-700 hover:text-white"
              id="google-login-btn"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.97 1 12 1 7.35 1 3.4 3.65 1.54 7.54l3.85 3C6.31 7.37 8.94 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.75-4.87 3.75-8.5z" />
                <path fill="#FBBC05" d="M5.39 10.54c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.54 2.94C.56 4.9 0 7.1 0 9.4c0 2.3.56 4.5 1.54 6.46l3.85-3.32z" />
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.3 1.09-3.06 0-5.69-2.33-6.61-5.5l-3.85 3C3.4 20.35 7.35 23 12 23z" />
              </svg>
              Google Auth
            </button>

            {/* Guest Sandbox Access */}
            <button
              onClick={handleSignInGuest}
              className="w-full py-3 px-6 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all shadow-[0_0_25px_rgba(139,92,246,0.25)] hover:shadow-[0_0_35px_rgba(139,92,246,0.35)] cursor-pointer"
              id="guest-login-btn"
            >
              Ingresar como Facilitador Demo
            </button>

            <div className="p-4 bg-violet-950/10 rounded-xl text-left text-xs text-violet-300/90 border border-violet-900/20" id="login-iframe-notice">
              <span className="font-bold block mb-1 text-violet-200">🔮 ¿Bloqueos de ventana popup?</span>
              Si estás en el visor de AI Studio, haz click en <strong className="text-white bg-violet-900/40 px-1 py-0.5 rounded">Facilitador Demo</strong> para acceder instantáneamente sin abrir popups externos.
            </div>
          </div>
        </main>

        <footer className="text-center text-[10px] text-zinc-600 font-mono z-10" id="login-footer">
          Ritual Canindé es Offline-First & Privacy Conscious. Sostiene tu altar musical.
        </footer>
      </div>
    );
  }

  // ----------------------------------------------------
  // WORKSPACE ROUTER (ACTIVE WORKSPACE OVERLAYS)
  // ----------------------------------------------------

  // A. Template designer overlay workspace active
  if (editingTemplate) {
    return (
      <div className="min-h-screen bg-[#07070a] text-zinc-100 p-6">
        <div className="max-w-7xl mx-auto">
          <TemplateEditor 
            template={editingTemplate}
            attributes={attributes}
            tracks={tracks}
            onBack={() => setEditingTemplate(null)}
            onSave={handleSaveWorkspaceTemplate}
          />
        </div>
      </div>
    );
  }

  // B. Ceremonial timeline live player active
  if (activeTemplateForPlayback) {
    return (
      <div className="min-h-screen bg-[#07070a] text-zinc-100 p-6">
        <div className="max-w-7xl mx-auto">
          <TimelineView
            template={activeTemplateForPlayback}
            tracks={tracks}
            attributes={attributes}
            onBack={() => setActiveTemplateForPlayback(null)}
            onSaveDraft={handleSaveDraft}
          />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN DASHBOARD (TABS COMPARTMENT)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200 flex flex-col justify-between" id="dashboard-layout">
      
      {/* 1. Header Navigation Panel (Immersive UI style) */}
      <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-8 bg-black/80 sticky top-0 z-30" id="navigator-header">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-full blur-[2px] opacity-80 animate-pulse-gentle shrink-0"></div>
            <div className="flex flex-col leading-none">
              <h1 className="text-lg md:text-xl font-light tracking-widest uppercase text-white font-display">
                Ritual <span className="font-bold">Canindé</span>
              </h1>
              <span className="text-[9px] text-zinc-500 font-mono tracking-wider mt-1" id="app-version">v{APP_VERSION}</span>
            </div>
          </div>

          {/* Navigation Controls (Flat typography links with border-b highlight as per design template) */}
          <nav className="flex gap-6 md:gap-8 items-center text-xs md:text-sm font-medium tracking-wide uppercase" id="nav-tabs">
            <button
              onClick={() => setActiveTab('biblioteca')}
              className={`pb-1 transition-all cursor-pointer font-semibold ${
                activeTab === 'biblioteca' 
                  ? 'text-violet-400 border-b-2 border-violet-500' 
                  : 'text-zinc-500 hover:text-white'
              }`}
              id="tab-biblioteca-lnk"
            >
              Biblioteca
            </button>
            <button
              onClick={() => setActiveTab('rituales')}
              className={`pb-1 transition-all cursor-pointer font-semibold ${
                activeTab === 'rituales' 
                  ? 'text-violet-400 border-b-2 border-violet-500' 
                  : 'text-zinc-500 hover:text-white'
              }`}
              id="tab-rituales-lnk"
            >
              Rituales
            </button>
            <button
              onClick={() => setActiveTab('reproducir')}
              className={`pb-1 transition-all cursor-pointer font-semibold ${
                activeTab === 'reproducir' 
                  ? 'text-violet-400 border-b-2 border-violet-500' 
                  : 'text-zinc-500 hover:text-white'
              }`}
              id="tab-play-lnk"
            >
              Reproducir
            </button>
          </nav>

          {/* User Section (Pill with avatar/initials as per template) */}
          <div className="flex items-center gap-3" id="user-pill">
            <div className="flex items-center gap-2.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800/80">
              <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 font-bold font-mono">
                {user.displayName ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'JD'}
              </div>
              <span className="hidden sm:inline text-xs text-zinc-400 font-medium">
                {user.displayName || 'Facilitador'}
              </span>
            </div>
            
            <button
              onClick={handleSignOut}
              className="p-1 px-2 py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-950/40 transition-all cursor-pointer"
              title="Salir del Altar"
              id="sign-out-btn"
            >
              <LogOut size={13} />
            </button>
          </div>

        </div>
      </header>

      {/* 2. Central Active View Canvas */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1" id="main-canvas">
        
        {dbLoading && (
          <div className="fixed top-20 right-6 bg-violet-950 border border-violet-850 px-3.5 py-1.5 text-xs text-violet-200 rounded-lg shadow-xl flex items-center gap-2 z-50 animate-bounce">
            <Loader2 className="animate-spin" size={13} />
            Sincronizando con Firestore Nube...
          </div>
        )}

        {/* ------------------------------------------------------------------------------------------------ */}
        {/* TABA 1: BIBLIOTECA (MUSIC + CUSTOM EMOTIONS) */}
        {/* ------------------------------------------------------------------------------------------------ */}
        {activeTab === 'biblioteca' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="biblioteca-grid">
            
            {/* LADO IZQUIERDO: LISTA DE TEMAS (8/12) */}
            <div className="lg:col-span-8 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/10 p-5 rounded-2xl border border-zinc-800/60 relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] dot-pattern" />
                <div className="relative z-10">
                  <h2 className="text-xl font-serif italic text-white flex items-center gap-2">
                    Canciones del Ritual
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">La música sagrada que conformará tus playlists con climas profundos.</p>
                </div>
                <button
                  onClick={handleOpenTrackCreate}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] cursor-pointer shrink-0 relative z-10"
                  id="insert-track-trigger"
                >
                  Agregar Tema
                </button>
              </div>

              {/* SEARCH & FILTERS BAR */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3" id="filters-container">
                <div className="sm:col-span-8 flex items-center bg-zinc-900/40 rounded-full border border-zinc-800/80 px-4 py-2 gap-2.5">
                  <Search size={14} className="text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Buscar por título o artista de medicina..."
                    value={trackSearchQuery}
                    onChange={(e) => setTrackSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-white focus:outline-none w-full"
                  />
                </div>
                
                <div className="sm:col-span-4 select-none">
                  <select
                    value={trackProviderFilter}
                    onChange={(e) => setTrackProviderFilter(e.target.value as any)}
                    className="w-full bg-zinc-900/40 rounded-full border border-zinc-800/80 text-zinc-300 px-4 py-2 text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todas las Fuentes</option>
                    <option value="spotify">🟢 Spotify</option>
                    <option value="youtube">🔴 YouTube</option>
                    <option value="local">💾 Local</option>
                  </select>
                </div>
              </div>

              {/* TRACK CARDS GRID */}
              {filteredTracks.length === 0 ? (
                <div className="text-center py-16 border border-zinc-800/60 bg-zinc-950/20 rounded-2xl relative overflow-hidden" id="empty-tracks">
                  <div className="absolute inset-0 opacity-[0.02] dot-pattern" />
                  <span className="text-3xl relative z-10">🏜️</span>
                  <p className="text-xs text-zinc-500 mt-2 tracking-wider uppercase relative z-10 select-none">No se encontraron temas en el altar.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="tracks-cards-grid">
                  {filteredTracks.map(t => {
                    return (
                      <div 
                        key={t.id} 
                        className="bg-zinc-900/10 hover:bg-zinc-900/30 rounded-2xl border border-zinc-800/60 p-5 flex flex-col justify-between hover:border-violet-900/40 transition-all space-y-4 shadow-md group relative overflow-hidden"
                        id={`track-card-${t.id}`}
                      >
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-violet-600/0 group-hover:bg-violet-600/20 transition-all" />
                        {/* Upper part metadata */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[10px] font-mono text-zinc-500 block">
                              Duración: {msToMSS(t.durationMs)}
                            </span>
                            <h3 className="text-sm font-bold text-white truncate pr-2" title={t.title}>
                              {t.title}
                            </h3>
                            <p className="text-xs text-zinc-400 truncate">
                              {t.artist || 'Sin artista'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 bg-zinc-900 border border-zinc-800 p-0.5 rounded text-[10px] text-zinc-400 px-2 font-mono">
                            {t.source?.provider === 'spotify' && '🟢 Spotify'}
                            {t.source?.provider === 'youtube' && '🔴 video'}
                            {t.source?.provider === 'local' && '💾 local'}
                          </div>
                        </div>

                        {/* Middle emotional tags list */}
                        <div className="flex flex-wrap gap-1.5" id={`track-card-tags-${t.id}`}>
                          {t.tags.map(tag => {
                            const attr = attributes.find(at => at.id === tag.defId);
                            if (!attr) return null;

                            return (
                              <span 
                                key={tag.defId} 
                                className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300"
                              >
                                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: attr.color }} />
                                {attr.name}
                                {attr.kind === 'intensity' && ` (${tag.value})`}
                              </span>
                            );
                          })}
                        </div>

                        {/* Lower Action buttons */}
                        <div className="border-t border-zinc-900 pt-3 flex justify-end gap-1.5" id="track-card-actions">
                          <button
                            onClick={() => handleOpenTrackEdit(t)}
                            className="p-1 px-2.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-violet-400 text-xs flex items-center gap-1 cursor-pointer"
                            id={`edit-track-btn-${t.id}`}
                          >
                            <Edit size={12} /> Editar
                          </button>
                          <button
                            onClick={() => handleDeleteTrack(t.id)}
                            className="p-1 px-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded transition-colors cursor-pointer"
                            id={`delete-track-btn-${t.id}`}
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

                     {/* LADO DERECHO: EMOCIONES / ATRIBUTOS EDITABLE PALLET (4/12) */}
            <div className="lg:col-span-4 space-y-5 bg-zinc-950/25 border border-zinc-800/50 p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03] dot-pattern" />
              <div className="flex justify-between items-center pb-3 border-b border-zinc-800/50 relative z-10">
                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-bold">
                    Clima Emocional
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1">La paleta de curaduría.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedEmotionForEdit(null);
                    setIsEmotionDialogOpen(true);
                  }}
                  className="px-3 py-1 bg-violet-950/40 hover:bg-violet-900/40 border border-violet-800/60 rounded-full text-[10px] uppercase font-bold text-violet-300 cursor-pointer tracking-wider"
                  id="insert-emotion-trigger"
                >
                  🔮 Nueva
                </button>
              </div>

              <div className="space-y-3.5 relative z-10" id="emotions-pallet-list">
                {attributes.map(attr => {
                  return (
                    <div 
                      key={attr.id} 
                      className="group flex items-center gap-3 cursor-pointer text-xs transition-colors"
                      id={`emotion-badge-${attr.id}`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: attr.color }} />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-zinc-300 group-hover:text-white font-medium transition-colors">{attr.name}</span>
                        <span className="text-[9px] text-zinc-500 font-mono block tracking-tight">
                          {attr.kind === 'intensity' && 'Intensidad 1–10'}
                          {attr.kind === 'category' && `Opciones [${attr.options?.length || 0}]`}
                          {attr.kind === 'flag' && 'Interruptor'}
                          {attr.builtIn && ' • Fábrica'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => handleOpenEmotionEdit(attr)}
                          className="text-zinc-600 hover:text-violet-400 p-1 rounded"
                          title={attr.builtIn ? 'Editar dimensión de fábrica' : 'Editar dimensión propia'}
                          id={`edit-emotion-btn-${attr.id}`}
                        >
                          <Edit size={12} />
                        </button>
                        {!attr.builtIn && (
                          <button
                            onClick={() => handleDeleteEmotion(attr.id)}
                            className="text-zinc-600 hover:text-red-400 p-1 rounded"
                            title="Eliminar dimensión propia"
                            id={`delete-emotion-btn-${attr.id}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------------------------------------------ */}
        {/* TABA 2: TEMPLATES RITUALS (WORKSPACER TRIGGER) */}
        {/* ------------------------------------------------------------------------------------------------ */}
        {activeTab === 'rituales' && (
          <div className="space-y-6" id="templates-tab">
            <div className="flex justify-between items-center bg-zinc-900/10 p-5 rounded-2xl border border-zinc-800/60 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03] dot-pattern" />
              <div className="relative z-10">
                <h2 className="text-xl font-serif italic text-white flex items-center gap-2">
                  Rituales y Ceremonias
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Diseña la topografía energética y los ritmos de cada pasaje ceremonial.</p>
              </div>

              <button
                onClick={handleCreateNewTemplate}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] cursor-pointer shrink-0 relative z-10"
                id="create-template-trigger"
              >
                Crear Ceremonia
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-20 border border-zinc-800/60 bg-zinc-950/20 rounded-2xl relative overflow-hidden" id="empty-templates">
                <div className="absolute inset-0 opacity-[0.02] dot-pattern" />
                <span className="text-4xl relative z-10">🧘‍♂️</span>
                <p className="text-sm text-zinc-500 mt-2 relative z-10">No has diseñado plantillas rituales de ceremonia aún.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" id="templates-grid">
                {templates.map(tmp => {
                  return (
                    <div 
                      key={tmp.id} 
                      className="bg-zinc-900/10 rounded-2xl border border-zinc-800/60 p-6 flex flex-col justify-between hover:border-violet-900/40 hover:bg-zinc-900/25 transition-all space-y-4 shadow-md group relative overflow-hidden"
                      id={`template-card-${tmp.id}`}
                    >
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-violet-600/0 group-hover:bg-violet-600/20 transition-all" />
                      <div className="space-y-3 relative z-10">
                        <span className="inline-block text-[9px] bg-violet-950/40 text-violet-300 font-mono border border-violet-900/30 px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider">
                          Duración: {durationInMinsDisplay(tmp.totalDurationMs)}
                        </span>
                        
                        <h3 className="text-lg font-serif italic text-white leading-snug">
                          {tmp.name}
                        </h3>

                        {/* Summarized properties */}
                        <div className="grid grid-cols-2 gap-2.5 pt-2 text-[10.5px] text-zinc-400">
                          <div className="bg-zinc-950/60 border border-zinc-800/50 p-2.5 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Fases</span>
                            <span className="text-zinc-200 font-bold">{tmp.regions?.length || 0} Regiones</span>
                          </div>
                          <div className="bg-zinc-950/60 border border-zinc-800/50 p-2.5 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Silencios</span>
                            <span className="text-zinc-200 font-bold">{tmp.silences?.length || 0} Intervalos</span>
                          </div>
                          <div className="bg-zinc-950/60 border border-zinc-800/50 p-2.5 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Flujo Fondo</span>
                            <span className="text-zinc-200 font-bold">{tmp.ambient?.enabled ? `Activo` : 'Inactivo'}</span>
                          </div>
                          <div className="bg-zinc-950/60 border border-zinc-800/50 p-2.5 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Anclas</span>
                            <span className="text-zinc-200 font-bold">{tmp.anchors?.length || 0} Temas</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions toolbar */}
                      <div className="flex items-center gap-2 pt-4 border-t border-zinc-800/50 relative z-10" id="template-card-toolbar">
                        <button
                          onClick={() => setActiveTemplateForPlayback(tmp)}
                          className="flex-1 py-2 px-3 bg-violet-600 hover:bg-violet-500 text-white font-bold uppercase tracking-wider rounded-full text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(139,92,246,0.25)]"
                          id={`play-template-btn-${tmp.id}`}
                        >
                          Orquestar
                        </button>
                        
                        <button
                          onClick={() => setEditingTemplate(tmp)}
                          className="p-2 bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white rounded-full text-[11px] cursor-pointer"
                          id={`edit-template-btn-${tmp.id}`}
                          title="Editar"
                        >
                          <Edit size={12} />
                        </button>

                        <button
                          onClick={() => handleDeleteTemplate(tmp.id)}
                          className="p-2 bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-red-400 rounded-full text-[11px] cursor-pointer"
                          id={`delete-template-btn-${tmp.id}`}
                          title="Borrar"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------------------------------------ */}
        {/* TABA 3: REPRODUCIR (LAUNCH TRANSITION COMPONENT) */}
        {/* ------------------------------------------------------------------------------------------------ */}
        {activeTab === 'reproducir' && (
          <div className="space-y-6" id="playback-tab">
            <div className="flex justify-between items-center bg-zinc-900/10 p-5 rounded-2xl border border-zinc-800/60 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03] dot-pattern" />
              <div className="relative z-10">
                <h2 className="text-xl font-serif italic text-white flex items-center gap-2">
                  Comenzar Ceremonia
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Selecciona un altar para orquestar la música en base a los climas emocionales.</p>
              </div>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-16 border border-zinc-900 bg-zinc-950/20 rounded-xl">
                <span className="text-3xl">🏜️</span>
                <p className="text-sm text-zinc-500 mt-2">Crea primero una plantilla de altar desde la sección "Rituales" para comenzar.</p>
              </div>
            ) : (
              <div className="max-w-xl mx-auto space-y-4" id="play-picker">
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest text-center">Selecciona la plantilla de viaje</span>
                <div className="space-y-3">
                  {templates.map(tmp => (
                    <button
                      key={tmp.id}
                      onClick={() => setActiveTemplateForPlayback(tmp)}
                      className="w-full text-left p-4 rounded-xl bg-zinc-950 border border-zinc-850 hover:border-violet-600 hover:bg-zinc-950/40 transition-all flex justify-between items-center group cursor-pointer"
                      id={`play-picker-btn-${tmp.id}`}
                    >
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-violet-400 leading-tight">
                          {tmp.name}
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-mono tracking-wider">
                          DURACIÓN ESTIMADA: {durationInMinsDisplay(tmp.totalDurationMs)}
                        </span>
                      </div>
                      <span className="text-xs p-2 rounded-full border border-zinc-800 group-hover:border-violet-600 bg-zinc-900 text-violet-400">
                        <Play size={12} fill="currentColor" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* 3. Global Dashboard Footer */}
      <footer className="border-t border-zinc-900 bg-[#060608] px-6 py-6" id="navigator-footer">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-xs text-zinc-500 gap-4">
          <div className="flex items-center gap-3">
            <p>© 2026 Ritual Canindé - Orquestador y Guardián de Medicina Sagrada.</p>
            <button
              onClick={handleResetTestData}
              className="text-[10px] text-zinc-600 hover:text-red-400 border border-zinc-850 hover:border-red-950/50 rounded-full px-2 py-0.5 transition-colors cursor-pointer"
              title="Borra y vuelve a sembrar los datos de fábrica"
              id="reset-test-data-btn"
            >
              Reiniciar datos
            </button>
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Base Firestore Sincronizada
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              Módulo Core TS Reservado para Integración
            </span>
          </div>
        </div>
      </footer>

      {/* 4. Modular Interactive dialog overlays */}
      <TrackDialog 
        isOpen={isTrackDialogOpen}
        onClose={() => setIsTrackDialogOpen(false)}
        attributes={attributes}
        onSave={handleSaveTrack}
        track={selectedTrackForEdit}
      />

      <EmotionDialog 
        isOpen={isEmotionDialogOpen}
        onClose={() => setIsEmotionDialogOpen(false)}
        attribute={selectedEmotionForEdit}
        onSave={handleSaveEmotion}
      />

    </div>
  );
}
