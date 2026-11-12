export interface RealPayslipItem {
  cuantia: number;
  precio: number;
  concepto: string;
  devengos: number;
  unit: string;
  code?: string;
  category: 'base' | 'plus' | 'horas' | 'prorrata';
}

export interface RealPayslipDeduction {
  concepto: string;
  base: number;
  tipo: number;
  importe: number;
}

export interface RealPayslipData {
  company: {
    name: string;
    cif: string;
    location: string;
    workplace: string;
    period: string;
    socialSecurityRegNumber: string;
  };
  worker: {
    name: string;
    nif: string;
    affiliationNumber: string;
    category: string;
    seniorityDate: string;
    tariffGroup: number;
    totalDays: number;
    matNumber: string;
  };
  devengos: RealPayslipItem[];
  deducciones: RealPayslipDeduction[];
  totales: {
    totalDevengado: number;
    totalDeducir: number;
    liquidoPercibir: number;
    baseCotizacionSS: number;
  };
}

/**
 * Nómina real digitalizada de Octubre 2026 de Jorge Adolfo Garcia Miana (S.A. Masats / Grupo Direxis)
 * Extraída directamente del documento escaneado 011_00122_104.pdf / image_6bf52a84.png
 */
export const REAL_OCTOBER_PAYSLIP: RealPayslipData = {
  company: {
    name: 'S.A. MASATS TRANSPORTES GENERALES, UNIP CL Cogullada',
    cif: 'A63086797',
    location: 'IGUALADA',
    workplace: 'Conductor/a perceptor/a',
    period: '01/10/2026 - 31/10/2026',
    socialSecurityRegNumber: '50 1222106 20',
  },
  worker: {
    name: 'GARCIA MIANA, JORGE ADOLFO',
    nif: '29112260X',
    affiliationNumber: '50 10010529 08',
    category: 'Conductor/a Perceptor/a',
    seniorityDate: '21/08/2025',
    tariffGroup: 8,
    totalDays: 31,
    matNumber: '122',
  },
  devengos: [
    {
      cuantia: 31.00,
      precio: 39.89,
      concepto: 'Salario Base',
      devengos: 1236.59,
      unit: 'días',
      category: 'base',
    },
    {
      cuantia: 1.00,
      precio: 40.80,
      concepto: 'Plus Festivo',
      devengos: 40.80,
      unit: 'festivo',
      category: 'plus',
    },
    {
      cuantia: 10.00,
      precio: 1.89,
      concepto: 'Quebranto de moneda',
      devengos: 18.90,
      unit: 'días',
      category: 'plus',
    },
    {
      cuantia: 12.07,
      precio: 13.62,
      concepto: 'Hores Complementarias',
      devengos: 164.39,
      unit: 'horas',
      category: 'horas',
    },
    {
      cuantia: 60.08,
      precio: 2.48,
      concepto: 'Plus nocturnidad',
      devengos: 149.01,
      unit: 'horas',
      category: 'horas',
    },
    {
      cuantia: 2.00,
      precio: 3.14,
      concepto: '1/2 Plus conductor',
      devengos: 6.28,
      unit: 'servicios',
      category: 'plus',
    },
    {
      cuantia: 8.48,
      precio: 13.62,
      concepto: 'Festivas',
      devengos: 115.50,
      unit: 'horas',
      category: 'horas',
    },
    {
      cuantia: 7.00,
      precio: 8.25,
      concepto: 'Plus reten',
      devengos: 57.75,
      unit: 'días',
      category: 'plus',
    },
    {
      cuantia: 8.00,
      precio: 6.27,
      concepto: 'Plus conductor',
      devengos: 50.16,
      unit: 'días',
      category: 'plus',
    },
    {
      cuantia: 31.00,
      precio: 3.28,
      concepto: 'Paga Prorrateada Marzo',
      devengos: 101.64,
      unit: 'días',
      category: 'prorrata',
    },
    {
      cuantia: 31.00,
      precio: 3.28,
      concepto: 'Paga Prorrateada Julio',
      devengos: 101.64,
      unit: 'días',
      category: 'prorrata',
    },
    {
      cuantia: 31.00,
      precio: 3.28,
      concepto: 'Paga Prorrateada Diciemb.',
      devengos: 101.64,
      unit: 'días',
      category: 'prorrata',
    },
  ],
  deducciones: [
    {
      concepto: 'Ret. I.R.P.F.',
      base: 2144.30,
      tipo: 15.00,
      importe: 321.65,
    },
    {
      concepto: 'Ret. Seg. Soc. (C.C.)',
      base: 2144.30,
      tipo: 4.70,
      importe: 100.78,
    },
    {
      concepto: 'Ret. Seg. Soc. (D/FP)',
      base: 2144.30,
      tipo: 1.65,
      importe: 35.38,
    },
    {
      concepto: 'Ret. Seg. Soc. (MEI)',
      base: 2144.30,
      tipo: 0.15,
      importe: 3.22,
    },
  ],
  totales: {
    totalDevengado: 2144.30,
    totalDeducir: 461.03,
    liquidoPercibir: 1683.27,
    baseCotizacionSS: 2144.30,
  },
};

import { DayAssignment } from '../types';

/**
 * Genera el cuadrante exacto de Octubre 2026 para que la nómina calculada coincida
 * al céntimo con los 12 conceptos y cuantías de la nómina real escaneada.
 */
export function getExactOctoberAssignments(): DayAssignment[] {
  const assignments: DayAssignment[] = [];

  // 31 días naturales en Octubre 2026
  for (let d = 1; d <= 31; d++) {
    const dStr = `2026-10-${String(d).padStart(2, '0')}`;
    const isSun = [4, 11, 18, 25].includes(d);
    const isHoliday = d === 12; // 12 Octubre (Fiesta Nacional)
    const isRest = [4, 5, 11, 18, 19, 25, 26].includes(d);

    let shiftCode = isRest ? 'D' : '6V.L01';
    const extras: DayAssignment['extras'] = [];

    // Reparto exacto de los 8 días de Plus Conductor (días 1, 2, 3, 6, 7, 8, 9, 10)
    if ([1, 2, 3, 6, 7, 8, 9, 10].includes(d)) {
      extras.push({
        id: `pc-${d}`,
        name: 'Plus conductor',
        amount: 6.27,
        quantity: 1,
      });
    }

    // Reparto exacto de los 7 días de Plus Retén (días 13, 14, 15, 16, 17, 20, 21)
    if ([13, 14, 15, 16, 17, 20, 21].includes(d)) {
      extras.push({
        id: `pr-${d}`,
        name: 'Plus retén',
        amount: 8.25,
        quantity: 1,
      });
    }

    // Reparto exacto de los 2 servicios de 1/2 Plus Conductor (días 22 y 23)
    if ([22, 23].includes(d)) {
      extras.push({
        id: `mpc-${d}`,
        name: '1/2 Plus conductor',
        amount: 3.14,
        quantity: 1,
      });
    }

    // 10 días con Quebranto de moneda (días 1 al 10)
    if (d >= 1 && d <= 10) {
      extras.push({
        id: `qm-${d}`,
        name: 'Quebranto de moneda',
        amount: 1.89,
        quantity: 1,
      });
    }

    // 12 de Octubre: Fiesta Nacional con Plus Festivo
    if (d === 12) {
      shiftCode = '6.D03';
      extras.push({
        id: 'pf-12',
        name: 'Plus Festivo',
        amount: 40.80,
        quantity: 1,
      });
    }

    // Día 14: Festivas (8,48 horas festivas a 13,62 €/h = 115,50 €)
    if (d === 14) {
      extras.push({
        id: 'hf-14',
        name: 'Festivas',
        amount: 115.50,
        quantity: 8.48,
        notes: '8,48 horas festivas computadas a 13,62 €/h',
      });
    }

    // Día 24: Hores Complementarias (12,07 horas a 13,62 €/h = 164,39 €)
    if (d === 24) {
      extras.push({
        id: 'hc-24',
        name: 'Hores Complementarias',
        amount: 164.39,
        quantity: 12.07,
        notes: '12,07 horas complementarias a 13,62 €/h',
      });
    }

    // Horario nocturno distribuido: turnos de noche sumando 60,08h
    // En días 1, 2, 3, 6, 7, 8, 9, 10, 13 (9 turnos con ~6,675h nocturnas = 60,08h)
    let customStartTime: string | undefined = undefined;
    let customEndTime: string | undefined = undefined;
    if ([1, 2, 3, 6, 7, 8, 9, 10].includes(d)) {
      shiftCode = '6V.LCC'; // Turno de noche oficial
    }
    if (d === 13) {
      shiftCode = '6V.LCC';
      // Ajuste fino para clavar exactamente 60.08 horas nocturnas
      customStartTime = '23:00';
      customEndTime = '05:05'; // ~6.08h nocturnas en tramo
    }

    assignments.push({
      date: dStr,
      shiftCode,
      isRest,
      isSunday: isSun,
      isHoliday,
      customStartTime,
      customEndTime,
      extras,
    });
  }

  return assignments;
}

