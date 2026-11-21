export type DayType = 'laborable' | 'sabado' | 'festivo' | 'todos';

export type ShiftCategory = 'todos' | 'mañana' | 'tarde' | 'partido' | 'noche' | 'sabado' | 'festivo' | 'discrecional' | 'descanso' | 'vacaciones';

export type ShiftModality = 'continuado' | 'partido' | 'nocturno' | 'discrecional';

export interface ShiftDefinition {
  id: string;
  code: string;
  title: string;
  category: 'mañana' | 'tarde' | 'partido' | 'noche' | 'discrecional' | 'descanso' | 'vacaciones';
  dayType: DayType;
  modality: ShiftModality;
  terminal: string; // e.g. "Cochera Central - Línea 101"
  startTime: string; // e.g. "06:00"
  endTime: string; // e.g. "14:15"
  secondStartTime?: string; // For split shifts (partido)
  secondEndTime?: string;
  drivingDuration: string; // e.g. "07:45"
  computedDuration: string; // e.g. "08:15"
  fixedRate?: number; // e.g. 82.00
  color: string; // e.g. "#eab308"
  badges: string[]; // e.g. ["Servicio Ordinario"]
  notes?: string;
  isCustom?: boolean;
  hasPlusReten?: boolean; // Turno de retén (+8,25 €)
  hasConductorPerceptor?: boolean; // Plus conductor perceptor (false si es retén)
  hasQuebrantoMoneda?: boolean; // Quebranto de moneda (false si es retén)
}

export type ExtraUnit = 'fijo' | 'hora' | 'dia' | 'servicio';

export interface ExtraConcept {
  id: string;
  name: string;
  amount: number;
  unit: ExtraUnit;
  description: string;
  tags: string[]; // e.g. ["Fuera de convenio", "Importe fijo"]
  active: boolean;
  isTaxable: boolean; // default true for IRFP/SS
}

export interface DayExtraItem {
  id: string;
  conceptId?: string;
  name: string;
  amount: number;
  notes?: string;
  quantity?: number;
}

export interface DayAssignment {
  date: string; // "YYYY-MM-DD"
  shiftId?: string; // References ShiftDefinition.id or special 'D' (Descanso), 'R' (Reserva), 'V' (Vacaciones), 'B' (Baja)
  shiftCode?: string;
  isHoliday?: boolean;
  isSunday?: boolean;
  isRest?: boolean;
  isVacation?: boolean;
  isSickLeave?: boolean;
  customStartTime?: string;
  customEndTime?: string;
  customLine?: string;
  customVehicle?: string;
  extras: DayExtraItem[];
  notes?: string;
  // Terminado más tarde del turno (exceso de jornada / horas extraordinarias sin pasos mínimos de tiempo)
  lateFinishMinutes?: number; // Total minutos de exceso (ej. 65 para 1h 5m, 40 para 40m)
  lateFinishHours?: number;   // Componente de horas (ej. 1)
  lateFinishMins?: number;    // Componente de minutos (ej. 5, 40)
  lateFinishAmount?: number;  // Importe económico devengado (€)
  lateFinishReason?: string;  // Motivo opcional (ej. Retraso por tráfico, avería, relevo tarde)
}

export interface ConvenioYearRate {
  year: number;
  salarioBaseDia: number;
  salarioBaseAnual: number;
  horaOrdinaria: number;
  plusNocturnidadHora: number;
  plusConductorPerceptorDia: number; // >= 4h
  plusConductorPerceptorDiaReducido: number; // < 4h
  quebrantoMonedaDia: number;
  plusFestivoMayor4h: number;
  plusFestivoMenor4h: number;
  plus24y31Diciembre: number;
  dietaComidaCenaRegular: number;
  dietaComidaCenaDiscrecional?: number;
  dietaPernoctaRegular: number;
  dietaPernoctaDiscrecional: number;
  plusVacacionesDia: number;
  plusPuntualidadDia?: number;
  salarioBaseDiaMasats?: number;
  plusRetenDia?: number;
  prorrataPagaDia?: number;
  horasJornadaAnual: number;
}

export interface ConvenioInfo {
  title: string;
  bopzNumber: string;
  publicationDate: string;
  validFrom: string;
  validTo: string;
  ultractividadTo: string;
  isExpired: boolean;
  isExtended: boolean;
  extensionNotes?: string;
  ratesByYear: Record<number, ConvenioYearRate>;
}

export type ExtraPayProrrateo = 'tres_pagas' | 'una_paga' | 'ninguna';

export type ExtrasCutoffMode = 'direxis_25_24' | 'mes_natural' | 'personalizado';

export interface WorkerProfile {
  name: string;
  nif: string;
  category: string;
  autonomousCommunity?: string; // e.g. 'aragon'
  locality?: string; // e.g. 'Zaragoza', 'Utebo', 'Calatayud'
  companyName: string;
  cif: string;
  irpfPercentage: number; // e.g. 14.5
  contractType: 'indefinido' | 'temporal' | 'tiempo_parcial';
  partTimePercentage?: number; // e.g. 50 (50%), 75 (75%)
  prorrateoPagasExtra: ExtraPayProrrateo; // 'tres_pagas' | 'una_paga' | 'ninguna'
  prorratearPagasExtra?: boolean; // legacy compatibility
  extrasCutoffMode?: ExtrasCutoffMode; // 'direxis_25_24' (25 mes anterior al 24 actual) | 'mes_natural' (1 al 31) | 'personalizado'
  customCutoffStartDay?: number; // e.g. 25
  hasMonetaryQuebranto: boolean; // cobra billetes en efectivo
  hasConductorPerceptorPlus: boolean;
  hasVacationPlus?: boolean; // Activar automáticamente el plus de vacaciones Art. 9 (10 €/día al 100%, proporcional al % de jornada) en días 'V'
  hasVacationPlus100Percent?: boolean; // legacy compatibility
  hasPunctualityEarlyStartPlus?: boolean; // Habilitar opción diaria de Plus puntualidad e inicio temprano en calendario
  salaryBaseRateMode?: 'convenio_53_18' | 'masats_39_89'; // 53.18 € Convenio Zaragoza o 39.89 € Recibo Masats
  unionFeeDeduction: number; // e.g. 0.00
  advancePayment: number; // anticipos
}

export interface PayrollLineItem {
  id: string;
  code?: string;
  name: string;
  quantity: number;
  quantityLabel: string;
  unit: string;
  unitPrice: number;
  amount: number;
  category: 'base' | 'plus' | 'horas' | 'prorrata' | 'extra';
  isOfficial?: boolean;
}

export interface PayrollExtraItemDetail {
  date: string;
  name: string;
  amount: number;
  notes?: string;
}

export interface PayrollBreakdown {
  monthKey: string; // "2026-10"
  year: number;
  month: number;
  totalDays: number;
  workedDays: number;
  restDays: number;
  holidayDays: number;
  vacationDays: number;
  vacationPlusDays: number;
  sickDays: number;

  totalWorkedHours: number;
  ordinaryConvenioHours: number; // Horas ordinarias dentro de convenio (excluyendo horas festivas)
  nightHours: number;
  partTimeFactor: number; // 1 for full time, e.g. 0.5 for 50%
  convenioAnnualHoursBase: number; // e.g. 1776h al 100% (Art. 14 Convenio)
  convenioAnnualHoursTarget: number; // e.g. 1332h al 75%, 1776h al 100%
  convenioMonthlyHoursTarget: number; // e.g. 111h al 75%, 148h al 100%

  // Extras Cutoff Configuration info
  extrasCutoffMode: ExtrasCutoffMode;
  extrasCutoffPeriod: string; // e.g. "25 Sep al 24 Oct"
  extrasCutoffLabel: string; // e.g. "Ciclo Direxis Zaragoza (25 al 24)"
  extrasCutoffStartDate: string; // "YYYY-MM-DD" inclusive
  extrasCutoffEndDate: string; // "YYYY-MM-DD" inclusive
  prevMonthCutoffStartDate?: string; // "YYYY-MM-DD" inclusive (when cutoff starts in previous month)
  prevMonthCutoffEndDate?: string; // "YYYY-MM-DD" inclusive (last day of previous month)
  currentMonthCutoffStartDate: string; // "YYYY-MM-DD" inclusive (1st of calculated month)
  currentMonthCutoffEndDate: string; // "YYYY-MM-DD" inclusive
  prevMonthCutoffTotal: number; // Sum of extrasItemsList in prev month stretch
  currentMonthCutoffTotal: number; // Sum of extrasItemsList in current month stretch
  prevMonthCutoffWorkedDays: number; // Worked shift days in prev month stretch
  currentMonthCutoffWorkedDays: number; // Worked shift days in current month stretch
  prevMonthCutoffRecordDays: number; // Any recorded calendar days (worked, rest, vacation, sick, notes, extras) in prev month stretch
  currentMonthCutoffRecordDays: number; // Any recorded calendar days in current month stretch
  prevMonthCutoffRestDays: number; // Rest / sick days (D/B) in prev month stretch
  currentMonthCutoffRestDays: number; // Rest / sick days (D/B) in current month stretch
  prevMonthCutoffVacationDays: number; // Vacation days (V) in prev month stretch
  currentMonthCutoffVacationDays: number; // Vacation days (V) in current month stretch
  extrasItemsList: PayrollExtraItemDetail[];
  pendingNextMonthExtrasCount?: number; // Extras after cutoff in the current month
  pendingNextMonthExtrasTotal?: number;

  // Lista detallada de conceptos con Cuantía (Nº de veces), Precio Unitario e Importe
  lines: PayrollLineItem[];
  salarioBaseDays: number;
  salarioBaseUnitPrice: number;
  plusFestivoCount: number;
  quebrantoCount: number;
  horasComplementarias: number;
  horasExcesoDiario9h: number;
  horasExcesoMensual: number;
  horasFestivas: number;
  horasFT: number;
  plusRetenCount: number;
  plusConductorCount: number;
  medioPlusConductorCount: number;
  plusPuntualidadCount: number;
  prorrataDays: number;

  // Devengos
  salarioBase: number;
  retribucionVacacionesBase: number;
  plusVacaciones: number;
  plusConductorPerceptor: number;
  medioPlusConductorAmount: number;
  plusQuebrantoMoneda: number;
  plusNocturnidad: number;
  plusFestivos: number;
  horasFestivasAmount: number;
  horasFTAmount: number;
  plusRetenAmount: number;
  plusPuntualidadAmount: number;
  prorrataPagasExtra: number;
  pagaExtraIntegraMes: number; // Paga completa de Julio o Diciembre si aplica
  pagaExtraIntegraNombre?: string; // 'Paga Extra de Julio' | 'Paga Extra de Navidad (Diciembre)'
  totalExtrasFueraConvenio: number;
  dietasExentas: number;
  dietasTributables: number;
  horasExtra: number;
  importeHorasExtra: number;

  totalDevengado: number; // Bruto total
  baseCotizacionSS: number;

  // Deducciones Trabajador
  contingenciasComunes: number; // 4.70%
  desempleo: number; // 1.55%
  formacionProfesional: number; // 0.10%
  mei: number; // 0.12% - 0.15%
  totalSeguridadSocial: number;

  retencionIrpf: number; // IRPF %
  retencionIrpfImporte: number;
  cuotaSindical: number;
  anticipos: number;
  totalDeducido: number;

  liquidoPercibir: number; // Neto

  // Costes Empresa (informativo)
  ssEmpresaCC: number; // 23.60%
  ssEmpresaDesempleo: number; // 5.50%
  ssEmpresaFP: number; // 0.60%
  ssEmpresaFogasa: number; // 0.20%
  ssEmpresaMEI: number; // 0.58%
  totalCosteEmpresa: number;
}

export interface MonthlySalaryEvolution {
  month: number; // 1 to 12
  monthName: string; // 'Ene', 'Feb', ...
  fullMonthName: string; // 'Enero', 'Febrero', ...
  year: number;
  netSalary: number; // Líquido a percibir (€)
  grossSalary: number; // Total devengado (€)
  deductions: number; // Total deducido (€)
  hasExtraPay: boolean; // Si tiene paga íntegra este mes
  extraPayName?: string;
  isProjected: boolean; // Si es proyección estimada o datos reales del cuadrante
  workedDays: number;
  totalHours: number;
  ordinaryConvenioHours?: number;
}

export type AnnualExtrasPayMode = 'prorrateadas' | 'integras' | 'mixta_marzo_prorr';
export type BolsaRepartoMode = 'lineal' | 'equilibrado';
export type SickLeaveContingencyType = 'comun' | 'accidente_100' | 'accidente_75';

export interface AnnualEditableParams {
  horasAnuales100: number;
  jornadaPct: number;
  vacReglamentarias: number;
  baseMes100: number;
  compMes100: number;
  numPagas: number;
  modoExtras: AnnualExtrasPayMode;
  plusVacDia100: number;
  repartoBolsa: BolsaRepartoMode;
}

export interface AnnualMonthEditableFields {
  habilesCal: number;
  vacNat: number;
  vacLab: number;
  bajaNat: number;
  bajaLab: number;
  tipoBaja: SickLeaveContingencyType;
  horasReales?: number;
}

export interface AnnualYearOverrideData {
  paramOverrides?: Partial<AnnualEditableParams>;
  monthOverrides?: Record<number, Partial<AnnualMonthEditableFields>>;
  updatedAt?: string;
}

export type AnnualCalendarState = Record<number, AnnualYearOverrideData>;

