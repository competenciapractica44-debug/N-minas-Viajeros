import { ShiftDefinition } from '../types';

/**
 * Turno único oficial para días no laborables de descanso o fiesta
 */
export const DESCANSO_SHIFT: ShiftDefinition = {
  id: 'turno-d',
  code: 'D',
  title: 'Fiesta / Descanso Semanal',
  category: 'descanso',
  dayType: 'todos',
  modality: 'continuado',
  terminal: 'Día Libre / Fiesta',
  startTime: '00:00',
  endTime: '00:00',
  drivingDuration: '00:00',
  computedDuration: 'Descanso / Fiesta (0h)',
  fixedRate: 0,
  color: '#10b981', // Verde esmeralda
  badges: ['Fiesta / Descanso', 'Día no laborable'],
  notes: 'Día libre reglamentario, festivo de descanso o fiesta oficial.',
};

/**
 * Turno de Vacaciones Retribuidas (Art. 9 Convenio)
 */
export const VACACIONES_SHIFT: ShiftDefinition = {
  id: 'turno-v',
  code: 'V',
  title: 'Vacaciones Retribuidas (Convenio Zaragoza)',
  category: 'vacaciones',
  dayType: 'todos',
  modality: 'continuado',
  terminal: 'Vacaciones anuales reglamentarias',
  startTime: '00:00',
  endTime: '00:00',
  drivingDuration: '00:00',
  computedDuration: 'Día de vacaciones retribuido',
  fixedRate: 63.18,
  color: '#06b6d4', // Cyan turquesa distintivo
  badges: ['Vacaciones Art. 9', 'Plus 10,00 €/día', 'Retribuido'],
  notes: 'Retribución de salario base diario (53,18 € en 2026) más plus de vacaciones de 10,00 €/día según Art. 9 del Convenio Colectivo de Transporte de Zaragoza (proporcional al % de jornada).',
};

export const FEATURED_SHIFTS: ShiftDefinition[] = [DESCANSO_SHIFT, VACACIONES_SHIFT];


// Helper to create DIREXIS ZARAGOZA official work parts
function createDirexisPart(
  code: string,
  start: string,
  end: string,
  durationStr: string,
  dayType: 'laborable' | 'sabado' | 'festivo'
): ShiftDefinition {
  const [hStr, mStr] = durationStr.split(':');
  const durH = parseInt(hStr, 10) || 8;
  const durM = parseInt(mStr, 10) || 0;
  const totalMins = durH * 60 + durM;

  const startHour = parseInt(start.split(':')[0], 10);
  let category: ShiftDefinition['category'] = 'mañana';
  if (startHour >= 22 || startHour < 4) {
    category = 'noche';
  } else if (startHour >= 12 && startHour < 21) {
    category = 'tarde';
  } else if (startHour >= 21) {
    category = 'noche';
  }

  // Calculate night hours in 22:00 to 06:00 (Art. 18 Convenio)
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const startMins = (sH || 0) * 60 + (sM || 0);
  let endMins = (eH || 0) * 60 + (eM || 0);
  if (endMins <= startMins) endMins += 24 * 60;
  let nightMins = 0;
  for (let m = startMins; m < endMins; m++) {
    const mod = m % 1440;
    if (mod >= 1320 || mod < 360) nightMins++;
  }
  const totalHours = totalMins / 60;
  const nightHours = Math.round((nightMins / 60) * 100) / 100;

  const isReten =
    code === '6V.LR1' ||
    code === '6V.LR3' ||
    code === '6.R01S' ||
    code === '6.R03S' ||
    code === '6.R01F' ||
    code === '6.R03F' ||
    code === '6.R01F/L' ||
    code === '6.R03F/L' ||
    code.includes('.LR') ||
    code.includes('.R0');

  // 2026 Convenio Zaragoza: 13.62 €/h ordinaria, 2.48 €/h nocturna
  // El plus de festivo no se incluye en los turnos (se devenga en festivos nacionales, autonómicos o locales y se añade manualmente)
  const baseAmt = totalHours * 13.62;
  const nightAmt = nightHours * 2.48;
  // Si es retén, incluye plus de retén (+8,25 €) y excluye quebranto y plus conductor
  const retenAmt = isReten ? 8.25 : 0;
  const rate = Math.round((baseAmt + nightAmt + retenAmt) * 100) / 100;

  // Colors requested by user:
  // Mañana = Amarillo (#eab308)
  // Tarde = Azul celeste (#0284c7)
  // Noche = Morado (#7c3aed)
  let color = '#eab308';
  if (category === 'tarde') {
    color = '#0284c7';
  } else if (category === 'noche') {
    color = '#7c3aed';
  }

  const dayLabel = dayType === 'festivo' ? 'Domingos y Festivos' : dayType === 'sabado' ? 'Sábados' : 'L-V Laborable';

  const badges = isReten
    ? [
        'Direxis Oficial',
        'Plus Retén (+8,25 €)',
        'Sin Quebranto',
        'Sin Plus Conductor',
      ]
    : [
        'Direxis Oficial',
        dayType === 'sabado' ? 'Servicio Sábado' : dayType === 'festivo' ? 'Domingos y Festivos' : 'Laborable',
        category === 'tarde' ? 'Turno Tarde' : category === 'mañana' ? 'Turno Mañana' : 'Turno Noche',
      ];

  const shiftTitle = isReten
    ? `Parte ${code} · Retén Disponibilidad (${dayLabel})`
    : `Parte ${code} · Direxis Zaragoza (${dayLabel})`;

  const shiftNotes = isReten
    ? `Parte de trabajo oficial de retén y disponibilidad para ${dayLabel} con duración total de ${durationStr}. Incluye plus de retén (+8,25 €) y excluye quebranto de moneda y plus conductor-perceptor al no realizar venta de billetes.`
    : `Parte de trabajo oficial de Direxis Zaragoza para ${dayLabel} con duración total de ${durationStr}.`;

  return {
    id: `direxis-${code.replace(/[^a-zA-Z0-9]/g, '_')}`,
    code,
    title: shiftTitle,
    category,
    dayType,
    modality: category === 'noche' ? 'nocturno' : 'continuado',
    terminal: isReten ? `Cochera / Guardia Retén (${code})` : `Direxis Terminal Central (${code})`,
    startTime: start,
    endTime: end,
    drivingDuration: durationStr,
    computedDuration: isReten ? `${durationStr} (Retén disponibilidad)` : `${durationStr} (Jornada completa)`,
    fixedRate: rate,
    color,
    badges,
    notes: shiftNotes,
    hasPlusReten: isReten,
    hasConductorPerceptor: !isReten,
    hasQuebrantoMoneda: !isReten,
  };
}

// 44 Partes Laborables (L-V) from PDF
const DIREXIS_LABORABLES: [string, string, string, string][] = [
  ['6V.LR1', '06:00', '15:00', '09:00'],
  ['6V.LR3', '15:00', '23:59', '08:59'],
  ['6V.L01', '06:30', '14:50', '08:20'],
  ['6V.L02', '14:40', '23:10', '08:30'],
  ['6V.L03', '05:15', '13:30', '08:15'],
  ['6V.L04', '13:20', '20:05', '06:45'],
  ['6V.L05', '05:20', '14:30', '09:10'],
  ['6V.L06', '05:00', '12:50', '07:50'],
  ['6V.L07', '05:15', '13:25', '08:10'],
  ['6V.L08', '05:45', '13:30', '07:45'],
  ['6V.L09', '15:30', '23:55', '08:25'],
  ['6V.L10', '15:15', '23:35', '08:20'],
  ['6V.L11', '06:15', '15:20', '09:05'],
  ['6V.L12', '05:30', '15:00', '09:30'],
  ['6V.L13', '14:35', '23:45', '09:10'],
  ['6V.L14', '05:30', '14:55', '09:25'],
  ['6V.L15', '14:30', '23:50', '09:20'],
  ['6V.L16', '05:35', '13:30', '07:55'],
  ['6V.L17', '13:00', '21:15', '08:15'],
  ['6V.L18', '06:00', '15:30', '09:30'],
  ['6V.L19', '14:45', '23:25', '08:40'],
  ['6V.L20', '12:15', '20:45', '08:30'],
  ['6V.L21', '06:00', '14:20', '08:20'],
  ['6V.L22', '13:50', '23:05', '09:15'],
  ['6V.L23', '05:30', '10:20', '04:50'],
  ['6V.L24', '05:55', '15:00', '09:05'],
  ['6V.L25', '06:30', '16:00', '09:30'],
  ['6V.L26', '06:30', '14:50', '08:20'],
  ['6V.L27', '14:20', '23:20', '09:00'],
  ['6V.L28', '15:00', '23:55', '08:55'],
  ['6V.L29', '14:15', '23:45', '09:30'],
  ['6V.L30', '14:45', '22:35', '07:50'],
  ['6V.L31', '06:15', '12:00', '05:45'],
  ['6V.L32', '06:15', '16:00', '09:45'],
  ['6V.L33', '06:05', '15:30', '09:25'],
  ['6V.L34', '06:20', '15:15', '08:55'],
  ['6V.L35', '14:50', '23:30', '08:40'],
  ['6V.L36', '13:45', '23:30', '09:45'],
  ['6V.L37', '13:45', '23:50', '10:05'],
  ['6V.L38', '14:00', '23:50', '09:50'],
  ['6V.L39', '12:55', '22:15', '09:20'],
  ['6V.L40', '06:45', '09:30', '02:45'],
  ['6V.L41', '18:55', '23:59', '05:04'],
  ['6V.LCC', '00:01', '08:30', '08:29'],
];

// 33 Partes Sábados from PDF
const DIREXIS_SABADOS: [string, string, string, string][] = [
  ['6.CARSAB', '00:01', '08:00', '07:59'],
  ['6.R01S', '06:00', '15:00', '09:00'],
  ['6.R03S', '15:00', '23:59', '08:59'],
  ['6.S01', '00:01', '08:00', '07:59'],
  ['6.S02', '05:30', '14:40', '09:10'],
  ['6.S03', '14:10', '00:03', '09:53'],
  ['6.S04', '03:01', '10:21', '07:20'],
  ['6.S05', '06:15', '15:15', '09:00'],
  ['6.S06', '06:30', '15:40', '09:10'],
  ['6.S07', '14:45', '23:03', '08:18'],
  ['6.S08', '15:15', '23:30', '08:15'],
  ['6.S09', '00:01', '07:50', '07:49'],
  ['6.S10', '06:45', '14:52', '08:07'],
  ['6.S11', '06:50', '15:52', '09:02'],
  ['6.S12', '07:15', '16:04', '08:49'],
  ['6.S13', '15:45', '23:45', '08:00'],
  ['6.S14', '15:30', '23:30', '08:00'],
  ['6.S15', '15:15', '00:04', '08:49'],
  ['6.S16', '06:30', '15:35', '09:05'],
  ['6.S17', '07:00', '15:25', '08:25'],
  ['6.S18', '07:30', '16:35', '09:05'],
  ['6.S19', '15:25', '00:59', '09:34'],
  ['6.S20', '15:25', '00:38', '09:13'],
  ['6.S21', '16:25', '00:36', '08:11'],
  ['6.S22', '08:15', '15:18', '07:03'],
  ['6.S23', '14:15', '22:48', '08:33'],
  ['6.S24', '01:30', '08:45', '07:15'],
  ['6.S25', '13:45', '23:30', '09:45'],
  ['6.S26', '06:45', '15:28', '08:43'],
  ['6.S27', '14:45', '23:28', '08:43'],
  ['6.S28', '08:00', '16:45', '08:45'],
  ['6.S29', '16:00', '00:05', '08:05'],
  ['6.S30', '06:30', '14:15', '07:45'],
];

// 21 Partes Domingos y Festivos sin sufijo /L
const DIREXIS_DOMINGOS: [string, string, string, string][] = [
  ['6.D01', '00:01', '06:20', '06:19'],
  ['6.D02', '00:01', '07:50', '07:49'],
  ['6.D03', '06:30', '15:15', '08:45'],
  ['6.D04', '03:01', '10:51', '07:50'],
  ['6.D05', '01:30', '08:45', '07:15'],
  ['6.D06', '08:30', '16:14', '07:44'],
  ['6.D07', '08:00', '15:45', '07:45'],
  ['6.D08', '08:00', '15:45', '07:45'],
  ['6.D09', '13:30', '23:45', '10:15'],
  ['6.D10', '07:00', '15:35', '08:35'],
  ['6.D11', '07:30', '15:30', '08:00'],
  ['6.D12', '15:00', '23:48', '08:48'],
  ['6.D13', '15:00', '23:03', '08:03'],
  ['6.D14', '14:45', '23:25', '08:40'],
  ['6.D15', '15:30', '23:28', '07:58'],
  ['6.D16', '14:00', '22:45', '08:45'],
  ['6.D17', '15:35', '00:35', '09:00'],
  ['6.D18', '08:00', '14:45', '06:45'],
  ['6.R01F', '06:00', '15:00', '09:00'],
  ['6.R03F', '15:00', '23:59', '08:59'],
  ['6CARFES', '00:01', '08:00', '07:59'],
];

export const ALL_INITIAL_SHIFTS: ShiftDefinition[] = [
  ...FEATURED_SHIFTS,
  ...DIREXIS_LABORABLES.map(([code, start, end, dur]) => createDirexisPart(code, start, end, dur, 'laborable')),
  ...DIREXIS_SABADOS.map(([code, start, end, dur]) => createDirexisPart(code, start, end, dur, 'sabado')),
  ...DIREXIS_DOMINGOS.map(([code, start, end, dur]) => createDirexisPart(code, start, end, dur, 'festivo')),
];
