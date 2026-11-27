import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { NominaView } from './components/NominaView';
import { CalendarioView } from './components/CalendarioView';
import { TurnosBDView } from './components/TurnosBDView';
import { ExtrasView } from './components/ExtrasView';
import { StartMenuView } from './components/StartMenuView';
import { CalendarioAnualView } from './components/CalendarioAnualView';
import { TurnoEditModal } from './components/TurnoEditModal';
import { ConvenioModal } from './components/ConvenioModal';
import { WorkerProfileModal } from './components/WorkerProfileModal';

import {
  ShiftDefinition,
  ExtraConcept,
  DayAssignment,
  ConvenioInfo,
  ConvenioYearRate,
  WorkerProfile,
  AnnualCalendarState,
  AnnualYearOverrideData,
  ValidatedMonthRecord,
  ValidatedMonthsMap,
} from './types';
import { ALL_INITIAL_SHIFTS, BAJA_SHIFT, DESCANSO_SHIFT, VACACIONES_SHIFT } from './data/defaultTurnos';
import { DEFAULT_EXTRAS } from './data/defaultExtras';
import { DEFAULT_CONVENIO_ZARAGOZA, getEffectiveYearRate } from './data/convenioZaragoza';
import {
  calculateMonthlyPayroll,
  calculateYearlySalaryEvolution,
  getExtrasDateRange,
  reconcileValidatedMonthsMap,
} from './utils/calculator';
import {
  deriveDefaultAnnualParams,
  deriveDefaultAnnualMonths,
  resolveAnnualParams,
  resolveAnnualMonths,
  calculateAnnualLiquidation,
} from './utils/annualCalendar';
import { exportToPDF, exportToPDFBlob, exportToExcel } from './utils/exporter';

import { User as FirebaseUser } from 'firebase/auth';
import { initAuth, logout, getCachedAccessToken } from './services/authService';
import {
  ensureDirexisHierarchy,
  findFileInFolder,
  readDriveJsonFile,
  saveOrUpdateDriveJsonFile,
  uploadPdfToDrive,
  listArchivedFilesInNominas,
  DriveFolderInfo,
  DriveFileInfo,
} from './services/googleDriveService';
import { GoogleLoginModal } from './components/GoogleLoginModal';
import { DriveNominasModal } from './components/DriveNominasModal';
import { PublicFooter, PublicLegalPage } from './components/PublicFooter';
import { LegalPageView } from './components/LegalPageView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ConfirmModal } from './components/ConfirmModal';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

function getPublicPageFromUrl(): PublicLegalPage | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page');
  if (page === 'privacidad' || page === 'terminos') {
    return page;
  }
  return null;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const EMPTY_WORKER_PROFILE: WorkerProfile = {
  name: '',
  nif: '',
  category: '',
  autonomousCommunity: 'aragon',
  locality: '',
  companyName: '',
  cif: '',
  irpfPercentage: 0,
  contractType: 'indefinido',
  partTimePercentage: 100,
  prorrateoPagasExtra: 'tres_pagas',
  prorratearPagasExtra: true,
  extrasCutoffMode: 'direxis_25_24',
  customCutoffStartDay: 25,
  hasMonetaryQuebranto: true,
  hasConductorPerceptorPlus: true,
  hasVacationPlus: true,
  hasPunctualityEarlyStartPlus: false,
  salaryBaseRateMode: 'convenio_53_18',
  unionFeeDeduction: 0,
  advancePayment: 0,
};

const DELETED_MOCK_CODES = new Set([
  'M1', 'T1', 'T2', 'T3', 'T4', 'T5', 'N1', 'DISC', 'M2', 'R', 'S1', 'S2', 'F1', 'F2', 'SP1'
]);

function mapLegacyShiftCode(code?: string): string | undefined {
  if (!code) return code;
  const trimmed = String(code).trim();
  if (!trimmed) return undefined;
  if (trimmed === 'M1') return '6V.L01';
  if (trimmed === 'M2') return '6V.L03';
  if (trimmed === 'T1' || trimmed === 'T2' || trimmed === 'T3' || trimmed === 'T4' || trimmed === 'T5') return '6V.L02';
  if (trimmed === 'N1') return '6V.LCC';
  if (trimmed === 'R') return '6V.LR1';
  if (/\/L/i.test(trimmed)) return trimmed.replace(/\/L/gi, '');
  if (trimmed === 'F1' || trimmed === 'F2') return '6.D03';
  if (trimmed === 'DISC' || trimmed === 'SP1') return '6V.L01';
  return trimmed;
}

function normalizeDateKey(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim().split('T')[0];
  const m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return trimmed;
}

function hasMeaningfulAssignmentContent(a?: DayAssignment): boolean {
  if (!a) return false;
  return Boolean(
    (a.shiftCode && a.shiftCode.trim() !== '') ||
      (a.shiftId && a.shiftId.trim() !== '') ||
      a.isRest ||
      a.isVacation ||
      a.isSickLeave ||
      a.isHoliday ||
      (a.extras && a.extras.length > 0) ||
      (a.lateFinishMinutes && a.lateFinishMinutes > 0) ||
      (a.notes && a.notes.trim() !== '') ||
      (a.customLine && a.customLine.trim() !== '')
  );
}

function normalizeAssignmentsList(rawList: DayAssignment[], availableShifts?: ShiftDefinition[]): DayAssignment[] {
  const byDate = new Map<string, DayAssignment>();
  for (const a of rawList) {
    const dateKey = normalizeDateKey(a.date);
    if (!dateKey) continue;
    const yr = parseInt(dateKey.split('-')[0], 10);
    if (isNaN(yr) || dateKey < '2025-12-01') continue;

    let resolvedCode = mapLegacyShiftCode(a.shiftCode);
    if (!resolvedCode && a.shiftId) {
      if (a.shiftId === 'D' || a.shiftId === 'V' || a.shiftId === 'B') {
        resolvedCode = a.shiftId;
      } else if (availableShifts) {
        const matched = availableShifts.find((s) => s.id === a.shiftId);
        if (matched) resolvedCode = matched.code;
      }
    }

    const item: DayAssignment = {
      ...a,
      date: dateKey,
      shiftCode: resolvedCode,
      extras: Array.isArray(a.extras) ? a.extras : [],
    };
    const existing = byDate.get(dateKey);
    if (!existing) {
      byDate.set(dateKey, item);
    } else {
      const incomingHasShift = Boolean(item.shiftCode || item.shiftId || item.isRest || item.isVacation || item.isSickLeave);
      byDate.set(dateKey, {
        ...existing,
        ...item,
        shiftCode: incomingHasShift ? item.shiftCode : existing.shiftCode,
        shiftId: incomingHasShift ? item.shiftId : existing.shiftId,
        shiftSnapshot: incomingHasShift ? item.shiftSnapshot : existing.shiftSnapshot,
        isRest: incomingHasShift ? item.isRest : existing.isRest,
        isVacation: incomingHasShift ? item.isVacation : existing.isVacation,
        isSickLeave: incomingHasShift ? item.isSickLeave : existing.isSickLeave,
        isHoliday: Boolean(existing.isHoliday || item.isHoliday),
        extras: item.extras.length > 0 ? item.extras : existing.extras,
        lateFinishMinutes: (item.lateFinishMinutes || 0) > 0 ? item.lateFinishMinutes : existing.lateFinishMinutes,
      });
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function mergeAssignmentsByDate(
  localList: DayAssignment[],
  remoteList: DayAssignment[],
  preferLocalOnConflict: boolean
): DayAssignment[] {
  const localMap = new Map<string, DayAssignment>();
  localList.forEach((a) => {
    const k = normalizeDateKey(a.date);
    if (k) localMap.set(k, { ...a, date: k });
  });
  const remoteMap = new Map<string, DayAssignment>();
  remoteList.forEach((a) => {
    const k = normalizeDateKey(a.date);
    if (k) remoteMap.set(k, { ...a, date: k });
  });

  const allDates = Array.from(new Set([...localMap.keys(), ...remoteMap.keys()])).sort();
  const merged: DayAssignment[] = [];
  for (const dateKey of allDates) {
    const l = localMap.get(dateKey);
    const r = remoteMap.get(dateKey);
    if (l && !r) {
      merged.push(l);
    } else if (!l && r) {
      merged.push(r);
    } else if (l && r) {
      if (preferLocalOnConflict) {
        merged.push(l);
      } else if (hasMeaningfulAssignmentContent(l) && !hasMeaningfulAssignmentContent(r)) {
        merged.push(l);
      } else {
        merged.push(r);
      }
    }
  }
  return merged;
}

function mergeValidatedMonths(
  localMap: ValidatedMonthsMap,
  remoteMap: ValidatedMonthsMap,
  preferLocalOnConflict: boolean
): ValidatedMonthsMap {
  const merged: ValidatedMonthsMap = { ...remoteMap };
  for (const [key, localRec] of Object.entries(localMap)) {
    const remoteRec = remoteMap[key];
    if (!remoteRec) {
      merged[key] = localRec;
    } else if (preferLocalOnConflict) {
      merged[key] = localRec;
    } else {
      const localTs = Date.parse(localRec.validatedAt || '') || 0;
      const remoteTs = Date.parse(remoteRec.validatedAt || '') || 0;
      merged[key] = localTs >= remoteTs ? localRec : remoteRec;
    }
  }
  return merged;
}

const ASSIGNMENTS_DIRTY_KEY = 'rutanomina_assignments_dirty_v1';
const PENDING_SYNC_DIRTY_KEY = 'rutanomina_pending_sync_v1';

type SyncDatasetKey =
  | 'assignments'
  | 'shifts'
  | 'extras'
  | 'convenio'
  | 'profile'
  | 'annualCalendarData'
  | 'validatedMonths';

type DirtyDatasetsMap = Partial<Record<SyncDatasetKey, boolean>>;

function readAssignmentsDirtyFlag(): boolean {
  try {
    return localStorage.getItem(ASSIGNMENTS_DIRTY_KEY) === '1';
  } catch {
    return false;
  }
}

function writeAssignmentsDirtyFlag(dirty: boolean): void {
  try {
    if (dirty) {
      localStorage.setItem(ASSIGNMENTS_DIRTY_KEY, '1');
    } else {
      localStorage.removeItem(ASSIGNMENTS_DIRTY_KEY);
    }
  } catch {
    // ignore storage quota/privacy mode errors
  }
}

function readPendingSyncDirtyMap(): DirtyDatasetsMap {
  const result: DirtyDatasetsMap = {};
  try {
    const raw = localStorage.getItem(PENDING_SYNC_DIRTY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(result, parsed);
      }
    }
  } catch {
    // ignore
  }
  if (readAssignmentsDirtyFlag()) {
    result.assignments = true;
  }
  return result;
}

function writePendingSyncDirtyMap(map: DirtyDatasetsMap): void {
  const hasAny = Object.values(map).some(Boolean);
  writeAssignmentsDirtyFlag(Boolean(map.assignments));
  try {
    if (hasAny) {
      localStorage.setItem(PENDING_SYNC_DIRTY_KEY, JSON.stringify(map));
    } else {
      localStorage.removeItem(PENDING_SYNC_DIRTY_KEY);
    }
  } catch {
    // ignore storage quota/privacy mode errors
  }
}

export default function App() {
  const [publicPage, setPublicPage] = useState<PublicLegalPage | null>(() => getPublicPageFromUrl());
  const [currentTab, setCurrentTab] = useState<'inicio' | 'turnos' | 'calendario' | 'nomina' | 'extras' | 'anual'>('inicio');
  const [selectedYear, setSelectedYear] = useState(() => Math.max(2026, new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() < 2026 ? 1 : now.getMonth() + 1;
  });

  const ensureBuiltInSpecialShifts = (list: ShiftDefinition[]): ShiftDefinition[] => {
    const hasCode = (c: string) =>
      list.some((s) => s.code?.trim().toUpperCase() === c);
    const additions: ShiftDefinition[] = [];
    if (!hasCode('D')) additions.push(DESCANSO_SHIFT);
    if (!hasCode('V')) additions.push(VACACIONES_SHIFT);
    if (!hasCode('B')) additions.push(BAJA_SHIFT);
    if (additions.length === 0) return list;
    return [...additions, ...list];
  };

  // Turnos iniciales: cargados directamente del JSON base de turnos de la aplicación
  const [shifts, setShifts] = useState<ShiftDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_shifts_v11');
      if (saved) {
        const parsed: ShiftDefinition[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return ensureBuiltInSpecialShifts(parsed);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return ensureBuiltInSpecialShifts(ALL_INITIAL_SHIFTS);
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_shifts_v11', JSON.stringify(shifts));
    } catch (e) {
      console.error(e);
    }
  }, [shifts]);

  const mergeWithDefaultBuiltInExtras = (list: ExtraConcept[]): ExtraConcept[] => {
    const hasFT = list.some((e) => e.id === 'extra-ft' || e.name.toLowerCase().includes('f/t'));
    if (hasFT) return list;
    const defaultFT = DEFAULT_EXTRAS.find((e) => e.id === 'extra-ft');
    return defaultFT ? [...list, defaultFT] : list;
  };

  // Conceptos vinculados al convenio (sin extras ficticios precargados)
  const [extras, setExtras] = useState<ExtraConcept[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_extras_v3');
      if (saved) {
        const parsed: ExtraConcept[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return mergeWithDefaultBuiltInExtras(parsed);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_EXTRAS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_extras_v3', JSON.stringify(extras));
    } catch (e) {
      console.error(e);
    }
  }, [extras]);

  // Calendario limpio al inicio; lo rellena el usuario o se recupera de Google Drive
  const [assignments, setAssignments] = useState<DayAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_assignments_v7');
      if (saved) {
        const parsed: DayAssignment[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return normalizeAssignmentsList(parsed);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_assignments_v7', JSON.stringify(assignments));
    } catch (e) {
      console.error(e);
    }
  }, [assignments]);

  // Convenio Colectivo inicial cargado desde el JSON oficial de 2026
  const [convenio, setConvenio] = useState<ConvenioInfo>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_convenio_v4');
      if (saved) {
        const parsed: ConvenioInfo = JSON.parse(saved);
        const cleanedRates: Record<number, ConvenioYearRate> = {};
        for (const [k, v] of Object.entries(parsed.ratesByYear || {})) {
          const yNum = Number(k);
          if (yNum >= 2026 && v) {
            const rawRate = v as ConvenioYearRate;
            cleanedRates[yNum] = {
              ...DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026],
              ...rawRate,
              plusFestivoMayor4h: rawRate.plusFestivoMayor4h === 42.80 ? 40.80 : (rawRate.plusFestivoMayor4h ?? 40.80),
              plusVacacionesDia: rawRate.plusVacacionesDia && rawRate.plusVacacionesDia > 0 ? rawRate.plusVacacionesDia : 10.00,
              year: yNum,
            };
          }
        }
        if (!cleanedRates[2026]) {
          cleanedRates[2026] = { ...DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026] };
        }
        return {
          ...DEFAULT_CONVENIO_ZARAGOZA,
          ...parsed,
          validFrom: '2026-01-01',
          ratesByYear: cleanedRates,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CONVENIO_ZARAGOZA;
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_convenio_v4', JSON.stringify(convenio));
    } catch (e) {
      console.error(e);
    }
  }, [convenio]);

  // Perfil del trabajador limpio al inicio; el usuario lo introduce la primera vez
  const [profile, setProfile] = useState<WorkerProfile>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_profile_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...EMPTY_WORKER_PROFILE,
          ...parsed,
          hasVacationPlus: parsed.hasVacationPlus !== undefined ? parsed.hasVacationPlus : true,
          hasPunctualityEarlyStartPlus: parsed.hasPunctualityEarlyStartPlus === true,
          fechaAlta: typeof parsed.fechaAlta === 'string' && parsed.fechaAlta.trim() ? parsed.fechaAlta.trim() : undefined,
          fechaBaja: typeof parsed.fechaBaja === 'string' && parsed.fechaBaja.trim() ? parsed.fechaBaja.trim() : undefined,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return EMPTY_WORKER_PROFILE;
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_profile_v2', JSON.stringify(profile));
    } catch (e) {
      console.error(e);
    }
  }, [profile]);

  // Ediciones anuales personalizadas para Calendario Anual / Bolsa de Horas (sincronizadas con Drive)
  const [annualCalendarData, setAnnualCalendarData] = useState<AnnualCalendarState>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_annual_calendar_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return parsed as AnnualCalendarState;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_annual_calendar_v1', JSON.stringify(annualCalendarData));
    } catch (e) {
      console.error(e);
    }
  }, [annualCalendarData]);

  // Meses validados (guardan % jornada, % IRPF, datos de horas y snapshot íntegro de la nómina)
  const [validatedMonths, setValidatedMonths] = useState<ValidatedMonthsMap>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_validated_months_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return reconcileValidatedMonthsMap(parsed as ValidatedMonthsMap, {
            assignments,
            shifts,
            convenio,
            profile,
            annualCalendarData,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  useEffect(() => {
    if (Object.keys(validatedMonths).length === 0) return;
    const reconciled = reconcileValidatedMonthsMap(validatedMonths, {
      assignments,
      shifts,
      convenio,
      profile,
      annualCalendarData,
    });
    if (JSON.stringify(reconciled) !== JSON.stringify(validatedMonths)) {
      setValidatedMonths(reconciled);
    }
  }, [validatedMonths, assignments, shifts, convenio, profile, annualCalendarData]);

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_validated_months_v1', JSON.stringify(validatedMonths));
    } catch (e) {
      console.error(e);
    }
  }, [validatedMonths]);

  // Modals state
  const [isTurnoModalOpen, setIsTurnoModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftDefinition | null>(null);
  const [isConvenioModalOpen, setIsConvenioModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isOnboardingProfile, setIsOnboardingProfile] = useState(false);

  // Google Drive & Auth State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getCachedAccessToken());
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [driveFolders, setDriveFolders] = useState<DriveFolderInfo | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDriveNominasModalOpen, setIsDriveNominasModalOpen] = useState(false);
  const [archivedNominas, setArchivedNominas] = useState<DriveFileInfo[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [isSavingCurrentNomina, setIsSavingCurrentNomina] = useState(false);
  const [isValidatingMonth, setIsValidatingMonth] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const [authRedirectError, setAuthRedirectError] = useState<string | null>(null);
  const [dirtyDatasets, setDirtyDatasets] = useState<DirtyDatasetsMap>(() => readPendingSyncDirtyMap());
  const [isUpdatingDrive, setIsUpdatingDrive] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const hasInitialDriveSyncDoneRef = React.useRef(false);
  const syncPromiseRef = React.useRef<Promise<void> | null>(null);
  const hasPendingLocalSyncRef = React.useRef(Object.values(readPendingSyncDirtyMap()).some(Boolean));
  const pendingActualizarAfterLoginRef = React.useRef(false);
  const isApplyingRemoteSyncRef = React.useRef(false);
  const lastSyncedAssignmentsJsonRef = React.useRef<string | null>(null);
  const [payrollCalcNonce, setPayrollCalcNonce] = useState(0);
  const [lastPayrollCalculatedAt, setLastPayrollCalculatedAt] = useState<Date>(() => new Date());
  const [isRefreshingForNomina, setIsRefreshingForNomina] = useState(false);
  const latestStateRef = React.useRef({ shifts, profile, convenio, assignments, extras, annualCalendarData, validatedMonths });
  latestStateRef.current = { shifts, profile, convenio, assignments, extras, annualCalendarData, validatedMonths };

  const hasUnsavedChanges = useMemo(
    () => Object.values(dirtyDatasets).some(Boolean),
    [dirtyDatasets]
  );

  const markDatasetsDirty = (...keys: SyncDatasetKey[]) => {
    setDirtyDatasets((prev) => {
      const next: DirtyDatasetsMap = { ...prev };
      let changed = false;
      for (const k of keys) {
        if (!next[k]) {
          next[k] = true;
          changed = true;
        }
      }
      if (!changed) return prev;
      writePendingSyncDirtyMap(next);
      hasPendingLocalSyncRef.current = true;
      return next;
    });
  };

  const clearDirtyDatasets = (keys?: SyncDatasetKey[]) => {
    setDirtyDatasets((prev) => {
      const next: DirtyDatasetsMap = keys ? { ...prev } : {};
      if (keys) {
        keys.forEach((k) => {
          delete next[k];
        });
      }
      writePendingSyncDirtyMap(next);
      hasPendingLocalSyncRef.current = Object.values(next).some(Boolean);
      return next;
    });
  };

  // Sincronizar navegación URL (?page=privacidad / ?page=terminos)
  useEffect(() => {
    const handlePopState = () => {
      setPublicPage(getPublicPageFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToPublicPage = (page: PublicLegalPage | null) => {
    setPublicPage(page);
    if (page) {
      setIsLoginModalOpen(false);
    }
    if (typeof window !== 'undefined') {
      const url = page ? `/?page=${page}` : '/';
      window.history.pushState({}, '', url);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Inicializar estado de autenticación al arrancar la app (incluyendo retorno por redirección en móvil)
  useEffect(() => {
    const unsubscribe = initAuth((user, token, authErr) => {
      setCurrentUser(user);
      if (authErr) {
        const msg =
          authErr instanceof Error
            ? authErr.message
            : 'No se pudo completar el inicio de sesión con Google.';
        setAuthRedirectError(msg);
      }
      if (token) {
        setAuthRedirectError(null);
        setAccessToken(token);
        setIsLoginModalOpen(false);
        syncWithDrive(token);
      } else {
        // Al entrar en la página principal (salvo páginas legales públicas), pedir identificarse con Google Drive
        setAccessToken(null);
        if (!getPublicPageFromUrl()) {
          setIsLoginModalOpen(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Función principal de sincronización con Google Drive (Direxis / Nóminas)
  const syncWithDrive = async (token: string, isManual = false): Promise<void> => {
    if (syncPromiseRef.current && !isManual) {
      return syncPromiseRef.current;
    }
    if (syncPromiseRef.current) {
      await syncPromiseRef.current;
    }

    const run = (async () => {
      setIsDriveSyncing(true);
      setDriveSyncError(null);
      try {
        const folders = await ensureDirexisHierarchy(token);
        setDriveFolders(folders);
        const currentSnapshot = latestStateRef.current;
        const dirtySnapshot = readPendingSyncDirtyMap();
        let effectiveShifts = currentSnapshot.shifts;
        let effectiveProfile = currentSnapshot.profile;
        let effectiveConvenio = currentSnapshot.convenio;
        let effectiveAssignments = currentSnapshot.assignments;
        let effectiveAnnualData = currentSnapshot.annualCalendarData;

        // 1. Turnos base (respetar cambios locales pendientes si no se actualizaron en Drive)
        const turnosFile = await findFileInFolder(token, 'turnos_base.json', folders.nominasFolderId);
        if (turnosFile && !dirtySnapshot.shifts) {
          const driveShifts = await readDriveJsonFile<ShiftDefinition[]>(token, turnosFile.id);
          if (driveShifts && Array.isArray(driveShifts) && driveShifts.length > 0) {
            const cleaned = driveShifts.map((s) => {
              if (s.code.includes('/L')) {
                const cleanCode = s.code.replace(/\/L/g, '');
                return {
                  ...s,
                  code: cleanCode,
                  title: s.title ? s.title.replace(/\/L/g, '') : `Servicio ${cleanCode}`,
                };
              }
              return s;
            });
            effectiveShifts = ensureBuiltInSpecialShifts(cleaned);
            setShifts(effectiveShifts);
          }
        } else if (!turnosFile) {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'turnos_base.json', currentSnapshot.shifts);
        }

        // 2. Configuración de chófer
        let needsProfileOnboarding = false;
        const choferFile = await findFileInFolder(token, 'chofer_config.json', folders.nominasFolderId);
        if (choferFile && !dirtySnapshot.profile) {
          const driveProfile = await readDriveJsonFile<WorkerProfile>(token, choferFile.id);
          if (driveProfile && driveProfile.name?.trim()) {
            effectiveProfile = {
              ...EMPTY_WORKER_PROFILE,
              ...driveProfile,
              hasVacationPlus: driveProfile.hasVacationPlus !== undefined ? driveProfile.hasVacationPlus : true,
              hasPunctualityEarlyStartPlus: driveProfile.hasPunctualityEarlyStartPlus === true,
              fechaAlta: typeof driveProfile.fechaAlta === 'string' && driveProfile.fechaAlta.trim() ? driveProfile.fechaAlta.trim() : undefined,
              fechaBaja: typeof driveProfile.fechaBaja === 'string' && driveProfile.fechaBaja.trim() ? driveProfile.fechaBaja.trim() : undefined,
            };
            isApplyingRemoteSyncRef.current = true;
            setProfile(effectiveProfile);
          } else if (currentSnapshot.profile.name.trim()) {
            await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'chofer_config.json', currentSnapshot.profile);
          } else {
            needsProfileOnboarding = true;
          }
        } else if (!choferFile && currentSnapshot.profile.name.trim()) {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'chofer_config.json', currentSnapshot.profile);
        } else if (!choferFile && !currentSnapshot.profile.name.trim()) {
          needsProfileOnboarding = true;
        }

        // 3. Valores del Convenio de 2026
        const convenioFile = await findFileInFolder(token, 'convenio_2026.json', folders.nominasFolderId);
        if (convenioFile && !dirtySnapshot.convenio) {
          const driveConvenio = await readDriveJsonFile<ConvenioInfo>(token, convenioFile.id);
          if (driveConvenio && driveConvenio.ratesByYear) {
            const migratedRates: Record<number, ConvenioYearRate> = {};
            for (const [k, v] of Object.entries(driveConvenio.ratesByYear)) {
              const yNum = Number(k);
              if (yNum >= 2026 && v) {
                const r = v as ConvenioYearRate;
                migratedRates[yNum] = {
                  ...DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026],
                  ...r,
                  plusFestivoMayor4h: r.plusFestivoMayor4h === 42.80 ? 40.80 : (r.plusFestivoMayor4h ?? 40.80),
                  plusVacacionesDia: r.plusVacacionesDia && r.plusVacacionesDia > 0 ? r.plusVacacionesDia : 10.00,
                  year: yNum,
                };
              }
            }
            effectiveConvenio = { ...driveConvenio, ratesByYear: migratedRates };
            isApplyingRemoteSyncRef.current = true;
            setConvenio(effectiveConvenio);
          }
        } else if (!convenioFile) {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'convenio_2026.json', currentSnapshot.convenio);
        }

        // 4. Asignaciones de Cuadrante (preservar cambios locales pendientes sin sobrescribirlos)
        const isAssignmentsDirty = Boolean(dirtySnapshot.assignments);
        const asignacionesFile = await findFileInFolder(token, 'cuadrante_asignaciones.json', folders.nominasFolderId);
        if (asignacionesFile) {
          const driveAsignaciones = await readDriveJsonFile<DayAssignment[]>(token, asignacionesFile.id);
          if (driveAsignaciones && Array.isArray(driveAsignaciones)) {
            const normalizedDrive = normalizeAssignmentsList(driveAsignaciones, effectiveShifts);
            const normalizedLocal = normalizeAssignmentsList(latestStateRef.current.assignments, effectiveShifts);
            const mergedAssignments = mergeAssignmentsByDate(normalizedLocal, normalizedDrive, isAssignmentsDirty);
            effectiveAssignments = mergedAssignments;
            const mergedJson = JSON.stringify(mergedAssignments);

            if (mergedJson !== JSON.stringify(latestStateRef.current.assignments)) {
              setAssignments(mergedAssignments);
            }
            if (!isAssignmentsDirty) {
              lastSyncedAssignmentsJsonRef.current = mergedJson;
            }
          }
        } else {
          const normalizedLocal = normalizeAssignmentsList(latestStateRef.current.assignments, effectiveShifts);
          effectiveAssignments = normalizedLocal;
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'cuadrante_asignaciones.json', normalizedLocal);
          if (!isAssignmentsDirty) {
            lastSyncedAssignmentsJsonRef.current = JSON.stringify(normalizedLocal);
          }
        }

        // 5. Catálogo de Extras
        const extrasFile = await findFileInFolder(token, 'catalogo_extras.json', folders.nominasFolderId);
        if (extrasFile && !dirtySnapshot.extras) {
          const driveExtras = await readDriveJsonFile<ExtraConcept[]>(token, extrasFile.id);
          if (driveExtras && Array.isArray(driveExtras) && driveExtras.length > 0) {
            isApplyingRemoteSyncRef.current = true;
            setExtras(mergeWithDefaultBuiltInExtras(driveExtras));
          }
        } else if (!extrasFile) {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'catalogo_extras.json', currentSnapshot.extras);
        }

        // 6. Ajustes personalizados del Calendario Anual y Bolsa de Horas
        const annualFile = await findFileInFolder(token, 'calendario_anual_bolsa.json', folders.nominasFolderId);
        if (annualFile && !dirtySnapshot.annualCalendarData) {
          const driveAnnual = await readDriveJsonFile<AnnualCalendarState>(token, annualFile.id);
          if (driveAnnual && typeof driveAnnual === 'object') {
            effectiveAnnualData = driveAnnual;
            isApplyingRemoteSyncRef.current = true;
            setAnnualCalendarData(driveAnnual);
          }
        } else if (!annualFile && Object.keys(currentSnapshot.annualCalendarData).length > 0) {
          await saveOrUpdateDriveJsonFile(
            token,
            folders.nominasFolderId,
            'calendario_anual_bolsa.json',
            currentSnapshot.annualCalendarData
          );
        }

        // 7. Meses validados (con % jornada, % IRPF y snapshot de nóminas cerradas)
        const validatedFile = await findFileInFolder(token, 'meses_validados.json', folders.nominasFolderId);
        if (validatedFile && !dirtySnapshot.validatedMonths) {
          const driveValidated = await readDriveJsonFile<ValidatedMonthsMap>(token, validatedFile.id);
          if (driveValidated && typeof driveValidated === 'object') {
            const reconcileCtx = {
              assignments: effectiveAssignments,
              shifts: effectiveShifts,
              convenio: effectiveConvenio,
              profile: effectiveProfile,
              annualCalendarData: effectiveAnnualData,
            };
            const reconciledDrive = reconcileValidatedMonthsMap(driveValidated, reconcileCtx);
            const mergedValidated = reconcileValidatedMonthsMap(
              mergeValidatedMonths(
                latestStateRef.current.validatedMonths,
                reconciledDrive,
                false
              ),
              reconcileCtx
            );
            isApplyingRemoteSyncRef.current = true;
            setValidatedMonths(mergedValidated);
            if (JSON.stringify(mergedValidated) !== JSON.stringify(driveValidated)) {
              await saveOrUpdateDriveJsonFile(
                token,
                folders.nominasFolderId,
                'meses_validados.json',
                mergedValidated
              );
            }
          }
        } else if (!validatedFile && Object.keys(latestStateRef.current.validatedMonths).length > 0) {
          await saveOrUpdateDriveJsonFile(
            token,
            folders.nominasFolderId,
            'meses_validados.json',
            latestStateRef.current.validatedMonths
          );
        }

        // Consultar nóminas archivadas en la subcarpeta
        const archived = await listArchivedFilesInNominas(token, folders.nominasFolderId);
        setArchivedNominas(archived);

        setLastSyncTime(new Date());
        hasInitialDriveSyncDoneRef.current = true;
        hasPendingLocalSyncRef.current = Object.values(readPendingSyncDirtyMap()).some(Boolean);

        if (needsProfileOnboarding) {
          setIsOnboardingProfile(true);
          setIsProfileModalOpen(true);
        } else {
          setIsOnboardingProfile(false);
        }
      } catch (err: any) {
        console.error('Error sincronizando con Google Drive:', err);
        setDriveSyncError(err?.message || 'Error al sincronizar con Google Drive.');
      } finally {
        isApplyingRemoteSyncRef.current = false;
        setIsDriveSyncing(false);
        syncPromiseRef.current = null;
      }
    })();

    syncPromiseRef.current = run;
    return run;
  };

  // Guardar explícitamente todos los cambios locales en Google Drive (Turnos, Turnos BD, Extras, Convenio, Perfil, Anual y Validados)
  const handleActualizarTodo = async (options?: {
    recalculateValidatedIfNeeded?: boolean;
    overrideValidatedMonths?: ValidatedMonthsMap;
  }): Promise<boolean> => {
    setPayrollCalcNonce((n) => n + 1);
    setLastPayrollCalculatedAt(new Date());

    const token = accessToken || getCachedAccessToken();
    if (!currentUser || !token) {
      pendingActualizarAfterLoginRef.current = true;
      setDriveSyncError('Conecta tu cuenta de Google Drive para subir y guardar tus cambios.');
      setIsLoginModalOpen(true);
      return false;
    }

    setIsUpdatingDrive(true);
    setDriveSyncError(null);
    try {
      let currentSnapshot = latestStateRef.current;

      // Si se solicita recalcular un mes ya validado (desde Nómina o Calendario), regenerar primero su snapshot actualizado
      if (options?.recalculateValidatedIfNeeded && currentValidatedRecord) {
        await handleValidateMonth(selectedYear, selectedMonth, { skipSpinner: false });
        currentSnapshot = latestStateRef.current;
      }

      const folders = driveFolders || (await ensureDirexisHierarchy(token));
      if (!driveFolders) setDriveFolders(folders);

      const validatedToUpload = options?.overrideValidatedMonths || currentSnapshot.validatedMonths;
      const uploads: Array<Promise<unknown>> = [
        saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'turnos_base.json', currentSnapshot.shifts),
        saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'convenio_2026.json', currentSnapshot.convenio),
        saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'cuadrante_asignaciones.json', currentSnapshot.assignments),
        saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'catalogo_extras.json', currentSnapshot.extras),
        saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'calendario_anual_bolsa.json', currentSnapshot.annualCalendarData),
        saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'meses_validados.json', validatedToUpload),
      ];
      if (currentSnapshot.profile.name.trim().length > 0) {
        uploads.push(
          saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'chofer_config.json', currentSnapshot.profile)
        );
      }

      await Promise.all(uploads);

      lastSyncedAssignmentsJsonRef.current = JSON.stringify(currentSnapshot.assignments);
      clearDirtyDatasets();
      setDriveSyncError(null);
      setLastSyncTime(new Date());
      setSaveSuccessMessage('¡Todo actualizado y guardado correctamente en Google Drive!');
      window.setTimeout(() => setSaveSuccessMessage(null), 5000);
      return true;
    } catch (err: any) {
      console.error('Error actualizando cambios en Google Drive:', err);
      const msg = String(err?.message || '');
      if (msg.includes('401')) {
        pendingActualizarAfterLoginRef.current = true;
        setDriveSyncError('Sesión de Drive caducada. Vuelve a conectar Google Drive y pulsa Actualizar para guardar tus cambios.');
        setIsLoginModalOpen(true);
      } else {
        setDriveSyncError('No se pudo actualizar en Google Drive. Tus cambios siguen en este dispositivo.');
      }
      return false;
    } finally {
      setIsUpdatingDrive(false);
    }
  };

  // Aviso al intentar cerrar, recargar o salir de la app si hay cambios pendientes sin guardar en Drive
  useEffect(() => {
    if (!hasUnsavedChanges && !isUpdatingDrive) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Tienes cambios sin actualizar en Google Drive. ¿Seguro que quieres salir?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isUpdatingDrive]);

  const executeLogout = async () => {
    await logout();
    setCurrentUser(null);
    setAccessToken(null);
    setDriveFolders(null);
    setArchivedNominas([]);
    hasInitialDriveSyncDoneRef.current = false;
    setIsLogoutConfirmOpen(false);
  };

  // Cierre de sesión con alerta previa si hay cambios pendientes de actualizar en Drive
  const handleLogout = async () => {
    if (hasUnsavedChanges) {
      setIsLogoutConfirmOpen(true);
      return;
    }
    await executeLogout();
  };

  // Sincronización manual bajo demanda
  const handleManualSync = () => {
    if (hasUnsavedChanges) {
      void handleActualizarTodo();
      return;
    }
    const token = accessToken || getCachedAccessToken();
    if (token) {
      syncWithDrive(token, true);
    } else {
      setIsLoginModalOpen(true);
    }
  };

  // Actualizar lista de nóminas archivadas
  const handleRefreshArchived = async () => {
    const token = accessToken || getCachedAccessToken();
    if (!token || !driveFolders) return;
    setIsLoadingArchived(true);
    try {
      const updated = await listArchivedFilesInNominas(token, driveFolders.nominasFolderId);
      setArchivedNominas(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingArchived(false);
    }
  };

  // Recalcular nómina siempre de nuevo desde los datos del calendario (sin guardar nómina automáticamente)
  const recalculatePayrollFromCalendar = async (pullDriveCalendarIfIdle = true) => {
    // 1. Recálculo inmediato con los datos actuales del calendario en memoria
    setPayrollCalcNonce((n) => n + 1);
    setLastPayrollCalculatedAt(new Date());

    // 2. Si Google Drive está conectado y no hay cambios locales pendientes de subir, comprobar datos actualizados del calendario en Drive
    const token = accessToken || getCachedAccessToken();
    if (
      pullDriveCalendarIfIdle &&
      currentUser &&
      token &&
      driveFolders &&
      !hasPendingLocalSyncRef.current &&
      !syncPromiseRef.current
    ) {
      setIsRefreshingForNomina(true);
      try {
        const [asignacionesFile, turnosFile, convenioFile, choferFile] = await Promise.all([
          findFileInFolder(token, 'cuadrante_asignaciones.json', driveFolders.nominasFolderId),
          findFileInFolder(token, 'turnos_base.json', driveFolders.nominasFolderId),
          findFileInFolder(token, 'convenio_2026.json', driveFolders.nominasFolderId),
          findFileInFolder(token, 'chofer_config.json', driveFolders.nominasFolderId),
        ]);

        if (hasPendingLocalSyncRef.current) {
          return;
        }

        const [driveAsignaciones, driveTurnos, driveConvenio, driveProfile] = await Promise.all([
          asignacionesFile ? readDriveJsonFile<DayAssignment[]>(token, asignacionesFile.id) : Promise.resolve(null),
          turnosFile ? readDriveJsonFile<ShiftDefinition[]>(token, turnosFile.id) : Promise.resolve(null),
          convenioFile ? readDriveJsonFile<ConvenioInfo>(token, convenioFile.id) : Promise.resolve(null),
          choferFile ? readDriveJsonFile<WorkerProfile>(token, choferFile.id) : Promise.resolve(null),
        ]);

        if (hasPendingLocalSyncRef.current) {
          return;
        }

        const cur = latestStateRef.current;
        let updatedAny = false;

        if (driveAsignaciones && Array.isArray(driveAsignaciones)) {
          const normalizedRemote = normalizeAssignmentsList(driveAsignaciones, cur.shifts);
          const normalizedLocal = normalizeAssignmentsList(cur.assignments, cur.shifts);
          const isDirty = hasPendingLocalSyncRef.current || readAssignmentsDirtyFlag();
          const mergedAssignments = mergeAssignmentsByDate(normalizedLocal, normalizedRemote, isDirty);
          const mergedJson = JSON.stringify(mergedAssignments);
          if (mergedJson !== JSON.stringify(cur.assignments)) {
            setAssignments(mergedAssignments);
            updatedAny = true;
          }
          if (mergedJson !== JSON.stringify(normalizedRemote)) {
            await saveOrUpdateDriveJsonFile(
              token,
              driveFolders.nominasFolderId,
              'cuadrante_asignaciones.json',
              mergedAssignments
            );
          }
          lastSyncedAssignmentsJsonRef.current = mergedJson;
          writeAssignmentsDirtyFlag(false);
        }
        if (driveTurnos && Array.isArray(driveTurnos) && driveTurnos.length > 0) {
          const cleanedShifts = driveTurnos.map((s) =>
            s.code.includes('/L')
              ? {
                  ...s,
                  code: s.code.replace(/\/L/g, ''),
                  title: s.title ? s.title.replace(/\/L/g, '') : `Servicio ${s.code.replace(/\/L/g, '')}`,
                }
              : s
          );
          const normalizedRemoteShifts = ensureBuiltInSpecialShifts(cleanedShifts);
          if (JSON.stringify(normalizedRemoteShifts) !== JSON.stringify(cur.shifts)) {
            isApplyingRemoteSyncRef.current = true;
            setShifts(normalizedRemoteShifts);
            updatedAny = true;
          }
        }
        if (driveConvenio && driveConvenio.ratesByYear) {
          const migratedRates: Record<number, ConvenioYearRate> = {};
          for (const [k, v] of Object.entries(driveConvenio.ratesByYear)) {
            const yNum = Number(k);
            if (yNum >= 2026 && v) {
              const r = v as ConvenioYearRate;
              migratedRates[yNum] = {
                ...DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026],
                ...r,
                plusFestivoMayor4h: r.plusFestivoMayor4h === 42.80 ? 40.80 : (r.plusFestivoMayor4h ?? 40.80),
                plusVacacionesDia: r.plusVacacionesDia && r.plusVacacionesDia > 0 ? r.plusVacacionesDia : 10.00,
                year: yNum,
              };
            }
          }
          const normalizedConvenio = { ...driveConvenio, ratesByYear: migratedRates };
          if (JSON.stringify(normalizedConvenio) !== JSON.stringify(cur.convenio)) {
            isApplyingRemoteSyncRef.current = true;
            setConvenio(normalizedConvenio);
            updatedAny = true;
          }
        }
        if (driveProfile && driveProfile.name?.trim()) {
          const normalizedDriveProfile: WorkerProfile = {
            ...EMPTY_WORKER_PROFILE,
            ...driveProfile,
            hasVacationPlus: driveProfile.hasVacationPlus !== undefined ? driveProfile.hasVacationPlus : true,
            hasPunctualityEarlyStartPlus: driveProfile.hasPunctualityEarlyStartPlus === true,
            fechaAlta: typeof driveProfile.fechaAlta === 'string' && driveProfile.fechaAlta.trim() ? driveProfile.fechaAlta.trim() : undefined,
            fechaBaja: typeof driveProfile.fechaBaja === 'string' && driveProfile.fechaBaja.trim() ? driveProfile.fechaBaja.trim() : undefined,
          };
          if (JSON.stringify(normalizedDriveProfile) !== JSON.stringify(cur.profile)) {
            isApplyingRemoteSyncRef.current = true;
            setProfile(normalizedDriveProfile);
            updatedAny = true;
          }
        }
        if (updatedAny) {
          setPayrollCalcNonce((n) => n + 1);
          setLastPayrollCalculatedAt(new Date());
        }
      } catch (err) {
        console.error('Error leyendo datos actualizados del calendario en Drive:', err);
      } finally {
        setIsRefreshingForNomina(false);
      }
    }
  };

  const handleSelectTab = (tab: string) => {
    const nextTab = tab as 'inicio' | 'turnos' | 'calendario' | 'nomina' | 'extras' | 'anual';
    setCurrentTab(nextTab);
    if (nextTab === 'nomina') {
      void recalculatePayrollFromCalendar(true);
    }
  };

  // Map of shifts for fast lookup
  const shiftsMap = useMemo(() => {
    const map = new Map<string, ShiftDefinition>();
    shifts.forEach((s) => map.set(s.code, s));
    return map;
  }, [shifts]);

  // Current year rates
  const currentYearRate = useMemo(() => {
    return getEffectiveYearRate(convenio, selectedYear);
  }, [convenio, selectedYear]);

  const currentMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const currentValidatedRecord = validatedMonths[currentMonthKey];

  // Instantáneas congeladas cuando el mes seleccionado está validado (turnos, asignaciones y tarifa del año)
  const effectiveViewShifts = useMemo(() => {
    if (currentValidatedRecord?.shiftsSnapshot && currentValidatedRecord.shiftsSnapshot.length > 0) {
      return currentValidatedRecord.shiftsSnapshot;
    }
    return shifts;
  }, [currentValidatedRecord, shifts]);

  const effectiveViewShiftsMap = useMemo(() => {
    const map = new Map<string, ShiftDefinition>();
    effectiveViewShifts.forEach((s) => map.set(s.code, s));
    return map;
  }, [effectiveViewShifts]);

  const effectiveViewConvenio = useMemo(() => {
    if (!currentValidatedRecord?.yearRateSnapshot) return convenio;
    return {
      ...convenio,
      ratesByYear: {
        ...convenio.ratesByYear,
        [selectedYear]: currentValidatedRecord.yearRateSnapshot,
      },
    };
  }, [convenio, currentValidatedRecord, selectedYear]);

  const effectiveViewAssignments = useMemo(() => {
    if (!currentValidatedRecord?.assignmentsSnapshot || currentValidatedRecord.assignmentsSnapshot.length === 0) {
      return assignments;
    }
    const snapList = currentValidatedRecord.assignmentsSnapshot;
    const cutoffMode =
      currentValidatedRecord.profileSnapshot?.extrasCutoffMode ||
      currentValidatedRecord.extrasCutoffMode ||
      'direxis_25_24';
    const customStartDay = currentValidatedRecord.profileSnapshot?.customCutoffStartDay || 25;
    const cutoffRange = getExtrasDateRange(selectedYear, selectedMonth, cutoffMode, customStartDay);
    const daysInM = new Date(selectedYear, selectedMonth, 0).getDate();
    const mStart = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const mEnd = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
    const winStart = cutoffRange.startDateStr < mStart ? cutoffRange.startDateStr : mStart;
    const winEnd = cutoffRange.endDateStr > mEnd ? cutoffRange.endDateStr : mEnd;
    const validSnapList = snapList.filter((sa) => {
      const d = normalizeDateKey(sa.date);
      return d >= mStart || hasMeaningfulAssignmentContent(sa);
    });
    const snapDates = new Set(validSnapList.map((sa) => normalizeDateKey(sa.date)));
    const otherAssignments = assignments.filter((a) => {
      const d = normalizeDateKey(a.date);
      if (snapDates.has(d)) return false;
      return !(d >= mStart && d <= winEnd);
    });
    return [...otherAssignments, ...validSnapList].sort((a, b) =>
      normalizeDateKey(a.date).localeCompare(normalizeDateKey(b.date))
    );
  }, [assignments, currentValidatedRecord, selectedYear, selectedMonth]);

  // Computed Monthly Payroll (en vivo para meses sin validar; usa snapshot congelado si el mes está validado)
  const liveMonthlyPayroll = useMemo(() => {
    return calculateMonthlyPayroll(
      assignments,
      shiftsMap,
      currentYearRate,
      profile,
      selectedYear,
      selectedMonth,
      validatedMonths,
      annualCalendarData[selectedYear]
    );
  }, [assignments, shiftsMap, currentYearRate, profile, selectedYear, selectedMonth, validatedMonths, annualCalendarData, payrollCalcNonce]);

  const monthlyPayroll = currentValidatedRecord?.payrollSnapshot || liveMonthlyPayroll;

  // Computed 12-Month Salary Evolution across the selected year
  const yearlyEvolution = useMemo(() => {
    return calculateYearlySalaryEvolution(
      selectedYear,
      assignments,
      shiftsMap,
      convenio,
      profile,
      validatedMonths,
      annualCalendarData[selectedYear]
    );
  }, [selectedYear, assignments, shiftsMap, convenio, profile, validatedMonths, annualCalendarData, payrollCalcNonce]);

  // Computed Annual Calendar & Bolsa de Horas summary (synced with RutaNomina + overrides + meses validados)
  const annualSummary = useMemo(() => {
    const yearOverride = annualCalendarData[selectedYear];
    const defaultParams = deriveDefaultAnnualParams(profile, convenio, selectedYear);
    const defaultMonths = deriveDefaultAnnualMonths(
      selectedYear,
      profile,
      assignments,
      shifts,
      convenio,
      validatedMonths
    );
    const effectiveParams = resolveAnnualParams(defaultParams, yearOverride);
    const effectiveMonths = resolveAnnualMonths(defaultMonths, yearOverride);
    return calculateAnnualLiquidation(selectedYear, effectiveParams, effectiveMonths, validatedMonths);
  }, [selectedYear, profile, convenio, assignments, shifts, annualCalendarData, validatedMonths]);

  const handleUpdateAnnualYearOverride = (
    year: number,
    nextOverride: AnnualYearOverrideData | null
  ) => {
    markDatasetsDirty('annualCalendarData');
    setAnnualCalendarData((prev) => {
      const copy = { ...prev };
      if (!nextOverride || (!nextOverride.paramOverrides && !nextOverride.monthOverrides)) {
        delete copy[year];
      } else {
        copy[year] = nextOverride;
      }
      return copy;
    });
  };

  useEffect(() => {
    setLastPayrollCalculatedAt(new Date());
  }, [assignments, shifts, convenio, profile, selectedYear, selectedMonth, annualCalendarData]);

  // Proteger meses validados y turnos ya introducidos en meses anteriores frente a cambios automáticos del catálogo
  const isProtectedAssignmentDate = (dateStr?: string): boolean => {
    const dk = normalizeDateKey(dateStr);
    if (!dk || dk.length < 7) return false;
    const ym = dk.slice(0, 7);
    if (validatedMonths[ym]) return true;
    const selectedYM = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const now = new Date();
    const todayYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return ym < selectedYM || (ym < todayYM && ym !== selectedYM);
  };

  // Turno actions
  const handleOpenNewTurno = () => {
    setEditingShift(null);
    setIsTurnoModalOpen(true);
  };

  const handleEditTurno = (shift: ShiftDefinition) => {
    setEditingShift(shift);
    setIsTurnoModalOpen(true);
  };

  const handleSaveTurno = (newOrUpdated: ShiftDefinition) => {
    const idx = shifts.findIndex(
      (s) => s.id === newOrUpdated.id || (editingShift && s.code === editingShift.code) || s.code === newOrUpdated.code
    );
    const oldShift = idx >= 0 ? shifts[idx] : null;
    const nextShifts =
      idx >= 0
        ? shifts.map((s, i) => (i === idx ? newOrUpdated : s))
        : [newOrUpdated, ...shifts];

    setShifts(nextShifts);
    markDatasetsDirty('shifts');

    if (oldShift) {
      const frozenOldShift: ShiftDefinition = JSON.parse(JSON.stringify(oldShift));
      let modifiedAnyAssignment = false;
      const nextAssignments = assignments.map((a) => {
        const matchesOld =
          a.shiftCode === oldShift.code || (oldShift.id && a.shiftId === oldShift.id);
        if (!matchesOld) return a;

        if (isProtectedAssignmentDate(a.date)) {
          // Conservar la definición exacta anterior en meses validados o meses previos
          if (!a.shiftSnapshot) {
            modifiedAnyAssignment = true;
            return { ...a, shiftSnapshot: frozenOldShift };
          }
          return a;
        }

        // En el mes activo o futuros sin validar, actualizar código si se renombró
        if (oldShift.code !== newOrUpdated.code) {
          modifiedAnyAssignment = true;
          return { ...a, shiftCode: newOrUpdated.code, shiftSnapshot: undefined };
        }
        return a;
      });

      if (modifiedAnyAssignment) {
        markDatasetsDirty('assignments');
        setAssignments(nextAssignments);
      }
    }

    setEditingShift(null);
    setIsTurnoModalOpen(false);
  };

  const handleDeleteTurno = (id: string) => {
    const shiftToDelete = shifts.find((s) => s.id === id);
    setShifts((prev) => prev.filter((s) => s.id !== id));
    markDatasetsDirty('shifts');
    if (shiftToDelete) {
      const frozenDeleted: ShiftDefinition = JSON.parse(JSON.stringify(shiftToDelete));
      let modifiedAnyAssignment = false;
      setAssignments((prev) =>
        prev.map((a) => {
          const matchesDeleted =
            a.shiftCode === shiftToDelete.code || (shiftToDelete.id && a.shiftId === shiftToDelete.id);
          if (!matchesDeleted) return a;
          modifiedAnyAssignment = true;
          if (isProtectedAssignmentDate(a.date)) {
            return {
              ...a,
              shiftSnapshot: a.shiftSnapshot || frozenDeleted,
            };
          }
          return {
            ...a,
            shiftCode: undefined,
            shiftId: undefined,
            shiftSnapshot: undefined,
            isRest: false,
          };
        })
      );
      if (modifiedAnyAssignment) {
        markDatasetsDirty('assignments');
      }
    }
  };

  const handleRestoreDefaultShifts = () => {
    markDatasetsDirty('shifts');
    setShifts(ensureBuiltInSpecialShifts(ALL_INITIAL_SHIFTS));
  };

  const handleSaveProfile = async (newProf: WorkerProfile) => {
    setProfile(newProf);
    setIsOnboardingProfile(false);
    setIsProfileModalOpen(false);
    markDatasetsDirty('profile');

    const token = accessToken || getCachedAccessToken();
    if (currentUser && token) {
      try {
        const folders = driveFolders || (await ensureDirexisHierarchy(token));
        if (!driveFolders) setDriveFolders(folders);
        await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'chofer_config.json', newProf);
        clearDirtyDatasets(['profile']);
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('Error guardando configuración de perfil en Google Drive:', err);
      }
    }
  };

  // Calendar Assignment update (bloqueado si el mes ya fue validado)
  const handleUpdateAssignment = (date: string, partial: Partial<DayAssignment>) => {
    const normalizedDate = normalizeDateKey(date);
    const ym = normalizedDate.slice(0, 7);
    if (validatedMonths[ym]) {
      return;
    }
    markDatasetsDirty('assignments');
    setAssignments((prev) => {
      const idx = prev.findIndex((a) => normalizeDateKey(a.date) === normalizedDate);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...partial, date: normalizedDate };
        return copy;
      }
      return [...prev, { date: normalizedDate, extras: [], ...partial }];
    });
  };

  // Extras actions
  const handleToggleExtra = (id: string) => {
    markDatasetsDirty('extras');
    setExtras((prev) =>
      prev.map((e) => (e.id === id ? { ...e, active: !e.active } : e))
    );
  };

  const handleSaveExtra = (extra: ExtraConcept) => {
    markDatasetsDirty('extras');
    setExtras((prev) => {
      const idx = prev.findIndex((e) => e.id === extra.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = extra;
        return copy;
      }
      return [extra, ...prev];
    });
  };

  const handleDeleteExtra = (id: string) => {
    markDatasetsDirty('extras');
    setExtras((prev) => prev.filter((e) => e.id !== id));
  };

  // Export triggers (respetando perfil, turnos, asignaciones y convenio congelados si el mes ya fue validado)
  const effectiveExportProfile: WorkerProfile = useMemo(() => {
    if (!currentValidatedRecord) return profile;
    if (currentValidatedRecord.profileSnapshot) {
      return currentValidatedRecord.profileSnapshot;
    }
    return {
      ...profile,
      irpfPercentage: currentValidatedRecord.irpfPercentage,
      partTimePercentage: currentValidatedRecord.jornadaPct,
      contractType:
        currentValidatedRecord.contractType ??
        (currentValidatedRecord.jornadaPct < 100 ? 'tiempo_parcial' : 'indefinido'),
      salaryBaseRateMode:
        currentValidatedRecord.salaryBaseRateMode ?? profile.salaryBaseRateMode,
      prorrateoPagasExtra:
        currentValidatedRecord.prorrateoPagasExtra ?? profile.prorrateoPagasExtra,
      extrasCutoffMode:
        currentValidatedRecord.extrasCutoffMode ?? profile.extrasCutoffMode,
    };
  }, [currentValidatedRecord, profile]);

  const handleExportPDF = () => {
    const monthName = MONTH_NAMES[selectedMonth - 1];
    exportToPDF(
      monthlyPayroll,
      effectiveExportProfile,
      effectiveViewAssignments,
      effectiveViewShiftsMap,
      effectiveViewConvenio,
      monthName
    );
  };

  const handleExportExcel = () => {
    const monthName = MONTH_NAMES[selectedMonth - 1];
    exportToExcel(
      monthlyPayroll,
      effectiveExportProfile,
      effectiveViewAssignments,
      effectiveViewShiftsMap,
      effectiveViewConvenio,
      monthName
    );
  };

  // Validar mes completo: congela % Jornada, % IRPF, turnos vigentes, asignaciones, tarifa anual y nómina exacta del mes y lo guarda en local + Drive
  const handleValidateMonth = async (
    yearToValidate: number,
    monthToValidate: number,
    _opts?: { skipSpinner?: boolean }
  ): Promise<{ success: boolean; driveSaved: boolean; message: string }> => {
    setIsValidatingMonth(true);
    markDatasetsDirty('validatedMonths');
    try {
      const mKey = `${yearToValidate}-${String(monthToValidate).padStart(2, '0')}`;
      const monthName = MONTH_NAMES[monthToValidate - 1];
      const daysInMonth = new Date(yearToValidate, monthToValidate, 0).getDate();

      let filledDaysCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${yearToValidate}-${String(monthToValidate).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const found = assignments.find((a) => normalizeDateKey(a.date) === dStr);
        if (hasMeaningfulAssignmentContent(found)) {
          filledDaysCount += 1;
        }
      }

      const rateForYear = getEffectiveYearRate(convenio, yearToValidate);
      const frozenYearRate: ConvenioYearRate = JSON.parse(JSON.stringify(rateForYear));
      const frozenProfile: WorkerProfile = JSON.parse(JSON.stringify(profile));
      const frozenShiftsSnapshot: ShiftDefinition[] = JSON.parse(JSON.stringify(shifts));
      const frozenJornadaPct =
        frozenProfile.contractType === 'tiempo_parcial'
          ? Math.min(100, Math.max(1, Number(frozenProfile.partTimePercentage) || 50))
          : 100;

      // Congelar asignaciones de la ventana activa del mes (mes natural + ciclo de corte) con su shiftSnapshot vigente
      const cutoffRange = getExtrasDateRange(
        yearToValidate,
        monthToValidate,
        frozenProfile.extrasCutoffMode || 'direxis_25_24',
        frozenProfile.customCutoffStartDay || 25
      );
      const mStartStr = `${yearToValidate}-${String(monthToValidate).padStart(2, '0')}-01`;
      const mEndStr = `${yearToValidate}-${String(monthToValidate).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const snapWindowStart = cutoffRange.startDateStr < mStartStr ? cutoffRange.startDateStr : mStartStr;
      const snapWindowEnd = cutoffRange.endDateStr > mEndStr ? cutoffRange.endDateStr : mEndStr;

      const frozenAssignmentsSnapshot: DayAssignment[] = assignments
        .filter((a) => {
          const dk = normalizeDateKey(a.date);
          return dk >= snapWindowStart && dk <= snapWindowEnd;
        })
        .map((a) => {
          const dk = normalizeDateKey(a.date);
          const cloned: DayAssignment = JSON.parse(JSON.stringify({ ...a, date: dk }));
          const uc = (cloned.shiftCode || '').trim().toUpperCase();
          const isSpecial =
            cloned.isRest || cloned.isVacation || cloned.isSickLeave || uc === 'D' || uc === 'V' || uc === 'B';
          if (!isSpecial && !cloned.shiftSnapshot && (cloned.shiftCode || cloned.shiftId)) {
            const matchedShift =
              shiftsMap.get(cloned.shiftCode || '') ||
              shifts.find((s) => s.code === cloned.shiftCode || (cloned.shiftId && s.id === cloned.shiftId));
            if (matchedShift) {
              cloned.shiftSnapshot = JSON.parse(JSON.stringify(matchedShift));
            }
          }
          return cloned;
        });

      const frozenShiftsMap = new Map<string, ShiftDefinition>();
      frozenShiftsSnapshot.forEach((s) => frozenShiftsMap.set(s.code, s));

      const yOverride = annualCalendarData[yearToValidate];
      const baseValidatedWithoutTarget: ValidatedMonthsMap = { ...validatedMonths };
      delete baseValidatedWithoutTarget[mKey];

      // Recalcular nómina exacta del mes con el perfil, turnos y asignaciones vigentes/congelados
      const payrollSnapshot = calculateMonthlyPayroll(
        assignments,
        frozenShiftsMap,
        frozenYearRate,
        frozenProfile,
        yearToValidate,
        monthToValidate,
        baseValidatedWithoutTarget,
        yOverride
      );

      // Calcular balance anual del mes para llevar el arrastre de horas exacto
      const defParams = deriveDefaultAnnualParams(frozenProfile, convenio, yearToValidate);
      const defMonths = deriveDefaultAnnualMonths(
        yearToValidate,
        frozenProfile,
        assignments,
        frozenShiftsSnapshot,
        convenio,
        baseValidatedWithoutTarget
      );
      const effParams = resolveAnnualParams(defParams, yOverride);
      const effMonths = resolveAnnualMonths(defMonths, yOverride);

      const tempMap: ValidatedMonthsMap = {
        ...baseValidatedWithoutTarget,
        [mKey]: {
          monthKey: mKey,
          year: yearToValidate,
          month: monthToValidate,
          validatedAt: new Date().toISOString(),
          jornadaPct: frozenJornadaPct,
          contractType: frozenProfile.contractType,
          irpfPercentage: frozenProfile.irpfPercentage,
          salaryBaseRateMode: frozenProfile.salaryBaseRateMode,
          prorrateoPagasExtra: frozenProfile.prorrateoPagasExtra,
          extrasCutoffMode: frozenProfile.extrasCutoffMode,
          profileSnapshot: frozenProfile,
          horasRealizadasMesNatural:
            effMonths[monthToValidate - 1]?.horasReales ??
            effMonths[monthToValidate - 1]?.horasDiarioMes ??
            payrollSnapshot.ordinaryConvenioHours,
          horasTeoricasMes: payrollSnapshot.convenioMonthlyHoursTarget,
          saldoMesHoras: 0,
          bolsaAcumuladaAlCierre: 0,
          filledDaysCount,
          daysInMonth,
          payrollSnapshot,
          shiftsSnapshot: frozenShiftsSnapshot,
          assignmentsSnapshot: frozenAssignmentsSnapshot,
          yearRateSnapshot: frozenYearRate,
        },
      };
      const annualRes = calculateAnnualLiquidation(yearToValidate, effParams, effMonths, tempMap);
      const monthRow = annualRes.filas[monthToValidate - 1];

      const sanitizedProfileName = (frozenProfile.name || 'Conductor').replace(/[^a-zA-Z0-9]/g, '_');
      const pdfFileName = `Nomina_${monthName}_${yearToValidate}_${sanitizedProfileName}.pdf`;
      const jsonFileName = `Nomina_${monthName}_${yearToValidate}_${sanitizedProfileName}.json`;

      const record: ValidatedMonthRecord = {
        monthKey: mKey,
        year: yearToValidate,
        month: monthToValidate,
        validatedAt: new Date().toISOString(),
        jornadaPct: frozenJornadaPct,
        contractType: frozenProfile.contractType,
        irpfPercentage: frozenProfile.irpfPercentage,
        salaryBaseRateMode: frozenProfile.salaryBaseRateMode,
        prorrateoPagasExtra: frozenProfile.prorrateoPagasExtra,
        extrasCutoffMode: frozenProfile.extrasCutoffMode,
        profileSnapshot: frozenProfile,
        horasRealizadasMesNatural:
          monthRow?.horasRealizadas ?? payrollSnapshot.ordinaryConvenioHours,
        horasTeoricasMes: payrollSnapshot.convenioMonthlyHoursTarget,
        saldoMesHoras:
          payrollSnapshot.bolsaHorasMes ??
          Math.round(
            (monthRow?.diferenciaRealMes ??
              (payrollSnapshot.ordinaryConvenioHours - payrollSnapshot.convenioMonthlyHoursTarget)) *
              100
          ) / 100,
        bolsaAcumuladaAlCierre:
          payrollSnapshot.bolsaHorasAcumulada ??
          Math.round((monthRow?.bolsaCompensacionAcumulada ?? 0) * 100) / 100,
        filledDaysCount,
        daysInMonth,
        payrollSnapshot,
        shiftsSnapshot: frozenShiftsSnapshot,
        assignmentsSnapshot: frozenAssignmentsSnapshot,
        yearRateSnapshot: frozenYearRate,
        drivePdfFileName: pdfFileName,
        driveJsonFileName: jsonFileName,
      };

      const updatedValidatedMap: ValidatedMonthsMap = reconcileValidatedMonthsMap(
        {
          ...validatedMonths,
          [mKey]: record,
        },
        {
          assignments,
          shifts,
          convenio,
          profile,
          annualCalendarData,
        }
      );
      setValidatedMonths(updatedValidatedMap);
      latestStateRef.current = {
        ...latestStateRef.current,
        validatedMonths: updatedValidatedMap,
      };

      const finalRecord = updatedValidatedMap[mKey] || record;
      const finalPayrollSnapshot = finalRecord.payrollSnapshot;
      const finalAssignmentsSnapshot =
        finalRecord.assignmentsSnapshot && finalRecord.assignmentsSnapshot.length > 0
          ? finalRecord.assignmentsSnapshot
          : frozenAssignmentsSnapshot;

      const frozenConvenioForPdf: ConvenioInfo = {
        ...convenio,
        ratesByYear: {
          ...convenio.ratesByYear,
          [yearToValidate]: frozenYearRate,
        },
      };

      let driveSaved = false;
      const token = accessToken || getCachedAccessToken();
      if (currentUser && token) {
        try {
          const folders = driveFolders || (await ensureDirexisHierarchy(token));
          if (!driveFolders) setDriveFolders(folders);

          const pdfBlob = exportToPDFBlob(
            finalPayrollSnapshot,
            frozenProfile,
            finalAssignmentsSnapshot,
            frozenShiftsMap,
            frozenConvenioForPdf,
            monthName
          );

          await Promise.all([
            saveOrUpdateDriveJsonFile(
              token,
              folders.nominasFolderId,
              'meses_validados.json',
              updatedValidatedMap
            ),
            uploadPdfToDrive(token, folders.nominasFolderId, pdfFileName, pdfBlob),
            saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, jsonFileName, {
              mes: monthName,
              ano: yearToValidate,
              validado: true,
              fechaValidacion: finalRecord.validatedAt,
              jornadaPct: frozenJornadaPct,
              irpfPercentage: frozenProfile.irpfPercentage,
              horasRealizadasMesNatural: finalRecord.horasRealizadasMesNatural,
              horasTeoricasMes: finalRecord.horasTeoricasMes,
              saldoMesHoras: finalRecord.saldoMesHoras,
              bolsaAcumuladaAlCierre: finalRecord.bolsaAcumuladaAlCierre,
              perfil: frozenProfile,
              resumen: {
                liquidoPercibir: finalPayrollSnapshot.liquidoPercibir,
                totalDevengado: finalPayrollSnapshot.totalDevengado,
                totalDeducido: finalPayrollSnapshot.totalDeducido,
                baseCotizacionSS: finalPayrollSnapshot.baseCotizacionSS,
                retencionIrpf: finalPayrollSnapshot.retencionIrpf,
                retencionIrpfImporte: finalPayrollSnapshot.retencionIrpfImporte,
                lineas: finalPayrollSnapshot.lines,
              },
              nominaCompleta: finalPayrollSnapshot,
            }),
          ]);

          const updatedFiles = await listArchivedFilesInNominas(token, folders.nominasFolderId);
          setArchivedNominas(updatedFiles);
          clearDirtyDatasets(['validatedMonths']);
          setLastSyncTime(new Date());
          driveSaved = true;
        } catch (driveErr) {
          console.error('Error guardando mes validado y nómina en Drive:', driveErr);
        }
      }

      const msg = driveSaved
        ? `¡Mes de ${monthName} ${yearToValidate} validado y guardado con la nómina en Google Drive!`
        : `¡Mes de ${monthName} ${yearToValidate} validado y guardado en este dispositivo (Jornada ${frozenJornadaPct}% · IRPF ${frozenProfile.irpfPercentage}%)!`;
      setSaveSuccessMessage(msg);
      setTimeout(() => setSaveSuccessMessage(null), 6000);
      return { success: true, driveSaved, message: msg };
    } finally {
      setIsValidatingMonth(false);
    }
  };

  const handleUnvalidateMonth = async (yearToUnlock: number, monthToUnlock: number) => {
    const mKey = `${yearToUnlock}-${String(monthToUnlock).padStart(2, '0')}`;
    const updatedMap: ValidatedMonthsMap = { ...validatedMonths };
    delete updatedMap[mKey];
    setValidatedMonths(updatedMap);
    markDatasetsDirty('validatedMonths');

    const token = accessToken || getCachedAccessToken();
    if (currentUser && token && driveFolders) {
      try {
        await saveOrUpdateDriveJsonFile(
          token,
          driveFolders.nominasFolderId,
          'meses_validados.json',
          updatedMap
        );
        clearDirtyDatasets(['validatedMonths']);
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('Error actualizando meses validados en Drive:', err);
      }
    }
  };

  // Archivar nómina del mes seleccionado en Google Drive (Direxis / Nóminas)
  const handleSaveCurrentNominaToDrive = async () => {
    const token = accessToken || getCachedAccessToken();
    if (!currentUser || !token || !driveFolders) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsSavingCurrentNomina(true);
    setSaveSuccessMessage(null);
    try {
      const monthName = MONTH_NAMES[selectedMonth - 1];
      const targetProfile = currentValidatedRecord?.profileSnapshot || profile;
      const pdfBlob = exportToPDFBlob(
        monthlyPayroll,
        targetProfile,
        effectiveViewAssignments,
        effectiveViewShiftsMap,
        effectiveViewConvenio,
        monthName
      );

      const sanitizedProfileName = (targetProfile.name || 'Conductor').replace(/[^a-zA-Z0-9]/g, '_');
      const pdfFileName = `Nomina_${monthName}_${selectedYear}_${sanitizedProfileName}.pdf`;
      const jsonFileName = `Nomina_${monthName}_${selectedYear}_${sanitizedProfileName}.json`;

      await uploadPdfToDrive(token, driveFolders.nominasFolderId, pdfFileName, pdfBlob);
      await saveOrUpdateDriveJsonFile(
        token,
        driveFolders.nominasFolderId,
        jsonFileName,
        {
          mes: monthName,
          ano: selectedYear,
          validado: Boolean(currentValidatedRecord),
          fechaGeneracion: new Date().toISOString(),
          perfil: targetProfile,
          resumen: {
            liquidoPercibir: monthlyPayroll.liquidoPercibir,
            totalDevengado: monthlyPayroll.totalDevengado,
            totalDeducido: monthlyPayroll.totalDeducido,
            baseCotizacionSS: monthlyPayroll.baseCotizacionSS,
            lineas: monthlyPayroll.lines,
          },
        }
      );

      const updatedFiles = await listArchivedFilesInNominas(token, driveFolders.nominasFolderId);
      setArchivedNominas(updatedFiles);
      setSaveSuccessMessage(`¡Nómina de ${monthName} ${selectedYear} guardada en tu Google Drive (Direxis / Nóminas)!`);
      setTimeout(() => setSaveSuccessMessage(null), 6000);
    } catch (err) {
      console.error('Error archivando nómina en Drive:', err);
    } finally {
      setIsSavingCurrentNomina(false);
    }
  };

  if (publicPage) {
    return (
      <LegalPageView
        page={publicPage}
        onBackToHome={() => navigateToPublicPage(null)}
        onNavigateLegal={(page) => navigateToPublicPage(page)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <OfflineIndicator />
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onChangeMonth={(y, m) => {
          setSelectedYear(y);
          setSelectedMonth(m);
        }}
        convenio={convenio}
        profile={profile}
        payroll={monthlyPayroll}
        onOpenConvenioModal={() => setIsConvenioModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        user={currentUser}
        isSyncing={isDriveSyncing}
        lastSyncTime={lastSyncTime}
        nominasFolderUrl={driveFolders?.nominasWebViewLink}
        onManualSync={handleManualSync}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        hasUnsavedChanges={hasUnsavedChanges}
        isUpdatingDrive={isUpdatingDrive}
        onActualizarDrive={() => void handleActualizarTodo()}
      />

      {/* Aviso global de cambios sin actualizar en Drive + confirmación de guardado */}
      {hasUnsavedChanges && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-950">
          <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Tienes cambios pendientes sin guardar en Google Drive. Pulsa <strong>Actualizar</strong> antes de salir para conservarlos.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleActualizarTodo()}
              disabled={isUpdatingDrive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingDrive ? 'animate-spin' : ''}`} />
              <span>{isUpdatingDrive ? 'Actualizando...' : 'Actualizar ahora'}</span>
            </button>
          </div>
        </div>
      )}

      {saveSuccessMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900">
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        </div>
      )}

      {/* Breve descripción pública de la aplicación visible en la pantalla principal */}
      <div className="bg-blue-50/70 border-b border-blue-100">
        <div className="max-w-5xl mx-auto px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-700">
          <p>
            <strong className="text-blue-900">RutaNómina - Transporte de Viajeros:</strong> herramienta para gestionar rutas, jornadas, turnos y nóminas de conductores de transporte de viajeros.
          </p>
          {!currentUser ? (
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="text-blue-700 hover:text-blue-900 font-bold underline text-left sm:text-right shrink-0 cursor-pointer"
            >
              Conectar Google Drive
            </button>
          ) : driveFolders?.nominasWebViewLink ? (
            <a
              href={driveFolders.nominasWebViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:text-blue-900 font-bold underline text-left sm:text-right shrink-0"
            >
              Abrir carpeta Direxis / Nóminas en Drive
            </a>
          ) : null}
        </div>
        {driveSyncError && (
          <div className="max-w-5xl mx-auto px-4 pb-2 text-[11px] text-rose-700 font-semibold">
            Aviso de Google Drive: {driveSyncError}
          </div>
        )}
      </div>

      {/* Main View Area */}
      <main className="flex-1">
        {!profile.name.trim() && currentTab !== 'inicio' && (
          <div className="max-w-5xl mx-auto px-4 pt-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
              <p>
                <strong>Configura tus particularidades laborales:</strong> introduce tu nombre, empresa, localidad, jornada e IRPF para personalizar tu calendario y nóminas.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsOnboardingProfile(true);
                  setIsProfileModalOpen(true);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-[11px] shrink-0 self-start sm:self-auto transition-colors cursor-pointer"
              >
                Configurar perfil ahora
              </button>
            </div>
          </div>
        )}

        {currentTab === 'inicio' && (
          <StartMenuView
            profile={profile}
            selectedYear={selectedYear}
            selectedMonthName={MONTH_NAMES[selectedMonth - 1]}
            yearRate={currentYearRate}
            annualSummary={annualSummary}
            assignedDaysCount={
              assignments.filter((a) => a.date?.startsWith(`${selectedYear}-`)).length
            }
            user={currentUser}
            isSyncing={isDriveSyncing}
            onOpenProfileModal={() => setIsProfileModalOpen(true)}
            onOpenConvenioModal={() => setIsConvenioModalOpen(true)}
            onSelectTab={handleSelectTab}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onManualSync={handleManualSync}
          />
        )}

        {currentTab === 'anual' && (
          <CalendarioAnualView
            selectedYear={selectedYear}
            onChangeYear={(yr) => setSelectedYear(yr)}
            profile={profile}
            convenio={convenio}
            assignments={assignments}
            shifts={shifts}
            yearOverride={annualCalendarData[selectedYear]}
            onUpdateYearOverride={handleUpdateAnnualYearOverride}
            onSyncCommonToProfile={(partial) =>
              void handleSaveProfile({ ...profile, ...partial })
            }
            validatedMonths={validatedMonths}
            onSelectMonthForNomina={(y, m) => {
              setSelectedYear(y);
              setSelectedMonth(m);
              setCurrentTab('nomina');
            }}
          />
        )}

        {currentTab === 'turnos' && (
          <TurnosBDView
            shifts={shifts}
            onOpenNewTurnoModal={handleOpenNewTurno}
            onEditTurno={handleEditTurno}
            onDeleteTurno={handleDeleteTurno}
            onRestoreDefaults={handleRestoreDefaultShifts}
            currentYear={selectedYear}
            convenio={convenio}
            hasUnsavedChanges={hasUnsavedChanges}
            isUpdatingDrive={isUpdatingDrive}
            onActualizarDrive={() => void handleActualizarTodo()}
          />
        )}

        {currentTab === 'calendario' && (
          <CalendarioView
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChangeMonth={(y, m) => {
              setSelectedYear(y);
              setSelectedMonth(m);
            }}
            assignments={effectiveViewAssignments}
            onUpdateAssignment={handleUpdateAssignment}
            shifts={effectiveViewShifts}
            extrasList={extras.filter((e) => e.active)}
            convenio={effectiveViewConvenio}
            profile={effectiveExportProfile}
            onEditShift={handleEditTurno}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            validatedMonth={currentValidatedRecord}
            validatedMonths={validatedMonths}
            annualSummary={annualSummary}
            isValidatingMonth={isValidatingMonth}
            isRecalculating={isRefreshingForNomina || isValidatingMonth || isUpdatingDrive}
            onRecalculate={() =>
              void handleActualizarTodo({ recalculateValidatedIfNeeded: true })
            }
            onValidateMonth={() => handleValidateMonth(selectedYear, selectedMonth)}
            onUnvalidateMonth={() => handleUnvalidateMonth(selectedYear, selectedMonth)}
            onGoToNomina={() => handleSelectTab('nomina')}
            hasUnsavedChanges={hasUnsavedChanges}
            isUpdatingDrive={isUpdatingDrive}
            onActualizarDrive={() => void handleActualizarTodo({ recalculateValidatedIfNeeded: true })}
          />
        )}

        {currentTab === 'nomina' && (
          <NominaView
            payroll={monthlyPayroll}
            profile={effectiveExportProfile}
            convenio={effectiveViewConvenio}
            assignments={effectiveViewAssignments}
            shifts={effectiveViewShifts}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            yearlyEvolution={yearlyEvolution}
            onSelectMonth={(m, y) => {
              if (y !== undefined) setSelectedYear(y);
              setSelectedMonth(m);
            }}
            monthName={MONTH_NAMES[selectedMonth - 1]}
            onUpdateProfile={(partial) => {
              markDatasetsDirty('profile');
              setProfile((prev) => ({ ...prev, ...partial }));
            }}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            isDriveConnected={!!currentUser}
            onOpenDriveNominasModal={() => setIsDriveNominasModalOpen(true)}
            lastCalculatedAt={lastPayrollCalculatedAt}
            isRecalculating={isRefreshingForNomina || isValidatingMonth || isUpdatingDrive}
            onRecalculate={() =>
              void handleActualizarTodo({ recalculateValidatedIfNeeded: true })
            }
            hasUnsavedChanges={hasUnsavedChanges}
            validatedMonth={currentValidatedRecord}
            validatedMonths={validatedMonths}
            annualSummary={annualSummary}
            isValidatingMonth={isValidatingMonth}
            onValidateMonth={() => handleValidateMonth(selectedYear, selectedMonth)}
            onUnvalidateMonth={() => handleUnvalidateMonth(selectedYear, selectedMonth)}
          />
        )}

        {currentTab === 'extras' && (
          <ExtrasView
            extras={extras}
            onToggleExtra={handleToggleExtra}
            onSaveExtra={handleSaveExtra}
            onDeleteExtra={handleDeleteExtra}
            yearRate={currentYearRate}
            hasUnsavedChanges={hasUnsavedChanges}
            isUpdatingDrive={isUpdatingDrive}
            onActualizarDrive={() => void handleActualizarTodo()}
          />
        )}
      </main>

      {/* Public Footer with Privacy Policy and Terms of Service links */}
      <PublicFooter onNavigateLegal={navigateToPublicPage} />

      {/* Fixed Bottom Navigation matching screenshot */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        extrasCount={extras.filter((e) => e.active).length}
      />

      {/* Modals */}
      <TurnoEditModal
        isOpen={isTurnoModalOpen}
        onClose={() => {
          setIsTurnoModalOpen(false);
          setEditingShift(null);
        }}
        onSave={handleSaveTurno}
        onDelete={handleDeleteTurno}
        shiftToEdit={editingShift}
        yearRate={currentYearRate}
      />

      <ConvenioModal
        isOpen={isConvenioModalOpen}
        onClose={() => setIsConvenioModalOpen(false)}
        convenio={convenio}
        onSaveConvenio={(newConv) => {
          markDatasetsDirty('convenio');
          setConvenio(newConv);
        }}
        currentYear={selectedYear}
      />

      <WorkerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsOnboardingProfile(false);
          setIsProfileModalOpen(false);
        }}
        profile={profile}
        onSaveProfile={handleSaveProfile}
        yearRate={currentYearRate}
        isOnboarding={isOnboardingProfile || !profile.name.trim()}
        isDriveConnected={!!currentUser && !!(accessToken || getCachedAccessToken())}
      />

      {/* Modal de Inicio de Sesión con Cuenta de Gmail / Google Drive */}
      <GoogleLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setAuthRedirectError(null);
          pendingActualizarAfterLoginRef.current = false;
          setIsLoginModalOpen(false);
        }}
        onLoginSuccess={(user, token) => {
          setAuthRedirectError(null);
          setCurrentUser(user);
          setAccessToken(token);
          void syncWithDrive(token).then(() => {
            if (pendingActualizarAfterLoginRef.current) {
              pendingActualizarAfterLoginRef.current = false;
              void handleActualizarTodo();
            }
          });
        }}
        onNavigateLegal={navigateToPublicPage}
        allowDismiss={true}
        initialError={authRedirectError}
      />

      {/* Confirmación de cierre de sesión si existen cambios sin subir a Drive */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        title="Cambios sin actualizar en Drive"
        message="Tienes cambios realizados que todavía no se han actualizado en Google Drive. Si desconectas la cuenta ahora, esos cambios quedarán solo en este navegador y no estarán disponibles la próxima vez en Drive.\n\n¿Deseas desconectar sin actualizar?"
        confirmText="Desconectar sin actualizar"
        cancelText="Volver y actualizar"
        isDestructive={true}
        onConfirm={() => void executeLogout()}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />

      {/* Modal de Nóminas Guardadas en Drive */}
      <DriveNominasModal
        isOpen={isDriveNominasModalOpen}
        onClose={() => setIsDriveNominasModalOpen(false)}
        files={archivedNominas}
        isLoading={isLoadingArchived}
        onRefresh={handleRefreshArchived}
        currentMonthName={MONTH_NAMES[selectedMonth - 1]}
        currentYear={selectedYear}
        nominasFolderUrl={driveFolders?.nominasWebViewLink}
        onSaveCurrentNomina={handleSaveCurrentNominaToDrive}
        isSavingCurrent={isSavingCurrentNomina}
        saveSuccessMessage={saveSuccessMessage}
      />
    </div>
  );
}
