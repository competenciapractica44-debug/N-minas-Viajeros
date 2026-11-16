import { ConvenioInfo, ConvenioYearRate } from '../types';

export const DEFAULT_CONVENIO_ZARAGOZA: ConvenioInfo = {
  title: 'Convenio Colectivo del Sector de Transporte de Viajeros por Carretera de Zaragoza',
  bopzNumber: 'BOPZ Núm. 182 / Código 50001135011982',
  publicationDate: '10 de agosto de 2023',
  validFrom: '2026-01-01',
  validTo: '2026-12-31',
  ultractividadTo: '2029-01-31',
  isExpired: false,
  isExtended: false,
  extensionNotes: 'Tablas salariales oficiales de 2026 con vigencia y ultraactividad legal hasta 2029.',
  ratesByYear: {
    2026: {
      year: 2026,
      salarioBaseDia: 53.18,
      salarioBaseAnual: 24196.90,
      salarioBaseDiaMasats: 39.89,
      horaOrdinaria: 13.62,
      plusNocturnidadHora: 2.48,
      plusConductorPerceptorDia: 6.27,
      plusConductorPerceptorDiaReducido: 3.14,
      quebrantoMonedaDia: 1.89,
      plusFestivoMayor4h: 40.80,
      plusFestivoMenor4h: 30.60,
      plusRetenDia: 8.25,
      prorrataPagaDia: 3.28,
      plus24y31Diciembre: 30.60,
      dietaComidaCenaRegular: 15.00,
      dietaComidaCenaDiscrecional: 19.00,
      dietaPernoctaRegular: 12.27,
      dietaPernoctaDiscrecional: 16.25,
      plusVacacionesDia: 10.00,
      plusPuntualidadDia: 12.00,
      horasJornadaAnual: 1776,
    },
  },
};

/**
 * Generates an extended year rate with a given percentage increase (e.g. 3.2% IPC)
 */
export function generateProrrogaYearRate(baseRate: ConvenioYearRate, newYear: number, increasePercent: number): ConvenioYearRate {
  const factor = 1 + increasePercent / 100;
  return {
    year: newYear,
    salarioBaseDia: parseFloat((baseRate.salarioBaseDia * factor).toFixed(2)),
    salarioBaseAnual: parseFloat((baseRate.salarioBaseAnual * factor).toFixed(2)),
    salarioBaseDiaMasats: parseFloat(((baseRate.salarioBaseDiaMasats ?? 39.89) * factor).toFixed(2)),
    horaOrdinaria: parseFloat((baseRate.horaOrdinaria * factor).toFixed(2)),
    plusNocturnidadHora: parseFloat((baseRate.plusNocturnidadHora * factor).toFixed(2)),
    plusConductorPerceptorDia: parseFloat((baseRate.plusConductorPerceptorDia * factor).toFixed(2)),
    plusConductorPerceptorDiaReducido: parseFloat((baseRate.plusConductorPerceptorDiaReducido * factor).toFixed(2)),
    quebrantoMonedaDia: parseFloat((baseRate.quebrantoMonedaDia * factor).toFixed(2)),
    plusFestivoMayor4h: parseFloat((baseRate.plusFestivoMayor4h * factor).toFixed(2)),
    plusFestivoMenor4h: parseFloat((baseRate.plusFestivoMenor4h * factor).toFixed(2)),
    plus24y31Diciembre: parseFloat((baseRate.plus24y31Diciembre * factor).toFixed(2)),
    dietaComidaCenaRegular: parseFloat((baseRate.dietaComidaCenaRegular * factor).toFixed(2)),
    dietaComidaCenaDiscrecional: parseFloat(((baseRate.dietaComidaCenaDiscrecional ?? 19.0) * factor).toFixed(2)),
    dietaPernoctaRegular: parseFloat((baseRate.dietaPernoctaRegular * factor).toFixed(2)),
    dietaPernoctaDiscrecional: parseFloat((baseRate.dietaPernoctaDiscrecional * factor).toFixed(2)),
    plusVacacionesDia: parseFloat((baseRate.plusVacacionesDia * factor).toFixed(2)),
    plusPuntualidadDia: parseFloat(((baseRate.plusPuntualidadDia ?? 12.0) * factor).toFixed(2)),
    plusRetenDia: parseFloat(((baseRate.plusRetenDia ?? 8.25) * factor).toFixed(2)),
    prorrataPagaDia: parseFloat(((baseRate.prorrataPagaDia ?? 3.28) * factor).toFixed(2)),
    horasJornadaAnual: baseRate.horasJornadaAnual,
  };
}

/**
 * Resolves the active ConvenioYearRate for a target year, falling back gracefully
 * to the closest configured Convenio year or 2026 defaults while preserving uploaded fields.
 */
export function getEffectiveYearRate(convenio: ConvenioInfo | undefined, year: number): ConvenioYearRate {
  const default2026 = DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026];
  const ratesMap = convenio?.ratesByYear || {};
  if (ratesMap[year]) {
    return { ...default2026, ...ratesMap[year], year };
  }
  const availableYears = Object.keys(ratesMap)
    .map(Number)
    .filter((y) => !isNaN(y))
    .sort((a, b) => b - a);
  const fallbackYear = availableYears.find((y) => y <= year) ?? availableYears[0];
  if (fallbackYear !== undefined && ratesMap[fallbackYear]) {
    return { ...default2026, ...ratesMap[fallbackYear], year };
  }
  return { ...default2026, year };
}

/**
 * Returns the live gross Convenio amount for official Convenio-linked extras so UI
 * and payroll calculation always obey the uploaded Convenio table.
 */
export function getOfficialConvenioExtraAmount(name: string, yearRate: ConvenioYearRate): number | null {
  const lower = (name || '').toLowerCase();
  if (lower.includes('reten') || lower.includes('retén')) {
    return yearRate.plusRetenDia ?? 8.25;
  }
  if (lower.includes('1/2') || lower.includes('medio plus')) {
    return (
      yearRate.plusConductorPerceptorDiaReducido ??
      parseFloat(((yearRate.plusConductorPerceptorDia ?? 6.27) / 2).toFixed(2))
    );
  }
  if (lower.includes('plus conductor')) {
    return yearRate.plusConductorPerceptorDia ?? 6.27;
  }
  if (lower.includes('quebranto')) {
    return yearRate.quebrantoMonedaDia ?? 1.89;
  }
  if (lower.includes('plus festivo')) {
    return yearRate.plusFestivoMayor4h ?? 40.80;
  }
  if (lower.includes('puntualidad') || lower.includes('inicio temprano')) {
    return yearRate.plusPuntualidadDia ?? 12.00;
  }
  if (lower.includes('festiva') || lower.includes('complementaria')) {
    return yearRate.horaOrdinaria ?? 13.62;
  }
  return null;
}

