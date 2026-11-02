import {
  DayAssignment,
  ShiftDefinition,
  ConvenioYearRate,
  WorkerProfile,
  PayrollBreakdown,
} from '../types';

/**
 * Calculates night hours worked between 22:00 and 06:00 for given start and end time
 */
export function calculateNightHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);

  const startMinutes = sH * 60 + sM;
  let endMinutes = eH * 60 + eM;
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60; // Crosses midnight
  }

  let nightMinutes = 0;
  // Step through each 5-minute slice or calculate overlap
  for (let m = startMinutes; m < endMinutes; m++) {
    const minuteOfDay = m % 1440;
    // Night window: 22:00 (1320) to 24:00 (1440), and 00:00 (0) to 06:00 (360)
    if (minuteOfDay >= 1320 || minuteOfDay < 360) {
      nightMinutes++;
    }
  }

  return Math.round((nightMinutes / 60) * 100) / 100;
}

/**
 * Computes duration in hours from start to end (including overnight)
 */
export function calculateTotalHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  let diff = (eH * 60 + eM) - (sH * 60 + sM);
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

/**
 * Comprehensive payroll calculation according to Zaragoza Transport Collective Agreement & Spanish Labor / Tax Laws
 */
export function calculateMonthlyPayroll(
  assignments: DayAssignment[],
  shiftsMap: Map<string, ShiftDefinition>,
  yearRate: ConvenioYearRate,
  profile: WorkerProfile,
  year: number,
  month: number
): PayrollBreakdown {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  let workedDays = 0;
  let restDays = 0;
  let holidayDays = 0;
  let vacationDays = 0;
  let sickDays = 0;

  let totalWorkedHours = 0;
  let totalNightHours = 0;

  let shiftGrossAccumulated = 0;
  let festivoPluses = 0;
  let outsideAgreementExtrasTotal = 0;
  let dietasExentas = 0;
  let dietasTributables = 0;

  // Process day by day
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday
    const isSunday = dayOfWeek === 0;

    const assignment = assignments.find((a) => a.date === dateStr);
    const shiftCode = assignment?.shiftCode;

    // Check holiday
    const isHoliday = assignment?.isHoliday || isSunday;

    if (assignment?.isRest || shiftCode === 'D') {
      restDays++;
      continue;
    }
    if (assignment?.isVacation || shiftCode === 'V') {
      vacationDays++;
      continue;
    }
    if (assignment?.isSickLeave || shiftCode === 'B') {
      sickDays++;
      continue;
    }

    if (shiftCode) {
      const shiftDef = shiftsMap.get(shiftCode) || Array.from(shiftsMap.values()).find((s) => s.code === shiftCode);
      if (shiftDef && shiftDef.code !== 'D') {
        workedDays++;
        if (isHoliday) holidayDays++;

        // Work hours & night hours
        let dayHours = 0;
        let dayNight = 0;

        if (shiftDef.modality === 'partido' && shiftDef.secondStartTime && shiftDef.secondEndTime) {
          const h1 = calculateTotalHours(shiftDef.startTime, shiftDef.endTime);
          const h2 = calculateTotalHours(shiftDef.secondStartTime, shiftDef.secondEndTime);
          dayHours = h1 + h2;
          dayNight = calculateNightHours(shiftDef.startTime, shiftDef.endTime) +
                     calculateNightHours(shiftDef.secondStartTime, shiftDef.secondEndTime);
        } else {
          dayHours = calculateTotalHours(shiftDef.startTime, shiftDef.endTime);
          dayNight = calculateNightHours(shiftDef.startTime, shiftDef.endTime);
        }

        totalWorkedHours += dayHours;
        totalNightHours += dayNight;

        // Shift daily rate
        if (shiftDef.fixedRate && shiftDef.fixedRate > 0) {
          shiftGrossAccumulated += shiftDef.fixedRate;
        } else {
          shiftGrossAccumulated += yearRate.salarioBaseDia;
        }

        // Holiday plus (Art. 17)
        if (isHoliday) {
          festivoPluses += dayHours > 4 ? yearRate.plusFestivoMayor4h : yearRate.plusFestivoMenor4h;
        }

        // Special 24/31 Dec night plus
        if ((month === 12 && (d === 24 || d === 31)) && dayNight > 0) {
          festivoPluses += yearRate.plus24y31Diciembre;
        }
      }
    }

    // Process extras attached to this day
    if (assignment?.extras && assignment.extras.length > 0) {
      for (const extra of assignment.extras) {
        outsideAgreementExtrasTotal += extra.amount;
        if (extra.name.toLowerCase().includes('dieta')) {
          dietasExentas += extra.amount;
        }
      }
    }
  }

  // Calculate Convenio Standard Pluses
  const plusConductorPerceptor = profile.hasConductorPerceptorPlus
    ? workedDays * yearRate.plusConductorPerceptorDia
    : 0;

  const plusQuebrantoMoneda = profile.hasMonetaryQuebranto
    ? workedDays * yearRate.quebrantoMonedaDia
    : 0;

  const plusNocturnidad = totalNightHours * yearRate.plusNocturnidadHora;

  // Prorrata de 3 pagas extras (Art. 11: 30 días x 3 pagas = 90 días año)
  // Prorrata mensual = (90 * salarioBaseDia) / 12 = 7.5 * salarioBaseDia
  const prorrataPagasExtra = profile.prorratearPagasExtra
    ? parseFloat((7.5 * yearRate.salarioBaseDia).toFixed(2))
    : 0;

  // Base salary portion: if not using shift-fixed rates, workedDays * salarioBaseDia
  // For transparent breakdown, we display standard convenio base:
  const salarioBase = workedDays * yearRate.salarioBaseDia;

  // Plus toma y deje or difference if fixed rate was applied
  const shiftRateExtraOverBase = Math.max(0, shiftGrossAccumulated - salarioBase);

  // Total Devengado (Bruto)
  const totalDevengado = parseFloat(
    (
      salarioBase +
      shiftRateExtraOverBase +
      plusConductorPerceptor +
      plusQuebrantoMoneda +
      plusNocturnidad +
      festivoPluses +
      outsideAgreementExtrasTotal +
      prorrataPagasExtra
    ).toFixed(2)
  );

  // Seguridad Social Base de Cotización (Spanish law: includes proportional extra pays and taxable earnings)
  // Excludes exempt per diems up to statutory limit
  const baseCotizacionSS = Math.max(
    1323.00,
    Math.min(
      4709.25,
      totalDevengado - dietasExentas + (profile.prorratearPagasExtra ? 0 : (7.5 * yearRate.salarioBaseDia))
    )
  );

  // Deducciones Seguridad Social Trabajador
  const contingenciasComunes = parseFloat((baseCotizacionSS * 0.047).toFixed(2)); // 4.70%
  const desempleoRate = profile.contractType === 'temporal' ? 0.016 : 0.0155; // 1.55%
  const desempleo = parseFloat((baseCotizacionSS * desempleoRate).toFixed(2));
  const formacionProfesional = parseFloat((baseCotizacionSS * 0.001).toFixed(2)); // 0.10%

  // MEI (Mecanismo de Equidad Intergeneracional): 2024 = 0.12%, 2025 = 0.14%, 2026 = 0.15%
  const meiRate = year >= 2026 ? 0.0015 : year === 2025 ? 0.0014 : 0.0012;
  const mei = parseFloat((baseCotizacionSS * meiRate).toFixed(2));

  const totalSeguridadSocial = parseFloat(
    (contingenciasComunes + desempleo + formacionProfesional + mei).toFixed(2)
  );

  // Base IRPF
  const baseIrpf = Math.max(0, totalDevengado - dietasExentas);
  const retencionIrpf = profile.irpfPercentage;
  const retencionIrpfImporte = parseFloat(((baseIrpf * retencionIrpf) / 100).toFixed(2));

  const cuotaSindical = profile.unionFeeDeduction || 0;
  const anticipos = profile.advancePayment || 0;

  const totalDeducido = parseFloat(
    (totalSeguridadSocial + retencionIrpfImporte + cuotaSindical + anticipos).toFixed(2)
  );

  const liquidoPercibir = parseFloat((totalDevengado - totalDeducido).toFixed(2));

  // Costes Patronales / Empresa (informativo)
  const ssEmpresaCC = parseFloat((baseCotizacionSS * 0.236).toFixed(2)); // 23.60%
  const ssEmpresaDesempleo = parseFloat((baseCotizacionSS * (profile.contractType === 'temporal' ? 0.067 : 0.055)).toFixed(2));
  const ssEmpresaFP = parseFloat((baseCotizacionSS * 0.006).toFixed(2)); // 0.60%
  const ssEmpresaFogasa = parseFloat((baseCotizacionSS * 0.002).toFixed(2)); // 0.20%
  const ssEmpresaMEI = parseFloat((baseCotizacionSS * (meiRate * 4)).toFixed(2)); // ~0.58%
  const totalCosteEmpresa = parseFloat(
    (totalDevengado + ssEmpresaCC + ssEmpresaDesempleo + ssEmpresaFP + ssEmpresaFogasa + ssEmpresaMEI).toFixed(2)
  );

  return {
    monthKey,
    year,
    month,
    totalDays: daysInMonth,
    workedDays,
    restDays,
    holidayDays,
    vacationDays,
    sickDays,

    totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
    nightHours: Math.round(totalNightHours * 100) / 100,

    salarioBase: parseFloat(salarioBase.toFixed(2)),
    plusConductorPerceptor: parseFloat(plusConductorPerceptor.toFixed(2)),
    plusQuebrantoMoneda: parseFloat(plusQuebrantoMoneda.toFixed(2)),
    plusNocturnidad: parseFloat(plusNocturnidad.toFixed(2)),
    plusFestivos: parseFloat(festivoPluses.toFixed(2)),
    plusTomaDeje: parseFloat(shiftRateExtraOverBase.toFixed(2)),
    prorrataPagasExtra,
    totalExtrasFueraConvenio: parseFloat(outsideAgreementExtrasTotal.toFixed(2)),
    dietasExentas: parseFloat(dietasExentas.toFixed(2)),
    dietasTributables: parseFloat(dietasTributables.toFixed(2)),
    horasExtra: 0,
    importeHorasExtra: 0,

    totalDevengado,
    baseCotizacionSS: parseFloat(baseCotizacionSS.toFixed(2)),

    contingenciasComunes,
    desempleo,
    formacionProfesional,
    mei,
    totalSeguridadSocial,

    retencionIrpf,
    retencionIrpfImporte,
    cuotaSindical,
    anticipos,
    totalDeducido,

    liquidoPercibir,

    ssEmpresaCC,
    ssEmpresaDesempleo,
    ssEmpresaFP,
    ssEmpresaFogasa,
    ssEmpresaMEI,
    totalCosteEmpresa,
  };
}
