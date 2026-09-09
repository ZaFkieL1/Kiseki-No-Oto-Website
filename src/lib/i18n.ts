/**
 * Language.
 *
 * The label is Colombian, so Spanish is not a translation of the site — it is
 * the site, and English is the second door. That is why `es` is the default
 * and the toggle in the bar reads as a switch rather than a flag menu.
 *
 * A fourth `subscribe`/`getSnapshot` singleton, alongside `deck`, `store` and
 * `session`, and consumed the same way: components call `useLang()` to
 * subscribe and `t()` to read. Keeping the choice outside React state is what
 * lets it survive every view change, and it is remembered in `localStorage`
 * so it survives the next visit too.
 *
 * **The dictionary is typed against `es`**, so a key added to one language and
 * forgotten in the other is a build error rather than an English word sitting
 * in the middle of a Spanish page.
 */

export type Lang = "es" | "en";

const STORAGE = "kno.lang";

/* -------------------------------------------------------------------------
   the words
   ------------------------------------------------------------------------- */

const es = {
  /* chassis */
  "nav.system": "Sistema",
  "nav.releases": "Lanzamientos",
  "nav.artists": "Artistas",
  "nav.events": "Eventos",
  "bar.online": "En línea",
  "bar.standby": "En espera",
  "bar.lang": "Cambiar idioma",
  "cursor.open": "abrir",

  /* the boot log — a machine talking to itself, so it stays in caps */
  "boot.init": "INICIALIZANDO...",
  "boot.audio": "MOTOR DE AUDIO",
  "boot.visual": "MOTOR VISUAL",
  "boot.database": "BASE DE DATOS",
  "boot.network": "RED",
  "boot.artists": "BASE DE ARTISTAS",
  "boot.releases": "BASE DE LANZAMIENTOS",
  "boot.artistCount": "ARTISTAS",
  "boot.releaseCount": "LANZAMIENTOS",
  "boot.connecting": "ESTABLECIENDO CONEXIÓN...",
  "boot.ready": "SISTEMA LISTO.",
  "boot.accessing": "ACCEDIENDO",
  "boot.skip": "PRESIONA CUALQUIER TECLA PARA SALTAR",

  /* accessing … */
  "access.system": "ACCEDIENDO A SYSTEM_CORE...",
  "access.releases": "ACCEDIENDO A BASE DE LANZAMIENTOS...",
  "access.scanning": "ESCANEANDO ARCHIVO...",
  "access.found": "LANZAMIENTOS ENCONTRADOS",
  "access.ready": "SISTEMA LISTO",
  "access.artists": "ACCEDIENDO A BASE DE ARTISTAS...",
  "access.events": "ACCEDIENDO A PROGRAMACIÓN...",

  /* 01 system */
  "sys.eyebrow": "01 Sistema / Identidad",
  "sys.explore": "Ver lanzamientos",
  "sys.scroll": "Baja ↓",
  "sys.name": "El nombre",
  "sys.manifest": "Manifiesto",
  "sys.support": "Apoya a Kiseki no Oto",
  "sys.supportNote": "Ayuda a mantener el proyecto vivo",
  "sys.focus": "Enfoque",
  "sys.origin": "Origen",
  "sys.status": "Estado",
  "sys.active": "Activo",
  "sys.dormant": "Inactivo",

  /* the signal column */
  "signal.title": "Último lanzamiento",
  "signal.catalogue": "Catálogo",
  "signal.roster": "Roster",
  "signal.loaded": "Cargado",
  "phase.STANDBY": "En espera",
  "phase.FETCHING": "Cargando",
  "phase.TRANSMITTING": "Transmitiendo",
  "phase.NO SIGNAL": "Sin señal",

  /* transport */
  "deck.play": "Reproducir",
  "deck.pause": "Pausar",
  "deck.prev": "Anterior",
  "deck.next": "Siguiente",
  "deck.mute": "Silenciar",
  "deck.unmute": "Activar sonido",
  "deck.volume": "Volumen",
  "deck.preview": "Preview",

  /* 02 releases */
  "rel.runningOrder": "Lista de canciones",
  "rel.playPreview": "Escuchar preview",
  "rel.pausePreview": "Pausar preview",
  "rel.openOn": "Abrir en",
  "rel.open": "Abrir el lanzamiento",
  "rel.linkUnset": "Sin enlace de lanzamiento",
  "rel.artworkFor": "Portada de",
  "rel.by": "por",

  /* 03 artists */
  "art.title": "Base de artistas",
  "art.count": "registros",
  "art.releases": "Lanzamientos",
  "art.since": "Desde",
  "art.status": "Estado",
  "art.profile": "Ver perfil",
  "art.profileCursor": "abrir perfil",

  /* 04 events */
  "evt.title": "Eventos",
  "evt.upcoming": "próximos",
  "evt.empty": "No hay transmisiones programadas.",
  "evt.SCHEDULED": "PROGRAMADO",
  "evt.ENDED": "FINALIZADO",
  "evt.platformTBA": "PLATAFORMA POR CONFIRMAR",
  "evt.watch": "Ver en vivo",
  "evt.channel": "Abrir canal",
  "evt.streamUnset": "Enlace de transmisión sin configurar",
  "evt.flyer": "Ver flyer",
  "evt.noFlyer": "Sin flyer",
  "evt.schedule": "Programación",
  "evt.times": "Horarios en",
} as const;

/** Every key `es` has, or it will not compile. */
type Copy = Record<keyof typeof es, string>;

const en: Copy = {
  "nav.system": "System",
  "nav.releases": "Releases",
  "nav.artists": "Artists",
  "nav.events": "Events",
  "bar.online": "Online",
  "bar.standby": "Standby",
  "bar.lang": "Switch language",
  "cursor.open": "open",

  "boot.init": "INITIALIZING...",
  "boot.audio": "AUDIO ENGINE",
  "boot.visual": "VISUAL ENGINE",
  "boot.database": "DATABASE",
  "boot.network": "NETWORK",
  "boot.artists": "ARTIST DATABASE",
  "boot.releases": "RELEASE DATABASE",
  "boot.artistCount": "ARTISTS",
  "boot.releaseCount": "RELEASES",
  "boot.connecting": "ESTABLISHING CONNECTION...",
  "boot.ready": "SYSTEM READY.",
  "boot.accessing": "ACCESSING",
  "boot.skip": "PRESS ANY KEY TO SKIP",

  "access.system": "ACCESSING SYSTEM_CORE...",
  "access.releases": "ACCESSING RELEASE DATABASE...",
  "access.scanning": "SCANNING ARCHIVE...",
  "access.found": "RELEASES FOUND",
  "access.ready": "SYSTEM READY",
  "access.artists": "ACCESSING ARTIST_DATABASE...",
  "access.events": "ACCESSING EVENT_SCHEDULE...",

  "sys.eyebrow": "01 System / Identity",
  "sys.explore": "Explore releases",
  "sys.scroll": "Scroll ↓",
  "sys.name": "The name",
  "sys.manifest": "Manifest",
  "sys.support": "Support Kiseki no Oto",
  "sys.supportNote": "Help keep the project alive",
  "sys.focus": "Focus",
  "sys.origin": "Origin",
  "sys.status": "Status",
  "sys.active": "Active",
  "sys.dormant": "Dormant",

  "signal.title": "Latest release",
  "signal.catalogue": "Catalogue",
  "signal.roster": "Roster",
  "signal.loaded": "Loaded",
  "phase.STANDBY": "Standing by",
  "phase.FETCHING": "Fetching",
  "phase.TRANSMITTING": "Transmitting",
  "phase.NO SIGNAL": "No signal",

  "deck.play": "Play",
  "deck.pause": "Pause",
  "deck.prev": "Previous",
  "deck.next": "Next",
  "deck.mute": "Mute",
  "deck.unmute": "Unmute",
  "deck.volume": "Volume",
  "deck.preview": "Preview",

  "rel.runningOrder": "Running order",
  "rel.playPreview": "Play preview",
  "rel.pausePreview": "Pause preview",
  "rel.openOn": "Open on",
  "rel.open": "Open the release",
  "rel.linkUnset": "Release link not set",
  "rel.artworkFor": "Artwork for",
  "rel.by": "by",

  "art.title": "Artist database",
  "art.count": "records",
  "art.releases": "Releases",
  "art.since": "Since",
  "art.status": "Status",
  "art.profile": "View profile",
  "art.profileCursor": "open profile",

  "evt.title": "Events",
  "evt.upcoming": "upcoming",
  "evt.empty": "No transmissions scheduled.",
  "evt.SCHEDULED": "SCHEDULED",
  "evt.ENDED": "ENDED",
  "evt.platformTBA": "PLATFORM TBA",
  "evt.watch": "Watch live",
  "evt.channel": "Open channel",
  "evt.streamUnset": "Stream link not set",
  "evt.flyer": "View flyer",
  "evt.noFlyer": "No flyer",
  "evt.schedule": "Schedule",
  "evt.times": "All times",
};

const COPY: Record<Lang, Copy> = { es, en };

export type Key = keyof typeof es;

/* -------------------------------------------------------------------------
   the singleton
   ------------------------------------------------------------------------- */

/**
 * The browser's storage, or nothing.
 *
 * Checked by capability rather than by `typeof localStorage`: Node 22 defines
 * the global but not its methods, so the existence check passes and the first
 * call throws — which took the whole module down at import time, under the test
 * runner and anywhere else the site renders outside a browser.
 */
function shelf(): Storage | null {
  try {
    return typeof localStorage?.getItem === "function" ? localStorage : null;
  } catch {
    // Storage disabled in the browser's settings throws on access alone.
    return null;
  }
}

function remembered(): Lang {
  const saved = shelf()?.getItem(STORAGE);
  return saved === "en" || saved === "es" ? saved : "es";
}

function createLang() {
  let current: Lang = remembered();
  const listeners = new Set<() => void>();

  const apply = (next: Lang): void => {
    current = next;
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
    try {
      shelf()?.setItem(STORAGE, next);
    } catch {
      // A full or blocked quota is not a reason to refuse the switch.
    }
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot(): Lang {
      return current;
    },
    /** The build renders under Node, where nothing was ever remembered. */
    getServerSnapshot(): Lang {
      return "es";
    },
    set: apply,
    toggle(): void {
      apply(current === "es" ? "en" : "es");
    },
  };
}

export const language = createLang();

/**
 * A word, in whatever language is current.
 *
 * Takes no language argument on purpose — its callers all render under a
 * component that subscribes through `useLang()`, so they repaint together and
 * no leaf has to thread the choice down. The same shape `roster()` and
 * `artistByKey()` use against the store.
 */
export function t(key: Key): string {
  return COPY[language.getSnapshot()][key];
}

/** For the fields of `label` that carry both languages. */
export function pick(pair: { es: string; en: string }): string {
  return pair[language.getSnapshot()];
}
