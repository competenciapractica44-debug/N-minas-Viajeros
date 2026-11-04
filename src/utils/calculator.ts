import {
  DayAssignment,
  ShiftDefinition,
  ConvenioYearRate,
  ConvenioInfo,
  WorkerProfile,
  PayrollBreakdown,
  ExtrasCutoffMode,
  PayrollExtraItemDetail,
  MonthlySalaryEvolution,
} from '../types';

const MONTH_NAMES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

/**
 * Format total minutes into human Spanish duration (e.g. 65 -> "1h y 5min", 40 -> "40min")
 */
export function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}h y ${minutes}min`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}min`;
}

/**
 * Returns date bounds and description for extras/variable calculation cutoff
 */
export function getExtrasDateRange(
  year: number,
  month: number, // 1 to 12
  cutoffMode: ExtrasCutoffMode = 'direxis_25_24',
  customStartDay = 25
): {
  startDateStr: string;
  endDateStr: string;
  label: string;
  periodText: string;
} {
  if (cutoffMode === 'mes_natural') {
    const lastDay = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return {
      startDateStr,
      endDateStr,
      label: 'Mes natural (del 1 al último día del mes)',
      periodText: `1 ${MONTH_NAMES_SHORT[month - 1]} - ${lastDay} ${MONTH_NAMES_SHORT[month - 1]}`,
    };
  }

  // Direxis (25 to 24) or custom
  const startDay = cutoffMode === 'direxis_25_24' ? 25 : (customStartDay || 25);
  const endDay = startDay === 1 ? 31 : startDay - 1;

  // Previous month and year
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const maxPrevDays = new Date(prevYear, prevMonth, 0).getDate();
  const safeStartDay = Math.min(startDay, maxPrevDays);

  const startDateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(safeStartDay).padStart(2, '0')}`;
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  const isDirexis = cutoffMode === 'direxis_25_24' || startDay === 25;
  const label = isDirexis
    ? 'Ciclo Direxis Zaragoza (del 25 mes anterior al 24 del mes actual)'
    : `Corte personalizado (del ${safeStartDay} al ${endDay})`;

  const periodText = `${safeStartDay} ${MONTH_NAMES_SHORT[prevMonth - 1]} - ${endDay} ${MONTH_NAMES_SHORT[month - 1]}`;

  return {
    startDateStr,
    endDateStr,
    label,
    periodText,
  };
}

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

  // Part-time contract factor
  const isPartTime = profile.contractType === 'tiempo_parcial';
  const partTimePercent = isPartTime
    ? (profile.partTimePercentage !== undefined && profile.partTimePercentage > 0 ? profile.partTimePercentage : 50)
    : 100;
  const partTimeFactor = partTimePercent / 100;

  // Process calendar month days (Salario base, regular shifts, hours, holiday pluses)
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

        // Shift daily rate (adjusted by part-time factor if applicable)
        const effectiveDayBase = (shiftDef.fixedRate && shiftDef.fixedRate > 0)
          ? (isPartTime ? shiftDef.fixedRate * partTimeFactor : shiftDef.fixedRate)
          : (yearRate.salarioBaseDia * partTimeFactor);

        shiftGrossAccumulated += effectiveDayBase;

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
  }

  // Process EXTRAS according to the chosen cutoff cycle (e.g. Direxis 25th prev month to 24th current month, or calendar month)
  const cutoffMode = profile.extrasCutoffMode || 'direxis_25_24';
  const customStartDay = profile.customCutoffStartDay || 25;
  const cutoffRange = getExtrasDateRange(year, month, cutoffMode, customStartDay);

  const extrasItemsList: PayrollExtraItemDetail[] = [];
  let outsideAgreementExtrasTotal = 0;
  let dietasExentas = 0;
  let dietasTributables = 0;
  let totalLateFinishMinutes = 0;
  let totalLateFinishAmount = 0;

  assignments.forEach((assignment) => {
    if (assignment.date >= cutoffRange.startDateStr && assignment.date <= cutoffRange.endDateStr) {
      if (assignment.extras && assignment.extras.length > 0) {
        for (const extra of assignment.extras) {
          outsideAgreementExtrasTotal += extra.amount;
          if (extra.name.toLowerCase().includes('dieta')) {
            dietasExentas += extra.amount;
          }
          extrasItemsList.push({
            date: assignment.date,
            name: extra.name,
            amount: extra.amount,
            notes: extra.notes,
          });
        }
      }

      // Check late finish / exceso de turno
      if (assignment.lateFinishMinutes && assignment.lateFinishMinutes > 0) {
        totalLateFinishMinutes += assignment.lateFinishMinutes;
        const computedLateAmount = assignment.lateFinishAmount !== undefined
          ? assignment.lateFinishAmount
          : parseFloat(((assignment.lateFinishMinutes / 60) * yearRate.horaOrdinaria).toFixed(2));
        totalLateFinishAmount += computedLateAmount;

        const durationFormatted = formatMinutesToHoursAndMinutes(assignment.lateFinishMinutes);
        const reasonText = assignment.lateFinishReason ? ` (${assignment.lateFinishReason})` : '';
        extrasItemsList.push({
          date: assignment.date,
          name: `Terminado más tarde: +${durationFormatted}${reasonText}`,
          amount: computedLateAmount,
          notes: `Exceso de jornada compensado a ${yearRate.horaOrdinaria.toFixed(2)} €/h`,
        });
      }
    }
  });

  // Calculate pending extras that occurred in the current month after the cutoff end date (e.g. days 25-31 in Direxis mode)
  let pendingNextMonthExtrasCount = 0;
  let pendingNextMonthExtrasTotal = 0;
  if (cutoffMode !== 'mes_natural') {
    const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
    assignments.forEach((assignment) => {
      if (assignment.date.startsWith(currentMonthPrefix) && assignment.date > cutoffRange.endDateStr) {
        if (assignment.extras && assignment.extras.length > 0) {
          for (const extra of assignment.extras) {
            pendingNextMonthExtrasCount++;
            pendingNextMonthExtrasTotal += extra.amount;
          }
        }
        if (assignment.lateFinishMinutes && assignment.lateFinishMinutes > 0) {
          pendingNextMonthExtrasCount++;
          const lateAmt = assignment.lateFinishAmount !== undefined
            ? assignment.lateFinishAmount
            : parseFloat(((assignment.lateFinishMinutes / 60) * yearRate.horaOrdinaria).toFixed(2));
          pendingNextMonthExtrasTotal += lateAmt;
        }
      }
    });
  }

  // Calculate Convenio Standard Pluses
  const plusConductorPerceptor = profile.hasConductorPerceptorPlus
    ? workedDays * yearRate.plusConductorPerceptorDia * (isPartTime ? partTimeFactor : 1)
    : 0;

  const plusQuebrantoMoneda = profile.hasMonetaryQuebranto
    ? workedDays * yearRate.quebrantoMonedaDia
    : 0;

  const plusNocturnidad = totalNightHours * yearRate.plusNocturnidadHora;

  // Prorrateo de pagas extraordinarias (Art. 11 Convenio Zaragoza: 3 pagas de 30 días de salario base = 90 días año)
  // Opciones:
  // 1) 'tres_pagas': 3 pagas prorrateadas mensualmente (7,5 días de salario base / mes)
  // 2) 'una_paga': 1 paga prorrateada mensualmente (Marzo: 2,5 días / mes), y las otras 2 se cobran íntegras en Julio y Diciembre (30 días de salario base cada una)
  // 3) 'ninguna': no prorratear ninguna (cobro íntegro en sus meses de devengo: Marzo, Julio y Diciembre)
  const prorrateoMode = profile.prorrateoPagasExtra || (profile.prorratearPagasExtra !== false ? 'tres_pagas' : 'ninguna');

  let prorrataPagasExtra = 0;
  let pagaExtraIntegraMes = 0;
  let pagaExtraIntegraNombre: string | undefined = undefined;

  const fullExtraPayAmount = parseFloat((30 * yearRate.salarioBaseDia * partTimeFactor).toFixed(2));

  if (prorrateoMode === 'tres_pagas') {
    prorrataPagasExtra = parseFloat((7.5 * yearRate.salarioBaseDia * partTimeFactor).toFixed(2));
  } else if (prorrateoMode === 'una_paga') {
    // 1 paga prorrateada (Marzo) a razón de 2.5 días de salario base al mes
    prorrataPagasExtra = parseFloat((2.5 * yearRate.salarioBaseDia * partTimeFactor).toFixed(2));
    // Julio y Diciembre se cobran íntegras
    if (month === 7) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Verano (Julio)';
    } else if (month === 12) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Navidad (Diciembre)';
    }
  } else {
    // 'ninguna'
    prorrataPagasExtra = 0;
    if (month === 3) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Marzo';
    } else if (month === 7) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Verano (Julio)';
    } else if (month === 12) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Navidad (Diciembre)';
    }
  }

  // Retribución de Vacaciones según Art. 9 Convenio Colectivo Transporte de Zaragoza:
  // 1) Salario Base por cada día de vacaciones disfrutado
  // 2) Plus de Vacaciones de 10,00 €/día en días 'V' (solo si el contrato está al 100% de jornada y la opción está activa en perfil)
  const isJornadaCompleta100 = !isPartTime || partTimeFactor >= 1.0;
  const isAutoVacationPlusActive = profile.hasVacationPlus100Percent !== false;
  const shouldApplyVacationPlus = isAutoVacationPlusActive && isJornadaCompleta100;

  const plusVacacionesDia = yearRate.plusVacacionesDia || 10.00;
  const plusVacaciones = shouldApplyVacationPlus
    ? parseFloat((vacationDays * plusVacacionesDia).toFixed(2))
    : 0;

  const retribucionVacacionesBase = parseFloat(
    (vacationDays * yearRate.salarioBaseDia * partTimeFactor).toFixed(2)
  );

  // Base salary portion: uses accumulated shift tariff or workedDays * daily base, plus vacation base pay
  const baseDeDiasTrabajados = shiftGrossAccumulated > 0
    ? shiftGrossAccumulated
    : (workedDays * yearRate.salarioBaseDia * partTimeFactor);
  const salarioBase = parseFloat((baseDeDiasTrabajados + retribucionVacacionesBase).toFixed(2));

  const horasExtra = parseFloat((totalLateFinishMinutes / 60).toFixed(2));
  const importeHorasExtra = parseFloat(totalLateFinishAmount.toFixed(2));

  // Total Devengado (Bruto total incluyendo plus de vacaciones, horas extras / terminado tarde y pagas extras si aplican este mes)
  const totalDevengado = parseFloat(
    (
      salarioBase +
      plusVacaciones +
      plusConductorPerceptor +
      plusQuebrantoMoneda +
      plusNocturnidad +
      festivoPluses +
      outsideAgreementExtrasTotal +
      importeHorasExtra +
      prorrataPagasExtra +
      pagaExtraIntegraMes
    ).toFixed(2)
  );

  // Seguridad Social Base de Cotización (Spanish Labor Law):
  // La cotización mensual incluye obligatoriamente la doceava parte de las pagas extras (7.5 días de salario base)
  // aunque se cobren de forma íntegra en Julio/Diciembre (el mes de cobro de paga íntegra no cotiza doble).
  const regularDevengadoCotizable = totalDevengado - pagaExtraIntegraMes - dietasExentas;
  const extraProrrataCotizacion = prorrateoMode === 'tres_pagas'
    ? 0
    : prorrateoMode === 'una_paga'
      ? (5.0 * yearRate.salarioBaseDia * partTimeFactor) // Falta la parte de Julio y Diciembre que no va en nómina mensual
      : (7.5 * yearRate.salarioBaseDia * partTimeFactor);

  const baseCalculadaSS = regularDevengadoCotizable + extraProrrataCotizacion;
  const minBaseSS = 1323.00 * (isPartTime ? Math.max(partTimeFactor, 0.4) : 1.0);
  const maxBaseSS = 4709.25;

  const baseCotizacionSS = Math.max(
    minBaseSS,
    Math.min(maxBaseSS, baseCalculadaSS)
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

  // Base IRPF (incluye salario devengado e integras de extras de este mes, excluye dietas exentas)
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

    totalWorkedHours: Math.round((totalWorkedHours + horasExtra) * 100) / 100,
    nightHours: Math.round(totalNightHours * 100) / 100,
    partTimeFactor,

    // Extras Cutoff Configuration info
    extrasCutoffMode: cutoffMode,
    extrasCutoffPeriod: cutoffRange.periodText,
    extrasCutoffLabel: cutoffRange.label,
    extrasItemsList,
    pendingNextMonthExtrasCount,
    pendingNextMonthExtrasTotal: parseFloat(pendingNextMonthExtrasTotal.toFixed(2)),

    salarioBase: parseFloat(salarioBase.toFixed(2)),
    retribucionVacacionesBase,
    plusVacaciones,
    plusConductorPerceptor: parseFloat(plusConductorPerceptor.toFixed(2)),
    plusQuebrantoMoneda: parseFloat(plusQuebrantoMoneda.toFixed(2)),
    plusNocturnidad: parseFloat(plusNocturnidad.toFixed(2)),
    plusFestivos: parseFloat(festivoPluses.toFixed(2)),
    prorrataPagasExtra,
    pagaExtraIntegraMes,
    pagaExtraIntegraNombre,
    totalExtrasFueraConvenio: parseFloat(outsideAgreementExtrasTotal.toFixed(2)),
    dietasExentas: parseFloat(dietasExentas.toFixed(2)),
    dietasTributables: parseFloat(dietasTributables.toFixed(2)),
    horasExtra,
    importeHorasExtra,

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

/**
 * Calculates monthly net salary evolution across the entire selected year (12 months)
 * Computes exact payroll for months with logged assignments and realistic projection for unlogged months
 */
export function calculateYearlySalaryEvolution(
  year: number,
  assignments: DayAssignment[],
  shiftsMap: Map<string, ShiftDefinition>,
  convenio: ConvenioInfo,
  profile: WorkerProfile
): MonthlySalaryEvolution[] {
  const yearRate =
    convenio.ratesByYear[year] ||
    convenio.ratesByYear[2026] ||
    convenio.ratesByYear[2024];

  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];
  const fullMonthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const result: MonthlySalaryEvolution[] = [];

  for (let m = 1; m <= 12; m++) {
    const monthPrefix = `${year}-${String(m).padStart(2, '0')}-`;
    const monthAssignments = assignments.filter((a) => a.date.startsWith(monthPrefix));
    const hasLoggedShifts = monthAssignments.some((a) => a.shiftCode && a.shiftCode !== 'D');

    let payroll: PayrollBreakdown;
    let isProjected = false;

    if (hasLoggedShifts) {
      payroll = calculateMonthlyPayroll(
        assignments,
        shiftsMap,
        yearRate,
        profile,
        year,
        m
      );
    } else {
      isProjected = true;
      // Generate standard representative schedule for this month (Mon-Fri as standard M1 morning shift)
      const daysInM = new Date(year, m, 0).getDate();
      const syntheticAssignments: DayAssignment[] = [];
      for (let d = 1; d <= daysInM; d++) {
        const dStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, m - 1, d).getDay(); // 0 is Sunday, 6 is Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        syntheticAssignments.push({
          date: dStr,
          shiftCode: isWeekend ? 'D' : 'M1',
          isRest: isWeekend,
          isSunday: dayOfWeek === 0,
          extras: [],
        });
      }
      payroll = calculateMonthlyPayroll(
        syntheticAssignments,
        shiftsMap,
        yearRate,
        profile,
        year,
        m
      );
    }

    result.push({
      month: m,
      monthName: monthNames[m - 1],
      fullMonthName: fullMonthNames[m - 1],
      year,
      netSalary: payroll.liquidoPercibir,
      grossSalary: payroll.totalDevengado,
      deductions: payroll.totalDeducido,
      hasExtraPay: (payroll.pagaExtraIntegraMes || 0) > 0,
      extraPayName: payroll.pagaExtraIntegraNombre,
      isProjected,
      workedDays: payroll.workedDays,
      totalHours: payroll.totalWorkedHours,
    });
  }

  return result;
}
