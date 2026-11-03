export type DayType = 'laborable' | 'sabado' | 'festivo' | 'todos';

export type ShiftCategory = 'todos' | 'mañana' | 'tarde' | 'partido' | 'noche' | 'discrecional' | 'descanso';

export type ShiftModality = 'continuado' | 'partido' | 'nocturno' | 'discrecional';

export interface ShiftDefinition {
  id: string;
  code: string;
  title: string;
  category: 'mañana' | 'tarde' | 'partido' | 'noche' | 'discrecional' | 'descanso';
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
  dietaComidaCenaDiscrecional: number;
  dietaPernoctaRegular: number;
  dietaPernoctaDiscrecional: number;
  plusVacacionesDia: number;
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

export interface WorkerProfile {
  name: string;
  nif: string;
  category: string;
  companyName: string;
  cif: string;
  irpfPercentage: number; // e.g. 14.5
  contractType: 'indefinido' | 'temporal' | 'tiempo_parcial';
  partTimePercentage?: number; // e.g. 50 (50%), 75 (75%)
  prorrateoPagasExtra: ExtraPayProrrateo; // 'tres_pagas' | 'una_paga' | 'ninguna'
  prorratearPagasExtra?: boolean; // legacy compatibility
  hasMonetaryQuebranto: boolean; // cobra billetes en efectivo
  hasConductorPerceptorPlus: boolean;
  unionFeeDeduction: number; // e.g. 0.00
  advancePayment: number; // anticipos
}

export interface PayrollBreakdown {
  monthKey: string; // "2024-10"
  year: number;
  month: number;
  totalDays: number;
  workedDays: number;
  restDays: number;
  holidayDays: number;
  vacationDays: number;
  sickDays: number;

  totalWorkedHours: number;
  nightHours: number;
  partTimeFactor: number; // 1 for full time, e.g. 0.5 for 50%

  // Devengos
  salarioBase: number;
  plusConductorPerceptor: number;
  plusQuebrantoMoneda: number;
  plusNocturnidad: number;
  plusFestivos: number;
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
