<div align="center">
  <h1>🔮 Ritual Canindé</h1>
  <p><em>Copiloto de curaduría y orquestación musical para meditaciones y ceremonias con medicinas sagradas.</em></p>
</div>

Ritual Canindé es el **copiloto de un facilitador**, no un autopiloto: ayuda a curar
música por su **clima emocional** y a orquestar el viaje de una ceremonia, dejando
siempre un **borrador editable**. App hermana de CanindéChords (mismo stack).

## Stack

- **React 19 + Vite 6 + TypeScript** · **Tailwind v4** (config CSS-first).
- **Firebase** (Auth + Firestore, base con id custom).
- **`src/ritual-core`**: núcleo puro de TypeScript (sin framework ni proveedores),
  cubierto por tests (Vitest). Es la fuente de verdad del modelo y del motor.

## Arquitectura (ports & adapters)

El núcleo define **modelo**, **secuenciador** (`generate`), **validación**, y los
**puertos** de persistencia (`Repository<T>`), reproducción (`PlaybackEngine`) y auth
(`AuthSession`). Los **adaptadores concretos viven en la app** y se inyectan:

| Puerto del núcleo | Adaptador de la app |
|---|---|
| `Repository<T>` | `src/services/firestoreRepository.ts` (Firestore por `ownerId`) |
| `PlaybackEngine` | `src/services/playback/{webAudio,youtube,spotify}Engine.ts` |
| `AuthSession` + `TokenStore` | `src/services/auth/oauthSessions.ts` (PKCE + localStorage) |

El modelo de la app usa la **misma escala que el núcleo (0..1)**; la UI muestra % y
convierte en el borde del input. El puente `src/services/coreMapping.ts` quedó mínimo:
pasa las entidades directo a `generate()`/`validateTemplate()` y sólo traduce la
secuencia generada al view-model de la timeline.

### Reglas de producto

- Clasificación **emocional** (intensidad 1–10 + categóricas + flags); la paleta de
  fábrica es **editable** y se pueden crear clasificaciones propias.
- Los **datos técnicos (tono Camelot / BPM)** nunca se muestran: viven en
  `track.audioMeta` y sólo los usa el motor de empalmes.
- Spotify / YouTube / local son **iguales en la capa creativa**. La playlist generada
  es un **borrador editable**.

## Reproducción (Fase 6)

- **Local** → Web Audio API (fades reales; único con crossfade real y offline).
- **YouTube** → IFrame Player API con **reproductor visible obligatorio**.
- **Spotify** → Web Playback SDK (requiere **Premium** + OAuth Authorization Code+PKCE;
  dev mode hasta 5 usuarios).

Sin credenciales, la reproducción cae en **modo simulación** (la app sigue siendo útil
para curar y previsualizar el borrador). La línea de tiempo avanza por reloj de pared,
así que progresa aunque un SDK falle.

## Configuración

1. Instalar dependencias: `npm install`
2. Copiar `.env.example` a `.env.local` y completar:
   - `GEMINI_API_KEY` (inyectado por AI Studio en runtime).
   - Para playback real (opcional): `VITE_SPOTIFY_CLIENT_ID`, `VITE_YOUTUBE_CLIENT_ID`,
     `VITE_OAUTH_REDIRECT_URI` (por defecto `<origin>/callback`).
3. Desplegar reglas de Firestore: `firebase deploy --only firestore:rules`
   (ver `firestore.rules`: acceso por `ownerId`).
4. Correr la app: `npm run dev`

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Build de producción |
| `npm run lint` | `tsc --noEmit` (chequeo de tipos) |
| `npm test` | Tests del núcleo + adaptadores (Vitest) |
| `npm run demo:run` | Genera una ceremonia de ejemplo por consola |

## Datos de prueba

Al primer login se siembran paleta, biblioteca y una plantilla de ejemplo. El botón
**"Reiniciar datos"** (footer) borra las colecciones y re-siembra de fábrica.

---

View in AI Studio: https://ai.studio/apps/44008411-4d7f-44ef-a0d8-414d9fdceb4e
