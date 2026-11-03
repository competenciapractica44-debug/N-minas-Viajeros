import { ShiftDefinition } from '../types';

export const FEATURED_SHIFTS: ShiftDefinition[] = [
  {
    id: 'turno-m1',
    code: 'M1',
    title: 'Mañana Regular Línea 101',
    category: 'mañana',
    dayType: 'laborable',
    modality: 'continuado',
    terminal: 'Cochera Central · Línea 101',
    startTime: '06:00',
    endTime: '14:15',
    drivingDuration: '08:15',
    computedDuration: '8h 15m (Jornada completa)',
    fixedRate: 82.00,
    color: '#eab308', // Amarillo para mañana
    badges: ['Servicio Ordinario'],
    notes: 'Servicio continuado de mañana con alta demanda en hora punta.',
  },
  {
    id: 'turno-t1',
    code: 'T1',
    title: 'Tarde Regular Línea 101',
    category: 'tarde',
    dayType: 'laborable',
    modality: 'continuado',
    terminal: 'Cochera Central · Línea 101',
    startTime: '14:15',
    endTime: '22:30',
    drivingDuration: '08:15',
    computedDuration: '8h 15m (Jornada completa)',
    fixedRate: 82.00,
    color: '#0284c7', // Azul celeste para tarde
    badges: ['Servicio Ordinario', 'Turno Tarde'],
    notes: 'Servicio continuado de tarde en corredor principal.',
  },
  {
    id: 'turno-t2',
    code: 'T2',
    title: 'Tarde Interurbano Refuerzo',
    category: 'tarde',
    dayType: 'laborable',
    modality: 'continuado',
    terminal: 'Línea 402 Corredor Norte',
    startTime: '14:00',
    endTime: '22:30',
    drivingDuration: '08:30',
    computedDuration: '8h 30m (Jornada completa)',
    fixedRate: 84.00,
    color: '#0284c7', // Azul celeste para tarde
    badges: ['Interurbano estándar', 'Turno Tarde'],
    notes: 'Línea interurbana con venta y cobro a bordo en franja de tarde.',
  },
  {
    id: 'turno-t3',
    code: 'T3',
    title: 'Tarde Urbana Línea 102 Plaza España - Actur',
    category: 'tarde',
    dayType: 'laborable',
    modality: 'continuado',
    terminal: 'Terminal Actur · Rey Fernando',
    startTime: '14:45',
    endTime: '23:00',
    drivingDuration: '08:15',
    computedDuration: '8h 15m (Jornada completa)',
    fixedRate: 82.50,
    color: '#0284c7', // Azul celeste para tarde
    badges: ['Urbano Tarde', 'Turno Tarde'],
    notes: 'Servicio urbano continuo de tarde con relevo en terminal.',
  },
  {
    id: 'turno-t4',
    code: 'T4',
    title: 'Tarde Interurbana Zaragoza - Utebo - Casetas',
    category: 'tarde',
    dayType: 'laborable',
    modality: 'continuado',
    terminal: 'Estación Central Delicias / Casetas',
    startTime: '15:15',
    endTime: '23:30',
    drivingDuration: '08:15',
    computedDuration: '8h 15m (Jornada completa)',
    fixedRate: 83.50,
    color: '#0284c7', // Azul celeste para tarde
    badges: ['Interurbano Tarde', 'Turno Tarde'],
    notes: 'Ruta interurbana de alta frecuencia en franja de tarde.',
  },
  {
    id: 'turno-t5',
    code: 'T5',
    title: 'Tarde Refuerzo Enlaces Hospitales y Polígonos',
    category: 'tarde',
    dayType: 'laborable',
    modality: 'continuado',
    terminal: 'Sector Polígono Malpica / Clínico',
    startTime: '13:30',
    endTime: '21:45',
    drivingDuration: '08:15',
    computedDuration: '8h 15m (Jornada completa)',
    fixedRate: 83.00,
    color: '#0284c7', // Azul celeste para tarde
    badges: ['Refuerzo Tarde', 'Turno Tarde'],
    notes: 'Salidas de fábricas y centros sanitarios turno de tarde.',
  },
  {
    id: 'turno-n1',
    code: 'N1',
    title: 'Nocturno Aeropuerto Express',
    category: 'noche',
    dayType: 'todos',
    modality: 'nocturno',
    terminal: 'Línea N20 Aeropuerto T1-T4',
    startTime: '22:00',
    endTime: '06:00',
    drivingDuration: '08:00',
    computedDuration: '8h continuas nocturnas',
    fixedRate: 104.50,
    color: '#7c3aed', // Morado para noche
    badges: ['Nocturnidad fija'],
    notes: 'Jornada completa en tramo de nocturnidad con plus consolidado.',
  },
  {
    id: 'turno-disc',
    code: 'DISC',
    title: 'Discrecional Largo Recorrido',
    category: 'discrecional',
    dayType: 'todos',
    modality: 'discrecional',
    terminal: 'Viajes Nacionales & Circuitos',
    startTime: '08:00',
    endTime: '20:00',
    drivingDuration: '09:00',
    computedDuration: 'Jornada Completa / Día',
    fixedRate: 125.00,
    color: '#059669', // Emerald
    badges: ['Dieta completa'],
    notes: 'Inspección técnica pre-viaje + lavado inc. Servicio discrecional.',
  },
  {
    id: 'turno-m2',
    code: 'M2',
    title: 'Mañana Refuerzo Hospital - Línea 105',
    category: 'mañana',
    dayType: 'laborable',
    modality: 'continuado',
    terminal: 'Cochera Central (Sector Este)',
    startTime: '06:30',
    endTime: '14:45',
    drivingDuration: '08:15',
    computedDuration: '8h 15m (Jornada completa)',
    fixedRate: 83.00,
    color: '#eab308', // Amarillo para mañana
    badges: ['Urbano regular'],
  },
  {
    id: 'turno-d',
    code: 'D',
    title: 'Descanso Semanal Reglamentario',
    category: 'descanso',
    dayType: 'todos',
    modality: 'continuado',
    terminal: 'Descanso libre',
    startTime: '00:00',
    endTime: '00:00',
    drivingDuration: '00:00',
    computedDuration: 'Descanso oficial',
    fixedRate: 0,
    color: '#10b981', // Verde
    badges: ['Descanso'],
  },
  {
    id: 'turno-r',
    code: 'R',
    title: 'Reserva de Cochera / Retén',
    category: 'mañana',
    dayType: 'laborable',
    modality: 'continuado',
    terminal: 'Cochera Central',
    startTime: '07:00',
    endTime: '15:00',
    drivingDuration: '08:00',
    computedDuration: '8h retén disponible',
    fixedRate: 78.50,
    color: '#eab308', // Amarillo para mañana
    badges: ['Retén disponible'],
  },
  {
    id: 'turno-s1',
    code: 'S1',
    title: 'Sábado Mañana Línea Interurbana',
    category: 'mañana',
    dayType: 'sabado',
    modality: 'continuado',
    terminal: 'Estación Central Delicias · Línea 401',
    startTime: '07:00',
    endTime: '15:30',
    drivingDuration: '08:30',
    computedDuration: '8h 30m (Jornada Sábado)',
    fixedRate: 86.50,
    color: '#eab308', // Amarillo para mañana
    badges: ['Servicio Sábado', 'Turno Mañana'],
    notes: 'Servicio ordinario de fin de semana turno de mañana.',
  },
  {
    id: 'turno-s2',
    code: 'S2',
    title: 'Sábado Tarde Refuerzo Líneas Urbanas',
    category: 'tarde',
    dayType: 'sabado',
    modality: 'continuado',
    terminal: 'Cochera Central · Líneas 101/102',
    startTime: '15:00',
    endTime: '23:30',
    drivingDuration: '08:30',
    computedDuration: '8h 30m (Jornada Sábado)',
    fixedRate: 86.50,
    color: '#0284c7', // Azul celeste para tarde
    badges: ['Servicio Sábado', 'Turno Tarde'],
    notes: 'Refuerzo de ocio y comercio turno de tarde de sábado.',
  },
  {
    id: 'turno-f1',
    code: 'F1',
    title: 'Domingo y Festivo Mañana Ordinario',
    category: 'mañana',
    dayType: 'festivo',
    modality: 'continuado',
    terminal: 'Terminal Intermodal · Zaragoza',
    startTime: '08:00',
    endTime: '16:15',
    drivingDuration: '08:15',
    computedDuration: '8h 15m (Festivo +25%)',
    fixedRate: 102.50,
    color: '#eab308', // Amarillo para mañana
    badges: ['Domingos y Festivos', 'Turno Mañana'],
    notes: 'Servicio en festivo con retribución de recargo de festivo según convenio.',
  },
  {
    id: 'turno-f2',
    code: 'F2',
    title: 'Domingo y Festivo Tarde Enlace Interurbano',
    category: 'tarde',
    dayType: 'festivo',
    modality: 'continuado',
    terminal: 'Corredor Norte / Garrapinillos',
    startTime: '15:15',
    endTime: '23:30',
    drivingDuration: '08:15',
    computedDuration: '8h 15m (Festivo +25%)',
    fixedRate: 103.00,
    color: '#0284c7', // Azul celeste para tarde
    badges: ['Domingos y Festivos', 'Turno Tarde'],
    notes: 'Turno de tarde en domingo o festivo con plus festivo consolidado.',
  },
];

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

  // Base gross rate calculated: 10.45€/h standard, 13.06€/h for festivos (+25%)
  const hourlyBase = dayType === 'festivo' ? 13.06 : 10.45;
  const rate = Math.round((totalMins / 60) * hourlyBase * 100) / 100;

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

  return {
    id: `direxis-${code.replace(/[^a-zA-Z0-9]/g, '_')}`,
    code,
    title: `Parte ${code} · Direxis Zaragoza (${dayLabel})`,
    category,
    dayType,
    modality: category === 'noche' ? 'nocturno' : 'continuado',
    terminal: `Direxis Terminal Central (${code})`,
    startTime: start,
    endTime: end,
    drivingDuration: durationStr,
    computedDuration: `${durationStr} (Jornada completa)`,
    fixedRate: rate,
    color,
    badges: [
      'Direxis Oficial',
      dayType === 'sabado' ? 'Servicio Sábado' : dayType === 'festivo' ? 'Domingos y Festivos' : 'Laborable',
      category === 'tarde' ? 'Turno Tarde' : category === 'mañana' ? 'Turno Mañana' : 'Turno Noche'
    ],
    notes: `Parte de trabajo oficial de Direxis Zaragoza para ${dayLabel} con duración total de ${durationStr}.`,
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

// 21 Partes Domingos y Festivos from PDF
const DIREXIS_DOMINGOS: [string, string, string, string][] = [
  ['6.D01/L', '00:01', '06:20', '06:19'],
  ['6.D02/L', '00:01', '07:50', '07:49'],
  ['6.D03/L', '06:30', '15:15', '08:45'],
  ['6.D04/L', '03:01', '10:51', '07:50'],
  ['6.D05/L', '01:30', '08:45', '07:15'],
  ['6.D06/L', '08:30', '16:14', '07:44'],
  ['6.D07/L', '08:00', '15:45', '07:45'],
  ['6.D08/L', '08:00', '15:45', '07:45'],
  ['6.D09/L', '13:30', '23:45', '10:15'],
  ['6.D10/L', '07:00', '15:35', '08:35'],
  ['6.D11/L', '07:30', '15:30', '08:00'],
  ['6.D12/L', '15:00', '23:48', '08:48'],
  ['6.D13/L', '15:00', '23:03', '08:03'],
  ['6.D14/L', '14:45', '23:25', '08:40'],
  ['6.D15/L', '15:30', '23:28', '07:58'],
  ['6.D16/L', '14:00', '22:45', '08:45'],
  ['6.D17/L', '15:35', '00:35', '09:00'],
  ['6.D18/L', '08:00', '14:45', '06:45'],
  ['6.R01F/L', '06:00', '15:00', '09:00'],
  ['6.R03F/L', '15:00', '23:59', '08:59'],
  ['6CARFES/L', '00:01', '08:00', '07:59'],
];

export const ALL_INITIAL_SHIFTS: ShiftDefinition[] = [
  ...FEATURED_SHIFTS,
  ...DIREXIS_LABORABLES.map(([code, start, end, dur]) => createDirexisPart(code, start, end, dur, 'laborable')),
  ...DIREXIS_SABADOS.map(([code, start, end, dur]) => createDirexisPart(code, start, end, dur, 'sabado')),
  ...DIREXIS_DOMINGOS.map(([code, start, end, dur]) => createDirexisPart(code, start, end, dur, 'festivo')),
];
