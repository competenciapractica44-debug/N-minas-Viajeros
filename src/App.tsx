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
import { DEFAULT_CONVENIO_ZARAGOZA } from './data/convenioZaragoza';
import { calculateMonthlyPayroll, calculateYearlySalaryEvolution } from './utils/calculator';
import { exportToPDF, exportToExcel } from './utils/exporter';
import { getExactOctoberAssignments } from './data/realOctoberPayslip';

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
  if (code === 'S1' || code === 'S2') return '6.S02';
  if (code === 'F1' || code === 'F2') return '6.D03/L';
  if (code === 'DISC' || code === 'SP1') return '6V.L01';
  return code;
}

// Initial 2026 assignments (application starts in 2026 with official Direxis parts)
function getInitial2026Assignments(): DayAssignment[] {
  const assignments: DayAssignment[] = [];
  const shiftSchedule: Record<number, string> = {
    1: '6V.L01',
    2: '6V.L01',
    3: '6.S02',
    4: 'D',
    5: '6V.L03',
    6: '6V.L01',
    7: '6V.L02',
    8: '6V.L02',
    9: '6V.LR1',
    10: '6.S05',
    11: 'D',
    12: 'D', // Fiesta Nacional / Descanso
    13: '6V.L01',
    14: '6V.L01',
    15: '6V.L02',
    16: '6V.L02',
    17: '6.S02',
    18: 'D',
    19: '6V.L01',
    20: '6V.L03',
    21: '6V.L02',
    22: '6V.L02',
    23: '6V.L01',
    24: '6.S01', // Has extras
    25: 'D',
    26: '6V.L01',
    27: '6V.L03',
    28: '6V.L02',
    29: '6V.L03',
    30: '6V.L13',
    31: '6.S02',
  };

  for (let d = 1; d <= 31; d++) {
    const dStr = `2026-10-${String(d).padStart(2, '0')}`;
    const code = shiftSchedule[d] || '6V.L01';
    const isRest = code === 'D';

    const extras = [];
    if (d === 24) {
      extras.push(
        { id: 'oct24-1', name: 'Limpieza interior autocar', amount: 30.00, notes: 'Plus fin de servicio nocturno' },
        { id: 'oct24-2', name: '30 min espera retraso atasco', amount: 12.50, notes: 'Exceso cómputo jornada A-6' }
      );
    } else if (d === 10) {
      extras.push(
        { id: 'oct10-1', name: 'Hora de espera en parada', amount: 22.50 }
      );
    } else if (d === 16) {
      extras.push(
        { id: 'oct16-1', name: 'Gratificación refuerzo imprevisto', amount: 35.00 }
      );
    } else if (d === 26) {
      extras.push(
        { id: 'oct26-1', name: 'Hora extra prolongación servicio', amount: 30.00, notes: 'Devengado tras el corte oficial de Direxis' }
      );
    }

    assignments.push({
      date: dStr,
      shiftCode: code,
      isRest,
      isSunday: [4, 11, 18, 25].includes(d),
      customLine: d === 24 ? 'Línea Interurbana 421 · Coche 304' : undefined,
      extras,
    });
  }

  // Previous month tail: September 25-30 (relevant for Direxis 25 Sep - 24 Oct cutoff)
  const sepSchedule: Record<number, { code: string; extras?: { id: string; name: string; amount: number; notes?: string }[] }> = {
    25: { code: '6V.L01' },
    26: { code: '6V.L02', extras: [{ id: 'sep26-1', name: 'Lavado y repostaje autocar', amount: 25.00, notes: 'Plus servicio tarde de septiembre' }] },
    27: { code: 'D' },
    28: { code: '6V.L01' },
    29: { code: '6V.L03' },
    30: { code: '6V.L02' },
  };

  for (let d = 25; d <= 30; d++) {
    const item = sepSchedule[d];
    assignments.push({
      date: `2026-09-${d}`,
      shiftCode: item.code,
      isRest: item.code === 'D',
      isSunday: d === 27,
      extras: item.extras || [],
    });
  }

  return assignments;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<'turnos' | 'calendario' | 'nomina' | 'extras'>('calendario');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(10); // Octubre 2026

  // Persistent Shifts (Exclusively official Direxis parts + Fiesta/Descanso)
  const [shifts, setShifts] = useState<ShiftDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_shifts_v7');
      if (saved) {
        const parsed: ShiftDefinition[] = JSON.parse(saved);
        const cleaned = parsed.filter(
          (s) => !DELETED_MOCK_CODES.has(s.code) && s.category !== 'partido' && s.modality !== 'partido'
        );
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
      localStorage.setItem('rutanomina_shifts_v7', JSON.stringify(shifts));
    } catch (e) {
      console.error(e);
    }
  }, [shifts]);

  // Persistent Extras (Fuera de Convenio)
  const [extras, setExtras] = useState<ExtraConcept[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_extras_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_EXTRAS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_extras_v1', JSON.stringify(extras));
    } catch (e) {
      console.error(e);
    }
  }, [extras]);

  // Persistent Calendar Assignments (starting in 2026, mapping legacy mock codes)
  const [assignments, setAssignments] = useState<DayAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_assignments_v4') || localStorage.getItem('rutanomina_assignments_v3');
      if (saved) {
        const parsed: DayAssignment[] = JSON.parse(saved);
        const cleaned = parsed
          .filter((a) => {
            const yr = parseInt(a.date.split('-')[0], 10);
            return yr >= 2026;
          })
          .map((a) => ({
            ...a,
            shiftCode: mapLegacyShiftCode(a.shiftCode),
          }));
        if (cleaned.length > 0) return cleaned;
      }
    } catch (e) {
      console.error(e);
    }
    return getInitial2026Assignments();
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_assignments_v4', JSON.stringify(assignments));
    } catch (e) {
      console.error(e);
    }
  }, [assignments]);

  // Persistent Convenio (starting in 2026, ensuring all fields are populated)
  const [convenio, setConvenio] = useState<ConvenioInfo>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_convenio_v2') || localStorage.getItem('rutanomina_convenio_v1');
      if (saved) {
        const parsed: ConvenioInfo = JSON.parse(saved);
        const cleanedRates: Record<number, ConvenioYearRate> = {};
        for (const [k, v] of Object.entries(parsed.ratesByYear || {})) {
          const yNum = Number(k);
          if (yNum >= 2026 && v) {
            cleanedRates[yNum] = {
              ...DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026],
              ...(v as ConvenioYearRate),
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
      localStorage.setItem('rutanomina_convenio_v2', JSON.stringify(convenio));
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
      salaryBaseRateMode: 'masats_39_89',
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

  // Map of shifts for fast lookup
  const shiftsMap = useMemo(() => {
    const map = new Map<string, ShiftDefinition>();
    shifts.forEach((s) => map.set(s.code, s));
    return map;
  }, [shifts]);

  // Current year rates
  const currentYearRate = useMemo(() => {
    return (
      convenio.ratesByYear[selectedYear] ||
      convenio.ratesByYear[2026]
    );
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
      const idx = prev.findIndex((s) => s.id === newOrUpdated.id || s.code === newOrUpdated.code);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newOrUpdated;
        return copy;
      }
      return [newOrUpdated, ...prev];
    });
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
      />

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
          />
        )}

        {currentTab === 'extras' && (
          <ExtrasView
            extras={extras}
            onToggleExtra={handleToggleExtra}
            onSaveExtra={handleSaveExtra}
            onDeleteExtra={handleDeleteExtra}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation matching screenshot */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab as any)}
        extrasCount={extras.filter((e) => e.active).length}
      />

      {/* Modals */}
      <TurnoEditModal
        isOpen={isTurnoModalOpen}
        onClose={() => setIsTurnoModalOpen(false)}
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
      />
    </div>
  );
}
