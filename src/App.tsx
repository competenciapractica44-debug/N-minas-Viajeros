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
    if (isNaN(yr) || yr < 2026) continue;

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
          return reconcileValidatedMonthsMap(parsed as ValidatedMonthsMap);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

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
  const hasInitialDriveSyncDoneRef = React.useRef(false);
  const syncPromiseRef = React.useRef<Promise<void> | null>(null);
  const hasPendingLocalSyncRef = React.useRef(readAssignmentsDirtyFlag());
  const isApplyingRemoteSyncRef = React.useRef(false);
  const lastSyncedAssignmentsJsonRef = React.useRef<string | null>(null);
  const [payrollCalcNonce, setPayrollCalcNonce] = useState(0);
  const [lastPayrollCalculatedAt, setLastPayrollCalculatedAt] = useState<Date>(() => new Date());
  const [isRefreshingForNomina, setIsRefreshingForNomina] = useState(false);
  const latestStateRef = React.useRef({ shifts, profile, convenio, assignments, extras, annualCalendarData, validatedMonths });
  latestStateRef.current = { shifts, profile, convenio, assignments, extras, annualCalendarData, validatedMonths };

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

  // Inicializar estado de autenticación al arrancar la app
  useEffect(() => {
    const unsubscribe = initAuth((user, token) => {
      setCurrentUser(user);
      if (token) {
        setAccessToken(token);
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

        // 1. Turnos base
        // Regla: "si ya hay turnos guardados, se trabajara sobre los guardados en drive"
        const turnosFile = await findFileInFolder(token, 'turnos_base.json', folders.nominasFolderId);
        if (turnosFile) {
          const driveShifts = await readDriveJsonFile<ShiftDefinition[]>(token, turnosFile.id);
          if (driveShifts && Array.isArray(driveShifts) && driveShifts.length > 0) {
            // Limpiar cualquier posible '/L' residual en turnos cargados
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
            setShifts(ensureBuiltInSpecialShifts(cleaned));
          }
        } else {
          // Si no existen todavía, guardar los turnos actuales como base inicial dentro de Direxis / Nóminas
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'turnos_base.json', currentSnapshot.shifts);
        }

        // 2. Configuración de chófer (si falta o está vacía en Drive y no se ha rellenado aún, abrir ficha para que el usuario la introduzca y guarde en Drive)
        let needsProfileOnboarding = false;
        const choferFile = await findFileInFolder(token, 'chofer_config.json', folders.nominasFolderId);
        if (choferFile) {
          const driveProfile = await readDriveJsonFile<WorkerProfile>(token, choferFile.id);
          if (driveProfile && driveProfile.name?.trim()) {
            isApplyingRemoteSyncRef.current = true;
            setProfile({
              ...EMPTY_WORKER_PROFILE,
              ...driveProfile,
              hasVacationPlus: driveProfile.hasVacationPlus !== undefined ? driveProfile.hasVacationPlus : true,
              hasPunctualityEarlyStartPlus: driveProfile.hasPunctualityEarlyStartPlus === true,
              fechaAlta: typeof driveProfile.fechaAlta === 'string' && driveProfile.fechaAlta.trim() ? driveProfile.fechaAlta.trim() : undefined,
              fechaBaja: typeof driveProfile.fechaBaja === 'string' && driveProfile.fechaBaja.trim() ? driveProfile.fechaBaja.trim() : undefined,
            });
          } else if (currentSnapshot.profile.name.trim()) {
            await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'chofer_config.json', currentSnapshot.profile);
          } else {
            needsProfileOnboarding = true;
          }
        } else if (currentSnapshot.profile.name.trim()) {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'chofer_config.json', currentSnapshot.profile);
        } else {
          needsProfileOnboarding = true;
        }

        // 3. Valores del Convenio de 2026
        const convenioFile = await findFileInFolder(token, 'convenio_2026.json', folders.nominasFolderId);
        if (convenioFile) {
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
            isApplyingRemoteSyncRef.current = true;
            setConvenio({ ...driveConvenio, ratesByYear: migratedRates });
          }
        } else {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'convenio_2026.json', currentSnapshot.convenio);
        }

        // 4. Asignaciones de Cuadrante (fusión por fecha: nunca pierde meses introducidos en local si faltan en Drive)
        const isLocalDirty = hasPendingLocalSyncRef.current || readAssignmentsDirtyFlag();
        const asignacionesFile = await findFileInFolder(token, 'cuadrante_asignaciones.json', folders.nominasFolderId);
        if (asignacionesFile) {
          const driveAsignaciones = await readDriveJsonFile<DayAssignment[]>(token, asignacionesFile.id);
          if (driveAsignaciones && Array.isArray(driveAsignaciones)) {
            const normalizedDrive = normalizeAssignmentsList(driveAsignaciones, currentSnapshot.shifts);
            const normalizedLocal = normalizeAssignmentsList(latestStateRef.current.assignments, currentSnapshot.shifts);
            const mergedAssignments = mergeAssignmentsByDate(normalizedLocal, normalizedDrive, isLocalDirty);
            const mergedJson = JSON.stringify(mergedAssignments);
            const driveJson = JSON.stringify(normalizedDrive);

            if (mergedJson !== JSON.stringify(latestStateRef.current.assignments)) {
              setAssignments(mergedAssignments);
            }
            if (mergedJson !== driveJson) {
              await saveOrUpdateDriveJsonFile(
                token,
                folders.nominasFolderId,
                'cuadrante_asignaciones.json',
                mergedAssignments
              );
            }
            lastSyncedAssignmentsJsonRef.current = mergedJson;
            writeAssignmentsDirtyFlag(false);
          }
        } else {
          const normalizedLocal = normalizeAssignmentsList(latestStateRef.current.assignments, currentSnapshot.shifts);
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'cuadrante_asignaciones.json', normalizedLocal);
          lastSyncedAssignmentsJsonRef.current = JSON.stringify(normalizedLocal);
          writeAssignmentsDirtyFlag(false);
        }

        // 5. Catálogo de Extras
        const extrasFile = await findFileInFolder(token, 'catalogo_extras.json', folders.nominasFolderId);
        if (extrasFile) {
          const driveExtras = await readDriveJsonFile<ExtraConcept[]>(token, extrasFile.id);
          if (driveExtras && Array.isArray(driveExtras) && driveExtras.length > 0) {
            isApplyingRemoteSyncRef.current = true;
            setExtras(mergeWithDefaultBuiltInExtras(driveExtras));
          }
        } else {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'catalogo_extras.json', currentSnapshot.extras);
        }

        // 6. Ajustes personalizados del Calendario Anual y Bolsa de Horas
        const annualFile = await findFileInFolder(token, 'calendario_anual_bolsa.json', folders.nominasFolderId);
        if (annualFile) {
          const driveAnnual = await readDriveJsonFile<AnnualCalendarState>(token, annualFile.id);
          if (driveAnnual && typeof driveAnnual === 'object') {
            const mergedAnnual: AnnualCalendarState = {
              ...driveAnnual,
              ...currentSnapshot.annualCalendarData,
            };
            isApplyingRemoteSyncRef.current = true;
            setAnnualCalendarData(mergedAnnual);
          }
        } else if (Object.keys(currentSnapshot.annualCalendarData).length > 0) {
          await saveOrUpdateDriveJsonFile(
            token,
            folders.nominasFolderId,
            'calendario_anual_bolsa.json',
            currentSnapshot.annualCalendarData
          );
        }

        // 7. Meses validados (con % jornada, % IRPF y snapshot de nóminas cerradas)
        const validatedFile = await findFileInFolder(token, 'meses_validados.json', folders.nominasFolderId);
        if (validatedFile) {
          const driveValidated = await readDriveJsonFile<ValidatedMonthsMap>(token, validatedFile.id);
          if (driveValidated && typeof driveValidated === 'object') {
            const reconciledDrive = reconcileValidatedMonthsMap(driveValidated);
            const mergedValidated = reconcileValidatedMonthsMap(
              mergeValidatedMonths(
                latestStateRef.current.validatedMonths,
                reconciledDrive,
                isLocalDirty
              )
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
        } else if (Object.keys(latestStateRef.current.validatedMonths).length > 0) {
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
        hasPendingLocalSyncRef.current = false;

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

  // Auto-guardado en Drive de la configuración y calendario (NUNCA guarda nóminas automáticamente)
  useEffect(() => {
    if (!currentUser || !accessToken || !driveFolders || !hasInitialDriveSyncDoneRef.current) {
      return;
    }

    const currentAssignmentsJson = JSON.stringify(assignments);
    const assignmentsChangedLocally =
      lastSyncedAssignmentsJsonRef.current !== null &&
      currentAssignmentsJson !== lastSyncedAssignmentsJsonRef.current;

    if (isApplyingRemoteSyncRef.current && !assignmentsChangedLocally) {
      isApplyingRemoteSyncRef.current = false;
      return;
    }
    isApplyingRemoteSyncRef.current = false;

    if (assignmentsChangedLocally) {
      hasPendingLocalSyncRef.current = true;
      writeAssignmentsDirtyFlag(true);
    }

    const timer = setTimeout(async () => {
      try {
        const uploads: Array<Promise<unknown>> = [
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'turnos_base.json', shifts),
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'convenio_2026.json', convenio),
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'cuadrante_asignaciones.json', assignments),
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'catalogo_extras.json', extras),
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'calendario_anual_bolsa.json', annualCalendarData),
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'meses_validados.json', validatedMonths),
        ];
        if (profile.name.trim().length > 0) {
          uploads.push(
            saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'chofer_config.json', profile)
          );
        }
        await Promise.all(uploads);
        lastSyncedAssignmentsJsonRef.current = currentAssignmentsJson;
        hasPendingLocalSyncRef.current = false;
        writeAssignmentsDirtyFlag(false);
        setDriveSyncError(null);
        setLastSyncTime(new Date());
      } catch (err: any) {
        console.error('Error auto-guardando en Google Drive:', err);
        const msg = String(err?.message || '');
        if (msg.includes('401')) {
          setDriveSyncError('Sesión de Drive caducada. Tus cambios siguen en este dispositivo; vuelve a conectar Drive para subirlos.');
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentUser, accessToken, driveFolders, shifts, profile, convenio, assignments, extras, annualCalendarData, validatedMonths]);

  // Cierre de sesión
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setAccessToken(null);
    setDriveFolders(null);
    setArchivedNominas([]);
    hasInitialDriveSyncDoneRef.current = false;
  };

  // Sincronización manual bajo demanda
  const handleManualSync = () => {
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
    const snapDates = new Set(snapList.map((sa) => normalizeDateKey(sa.date)));
    const otherAssignments = assignments.filter((a) => {
      const d = normalizeDateKey(a.date);
      return !snapDates.has(d) && !(d >= winStart && d <= winEnd);
    });
    return [...otherAssignments, ...snapList].sort((a, b) =>
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
      validatedMonths
    );
  }, [assignments, shiftsMap, currentYearRate, profile, selectedYear, selectedMonth, validatedMonths, payrollCalcNonce]);

  const monthlyPayroll = currentValidatedRecord?.payrollSnapshot || liveMonthlyPayroll;

  // Computed 12-Month Salary Evolution across the selected year
  const yearlyEvolution = useMemo(() => {
    return calculateYearlySalaryEvolution(
      selectedYear,
      assignments,
      shiftsMap,
      convenio,
      profile,
      validatedMonths
    );
  }, [selectedYear, assignments, shiftsMap, convenio, profile, validatedMonths, payrollCalcNonce]);

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
  }, [assignments, shifts, convenio, profile, selectedYear, selectedMonth]);

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
        hasPendingLocalSyncRef.current = true;
        writeAssignmentsDirtyFlag(true);
        setAssignments(nextAssignments);
      }
    }

    setEditingShift(null);
    setIsTurnoModalOpen(false);
  };

  const handleDeleteTurno = (id: string) => {
    const shiftToDelete = shifts.find((s) => s.id === id);
    setShifts((prev) => prev.filter((s) => s.id !== id));
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
        hasPendingLocalSyncRef.current = true;
        writeAssignmentsDirtyFlag(true);
      }
    }
  };

  const handleRestoreDefaultShifts = () => {
    if (window.confirm(`¿Deseas restablecer los ${ALL_INITIAL_SHIFTS.length} turnos iniciales incluidos en la aplicación?`)) {
      setShifts(ALL_INITIAL_SHIFTS);
    }
  };

  const handleSaveProfile = async (newProf: WorkerProfile) => {
    setProfile(newProf);
    setIsOnboardingProfile(false);
    setIsProfileModalOpen(false);

    const token = accessToken || getCachedAccessToken();
    if (currentUser && token) {
      try {
        const folders = driveFolders || (await ensureDirexisHierarchy(token));
        if (!driveFolders) setDriveFolders(folders);
        await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'chofer_config.json', newProf);
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
    hasPendingLocalSyncRef.current = true;
    writeAssignmentsDirtyFlag(true);
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
    setExtras((prev) =>
      prev.map((e) => (e.id === id ? { ...e, active: !e.active } : e))
    );
  };

  const handleSaveExtra = (extra: ExtraConcept) => {
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
    monthToValidate: number
  ): Promise<{ success: boolean; driveSaved: boolean; message: string }> => {
    setIsValidatingMonth(true);
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

      // Recalcular nómina exacta del mes con el perfil, turnos y asignaciones congelados
      const payrollSnapshot = calculateMonthlyPayroll(
        assignments,
        frozenShiftsMap,
        frozenYearRate,
        frozenProfile,
        yearToValidate,
        monthToValidate,
        validatedMonths
      );

      // Calcular balance anual del mes para llevar el arrastre de horas exacto
      const yOverride = annualCalendarData[yearToValidate];
      const defParams = deriveDefaultAnnualParams(frozenProfile, convenio, yearToValidate);
      const defMonths = deriveDefaultAnnualMonths(
        yearToValidate,
        frozenProfile,
        assignments,
        frozenShiftsSnapshot,
        convenio,
        validatedMonths
      );
      const effParams = resolveAnnualParams(defParams, yOverride);
      const effMonths = resolveAnnualMonths(defMonths, yOverride);

      const tempMap: ValidatedMonthsMap = {
        ...validatedMonths,
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
        horasTeoricasMes:
          monthRow?.cuotaMes ?? payrollSnapshot.convenioMonthlyHoursTarget,
        saldoMesHoras: Math.round(
          ((monthRow?.diferenciaRealMes ??
            (payrollSnapshot.ordinaryConvenioHours - payrollSnapshot.convenioMonthlyHoursTarget))) *
            100
        ) / 100,
        bolsaAcumuladaAlCierre: Math.round((monthRow?.bolsaCompensacionAcumulada ?? 0) * 100) / 100,
        filledDaysCount,
        daysInMonth,
        payrollSnapshot,
        shiftsSnapshot: frozenShiftsSnapshot,
        assignmentsSnapshot: frozenAssignmentsSnapshot,
        yearRateSnapshot: frozenYearRate,
        drivePdfFileName: pdfFileName,
        driveJsonFileName: jsonFileName,
      };

      const updatedValidatedMap: ValidatedMonthsMap = {
        ...validatedMonths,
        [mKey]: record,
      };
      setValidatedMonths(updatedValidatedMap);

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
            payrollSnapshot,
            frozenProfile,
            frozenAssignmentsSnapshot,
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
              fechaValidacion: record.validatedAt,
              jornadaPct: frozenJornadaPct,
              irpfPercentage: frozenProfile.irpfPercentage,
              horasRealizadasMesNatural: record.horasRealizadasMesNatural,
              horasTeoricasMes: record.horasTeoricasMes,
              saldoMesHoras: record.saldoMesHoras,
              bolsaAcumuladaAlCierre: record.bolsaAcumuladaAlCierre,
              perfil: frozenProfile,
              resumen: {
                liquidoPercibir: payrollSnapshot.liquidoPercibir,
                totalDevengado: payrollSnapshot.totalDevengado,
                totalDeducido: payrollSnapshot.totalDeducido,
                baseCotizacionSS: payrollSnapshot.baseCotizacionSS,
                retencionIrpf: payrollSnapshot.retencionIrpf,
                retencionIrpfImporte: payrollSnapshot.retencionIrpfImporte,
                lineas: payrollSnapshot.lines,
              },
              nominaCompleta: payrollSnapshot,
            }),
          ]);

          const updatedFiles = await listArchivedFilesInNominas(token, folders.nominasFolderId);
          setArchivedNominas(updatedFiles);
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

    const token = accessToken || getCachedAccessToken();
    if (currentUser && token && driveFolders) {
      try {
        await saveOrUpdateDriveJsonFile(
          token,
          driveFolders.nominasFolderId,
          'meses_validados.json',
          updatedMap
        );
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
      />

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
            onValidateMonth={() => handleValidateMonth(selectedYear, selectedMonth)}
            onUnvalidateMonth={() => handleUnvalidateMonth(selectedYear, selectedMonth)}
            onGoToNomina={() => handleSelectTab('nomina')}
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
            onUpdateProfile={(partial) => setProfile((prev) => ({ ...prev, ...partial }))}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            isDriveConnected={!!currentUser}
            onOpenDriveNominasModal={() => setIsDriveNominasModalOpen(true)}
            lastCalculatedAt={lastPayrollCalculatedAt}
            isRecalculating={isRefreshingForNomina}
            onRecalculate={() => void recalculatePayrollFromCalendar(true)}
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
        onSaveConvenio={(newConv) => setConvenio(newConv)}
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
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user, token) => {
          setCurrentUser(user);
          setAccessToken(token);
          syncWithDrive(token);
        }}
        onNavigateLegal={navigateToPublicPage}
        allowDismiss={true}
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
