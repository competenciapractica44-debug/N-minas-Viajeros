export type HolidayScope = 'nacional' | 'regional' | 'local';

export interface DetectedHolidayInfo {
  date: string; // YYYY-MM-DD
  name: string;
  scope: HolidayScope;
  regionLabel?: string;
  localityLabel?: string;
}

export interface AutonomousCommunityOption {
  id: string;
  name: string;
  localities: string[];
}

export const SPANISH_AUTONOMOUS_COMMUNITIES: AutonomousCommunityOption[] = [
  {
    id: 'aragon',
    name: 'Aragón',
    localities: [
      'Zaragoza',
      'Utebo',
      'Ejea de los Caballeros',
      'Calatayud',
      'Tarazona',
      'Caspe',
      'La Almunia de Doña Godina',
      'Cuarte de Huerva',
      'Zuera',
      'Huesca',
      'Jaca',
      'Monzón',
      'Barbastro',
      'Teruel',
      'Alcañiz',
    ],
  },
  {
    id: 'cataluna',
    name: 'Cataluña',
    localities: ['Barcelona', 'Igualada', 'Lleida', 'Girona', 'Tarragona', 'Manresa', 'Sabadell', 'Terrassa'],
  },
  {
    id: 'madrid',
    name: 'Comunidad de Madrid',
    localities: ['Madrid', 'Alcalá de Henares', 'Getafe', 'Leganés', 'Móstoles', 'Fuenlabrada'],
  },
  {
    id: 'valencia',
    name: 'Comunitat Valenciana',
    localities: ['Valencia', 'Alicante', 'Castellón de la Plana', 'Elche'],
  },
  {
    id: 'andalucia',
    name: 'Andalucía',
    localities: ['Sevilla', 'Málaga', 'Córdoba', 'Granada', 'Cádiz', 'Almería', 'Huelva', 'Jaén'],
  },
  {
    id: 'pais_vasco',
    name: 'País Vasco',
    localities: ['Bilbao', 'San Sebastián', 'Vitoria-Gasteiz'],
  },
  {
    id: 'navarra',
    name: 'Comunidad Foral de Navarra',
    localities: ['Pamplona', 'Tudela', 'Estella'],
  },
  {
    id: 'la_rioja',
    name: 'La Rioja',
    localities: ['Logroño', 'Calahorra', 'Haro'],
  },
  {
    id: 'castilla_leon',
    name: 'Castilla y León',
    localities: ['Valladolid', 'Burgos', 'León', 'Salamanca', 'Soria', 'Segovia', 'Ávila', 'Zamora', 'Palencia'],
  },
  {
    id: 'castilla_mancha',
    name: 'Castilla-La Mancha',
    localities: ['Toledo', 'Albacete', 'Ciudad Real', 'Cuenca', 'Guadalajara'],
  },
  {
    id: 'galicia',
    name: 'Galicia',
    localities: ['Santiago de Compostela', 'A Coruña', 'Vigo', 'Ourense', 'Lugo', 'Pontevedra'],
  },
  {
    id: 'asturias',
    name: 'Principado de Asturias',
    localities: ['Oviedo', 'Gijón', 'Avilés'],
  },
  {
    id: 'cantabria',
    name: 'Cantabria',
    localities: ['Santander', 'Torrelavega'],
  },
  {
    id: 'murcia',
    name: 'Región de Murcia',
    localities: ['Murcia', 'Cartagena', 'Lorca'],
  },
  {
    id: 'extremadura',
    name: 'Extremadura',
    localities: ['Mérida', 'Badajoz', 'Cáceres'],
  },
  {
    id: 'baleares',
    name: 'Illes Balears',
    localities: ['Palma', 'Ibiza', 'Maó'],
  },
  {
    id: 'canarias',
    name: 'Canarias',
    localities: ['Las Palmas de Gran Canaria', 'Santa Cruz de Tenerife'],
  },
  {
    id: 'ceuta',
    name: 'Ceuta',
    localities: ['Ceuta'],
  },
  {
    id: 'melilla',
    name: 'Melilla',
    localities: ['Melilla'],
  },
];

function normalizeText(value?: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Resolves Autonomous Community ID even if a user passes name or only locality.
 */
export function resolveRegionId(autonomousCommunity?: string, locality?: string): string | undefined {
  const normRegion = normalizeText(autonomousCommunity);
  if (normRegion) {
    const matched = SPANISH_AUTONOMOUS_COMMUNITIES.find(
      (c) => c.id === normRegion || normalizeText(c.name) === normRegion || normalizeText(c.name).includes(normRegion)
    );
    if (matched) return matched.id;
  }

  const normLoc = normalizeText(locality);
  if (normLoc) {
    for (const c of SPANISH_AUTONOMOUS_COMMUNITIES) {
      if (c.localities.some((l) => normalizeText(l) === normLoc)) {
        return c.id;
      }
    }
  }

  return undefined;
}

/**
 * Anonymous Gregorian algorithm for Easter Sunday.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDaysToYMD(base: Date, days: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function md(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface LocalHolidaySpec {
  month: number;
  day: number;
  name: string;
}

const LOCAL_HOLIDAYS_CATALOG: Record<string, LocalHolidaySpec[]> = {
  zaragoza: [
    { month: 1, day: 29, name: 'San Valero (Patrón de Zaragoza)' },
    { month: 3, day: 5, name: 'Cincomarzada (Festivo local Zaragoza)' },
  ],
  utebo: [
    { month: 6, day: 19, name: 'San Lamberto (Festivo local Utebo)' },
    { month: 7, day: 26, name: 'Santa Ana (Festivo local Utebo)' },
  ],
  'ejea de los caballeros': [
    { month: 4, day: 14, name: 'Voto de la Villa (Festivo local Ejea)' },
    { month: 9, day: 8, name: 'Virgen de la Oliva (Festivo local Ejea)' },
  ],
  calatayud: [
    { month: 8, day: 16, name: 'San Roque (Festivo local Calatayud)' },
    { month: 9, day: 8, name: 'Virgen de la Peña (Festivo local Calatayud)' },
  ],
  tarazona: [
    { month: 8, day: 28, name: 'San Agustín (Festivo local Tarazona)' },
    { month: 10, day: 5, name: 'San Atilano (Festivo local Tarazona)' },
  ],
  caspe: [
    { month: 8, day: 6, name: 'San Salvador (Festivo local Caspe)' },
    { month: 8, day: 16, name: 'San Roque (Festivo local Caspe)' },
  ],
  'la almunia de dona godina': [
    { month: 9, day: 25, name: 'Santa Pantaria (Festivo local La Almunia)' },
  ],
  'cuarte de huerva': [
    { month: 7, day: 26, name: 'Santa Ana (Festivo local Cuarte de Huerva)' },
    { month: 9, day: 14, name: 'Exaltación de la Santa Cruz (Cuarte)' },
  ],
  zuera: [
    { month: 8, day: 28, name: 'San Licer (Festivo local Zuera)' },
  ],
  huesca: [
    { month: 1, day: 22, name: 'San Vicente (Festivo local Huesca)' },
    { month: 8, day: 10, name: 'San Lorenzo (Festivo local Huesca)' },
  ],
  jaca: [
    { month: 6, day: 25, name: 'Santa Orosia (Festivo local Jaca)' },
  ],
  monzon: [
    { month: 9, day: 21, name: 'San Mateo (Festivo local Monzón)' },
  ],
  barbastro: [
    { month: 9, day: 8, name: 'Natividad de la Virgen (Barbastro)' },
  ],
  teruel: [
    { month: 7, day: 10, name: 'Fiestas del Ángel (Festivo local Teruel)' },
  ],
  alcaniz: [
    { month: 9, day: 9, name: 'Virgen de Pueyos (Festivo local Alcañiz)' },
    { month: 9, day: 10, name: 'Santo Ángel Custodio (Festivo local Alcañiz)' },
  ],
  barcelona: [
    { month: 9, day: 24, name: 'La Mercè (Festivo local Barcelona)' },
  ],
  igualada: [
    { month: 8, day: 24, name: 'Sant Bartomeu (Festivo local Igualada)' },
  ],
  madrid: [
    { month: 5, day: 15, name: 'San Isidro Labrador (Festivo local Madrid)' },
    { month: 11, day: 9, name: 'Virgen de la Almudena (Festivo local Madrid)' },
  ],
  valencia: [
    { month: 1, day: 22, name: 'San Vicente Mártir (Festivo local Valencia)' },
  ],
  sevilla: [
    { month: 5, day: 30, name: 'San Fernando (Festivo local Sevilla)' },
  ],
  bilbao: [
    { month: 7, day: 31, name: 'San Ignacio de Loyola (Bilbao)' },
  ],
  pamplona: [
    { month: 7, day: 7, name: 'San Fermín (Festivo local Pamplona)' },
    { month: 11, day: 29, name: 'San Saturnino (Festivo local Pamplona)' },
  ],
  logrono: [
    { month: 6, day: 11, name: 'San Bernabé (Festivo local Logroño)' },
    { month: 9, day: 21, name: 'San Mateo (Festivo local Logroño)' },
  ],
  soria: [
    { month: 10, day: 2, name: 'San Saturio (Festivo local Soria)' },
  ],
};

/**
 * Generates all official holidays (National, Regional, Local) for a given year & driver location.
 */
export function getOfficialHolidaysForYear(
  year: number,
  autonomousCommunity?: string,
  locality?: string
): Map<string, DetectedHolidayInfo> {
  const map = new Map<string, DetectedHolidayInfo>();
  const easter = getEasterSunday(year);
  const regionId = resolveRegionId(autonomousCommunity, locality);
  const regionName = SPANISH_AUTONOMOUS_COMMUNITIES.find((c) => c.id === regionId)?.name;

  const setHoliday = (info: DetectedHolidayInfo) => {
    // Prioridad visual si coinciden en el mismo día: local > regional > nacional (salvo que nacional ya sea claro)
    if (!map.has(info.date) || info.scope === 'local') {
      map.set(info.date, info);
    }
  };

  // 1. FESTIVOS NACIONALES (toda España)
  const nationals: Array<[string, string]> = [
    [md(year, 1, 1), 'Año Nuevo'],
    [md(year, 1, 6), 'Epifanía del Señor (Reyes)'],
    [addDaysToYMD(easter, -2), 'Viernes Santo'],
    [md(year, 5, 1), 'Fiesta del Trabajo'],
    [md(year, 8, 15), 'Asunción de la Virgen'],
    [md(year, 10, 12), 'Fiesta Nacional de España'],
    [md(year, 11, 1), 'Todos los Santos'],
    [md(year, 12, 6), 'Día de la Constitución Española'],
    [md(year, 12, 8), 'Inmaculada Concepción'],
    [md(year, 12, 25), 'Natividad del Señor'],
  ];

  nationals.forEach(([date, name]) => {
    setHoliday({ date, name, scope: 'nacional' });
  });

  // 2. FESTIVOS REGIONALES / AUTONÓMICOS (requiere región o localidad resuelta)
  if (regionId) {
    const regionsWithoutJuevesSanto = new Set(['cataluna', 'valencia']);
    if (!regionsWithoutJuevesSanto.has(regionId)) {
      setHoliday({
        date: addDaysToYMD(easter, -3),
        name: 'Jueves Santo',
        scope: 'regional',
        regionLabel: regionName,
      });
    }

    const regionsWithLunesPascua = new Set(['cataluna', 'valencia', 'baleares', 'navarra', 'pais_vasco', 'la_rioja', 'cantabria']);
    if (regionsWithLunesPascua.has(regionId)) {
      setHoliday({
        date: addDaysToYMD(easter, 1),
        name: 'Lunes de Pascua',
        scope: 'regional',
        regionLabel: regionName,
      });
    }

    // Traslados de domingo a lunes en 2026 (1 nov y 6 dic caen en domingo)
    const nov1 = new Date(year, 10, 1);
    if (nov1.getDay() === 0 && ['aragon', 'andalucia', 'asturias', 'castilla_leon', 'extremadura', 'madrid', 'navarra'].includes(regionId)) {
      setHoliday({
        date: md(year, 11, 2),
        name: 'Todos los Santos (lunes siguiente)',
        scope: 'regional',
        regionLabel: regionName,
      });
    }
    const dec6 = new Date(year, 11, 6);
    if (dec6.getDay() === 0 && ['aragon', 'andalucia', 'asturias', 'cantabria', 'castilla_leon', 'extremadura', 'madrid', 'murcia', 'navarra', 'la_rioja', 'melilla'].includes(regionId)) {
      setHoliday({
        date: md(year, 12, 7),
        name: 'Día de la Constitución (lunes siguiente)',
        scope: 'regional',
        regionLabel: regionName,
      });
    }

    const fixedRegional: Record<string, Array<[number, number, string]>> = {
      aragon: [[4, 23, 'San Jorge · Día de Aragón']],
      cataluna: [
        [6, 24, 'Sant Joan'],
        [9, 11, 'Diada Nacional de Catalunya'],
        [12, 26, 'Sant Esteve'],
      ],
      madrid: [
        [5, 2, 'Fiesta de la Comunidad de Madrid'],
        [7, 25, 'Santiago Apóstol'],
      ],
      valencia: [
        [3, 19, 'San José'],
        [6, 24, 'San Juan'],
        [10, 9, 'Día de la Comunitat Valenciana'],
      ],
      andalucia: [[2, 28, 'Día de Andalucía']],
      asturias: [[9, 8, 'Día de Asturias']],
      baleares: [[3, 1, 'Día de les Illes Balears']],
      canarias: [[5, 30, 'Día de Canarias']],
      cantabria: [
        [7, 28, 'Día de las Instituciones de Cantabria'],
        [9, 15, 'La Bien Aparecida'],
      ],
      castilla_mancha: [[5, 31, 'Día de Castilla-La Mancha']],
      castilla_leon: [[4, 23, 'Día de Castilla y León']],
      extremadura: [[9, 8, 'Día de Extremadura']],
      galicia: [
        [5, 17, 'Día das Letras Galegas'],
        [7, 25, 'Día Nacional de Galicia'],
      ],
      la_rioja: [[6, 9, 'Día de La Rioja']],
      murcia: [
        [3, 19, 'San José'],
        [6, 9, 'Día de la Región de Murcia'],
      ],
      navarra: [[12, 3, 'San Francisco Javier · Día de Navarra']],
      pais_vasco: [[3, 19, 'San José']],
      ceuta: [[9, 2, 'Día de Ceuta']],
      melilla: [[9, 17, 'Día de Melilla']],
    };

    (fixedRegional[regionId] || []).forEach(([month, day, name]) => {
      setHoliday({
        date: md(year, month, day),
        name,
        scope: 'regional',
        regionLabel: regionName,
      });
    });
  }

  // 3. FESTIVOS LOCALES (según localidad configurada en la ficha del chófer)
  const normLoc = normalizeText(locality);
  if (normLoc) {
    const localList = LOCAL_HOLIDAYS_CATALOG[normLoc];
    if (localList) {
      localList.forEach((spec) => {
        setHoliday({
          date: md(year, spec.month, spec.day),
          name: spec.name,
          scope: 'local',
          localityLabel: locality?.trim(),
        });
      });
    }
  }

  return map;
}

export function getOfficialHolidayForDate(
  dateStr: string,
  autonomousCommunity?: string,
  locality?: string
): DetectedHolidayInfo | null {
  const year = parseInt(dateStr.slice(0, 4), 10);
  if (isNaN(year)) return null;
  const map = getOfficialHolidaysForYear(year, autonomousCommunity, locality);
  return map.get(dateStr) || null;
}
