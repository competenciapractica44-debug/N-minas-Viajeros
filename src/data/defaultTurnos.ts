import { ShiftDefinition } from '../types';
import turnosBaseInitial from './turnosBaseInitial.json';

const INITIAL_SHIFTS: ShiftDefinition[] = turnosBaseInitial as ShiftDefinition[];

/**
 * Turno único oficial para días no laborables de descanso o fiesta
 */
export const DESCANSO_SHIFT: ShiftDefinition =
  INITIAL_SHIFTS.find((s) => s.code === 'D') || {
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
    color: '#10b981',
    badges: ['Fiesta / Descanso', 'Día no laborable'],
    notes: 'Día libre reglamentario, festivo de descanso o fiesta oficial.',
  };

/**
 * Turno de Vacaciones Retribuidas (Art. 9 Convenio)
 */
export const VACACIONES_SHIFT: ShiftDefinition =
  INITIAL_SHIFTS.find((s) => s.code === 'V') || {
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
    color: '#06b6d4',
    badges: ['Vacaciones Art. 9', 'Plus 10,00 €/día', 'Retribuido'],
    notes:
      'Retribución de salario base diario (53,18 € en 2026) más plus de vacaciones de 10,00 €/día según Art. 9 del Convenio Colectivo de Transporte de Zaragoza (proporcional al % de jornada).',
  };

export const FEATURED_SHIFTS: ShiftDefinition[] = [DESCANSO_SHIFT, VACACIONES_SHIFT];

export const ALL_INITIAL_SHIFTS: ShiftDefinition[] = INITIAL_SHIFTS;
