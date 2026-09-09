# LABEL_OS — Admin (KERNEL)

Fecha: 2026-08-12 · Estado: propuesto

> La prosa va en español porque es el documento que se revisa. Todo lo que
> viaja al código —nombres de archivo, tipos, campos, rutas— va en inglés,
> como el resto del repositorio.

## 1. Qué se construye

Una consola de administración en `/admin` que gestiona lo esencial del sello:

- **Releases** — alta, edición y baja del catálogo.
- **Artists** — alta, edición y baja del roster.
- **Events** — eventos en línea, con enlace al directo, flyer de invitación y
  schedule por horas.
- **En transmisión** — marcar qué release carga el hero de `01 SYSTEM`.

Solo frontend. Los datos viven en `localStorage` detrás de una interfaz que
Firestore va a implementar después sin que la UI cambie.

## 2. Decisiones tomadas

| Decisión | Elegido | Por qué |
| :-- | :-- | :-- |
| Persistencia | `localStorage` tras una interfaz de repositorio | Editas y lo ves en el sitio al instante; migrar a Firestore es escribir un adaptador |
| Ubicación | Ruta `/admin`, lenguaje LABEL_OS | Fuera del bundle público; hereda los tokens sin ser otra app |
| Flyer / portadas / audio | Campo de texto con ruta o URL | No hay subida de archivos; coherente con `cover: "/cover.png"`, que ya funciona así |
| Artistas del line-up | Texto libre + enlace opcional al roster | Los invitados externos no deben inflar `roster.length`, que alimenta el contador del hero |
| Track destacado | A nivel release | Cada release tiene un archivo; Bandcamp es dueño del tracklist |
| Autenticación | Ninguna por ahora | Llega con Firebase Auth junto a Firestore; un gate falso hoy es trabajo que se tira |
| Zona horaria | Etiqueta por evento, sin conversión | El flyer es la fuente; convertir haría que el sitio lo contradiga |

## 3. La costura de datos

```
src/lib/store/
  types.ts      Snapshot y los shapes compartidos
  store.ts      la interfaz + el singleton vivo
  local.ts      adaptador localStorage
  seed.ts       data.ts como contenido inicial
  firestore.ts  ← después
```

### Interfaz

```ts
interface Snapshot {
  releases: Release[];
  artists: Artist[];
  events: LabelEvent[];
  /** Número de catálogo del release en transmisión. */
  featured: string | null;
  /** De dónde salió lo que estás viendo. Se muestra en la cabecera. */
  origin: "seed" | "local";
}

interface Store {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;

  saveRelease(release: Release): Promise<void>;
  removeRelease(cat: string): Promise<void>;
  saveArtist(artist: Artist): Promise<void>;
  removeArtist(key: string): Promise<void>;
  saveEvent(event: LabelEvent): Promise<void>;
  removeEvent(id: string): Promise<void>;
  setFeatured(cat: string): Promise<void>;
  resetToSeed(): Promise<void>;
}
```

### Reglas que no son negociables

- **Las escrituras son `async` desde el día uno**, aunque `localStorage` sea
  síncrono. Las de Firestore lo serán. Si hoy fueran síncronas, el admin
  nacería sin estados de guardando/error y habría que tocar cada punto de
  llamada al migrar. El adaptador local resuelve la promesa de inmediato.
- **La lectura inicial es síncrona.** `deck` se construye a nivel de módulo en
  `audio.ts` y necesita un release antes del primer render. `localStorage` lo
  permite; el adaptador de Firestore tendrá que arrancar desde la semilla y
  reemplazarla cuando llegue la primera respuesta.
- **`subscribe` + `getSnapshot` es el par que ya usa `deck`**, consumido con
  `useSyncExternalStore`. No se introduce un patrón nuevo.
- **`resetToSeed()` es una salida de emergencia, no un adorno.** Sin ella, un
  dato guardado que rompa una vista solo se arregla desde DevTools.

### Persistencia

- Clave: `kiseki.store.v1`.
- Payload: `{ version: 1, releases, artists, events, featured }`.
- Al arrancar: si falta, no parsea, o la versión no coincide → siembra desde
  `data.ts` y escribe. Un dato viejo nunca puede tumbar la app.
- **Sincronía entre pestañas:** el evento `storage` de `window` re-lee y
  notifica. Editas en `/admin` y la pestaña del sitio se actualiza sola.

### Derivados

- `roster` = `artists.filter((a) => a.roster)`.
- Los conteos del hero salen de los arrays, como hoy.
- El estado de un evento se deriva de su fecha (§5).

## 4. Cambios en `data.ts`

Deja de ser la fuente y pasa a ser la semilla. Se quedan donde están los tipos
y las funciones puras: `label`, `TYPE_LABEL`, `releaseMeta`, `mulberry32`,
`hash`, `formatTime`, `shop`.

`artistByKey`, `releaseByCat` y `releasesByArtist` **siguen siendo funciones de
módulo**, pero leen `store.getSnapshot()` por dentro. Eso deja intactos a sus
cinco consumidores (`ReleaseBackground`, `ReleaseArtwork`, `ReleaseInfo`,
`TransportDock`, `ArchiveView`): siempre se renderizan bajo un componente que sí
está suscrito, así que se repintan cuando el dato cambia.

`label` **no se administra**: la identidad del sello (nombre, kana, géneros,
tagline, etimología, manifiesto) se sigue editando en `data.ts`. No lo pediste
y no cambia con la frecuencia que justifica una pantalla.

### El orden del catálogo

Hoy `releases` es `[...REAL_RELEASES, ...GENERATED_RELEASES]`, con los reales
primero para que el deck arranque cargando el disco real más nuevo. Con
`featured` explícito ese truco sobra: el catálogo se ordena por `date`
descendente y el hero carga lo que esté marcado. Hay que actualizar `CLAUDE.md`,
que documenta el orden viejo como intencional.

## 5. Cambio de modelo: `LabelEvent`

El modelo actual es de eventos presenciales. `venue`, `city` y los estados
`TICKETS` / `SOLD OUT` no aplican a un evento en línea.

```ts
export interface LabelEvent {
  id: string;
  /** 2026.09.12 */
  date: string;
  name: string;
  /** TWITCH · YOUTUBE — ocupa el lugar que tenía el venue. */
  platform?: string;
  /** Enlace al directo. Sin él, la tarjeta muestra un hueco, no un enlace muerto. */
  stream?: string;
  /** Ruta o URL de la invitación. */
  flyer?: string;
  /** JST · GMT-6. Se muestra, nunca se convierte. */
  timezone: string;
  schedule: Slot[];
}

export interface Slot {
  /** HH:MM */
  start: string;
  end?: string;
  /** Como va en el flyer. */
  artist: string;
  /** Enlace opcional a la ficha del roster. */
  artistKey?: string;
}
```

**No hay campo `state`.** Se deriva de `date`: futuro → `SCHEDULED`, pasado →
`ENDED`. Un campo manual que dice "TICKETS" sobre un evento de hace tres meses
es exactamente la deriva que el proyecto evita en todos lados.

El `id` se genera al crear (`hash(date + name)`), porque el nombre y la fecha
pueden editarse y la llave no puede moverse bajo los pies del schedule.

## 6. Qué cambia en el sitio público

Siete componentes leen los arrays directamente y pasan a un hook
`useCatalogue()`:

| Archivo | Qué lee |
| :-- | :-- |
| `LabelOS.tsx` | `releases.length` **a nivel de módulo**, dentro de `VIEWS` |
| `BootSequence.tsx` | `releases.length`, `roster.length` |
| `SignalPanel.tsx` | `releases`, `roster` |
| `ReleaseDatabase.tsx` | `releases` |
| `ArtistsView.tsx` | `releases`, `roster` |
| `ArchiveView.tsx` | `releases` |
| `EventsView.tsx` | `events` |

El de `LabelOS.tsx` tiene filo: la línea `"38 RELEASES FOUND"` de la secuencia
de acceso se arma a nivel de módulo, así que hoy la cifra se congelaría en la
del build. `VIEWS` pasa a construirse dentro del componente con `useMemo`.

`audio.ts` deja de tomar `releases[0]` y arranca con el marcado; si ese
catálogo ya no existe, cae a `releases[0]` en vez de quedarse sin disco.

### EventsView

Cada evento gana dos acciones, además del enlace al directo:

- **VER INVITACIÓN** — abre el flyer.
- **SCHEDULE** — despliega las horas. Los nombres con `artistKey` enlazan a su
  ficha; los demás son texto.

### La limitación honesta: `<noscript>`

`src/pages/index.astro` arma su listado de catálogo **en tiempo de build** y no
puede leer `localStorage`. Ese listado seguirá mostrando la semilla de
`data.ts`, no el store vivo. Con Firestore sigue igual mientras el sitio compile
estático. Es aceptable —es un fallback para quien no tiene JS— pero hay que
saberlo y no perseguirlo como bug.

## 7. Las pantallas

```
┌────────────────────────────────────────────────────────────────────────┐
│ KISEKI_OS · KERNEL               LOCAL STORE · 38/12/6   [RESET SEED]  │
├──────────────┬─────────────────────────────────────────────────────────┤
│ 01 RELEASES  │ RELEASES                              [ + NEW RELEASE ] │
│ 02 ARTISTS   │ ─────────────────────────────────┬───────────────────── │
│ 03 EVENTS    │ ● KSK-038  草SpeedRebirth        │  CAT    [KSK-038  ]  │
│              │   KSK-037  ANTIGRAVITY SUGAR     │  TITLE  [草Speed… ]  │
│              │   KSK-036  夜明けのBPM            │  ARTIST [kernbre… ▾] │
│              │   …                              │  ┌──────┐            │
│              │                                  │  │ prev │  HUE  ▓▓▓░ │
│              │                                  │  └──────┘            │
│              │                                  │  [ ● EN TRANSMISIÓN ]│
│              │                                  │  [ GUARDAR ] [ ✕ ]   │
└──────────────┴──────────────────────────────────┴──────────────────────┘
```

Maestro/detalle en las tres pestañas. El admin es otro island con su propia
`AdminKey` en state, mismo patrón que `LabelOS`, sin router.

### 01 RELEASES

Campos: `cat`, `title`, `artist` (select del roster), `type`, `date`, `tracks`,
`bpm`, `duration`, `audio`, `cover`, `desktopArtwork`, `bandcamp`.

Dos que no se capturan a mano:

- **`seed`** se deriva de `hash(cat + title)`, igual que en `data.ts`. No es
  editable, y la pantalla avisa que **cambiar el catálogo o el título cambia la
  portada generada** — es un efecto invisible que muerde meses después.
- **`hue`** se muestrea de la portada cuando la hay, con override manual.

Al lado, un preview en vivo con el mismo `artwork.ts` del sitio: se ve la
portada real o la generada antes de guardar.

El botón **EN TRANSMISIÓN** marca el release del hero. Marcar uno desmarca el
anterior; nunca hay dos ni ninguno.

### 02 ARTISTS

Campos: `key` (slug, llave), `name`, `kana`, `genres` (chips), `since`, `base`,
`active`, `roster`.

La pantalla explica que `roster: false` es un crédito de catálogo (tipo V.A.) y
no un miembro del sello, porque es lo que separa `012 ARTISTS` de la lista
completa.

**Borrar un artista con releases queda bloqueado**, con el conteo a la vista:
"3 releases dependen de este artista".

### 03 EVENTS

Campos: `date`, `name`, `platform`, `stream`, `flyer` (con preview),
`timezone`, y el editor de `schedule`.

El schedule son filas de hora / artista / enlace opcional al roster, ordenadas
por hora al guardar. Añadir y quitar filas sin recargar el formulario.

## 8. Validación

| Campo | Regla |
| :-- | :-- |
| `cat` | `KSK-###`, único en el catálogo |
| `date` | `YYYY.MM.DD`, fecha real |
| `Artist.key` | slug en minúsculas, único |
| `Slot.start` / `end` | `HH:MM` |
| `audio`, `cover`, `desktopArtwork`, `flyer`, `stream`, `bandcamp` | empieza por `http` o `/` |
| `tracks`, `bpm`, `duration` | entero ≥ 0; `0` significa desconocido |

La validación es inline, al salir del campo, y bloquea el guardado. Los errores
dicen qué pasó y cómo arreglarlo, sin disculparse.

## 9. Estados y errores

- Cada formulario: **guardando / guardado / error**, con el error del store a la
  vista (`localStorage` lleno es el caso real).
- Cambiar de registro con cambios sin guardar **avisa antes de descartarlos**.
- `RESET SEED` pide confirmación y dice exactamente qué borra.
- Lista vacía: invitación a crear el primero, no un espacio en blanco.

## 10. Fuera de alcance

Shop, archive, subida de archivos, login, historial/undo, multi-usuario,
edición de la identidad del sello (`label`).

## 11. Migrar a Firestore, después

Se escribe `store/firestore.ts` implementando `Store` y se cambia qué adaptador
monta `store.ts`. No cambia: la UI del admin, los hooks, las vistas públicas,
ni los tipos. Sí hay que resolver dos cosas que el adaptador local esconde:

1. **La lectura inicial deja de ser síncrona.** El arranque parte de la semilla
   y se reemplaza cuando llega la primera respuesta.
2. **Reglas de seguridad y Auth**, que hoy no existen porque `/admin` está
   abierta.

## 12. Pendiente

**La imagen de la invitación no ha llegado.** El shape de `Slot` (hora, hora
final opcional, artista) es una suposición. Si el flyer trae b2b, bloques,
duraciones o hosts, `Slot` cambia y con él el editor de schedule. Es más barato
corregirlo antes de implementar.
