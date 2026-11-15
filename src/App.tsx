import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { NominaView } from './components/NominaView';
import { CalendarioView } from './components/CalendarioView';
import { TurnosBDView } from './components/TurnosBDView';
import { ExtrasView } from './components/ExtrasView';
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
} from './types';
import { ALL_INITIAL_SHIFTS } from './data/defaultTurnos';
import { DEFAULT_EXTRAS } from './data/defaultExtras';
import { DEFAULT_CONVENIO_ZARAGOZA, getEffectiveYearRate } from './data/convenioZaragoza';
import { calculateMonthlyPayroll, calculateYearlySalaryEvolution } from './utils/calculator';
import { exportToPDF, exportToPDFBlob, exportToExcel } from './utils/exporter';
import { getExactOctoberAssignments } from './data/realOctoberPayslip';

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

const DELETED_MOCK_CODES = new Set([
  'M1', 'T1', 'T2', 'T3', 'T4', 'T5', 'N1', 'DISC', 'M2', 'R', 'S1', 'S2', 'F1', 'F2', 'SP1'
]);

function mapLegacyShiftCode(code?: string): string | undefined {
  if (!code) return code;
  if (code === 'M1') return '6V.L01';
  if (code === 'M2') return '6V.L03';
  if (code === 'T1' || code === 'T2' || code === 'T3' || code === 'T4' || code === 'T5') return '6V.L02';
  if (code === 'N1') return '6V.LCC';
  if (code === 'R') return '6V.LR1';
  if (code.includes('/L')) return code.replace(/\/L/g, '');
  if (code === 'F1' || code === 'F2') return '6.D03';
  if (code === 'DISC' || code === 'SP1') return '6V.L01';
  return code;
}

export default function App() {
  const [publicPage, setPublicPage] = useState<PublicLegalPage | null>(() => getPublicPageFromUrl());
  const [currentTab, setCurrentTab] = useState<'turnos' | 'calendario' | 'nomina' | 'extras'>('calendario');
  const [selectedYear, setSelectedYear] = useState(() => Math.max(2026, new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() < 2026 ? 1 : now.getMonth() + 1;
  });

  // Persistent Shifts (Exclusively official Direxis parts without /L + Retén configurations)
  const [shifts, setShifts] = useState<ShiftDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_shifts_v10') || localStorage.getItem('rutanomina_shifts_v9');
      if (saved) {
        const parsed: ShiftDefinition[] = JSON.parse(saved);
        const cleaned = parsed
          .filter((s) => !DELETED_MOCK_CODES.has(s.code) && s.category !== 'partido' && s.modality !== 'partido')
          .map((s) => {
            // Eliminar automáticamente cualquier "/L" de códigos y títulos
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
        const hasDescanso = cleaned.some((s) => s.code === 'D');
        if (!hasDescanso) {
          const dDef = ALL_INITIAL_SHIFTS.find((s) => s.code === 'D');
          if (dDef) cleaned.unshift(dDef);
        }
        if (cleaned.length >= 90) return cleaned;
      }
    } catch (e) {
      console.error(e);
    }
    return ALL_INITIAL_SHIFTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_shifts_v10', JSON.stringify(shifts));
    } catch (e) {
      console.error(e);
    }
  }, [shifts]);

  // Persistent Extras (Fuera de Convenio y Conceptos Oficiales)
  const [extras, setExtras] = useState<ExtraConcept[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_extras_v2') || localStorage.getItem('rutanomina_extras_v1');
      if (saved) {
        const parsed: ExtraConcept[] = JSON.parse(saved);
        const hasReten = parsed.some((e) => e.id === 'extra-reten' || e.name.toLowerCase().includes('reten') || e.name.toLowerCase().includes('retén'));
        if (!hasReten) {
          const defaultReten = DEFAULT_EXTRAS.find((e) => e.id === 'extra-reten');
          if (defaultReten) return [defaultReten, ...parsed];
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_EXTRAS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_extras_v2', JSON.stringify(extras));
    } catch (e) {
      console.error(e);
    }
  }, [extras]);

  // Persistent Calendar Assignments (starts blank by default; filled by user or Google Drive backup)
  const [assignments, setAssignments] = useState<DayAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_assignments_v6');
      if (saved) {
        const parsed: DayAssignment[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((a) => {
              const yr = parseInt(a.date.split('-')[0], 10);
              return yr >= 2026;
            })
            .map((a) => ({
              ...a,
              shiftCode: mapLegacyShiftCode(a.shiftCode),
              extras: a.extras || [],
            }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_assignments_v6', JSON.stringify(assignments));
    } catch (e) {
      console.error(e);
    }
  }, [assignments]);

  // Persistent Convenio (starting in 2026, ensuring all fields are populated)
  const [convenio, setConvenio] = useState<ConvenioInfo>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_convenio_v3') || localStorage.getItem('rutanomina_convenio_v2');
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
              plusFestivoMayor4h: rawRate.plusFestivoMayor4h === 40.80 ? 42.80 : (rawRate.plusFestivoMayor4h ?? 42.80),
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
      localStorage.setItem('rutanomina_convenio_v3', JSON.stringify(convenio));
    } catch (e) {
      console.error(e);
    }
  }, [convenio]);

  // Worker Profile
  const [profile, setProfile] = useState<WorkerProfile>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_profile_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          extrasCutoffMode: 'direxis_25_24',
          customCutoffStartDay: 25,
          hasVacationPlus100Percent: true,
          ...parsed,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return {
      name: 'GARCIA MIANA, JORGE ADOLFO',
      nif: '29112260X',
      category: 'Conductor/a Perceptor/a',
      companyName: 'S.A. MASATS TRANSPORTES GENERALES, UNIP',
      cif: 'A63086797',
      irpfPercentage: 15.0,
      contractType: 'indefinido',
      partTimePercentage: 100,
      prorrateoPagasExtra: 'tres_pagas',
      prorratearPagasExtra: true,
      extrasCutoffMode: 'direxis_25_24',
      customCutoffStartDay: 25,
      hasMonetaryQuebranto: true,
      hasConductorPerceptorPlus: true,
      hasVacationPlus100Percent: true,
      salaryBaseRateMode: 'convenio_53_18',
      unionFeeDeduction: 0,
      advancePayment: 0,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_profile_v1', JSON.stringify(profile));
    } catch (e) {
      console.error(e);
    }
  }, [profile]);

  // Sincronizar nómina y cuadrante con la nómina real escaneada de Octubre 2026
  const handleSyncRealPayslip = () => {
    setSelectedYear(2026);
    setSelectedMonth(10);
    setProfile((prev) => ({
      ...prev,
      name: 'GARCIA MIANA, JORGE ADOLFO',
      nif: '29112260X',
      category: 'Conductor/a Perceptor/a',
      companyName: 'S.A. MASATS TRANSPORTES GENERALES, UNIP',
      cif: 'A63086797',
      irpfPercentage: 15.0,
      salaryBaseRateMode: 'masats_39_89',
      prorrateoPagasExtra: 'tres_pagas',
      contractType: 'indefinido',
      partTimePercentage: 100,
    }));
    const exactOctoberAssignments = getExactOctoberAssignments();
    setAssignments((prev) => {
      const otherMonths = prev.filter((a) => !a.date.startsWith('2026-10-'));
      return [...otherMonths, ...exactOctoberAssignments];
    });
    setCurrentTab('nomina');
  };

  // Modals state
  const [isTurnoModalOpen, setIsTurnoModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftDefinition | null>(null);
  const [isConvenioModalOpen, setIsConvenioModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const hasInitialDriveSyncDoneRef = React.useRef(false);
  const syncPromiseRef = React.useRef<Promise<void> | null>(null);
  const latestStateRef = React.useRef({ shifts, profile, convenio, assignments, extras });
  latestStateRef.current = { shifts, profile, convenio, assignments, extras };

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
            setShifts(cleaned);
          }
        } else {
          // Si no existen todavía, guardar los turnos actuales como base inicial dentro de Direxis / Nóminas
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'turnos_base.json', currentSnapshot.shifts);
        }

        // 2. Configuración de chófer
        const choferFile = await findFileInFolder(token, 'chofer_config.json', folders.nominasFolderId);
        if (choferFile) {
          const driveProfile = await readDriveJsonFile<WorkerProfile>(token, choferFile.id);
          if (driveProfile && driveProfile.name) {
            setProfile(driveProfile);
          }
        } else {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'chofer_config.json', currentSnapshot.profile);
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
                  plusFestivoMayor4h: r.plusFestivoMayor4h === 40.80 ? 42.80 : (r.plusFestivoMayor4h ?? 42.80),
                  year: yNum,
                };
              }
            }
            setConvenio({ ...driveConvenio, ratesByYear: migratedRates });
          }
        } else {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'convenio_2026.json', currentSnapshot.convenio);
        }

        // 4. Asignaciones de Cuadrante (si hay copia en Drive, rellena el calendario; si no, queda en blanco o conserva lo introducido)
        const asignacionesFile = await findFileInFolder(token, 'cuadrante_asignaciones.json', folders.nominasFolderId);
        if (asignacionesFile) {
          const driveAsignaciones = await readDriveJsonFile<DayAssignment[]>(token, asignacionesFile.id);
          if (driveAsignaciones && Array.isArray(driveAsignaciones) && driveAsignaciones.length > 0) {
            setAssignments(driveAsignaciones);
          }
        } else {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'cuadrante_asignaciones.json', currentSnapshot.assignments);
        }

        // 5. Catálogo de Extras
        const extrasFile = await findFileInFolder(token, 'catalogo_extras.json', folders.nominasFolderId);
        if (extrasFile) {
          const driveExtras = await readDriveJsonFile<ExtraConcept[]>(token, extrasFile.id);
          if (driveExtras && Array.isArray(driveExtras) && driveExtras.length > 0) {
            setExtras(driveExtras);
          }
        } else {
          await saveOrUpdateDriveJsonFile(token, folders.nominasFolderId, 'catalogo_extras.json', currentSnapshot.extras);
        }

        // Consultar nóminas archivadas en la subcarpeta
        const archived = await listArchivedFilesInNominas(token, folders.nominasFolderId);
        setArchivedNominas(archived);

        setLastSyncTime(new Date());
        hasInitialDriveSyncDoneRef.current = true;
      } catch (err: any) {
        console.error('Error sincronizando con Google Drive:', err);
        setDriveSyncError(err?.message || 'Error al sincronizar con Google Drive.');
      } finally {
        setIsDriveSyncing(false);
        syncPromiseRef.current = null;
      }
    })();

    syncPromiseRef.current = run;
    return run;
  };

  // Auto-guardado en Drive ante cualquier variación tras sincronización inicial
  useEffect(() => {
    if (!currentUser || !accessToken || !driveFolders || !hasInitialDriveSyncDoneRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        await Promise.all([
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'turnos_base.json', shifts),
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'chofer_config.json', profile),
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'convenio_2026.json', convenio),
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'cuadrante_asignaciones.json', assignments),
          saveOrUpdateDriveJsonFile(accessToken, driveFolders.nominasFolderId, 'catalogo_extras.json', extras),
        ]);
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('Error auto-guardando en Google Drive:', err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentUser, accessToken, driveFolders, shifts, profile, convenio, assignments, extras]);

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

  // Computed Monthly Payroll
  const monthlyPayroll = useMemo(() => {
    return calculateMonthlyPayroll(
      assignments,
      shiftsMap,
      currentYearRate,
      profile,
      selectedYear,
      selectedMonth
    );
  }, [assignments, shiftsMap, currentYearRate, profile, selectedYear, selectedMonth]);

  // Computed 12-Month Salary Evolution across the selected year
  const yearlyEvolution = useMemo(() => {
    return calculateYearlySalaryEvolution(
      selectedYear,
      assignments,
      shiftsMap,
      convenio,
      profile
    );
  }, [selectedYear, assignments, shiftsMap, convenio, profile]);

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
    setShifts((prev) => {
      const idx = prev.findIndex(
        (s) => s.id === newOrUpdated.id || (editingShift && s.code === editingShift.code) || s.code === newOrUpdated.code
      );
      if (idx >= 0) {
        const oldShift = prev[idx];
        const copy = [...prev];
        copy[idx] = newOrUpdated;

        // Si se ha cambiado el código, propagar el nuevo código a todos los días del calendario
        if (oldShift.code !== newOrUpdated.code) {
          setAssignments((asgs) =>
            asgs.map((a) =>
              a.shiftCode === oldShift.code ? { ...a, shiftCode: newOrUpdated.code } : a
            )
          );
        }
        return copy;
      }
      return [newOrUpdated, ...prev];
    });
    setEditingShift(null);
    setIsTurnoModalOpen(false);
  };

  const handleDeleteTurno = (id: string) => {
    const shiftToDelete = shifts.find((s) => s.id === id);
    setShifts((prev) => prev.filter((s) => s.id !== id));
    if (shiftToDelete) {
      setAssignments((prev) =>
        prev.map((a) =>
          a.shiftCode === shiftToDelete.code
            ? { ...a, shiftCode: undefined, isRest: false }
            : a
        )
      );
    }
  };

  const handleRestoreDefaultShifts = () => {
    if (window.confirm('¿Deseas restablecer los 98 partes oficiales de Direxis Zaragoza y turnos estándar?')) {
      setShifts(ALL_INITIAL_SHIFTS);
    }
  };

  // Calendar Assignment update
  const handleUpdateAssignment = (date: string, partial: Partial<DayAssignment>) => {
    setAssignments((prev) => {
      const idx = prev.findIndex((a) => a.date === date);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...partial };
        return copy;
      }
      return [...prev, { date, extras: [], ...partial }];
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

  // Export triggers
  const handleExportPDF = () => {
    const monthName = MONTH_NAMES[selectedMonth - 1];
    exportToPDF(
      monthlyPayroll,
      profile,
      assignments,
      shiftsMap,
      convenio,
      monthName
    );
  };

  const handleExportExcel = () => {
    const monthName = MONTH_NAMES[selectedMonth - 1];
    exportToExcel(
      monthlyPayroll,
      profile,
      assignments,
      shiftsMap,
      convenio,
      monthName
    );
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
      const pdfBlob = exportToPDFBlob(
        monthlyPayroll,
        profile,
        assignments,
        shiftsMap,
        convenio,
        monthName
      );

      const sanitizedProfileName = (profile.name || 'Conductor').replace(/[^a-zA-Z0-9]/g, '_');
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
          fechaGeneracion: new Date().toISOString(),
          perfil: profile,
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
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab as any)}
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
            assignments={assignments}
            onUpdateAssignment={handleUpdateAssignment}
            shifts={shifts}
            extrasList={extras.filter((e) => e.active)}
            convenio={convenio}
            profile={profile}
            onEditShift={handleEditTurno}
          />
        )}

        {currentTab === 'nomina' && (
          <NominaView
            payroll={monthlyPayroll}
            profile={profile}
            convenio={convenio}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            yearlyEvolution={yearlyEvolution}
            onSelectMonth={(m) => setSelectedMonth(m)}
            monthName={MONTH_NAMES[selectedMonth - 1]}
            onUpdateProfile={(partial) => setProfile((prev) => ({ ...prev, ...partial }))}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            onSyncRealPayslip={handleSyncRealPayslip}
            isDriveConnected={!!currentUser}
            onOpenDriveNominasModal={() => setIsDriveNominasModalOpen(true)}
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
        onSelectTab={(tab) => setCurrentTab(tab as any)}
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
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        onSaveProfile={(newProf) => setProfile(newProf)}
        yearRate={currentYearRate}
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
