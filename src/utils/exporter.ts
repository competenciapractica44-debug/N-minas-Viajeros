import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  PayrollBreakdown,
  WorkerProfile,
  DayAssignment,
  ShiftDefinition,
  ConvenioInfo,
} from '../types';

/**
 * Format currency with euro symbol
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generates and downloads an official-grade PDF payslip report
 */
export function exportToPDF(
  payroll: PayrollBreakdown,
  profile: WorkerProfile,
  assignments: DayAssignment[],
  shiftsMap: Map<string, ShiftDefinition>,
  convenio: ConvenioInfo,
  monthName: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Primary brand header
  doc.setFillColor(30, 58, 138); // Navy blue
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO INDIVIDUAL DE SALARIOS · TRANSPORTE DE VIAJEROS', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período de Liquidación: ${monthName} ${payroll.year} · Convenio Colectivo Zaragoza`, 14, 18);

  // Top info boxes (Company and Worker)
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);

  // Box 1: Empresa
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 26, 88, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DE LA EMPRESA', 18, 32);
  doc.setFont('helvetica', 'normal');
  doc.text(`Razón Social: ${profile.companyName || 'DIREXIS ZARAGOZA S.A.'}`, 18, 38);
  doc.text(`CIF: ${profile.cif || 'A-50123456'}`, 18, 43);
  doc.text(`Convenio: BOPZ 182 / Código 50001135011982`, 18, 48);

  // Box 2: Trabajador
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(108, 26, 88, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL TRABAJADOR', 112, 32);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${profile.name || 'Conductor Profesional'}`, 112, 38);
  doc.text(`NIF/NIE: ${profile.nif || '12345678-Z'}`, 112, 43);
  doc.text(`Categoría: ${profile.category || 'Conductor-Perceptor Grupo II'}`, 112, 48);

  // Key KPI summary strip
  const startY = 56;
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14, startY, 182, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(8.5);
  doc.text(
    `DÍAS TRABAJADOS: ${payroll.workedDays}   |   DESCANSOS: ${payroll.restDays}   |   HORAS TOTALES: ${payroll.totalWorkedHours}h   |   HORAS NOCTURNAS: ${payroll.nightHours}h`,
    18,
    startY + 7.5
  );

  const devengosRows = [
    [
      'Salario Base Jornadas (Convenio)',
      payroll.vacationDays > 0 ? `${payroll.workedDays} trab + ${payroll.vacationDays} vac` : `${payroll.workedDays} días`,
      formatCurrency(payroll.salarioBase),
    ],
  ];

  if (payroll.plusVacaciones > 0) {
    devengosRows.push(['Plus de Vacaciones (Art. 9 Convenio)', `${payroll.vacationDays} días`, formatCurrency(payroll.plusVacaciones)]);
  }
  if (payroll.plusConductorPerceptor > 0) {
    devengosRows.push(['Plus Conductor-Perceptor (Art. 19)', `${payroll.workedDays} días`, formatCurrency(payroll.plusConductorPerceptor)]);
  }
  if (payroll.plusQuebrantoMoneda > 0) {
    devengosRows.push(['Quebranto de Moneda (Art. 20)', `${payroll.workedDays} días`, formatCurrency(payroll.plusQuebrantoMoneda)]);
  }
  if (payroll.plusNocturnidad > 0) {
    devengosRows.push(['Plus de Nocturnidad (Art. 18, 22:00 a 06:00)', `${payroll.nightHours} horas`, formatCurrency(payroll.plusNocturnidad)]);
  }
  if (payroll.plusFestivos > 0) {
    devengosRows.push(['Plus Festivos y Domingos (Art. 17)', `${payroll.holidayDays} festivos/dom`, formatCurrency(payroll.plusFestivos)]);
  }
  if (payroll.prorrataPagasExtra > 0) {
    const extraLabel = profile.prorrateoPagasExtra === 'una_paga'
      ? 'Prorrata Paga Extraordinaria Marzo (Art. 11)'
      : 'Prorrata Pagas Extraordinarias (Art. 11, 3 pagas)';
    devengosRows.push([extraLabel, profile.prorrateoPagasExtra === 'una_paga' ? '1/12 (2,5 d/mes)' : '1/12 (7,5 d/mes)', formatCurrency(payroll.prorrataPagasExtra)]);
  }
  if (payroll.pagaExtraIntegraMes > 0) {
    devengosRows.push([payroll.pagaExtraIntegraNombre || 'Paga Extraordinaria Íntegra', '30 días salario base', formatCurrency(payroll.pagaExtraIntegraMes)]);
  }
  if (payroll.totalExtrasFueraConvenio > 0) {
    const cutoffText = payroll.extrasCutoffPeriod ? `Corte ${payroll.extrasCutoffPeriod}` : 'Asignados en cuadrante';
    devengosRows.push(['Complementos y Extras Fuera de Convenio', cutoffText, formatCurrency(payroll.totalExtrasFueraConvenio)]);
  }
  if (payroll.importeHorasExtra > 0) {
    devengosRows.push(['Horas Extraordinarias / Exceso Horario', `${payroll.horasExtra} horas`, formatCurrency(payroll.importeHorasExtra)]);
  }

  autoTable(doc, {
    startY: startY + 16,
    head: [['I. DEVENGOS (CONCEPTOS RETRIBUTIVOS)', 'UNIDADES', 'IMPORTE']],
    body: devengosRows,
    foot: [['TOTAL DEVENGADO (TOTAL BRUTO)', '', formatCurrency(payroll.totalDevengado)]],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 36, halign: 'center' },
      2: { cellWidth: 36, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Table 2: Deducciones (SS + IRPF)
  const currentY = (doc as any).lastAutoTable.finalY + 6;

  const deduccionesRows = [
    ['Contingencias Comunes (Seguridad Social)', '4,70%', formatCurrency(payroll.contingenciasComunes)],
    ['Desempleo (Régimen General)', `${profile.contractType === 'temporal' ? '1,60%' : '1,55%'}`, formatCurrency(payroll.desempleo)],
    ['Formación Profesional', '0,10%', formatCurrency(payroll.formacionProfesional)],
    ['Mecanismo de Equidad Intergeneracional (MEI)', `${(payroll.mei / (payroll.baseCotizacionSS || 1) * 100).toFixed(2)}%`, formatCurrency(payroll.mei)],
    ['Retención I.R.P.F. (Impuesto sobre la Renta)', `${payroll.retencionIrpf.toFixed(2)}%`, formatCurrency(payroll.retencionIrpfImporte)],
  ];

  if (payroll.cuotaSindical > 0) {
    deduccionesRows.push(['Cuota Sindical (Art. 36)', 'Deducción nómina', formatCurrency(payroll.cuotaSindical)]);
  }
  if (payroll.anticipos > 0) {
    deduccionesRows.push(['Anticipos a cuenta', 'Compensación', formatCurrency(payroll.anticipos)]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['II. DEDUCCIONES LEGALES Y RETENCIONES', 'TIPO / %', 'IMPORTE']],
    body: deduccionesRows,
    foot: [['TOTAL A DEDUCIR', '', formatCurrency(payroll.totalDeducido)]],
    theme: 'striped',
    headStyles: { fillColor: [225, 29, 72], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 36, halign: 'center' },
      2: { cellWidth: 36, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Big Liquido banner
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFillColor(16, 185, 129); // Emerald green
  doc.roundedRect(14, finalY, 182, 18, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('LÍQUIDO TOTAL A PERCIBIR (NETO EN CUENTA)', 20, finalY + 8);
  doc.setFontSize(15);
  doc.text(formatCurrency(payroll.liquidoPercibir), pageWidth - 20, finalY + 12, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Base de Cotización S.S.: ${formatCurrency(payroll.baseCotizacionSS)}  |  Total Coste Empresa Estimado: ${formatCurrency(payroll.totalCosteEmpresa)}`, 20, finalY + 14);

  // Signature lines
  const sigY = finalY + 28;
  if (sigY < 275) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text('Firma y Sello de la Empresa', 35, sigY);
    doc.line(25, sigY + 12, 85, sigY + 12);

    doc.text('Firma del Trabajador (Recibí)', 135, sigY);
    doc.line(125, sigY + 12, 185, sigY + 12);
  }

  // Page 2: Detailed list of days & shifts
  const assignedDays = assignments.filter((a) => a.shiftCode && a.shiftCode !== 'D');
  if (assignedDays.length > 0) {
    doc.addPage();
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`ANEXO: DETALLE DE PARTES Y SERVICIOS REALIZADOS · ${monthName.toUpperCase()} ${payroll.year}`, 14, 11);

    const cuadranteRows = assignments
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => {
        const shift = shiftsMap.get(item.shiftCode || '') || Array.from(shiftsMap.values()).find((s) => s.code === item.shiftCode);
        const dayNum = item.date.split('-')[2];
        const extrasStr = item.extras && item.extras.length > 0
          ? item.extras.map((e) => `${e.name} (+${e.amount}€)`).join('; ')
          : '-';

        return [
          `Día ${dayNum}`,
          item.shiftCode || 'Descanso',
          shift?.terminal || shift?.title || (item.shiftCode === 'D' ? 'Descanso Semanal' : '-'),
          shift ? `${shift.startTime} - ${shift.endTime}` : '-',
          shift?.computedDuration || '-',
          extrasStr,
          shift?.fixedRate ? formatCurrency(shift.fixedRate) : formatCurrency(convenio.ratesByYear[payroll.year]?.salarioBaseDia || 50.37),
        ];
      });

    autoTable(doc, {
      startY: 22,
      head: [['DÍA', 'PARTE', 'LÍNEA / TERMINAL', 'HORARIO', 'DURACIÓN CÓMPUTO', 'EXTRAS Y PECULIARIDADES', 'TARIFA']],
      body: cuadranteRows,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 42 },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 28 },
        5: { cellWidth: 36 },
        6: { cellWidth: 16, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`Nomina_${profile.name.replace(/\s+/g, '_') || 'Conductor'}_${monthName}_${payroll.year}.pdf`);
}

/**
 * Generates and downloads an Excel workbook with sheets:
 * 1. Resumen Nómina
 * 2. Cuadrante Detallado
 * 3. Extras Fuera de Convenio
 * 4. Tablas Convenio
 */
export function exportToExcel(
  payroll: PayrollBreakdown,
  profile: WorkerProfile,
  assignments: DayAssignment[],
  shiftsMap: Map<string, ShiftDefinition>,
  convenio: ConvenioInfo,
  monthName: string
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen Nómina
  const resumenData = [
    ['RECIBO INDIVIDUAL DE SALARIOS - TRANSPORTE DE VIAJEROS'],
    ['Empresa:', profile.companyName || 'DIREXIS ZARAGOZA S.A.', 'CIF:', profile.cif || 'A-50123456'],
    ['Trabajador:', profile.name || 'Conductor Profesional', 'NIF:', profile.nif || '12345678-Z'],
    ['Categoría:', profile.category || 'Conductor-Perceptor', 'Convenio:', 'BOPZ 182 Zaragoza'],
    ['Tipo Contrato:', profile.contractType === 'tiempo_parcial' ? `A tiempo parcial (${profile.partTimePercentage || 50}%)` : profile.contractType === 'temporal' ? 'Temporal (100%)' : 'Indefinido (100%)', 'Pagas Extras:', profile.prorrateoPagasExtra === 'una_paga' ? '1 paga prorrateada + Julio y Diciembre íntegras' : profile.prorrateoPagasExtra === 'ninguna' ? 'Sin prorrateo (Cobro íntegro)' : '3 pagas prorrateadas mensualmente'],
    ['Mes/Año:', `${monthName} ${payroll.year}`, 'Fecha Emisión:', new Date().toLocaleDateString('es-ES')],
    [],
    ['I. DATOS DE JORNADA', 'VALOR', 'UNIDAD'],
    ['Días Trabajados en el Mes', payroll.workedDays, 'días'],
    ['Días de Descanso', payroll.restDays, 'días'],
    ['Días de Vacaciones Retribuidas', payroll.vacationDays, 'días'],
    ['Días Festivos / Domingos', payroll.holidayDays, 'días'],
    ['Horas Totales Trabajadas', payroll.totalWorkedHours, 'horas'],
    ['Horas Nocturnas (22:00 a 06:00)', payroll.nightHours, 'horas'],
    [],
    ['II. DEVENGOS (BRUTO)', 'CANTIDAD / BASE', 'IMPORTE (€)'],
    ['Salario Base Convenio', `${payroll.workedDays} días`, payroll.salarioBase],
    ...(payroll.plusVacaciones > 0 ? [['Plus de Vacaciones (Art. 9 Convenio)', `${payroll.vacationDays} días`, payroll.plusVacaciones]] : []),
    ['Plus Conductor-Perceptor (Art. 19)', `${payroll.workedDays} días`, payroll.plusConductorPerceptor],
    ['Quebranto de Moneda (Art. 20)', `${payroll.workedDays} días`, payroll.plusQuebrantoMoneda],
    ['Plus Nocturnidad (Art. 18)', `${payroll.nightHours} horas`, payroll.plusNocturnidad],
    ['Plus Festivos y Domingos (Art. 17)', `${payroll.holidayDays} días`, payroll.plusFestivos],
    ['Prorrata Pagas Extras (Art. 11)', profile.prorrateoPagasExtra === 'una_paga' ? '1 paga (Marzo)' : '3 pagas', payroll.prorrataPagasExtra],
    ...(payroll.pagaExtraIntegraMes > 0 ? [[payroll.pagaExtraIntegraNombre || 'Paga Extraordinaria Íntegra', '30 días salario base', payroll.pagaExtraIntegraMes]] : []),
    ['Complementos y Extras Fuera de Convenio', payroll.extrasCutoffPeriod ? `Corte ${payroll.extrasCutoffPeriod}` : 'Cuadrante', payroll.totalExtrasFueraConvenio],
    ...(payroll.importeHorasExtra > 0 ? [['Horas Extraordinarias / Exceso Horario', `${payroll.horasExtra} horas`, payroll.importeHorasExtra]] : []),
    ['TOTAL DEVENGADO (BRUTO TOTAL)', '', payroll.totalDevengado],
    [],
    ['III. DEDUCCIONES TRABAJADOR', 'TIPO / PORCENTAJE', 'IMPORTE (€)'],
    ['Contingencias Comunes (4.70%)', '4.70%', payroll.contingenciasComunes],
    ['Desempleo', profile.contractType === 'temporal' ? '1.60%' : '1.55%', payroll.desempleo],
    ['Formación Profesional (0.10%)', '0.10%', payroll.formacionProfesional],
    ['Mecanismo de Equidad Intergeneracional (MEI)', 'MEI oficial', payroll.mei],
    ['TOTAL SEGURIDAD SOCIAL TRABAJADOR', '', payroll.totalSeguridadSocial],
    ['Retención IRPF', `${payroll.retencionIrpf}%`, payroll.retencionIrpfImporte],
    ['Cuota Sindical', 'Convenio', payroll.cuotaSindical],
    ['Anticipos', '', payroll.anticipos],
    ['TOTAL A DEDUCIR', '', payroll.totalDeducido],
    [],
    ['IV. TOTALES FINALES', '', 'IMPORTE (€)'],
    ['LÍQUIDO TOTAL A PERCIBIR (NETO)', '', payroll.liquidoPercibir],
    ['Base de Cotización Seguridad Social', '', payroll.baseCotizacionSS],
    ['Coste Total Empresa Estimado', '', payroll.totalCosteEmpresa],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Nómina');

  // Sheet 2: Cuadrante y Partes
  const cuadranteHeader = [
    ['Fecha', 'Día', 'Código Parte', 'Servicio / Terminal', 'Horario Inicio', 'Horario Fin', 'Duración Total', 'Extras Asignados', 'Tarifa Devengada (€)'],
  ];

  const cuadranteRows = assignments
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => {
      const shift = shiftsMap.get(item.shiftCode || '') || Array.from(shiftsMap.values()).find((s) => s.code === item.shiftCode);
      const extrasStr = item.extras?.map((e) => `${e.name} (+${e.amount}€)`).join('; ') || '-';
      const dayNum = item.date.split('-')[2];

      return [
        item.date,
        `Día ${dayNum}`,
        item.shiftCode === 'V' ? 'V (Vacaciones)' : item.shiftCode || 'Descanso',
        shift?.terminal || shift?.title || (item.shiftCode === 'D' ? 'Descanso' : item.shiftCode === 'V' ? 'Vacaciones Retribuidas (Convenio Zaragoza)' : '-'),
        shift?.startTime || '-',
        shift?.endTime || '-',
        shift?.computedDuration || (item.shiftCode === 'V' ? 'Jornada vacaciones retribuida' : '-'),
        extrasStr,
        shift?.fixedRate || (item.shiftCode === 'D' ? 0 : item.shiftCode === 'V' ? (convenio.ratesByYear[payroll.year]?.salarioBaseDia || 50.37) + (convenio.ratesByYear[payroll.year]?.plusVacacionesDia || 10.00) : convenio.ratesByYear[payroll.year]?.salarioBaseDia || 50.37),
      ];
    });

  const wsCuadrante = XLSX.utils.aoa_to_sheet([...cuadranteHeader, ...cuadranteRows]);
  XLSX.utils.book_append_sheet(wb, wsCuadrante, 'Partes y Turnos');

  // Sheet 3: Tablas del Convenio
  const convenioData = [
    ['CONVENIO COLECTIVO DEL TRANSPORTE DE VIAJEROS DE ZARAGOZA'],
    ['Normativa:', convenio.title],
    ['BOPZ:', convenio.bopzNumber],
    ['Vigencia Oficial:', `${convenio.validFrom} al ${convenio.validTo}`],
    ['Ultraactividad:', `Hasta ${convenio.ultractividadTo}`],
    [],
    ['AÑO', 'SALARIO BASE/DÍA (€)', 'SALARIO ANUAL (€)', 'HORA ORDINARIA (€)', 'PLUS NOCTURNO/H (€)', 'PLUS PERCEPTOR/DÍA (€)', 'QUEBRANTO MONEDA/DÍA (€)', 'PLUS FESTIVO >4H (€)'],
    ...Object.values(convenio.ratesByYear).map((r) => [
      r.year,
      r.salarioBaseDia,
      r.salarioBaseAnual,
      r.horaOrdinaria,
      r.plusNocturnidadHora,
      r.plusConductorPerceptorDia,
      r.quebrantoMonedaDia,
      r.plusFestivoMayor4h,
    ]),
  ];

  const wsConvenio = XLSX.utils.aoa_to_sheet(convenioData);
  XLSX.utils.book_append_sheet(wb, wsConvenio, 'Tablas Convenio');

  XLSX.writeFile(wb, `Nomina_Transporte_${monthName}_${payroll.year}.xlsx`);
}
