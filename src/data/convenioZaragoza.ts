import { ConvenioInfo, ConvenioYearRate } from '../types';

export const DEFAULT_CONVENIO_ZARAGOZA: ConvenioInfo = {
  title: 'Convenio Colectivo del Sector de Transporte de Viajeros por Carretera de Zaragoza',
  bopzNumber: 'BOPZ Núm. 182 / Código 50001135011982',
  publicationDate: '10 de agosto de 2023',
  validFrom: '2023-01-01',
  validTo: '2026-12-31',
  ultractividadTo: '2029-01-31',
  isExpired: false,
  isExtended: false,
  extensionNotes: 'Cláusula de ultraactividad vigente por 24 meses adicionales tras expiración.',
  ratesByYear: {
    2023: {
      year: 2023,
      salarioBaseDia: 48.43,
      salarioBaseAnual: 22035.65,
      horaOrdinaria: 12.30,
      plusNocturnidadHora: 2.48, // Art. 18 (22:00 a 06:00)
      plusConductorPerceptorDia: 6.27, // Art. 19 (>= 4h)
      plusConductorPerceptorDiaReducido: 3.14, // (< 4h)
      quebrantoMonedaDia: 1.89, // Art. 20
      plusFestivoMayor4h: 40.80, // Art. 17
      plusFestivoMenor4h: 30.60,
      plus24y31Diciembre: 30.60,
      dietaComidaCenaRegular: 15.00, // Art. 23 (30€ comida + cena)
      dietaComidaCenaDiscrecional: 19.00,
      dietaPernoctaRegular: 12.27,
      dietaPernoctaDiscrecional: 16.25,
      plusVacacionesDia: 10.00, // Art. 9
      horasJornadaAnual: 1792,
    },
    2024: {
      year: 2024,
      salarioBaseDia: 50.37,
      salarioBaseAnual: 22960.72,
      horaOrdinaria: 12.87,
      plusNocturnidadHora: 2.48,
      plusConductorPerceptorDia: 6.27,
      plusConductorPerceptorDiaReducido: 3.14,
      quebrantoMonedaDia: 1.89,
      plusFestivoMayor4h: 40.80,
      plusFestivoMenor4h: 30.60,
      plus24y31Diciembre: 30.60,
      dietaComidaCenaRegular: 15.00,
      dietaComidaCenaDiscrecional: 19.00,
      dietaPernoctaRegular: 12.27,
      dietaPernoctaDiscrecional: 16.25,
      plusVacacionesDia: 10.00,
      horasJornadaAnual: 1784,
    },
    2025: {
      year: 2025,
      salarioBaseDia: 51.88,
      salarioBaseAnual: 23605.40,
      horaOrdinaria: 13.29,
      plusNocturnidadHora: 2.48,
      plusConductorPerceptorDia: 6.27,
      plusConductorPerceptorDiaReducido: 3.14,
      quebrantoMonedaDia: 1.89,
      plusFestivoMayor4h: 40.80,
      plusFestivoMenor4h: 30.60,
      plus24y31Diciembre: 30.60,
      dietaComidaCenaRegular: 15.00,
      dietaComidaCenaDiscrecional: 19.00,
      dietaPernoctaRegular: 12.27,
      dietaPernoctaDiscrecional: 16.25,
      plusVacacionesDia: 10.00,
      horasJornadaAnual: 1776,
    },
    2026: {
      year: 2026,
      salarioBaseDia: 53.18,
      salarioBaseAnual: 24196.90,
      horaOrdinaria: 13.62,
      plusNocturnidadHora: 2.48,
      plusConductorPerceptorDia: 6.27,
      plusConductorPerceptorDiaReducido: 3.14,
      quebrantoMonedaDia: 1.89,
      plusFestivoMayor4h: 40.80,
      plusFestivoMenor4h: 30.60,
      plus24y31Diciembre: 30.60,
      dietaComidaCenaRegular: 15.00,
      dietaComidaCenaDiscrecional: 19.00,
      dietaPernoctaRegular: 12.27,
      dietaPernoctaDiscrecional: 16.25,
      plusVacacionesDia: 10.00,
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
    horaOrdinaria: parseFloat((baseRate.horaOrdinaria * factor).toFixed(2)),
    plusNocturnidadHora: parseFloat((baseRate.plusNocturnidadHora * factor).toFixed(2)),
    plusConductorPerceptorDia: parseFloat((baseRate.plusConductorPerceptorDia * factor).toFixed(2)),
    plusConductorPerceptorDiaReducido: parseFloat((baseRate.plusConductorPerceptorDiaReducido * factor).toFixed(2)),
    quebrantoMonedaDia: parseFloat((baseRate.quebrantoMonedaDia * factor).toFixed(2)),
    plusFestivoMayor4h: parseFloat((baseRate.plusFestivoMayor4h * factor).toFixed(2)),
    plusFestivoMenor4h: parseFloat((baseRate.plusFestivoMenor4h * factor).toFixed(2)),
    plus24y31Diciembre: parseFloat((baseRate.plus24y31Diciembre * factor).toFixed(2)),
    dietaComidaCenaRegular: parseFloat((baseRate.dietaComidaCenaRegular * factor).toFixed(2)),
    dietaComidaCenaDiscrecional: parseFloat((baseRate.dietaComidaCenaDiscrecional * factor).toFixed(2)),
    dietaPernoctaRegular: parseFloat((baseRate.dietaPernoctaRegular * factor).toFixed(2)),
    dietaPernoctaDiscrecional: parseFloat((baseRate.dietaPernoctaDiscrecional * factor).toFixed(2)),
    plusVacacionesDia: parseFloat((baseRate.plusVacacionesDia * factor).toFixed(2)),
    horasJornadaAnual: baseRate.horasJornadaAnual,
  };
}
