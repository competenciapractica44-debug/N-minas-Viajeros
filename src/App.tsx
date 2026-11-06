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
  WorkerProfile,
} from './types';
import { ALL_INITIAL_SHIFTS } from './data/defaultTurnos';
import { DEFAULT_EXTRAS } from './data/defaultExtras';
import { DEFAULT_CONVENIO_ZARAGOZA } from './data/convenioZaragoza';
import { calculateMonthlyPayroll, calculateYearlySalaryEvolution } from './utils/calculator';
import { exportToPDF, exportToExcel } from './utils/exporter';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Initial October 2024 assignments matching screenshot 3 exactly
function getInitialOctoberAssignments(): DayAssignment[] {
  const assignments: DayAssignment[] = [];
  const shiftSchedule: Record<number, string> = {
    1: 'M1',
    2: 'M1',
    3: 'T1',
    4: 'T2',
    5: 'D',
    6: 'D',
    7: 'M2',
    8: 'T1',
    9: 'T2',
    10: 'R',
    11: 'N1',
    12: 'D',
    13: 'D',
    14: 'M1',
    15: 'M1',
    16: 'T1',
    17: 'T1',
    18: 'M2',
    19: 'D',
    20: 'D',
    21: 'M1',
    22: 'M2',
    23: 'T1',
    24: 'T2', // Has extras in screenshot 3
    25: 'T1',
    26: 'D',
    27: 'D',
    28: 'M1',
    29: 'M2',
    30: 'N1',
    31: 'R',
  };

  for (let d = 1; d <= 31; d++) {
    const dStr = `2024-10-${String(d).padStart(2, '0')}`;
    const code = shiftSchedule[d];
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
      isSunday: [6, 13, 20, 27].includes(d),
      customLine: d === 24 ? 'Línea Interurbana 421 · Coche 304' : undefined,
      extras,
    });
  }

  // Previous month tail: September 25-30 (relevant for Direxis 25 Sep - 24 Oct cutoff)
  const sepSchedule: Record<number, { code: string; extras?: { id: string; name: string; amount: number; notes?: string }[] }> = {
    25: { code: 'M1' },
    26: { code: 'T1', extras: [{ id: 'sep26-1', name: 'Lavado y repostaje autocar', amount: 25.00, notes: 'Plus servicio tarde de septiembre' }] },
    27: { code: 'M1' },
    28: { code: 'D' },
    29: { code: 'D' },
    30: { code: 'M2' },
  };

  for (let d = 25; d <= 30; d++) {
    const item = sepSchedule[d];
    assignments.push({
      date: `2024-09-${d}`,
      shiftCode: item.code,
      isRest: item.code === 'D',
      isSunday: d === 29,
      extras: item.extras || [],
    });
  }

  return assignments;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<'turnos' | 'calendario' | 'nomina' | 'extras'>('calendario');
  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedMonth, setSelectedMonth] = useState(10); // Octubre

  // Persistent Shifts (Internal Database)
  const [shifts, setShifts] = useState<ShiftDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_shifts_v6');
      if (saved) {
        const parsed: ShiftDefinition[] = JSON.parse(saved);
        const filtered = parsed.filter((s) => s.category !== 'partido' && s.code !== 'SP1' && s.modality !== 'partido');
        if (!filtered.some((s) => s.code === 'V')) {
          const vDef = ALL_INITIAL_SHIFTS.find((s) => s.code === 'V');
          if (vDef) filtered.push(vDef);
        }
        return filtered;
      }
      // Migrate from older version if present to incorporate new Saturday and Sunday/Holiday shifts, and clean out partido/SP1
      const oldSaved =
        localStorage.getItem('rutanomina_shifts_v5') ||
        localStorage.getItem('rutanomina_shifts_v4') ||
        localStorage.getItem('rutanomina_shifts_v3');
      if (oldSaved) {
        const parsed: ShiftDefinition[] = JSON.parse(oldSaved).filter(
          (s: ShiftDefinition) => s.category !== 'partido' && s.code !== 'SP1' && s.modality !== 'partido'
        );
        const existingCodes = new Set(parsed.map((s) => s.code));
        const missing = ALL_INITIAL_SHIFTS.filter(
          (s) => !existingCodes.has(s.code) && s.category !== 'partido' && s.code !== 'SP1' && s.modality !== 'partido'
        );
        const merged = [...parsed, ...missing];
        return merged;
      }
    } catch (e) {
      console.error(e);
    }
    return ALL_INITIAL_SHIFTS.filter((s) => s.category !== 'partido' && s.code !== 'SP1');
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_shifts_v6', JSON.stringify(shifts));
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

  // Persistent Calendar Assignments
  const [assignments, setAssignments] = useState<DayAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_assignments_v2');
      if (saved) return JSON.parse(saved);
      const oldSaved = localStorage.getItem('rutanomina_assignments_v1');
      if (oldSaved) {
        const parsed: DayAssignment[] = JSON.parse(oldSaved);
        const dates = new Set(parsed.map((a) => a.date));
        const initial = getInitialOctoberAssignments();
        const missing = initial.filter((a) => !dates.has(a.date));
        return [...parsed, ...missing];
      }
    } catch (e) {
      console.error(e);
    }
    return getInitialOctoberAssignments();
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_assignments_v2', JSON.stringify(assignments));
    } catch (e) {
      console.error(e);
    }
  }, [assignments]);

  // Persistent Convenio
  const [convenio, setConvenio] = useState<ConvenioInfo>(() => {
    try {
      const saved = localStorage.getItem('rutanomina_convenio_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CONVENIO_ZARAGOZA;
  });

  useEffect(() => {
    try {
      localStorage.setItem('rutanomina_convenio_v1', JSON.stringify(convenio));
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
      name: 'Manuel Gómez Ruiz',
      nif: '17745892-K',
      category: 'Conductor-Perceptor Grupo II',
      companyName: 'DIREXIS ZARAGOZA S.A.',
      cif: 'A-50123456',
      irpfPercentage: 14.5,
      contractType: 'indefinido',
      partTimePercentage: 50,
      prorrateoPagasExtra: 'tres_pagas',
      prorratearPagasExtra: true,
      extrasCutoffMode: 'direxis_25_24',
      customCutoffStartDay: 25,
      hasMonetaryQuebranto: true,
      hasConductorPerceptorPlus: true,
      hasVacationPlus100Percent: true,
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
      convenio.ratesByYear[2026] ||
      convenio.ratesByYear[2024]
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
