import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';
import {
  PayrollBreakdown,
  WorkerProfile,
  DayAssignment,
  ShiftDefinition,
  ConvenioInfo,
} from '../types';
import { getEffectiveYearRate } from '../data/convenioZaragoza';
import {
  computeShiftRateFromConvenio,
  ANNUAL_VACATION_DAYS_CONVENIO,
  getDaysInYear,
} from './calculator';

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

function formatHoursLabel(hours: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: hours % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(hours);
}

/**
 * Builds the official-grade PDF payslip report document
 */
export function buildPDFDoc(
  payroll: PayrollBreakdown,
  profile: WorkerProfile,
  assignments: DayAssignment[],
  shiftsMap: Map<string, ShiftDefinition>,
  convenio: ConvenioInfo,
  monthName: string
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const activeRate = getEffectiveYearRate(convenio, payroll.year);
  const baseDayRate = profile.salaryBaseRateMode === 'masats_39_89'
    ? parseFloat((activeRate.salarioBaseDiaMasats ?? 39.89).toFixed(2))
    : parseFloat((activeRate.salarioBaseDia * payroll.partTimeFactor).toFixed(2));
  const jornadaPct = Math.round(payroll.partTimeFactor * 100);

  // Primary brand header
  doc.setFillColor(30, 58, 138); // Navy blue
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO INDIVIDUAL DE SALARIOS · TRANSPORTE DE VIAJEROS', 14, 12);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Período: ${monthName} ${payroll.year} · Corte variables: ${payroll.extrasCutoffPeriod} · Convenio Colectivo Zaragoza`,
    14,
    18
  );

  // Top info boxes (Company and Worker)
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);

  // Box 1: Empresa
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 26, 88, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DE LA EMPRESA', 18, 32);
  doc.setFont('helvetica', 'normal');
  doc.text(`Razón Social: ${profile.companyName?.trim() || 'Sin especificar'}`, 18, 38);
  doc.text(`CIF: ${profile.cif?.trim() || 'Sin especificar'}`, 18, 43);
  doc.text(`Convenio: BOPZ 182 / Código 50001135011982`, 18, 48);

  // Box 2: Trabajador
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(108, 26, 88, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL TRABAJADOR', 112, 32);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${profile.name?.trim() || 'Sin especificar'}`, 112, 38);
  doc.text(`NIF/NIE: ${profile.nif?.trim() || 'Sin especificar'}`, 112, 43);
  doc.text(`Jornada (${jornadaPct}%): ${formatHoursLabel(payroll.convenioAnnualHoursTarget)} h/año (${formatHoursLabel(payroll.convenioMonthlyHoursTarget)} h/mes)`, 112, 48);

  // Key KPI summary strip
  const startY = 56;
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14, startY, 182, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(8);
  doc.text(
    `TRABAJADOS: ${payroll.workedDays}d  |  VAC. (ART. 9): ${payroll.vacationPlusDays}d  |  CONV.: ${formatHoursLabel(payroll.ordinaryConvenioHours)}h${payroll.horasFestivas > 0 ? ` + ${formatHoursLabel(payroll.horasFestivas)}h FEST.` : ''}${payroll.horasFT > 0 ? ` + ${formatHoursLabel(payroll.horasFT)}h F/T` : ''}  |  NOCT: ${payroll.nightHours}h`,
    18,
    startY + 7.5
  );

  const devengosRows = payroll.lines.map((line) => [
    `${line.quantityLabel} ${line.unit}`,
    formatCurrency(line.unitPrice),
    line.name,
    formatCurrency(line.amount),
  ]);

  autoTable(doc, {
    startY: startY + 16,
    head: [['CUANTÍA (Nº VECES)', 'PRECIO BRUTO', 'CONCEPTO RETRIBUTIVO (ANTES IMP.)', 'DEVENGOS BRUTO (€)']],
    body: devengosRows,
    foot: [['TOTAL DEVENGADO BRUTO (ANTES DE IMPUESTOS)', '', '', formatCurrency(payroll.totalDevengado)]],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 34, halign: 'center' },
      1: { cellWidth: 26, halign: 'right' },
      2: { cellWidth: 88 },
      3: { cellWidth: 34, halign: 'right' },
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

  // Page 2: Detailed list of days & shifts within the active payroll window (cutoff start .. end of calculated month)
  const monthStartStr = `${payroll.year}-${String(payroll.month).padStart(2, '0')}-01`;
  const monthEndStr = `${payroll.year}-${String(payroll.month).padStart(2, '0')}-${String(payroll.totalDays).padStart(2, '0')}`;
  const pdfWindowStart = payroll.extrasCutoffStartDate < monthStartStr ? payroll.extrasCutoffStartDate : monthStartStr;
  const pdfWindowEnd = payroll.extrasCutoffEndDate > monthEndStr ? payroll.extrasCutoffEndDate : monthEndStr;
  const assignedDays = assignments.filter(
    (a) => a.date >= pdfWindowStart && a.date <= pdfWindowEnd && a.shiftCode && a.shiftCode !== 'D'
  );
  if (assignedDays.length > 0) {
    doc.addPage();
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`ANEXO: DETALLE DE PARTES Y SERVICIOS · ${monthName.toUpperCase()} ${payroll.year} (CORTE ${payroll.extrasCutoffPeriod.toUpperCase()})`, 14, 11);

    const cuadranteRows = assignments
      .filter((a) => a.date >= pdfWindowStart && a.date <= pdfWindowEnd)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => {
        const shift = shiftsMap.get(item.shiftCode || '') || Array.from(shiftsMap.values()).find((s) => s.code === item.shiftCode);
        const [, mm, dd] = item.date.split('-');
        const dateBadge = item.date < monthStartStr
          ? `${dd}/${mm} (Ant.)`
          : item.date > payroll.extrasCutoffEndDate
          ? `${dd}/${mm} (Sig.)`
          : `${dd}/${mm}`;
        const extrasStr = item.extras && item.extras.length > 0
          ? item.extras.map((e) => `${e.name} (+${e.amount}€)`).join('; ')
          : '-';

        return [
          dateBadge,
          item.shiftCode || 'Descanso',
          shift?.terminal || shift?.title || (item.shiftCode === 'D' ? 'Descanso Semanal' : '-'),
          shift ? `${shift.startTime} - ${shift.endTime}` : '-',
          shift?.computedDuration || '-',
          extrasStr,
          shift
            ? formatCurrency(computeShiftRateFromConvenio(shift, activeRate).totalRate)
            : formatCurrency(item.shiftCode === 'D' ? 0 : baseDayRate),
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

  return doc;
}

/**
  * Generates and downloads the PDF payslip to local disk
  */
export function exportToPDF(
  payroll: PayrollBreakdown,
  profile: WorkerProfile,
  assignments: DayAssignment[],
  shiftsMap: Map<string, ShiftDefinition>,
  convenio: ConvenioInfo,
  monthName: string
) {
  const doc = buildPDFDoc(payroll, profile, assignments, shiftsMap, convenio, monthName);
  doc.save(`Nomina_${profile.name.replace(/\s+/g, '_') || 'Conductor'}_${monthName}_${payroll.year}.pdf`);
}

/**
  * Generates the PDF as a Blob for uploading to Google Drive
  */
export function exportToPDFBlob(
  payroll: PayrollBreakdown,
  profile: WorkerProfile,
  assignments: DayAssignment[],
  shiftsMap: Map<string, ShiftDefinition>,
  convenio: ConvenioInfo,
  monthName: string
): Blob {
  const doc = buildPDFDoc(payroll, profile, assignments, shiftsMap, convenio, monthName);
  return doc.output('blob');
}

// ---------------------------------------------------------------------------
// Excel Styling Helpers (xlsx-js-style)
// ---------------------------------------------------------------------------
type CellStyle = XLSX.CellStyle;

const FONT_FAMILY = 'Calibri';

const BORDER_THIN = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
} as const;

const BORDER_TOTAL = {
  top: { style: 'medium' as const, color: { rgb: '64748B' } },
  bottom: { style: 'medium' as const, color: { rgb: '334155' } },
  left: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
  right: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
};

const STYLE_TITLE_BANNER: CellStyle = {
  font: { name: FONT_FAMILY, sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
};

const STYLE_SUBTITLE_BANNER: CellStyle = {
  font: { name: FONT_FAMILY, sz: 10, italic: true, color: { rgb: '1E3A8A' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: { bottom: { style: 'medium', color: { rgb: 'BFDBFE' } } },
};

const STYLE_META_LABEL: CellStyle = {
  font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: '334155' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: BORDER_THIN,
};

const STYLE_META_VALUE: CellStyle = {
  font: { name: FONT_FAMILY, sz: 10, bold: false, color: { rgb: '0F172A' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: BORDER_THIN,
};

function makeSectionHeaderStyle(bgHex: string): CellStyle {
  return {
    font: { name: FONT_FAMILY, sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: bgHex } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: bgHex } },
      bottom: { style: 'thin', color: { rgb: bgHex } },
      left: { style: 'thin', color: { rgb: bgHex } },
      right: { style: 'thin', color: { rgb: bgHex } },
    },
  };
}

function makeTableColHeaderStyle(bgHex: string, align: 'left' | 'center' | 'right' = 'left'): CellStyle {
  return {
    font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: bgHex } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'medium', color: { rgb: '64748B' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };
}

function makeDataCellStyle(
  zebra: boolean,
  opts?: {
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    colorHex?: string;
    bgHex?: string;
    numFmt?: string;
  }
): CellStyle {
  return {
    font: {
      name: FONT_FAMILY,
      sz: 10,
      bold: opts?.bold ?? false,
      color: { rgb: opts?.colorHex ?? '1E293B' },
    },
    fill: {
      patternType: 'solid',
      fgColor: { rgb: opts?.bgHex ?? (zebra ? 'F8FAFC' : 'FFFFFF') },
    },
    alignment: {
      horizontal: opts?.align ?? 'left',
      vertical: 'center',
      wrapText: true,
    },
    border: BORDER_THIN,
    ...(opts?.numFmt ? { numFmt: opts.numFmt } : {}),
  };
}

function makeTotalRowStyle(
  bgHex: string,
  textHex: string,
  align: 'left' | 'center' | 'right' = 'left',
  numFmt?: string,
  fontSize = 11
): CellStyle {
  return {
    font: { name: FONT_FAMILY, sz: fontSize, bold: true, color: { rgb: textHex } },
    fill: { patternType: 'solid', fgColor: { rgb: bgHex } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: BORDER_TOTAL,
    ...(numFmt ? { numFmt } : {}),
  };
}

function styleRange(
  ws: XLSX.WorkSheet,
  rStart: number,
  cStart: number,
  rEnd: number,
  cEnd: number,
  styleFactory: (r: number, c: number) => CellStyle
) {
  for (let r = rStart; r <= rEnd; r++) {
    for (let c = cStart; c <= cEnd; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) {
        ws[addr] = { t: 's', v: '' };
      }
      ws[addr].s = styleFactory(r, c);
    }
  }
}

function autoFitColumns(
  rows: Array<Array<string | number | undefined>>,
  minWidths: number[],
  maxWidths?: number[]
): XLSX.ColInfo[] {
  const colCount = Math.max(minWidths.length, ...rows.map((r) => r.length));
  const widths: number[] = Array.from({ length: colCount }, (_, idx) => minWidths[idx] ?? 14);

  rows.forEach((row) => {
    row.forEach((cellVal, idx) => {
      if (cellVal === undefined || cellVal === null) return;
      const str = String(cellVal);
      // Ignorar títulos largos fusionados que ocupan varias columnas en la fila 0/1
      if (row.filter((v) => v !== undefined && v !== '').length === 1 && str.length > 48) {
        return;
      }
      const len = str.length + 5;
      if (len > widths[idx]) {
        widths[idx] = len;
      }
    });
  });

  return widths.map((w, idx) => ({
    wch: Math.min(maxWidths?.[idx] ?? 62, Math.max(minWidths[idx] ?? 14, w)),
  }));
}

/**
 * Generates and downloads a styled, cleanly formatted Excel workbook with sheets:
 * 1. Resumen Nómina
 * 2. Partes y Turnos
 * 3. Extras del Período
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
  const activeRate = getEffectiveYearRate(convenio, payroll.year);
  const baseDayRate = profile.salaryBaseRateMode === 'masats_39_89'
    ? parseFloat((activeRate.salarioBaseDiaMasats ?? 39.89).toFixed(2))
    : parseFloat((activeRate.salarioBaseDia * payroll.partTimeFactor).toFixed(2));
  const jornadaPct = Math.round(payroll.partTimeFactor * 100);
  const periodHoursDiff = parseFloat((payroll.ordinaryConvenioHours - payroll.convenioMonthlyHoursTarget).toFixed(2));
  const CURRENCY_FMT = '#,##0.00 "€"';
  const HOURS_FMT = '#,##0.00 "h"';
  const DAYS_FMT = '#,##0.00';

  const contractLabel =
    profile.contractType === 'tiempo_parcial'
      ? `Tiempo parcial (${profile.partTimePercentage || 50}%)`
      : profile.contractType === 'temporal'
      ? 'Temporal (100%)'
      : 'Indefinido (100%)';
  const prorrateoLabel =
    profile.prorrateoPagasExtra === 'una_paga'
      ? '1 paga prorrateada + Julio y Dic. íntegras'
      : profile.prorrateoPagasExtra === 'ninguna'
      ? 'Sin prorrateo (Cobro íntegro)'
      : '3 pagas prorrateadas mensualmente';

  // =========================================================================
  // HOJA 1: RESUMEN NÓMINA (Diseño ejecutivo 4 columnas A..D)
  // =========================================================================
  const rows1: Array<Array<string | number>> = [];
  const rowHeights1: XLSX.RowInfo[] = [];

  const pushRow1 = (vals: Array<string | number>, hpt = 21): number => {
    const idx = rows1.length;
    rows1.push(vals);
    rowHeights1[idx] = { hpt };
    return idx;
  };

  // Título & subtítulo
  const rTitle = pushRow1(['RECIBO INDIVIDUAL DE SALARIOS · TRANSPORTE DE VIAJEROS', '', '', ''], 30);
  const rSub = pushRow1(
    [`Período: ${monthName} ${payroll.year}   |   Ciclo de corte variables: ${payroll.extrasCutoffPeriod}   |   Convenio Colectivo Zaragoza`, '', '', ''],
    22
  );
  pushRow1(['', '', '', ''], 10);

  // Bloque datos empresa y trabajador
  const rMetaStart = pushRow1(['Empresa:', profile.companyName?.trim() || 'Sin especificar', 'CIF:', profile.cif?.trim() || 'Sin especificar'], 22);
  pushRow1(['Trabajador:', profile.name?.trim() || 'Sin especificar', 'NIF / NIE:', profile.nif?.trim() || 'Sin especificar'], 22);
  pushRow1(['Categoría Profesional:', profile.category?.trim() || 'Conductor/a Perceptor/a', 'Convenio Aplicable:', 'BOPZ 182 · Zaragoza'], 22);
  pushRow1(['Contrato y Jornada:', contractLabel, 'Régimen Pagas Extras:', prorrateoLabel], 22);
  const rMetaEnd = pushRow1(['Mes / Año Liquidación:', `${monthName} ${payroll.year}`, 'Fecha de Emisión:', new Date().toLocaleDateString('es-ES')], 22);
  pushRow1(['', '', '', ''], 12);

  // Sección I: Datos de Jornada y Horas de Convenio (Art. 14)
  const rSecJornadaTitle = pushRow1(['I. DATOS DE JORNADA Y HORAS POR CONVENIO (ART. 14)', '', '', ''], 24);
  const rSecJornadaHead = pushRow1(['CONCEPTO DE JORNADA', 'VALOR', 'UNIDAD / REFERENCIA', 'DETALLE / OBSERVACIONES'], 22);
  const jornadaRows: Array<[string, number, string, string, string]> = [
    ['Días Naturales / Pagados Salario Base', payroll.salarioBaseDays, 'días naturales', `De ${payroll.totalDays} días en ${monthName}`, DAYS_FMT],
    ['Días Trabajados en Mes Natural', payroll.workedDays, 'días', 'Turnos asignados en calendario del mes', DAYS_FMT],
    ['Días de Descanso', payroll.restDays, 'días', 'Libranzas y descansos semanales (D)', DAYS_FMT],
    ['Días de Vacaciones en Mes Natural', payroll.vacationDays, 'días', 'Incluidos en Salario Base mensual', DAYS_FMT],
    ['Días de Vacaciones (Plus Art. 9 en período)', payroll.vacationPlusDays, 'días', `Dentro del corte ${payroll.extrasCutoffPeriod}`, DAYS_FMT],
    ['Días Festivos / Domingos en período', payroll.holidayDays, 'festivos', `Dentro del corte ${payroll.extrasCutoffPeriod}`, DAYS_FMT],
    ['Horas Nocturnas (22:00 a 06:00)', payroll.nightHours, 'horas', 'Computadas en período de corte', HOURS_FMT],
    ['Horas Totales Realizadas en Período', payroll.totalWorkedHours, 'horas', 'Suma total trabajada (ordinarias, >9h, festivas y F/T)', HOURS_FMT],
    ['Horas Ordinarias Salario Base (hasta 9h/día)', payroll.ordinaryConvenioHours, 'horas', 'Excluye festivos, días F/T y excesos diarios >9h', HOURS_FMT],
    ['Horas Festivas (Art. 17 · Aparte Base)', payroll.horasFestivas, 'horas', 'Jornadas en festivo: se abonan aparte y no suman a convenio', HOURS_FMT],
    ['Horas F/T (Fiesta / Trabajo · Aparte Base)', payroll.horasFT, 'horas', 'Jornadas marcadas F/T: se abonan aparte a hora ordinaria', HOURS_FMT],
    ['Exceso Turnos > 9h/día (H. Complementarias)', payroll.horasExcesoDiario9h, 'horas', 'Horas diarias por encima de 9h pasan a complementarias', HOURS_FMT],
    [
      `Jornada Anual Convenio a Cumplir (${jornadaPct}%)`,
      payroll.convenioAnnualHoursTarget,
      'horas / año',
      payroll.partTimeFactor < 1
        ? `${jornadaPct}% de ${formatHoursLabel(payroll.convenioAnnualHoursBase)} h anuales (Art. 14 Convenio)`
        : 'Jornada anual completa Art. 14 Convenio',
      HOURS_FMT,
    ],
    [
      `Horas Teóricas ${monthName} (${jornadaPct}%)`,
      payroll.convenioMonthlyHoursTarget,
      'horas / mes',
      `Proporcional a ${Math.max(0, payroll.totalDays - payroll.vacationDays - payroll.sickDays)}d activos de ${monthName} sobre ${Math.max(1, getDaysInYear(payroll.year) - ANNUAL_VACATION_DAYS_CONVENIO)}d/año (sin ${ANNUAL_VACATION_DAYS_CONVENIO}d vac.)`,
      HOURS_FMT,
    ],
    [
      'Diferencia Horas Reales vs Teóricas',
      periodHoursDiff,
      'horas',
      periodHoursDiff >= 0
        ? 'Exceso mensual -> abonado como Horas Complementarias'
        : 'Saldo negativo (0 h compl. mensuales · Salario Base 100%, a compensar)',
      HOURS_FMT,
    ],
  ];

  const rJornadaFirst = rows1.length;
  jornadaRows.forEach(([label, val, unit, note]) => {
    pushRow1([label, val, unit, note], 20);
  });
  const rJornadaLast = rows1.length - 1;
  pushRow1(['', '', '', ''], 12);

  // Sección II: Devengos Salariales en Bruto
  const rSecDevTitle = pushRow1(['II. DEVENGOS SALARIALES EN BRUTO (ANTES DE IMPUESTOS)', '', '', ''], 24);
  const rSecDevHead = pushRow1(['CONCEPTO RETRIBUTIVO (CONVENIO)', 'CUANTÍA (Nº VECES)', 'PRECIO UNITARIO (€)', 'DEVENGOS BRUTO (€)'], 22);
  const rDevFirst = rows1.length;
  payroll.lines.forEach((line) => {
    pushRow1([line.name, `${line.quantityLabel} ${line.unit}`, line.unitPrice, line.amount], 21);
  });
  const rDevLast = rows1.length - 1;
  const rDevTotal = pushRow1(['TOTAL DEVENGADO BRUTO (ANTES DE IMPUESTOS)', '', '', payroll.totalDevengado], 24);
  pushRow1(['', '', '', ''], 12);

  // Sección III: Deducciones
  const rSecDedTitle = pushRow1(['III. DEDUCCIONES LEGALES, SEGURIDAD SOCIAL E I.R.P.F.', '', '', ''], 24);
  const rSecDedHead = pushRow1(['CONCEPTO DE DEDUCCIÓN / TRIBUTO', 'TIPO / PORCENTAJE', 'BASE DE CÁLCULO', 'IMPORTE DEDUCIDO (€)'], 22);
  const dedRowsData: Array<[string, string, number | string, number, boolean?]> = [
    ['Contingencias Comunes (Seguridad Social)', '4,70%', payroll.baseCotizacionSS, payroll.contingenciasComunes],
    ['Desempleo (Régimen General)', profile.contractType === 'temporal' ? '1,60%' : '1,55%', payroll.baseCotizacionSS, payroll.desempleo],
    ['Formación Profesional', '0,10%', payroll.baseCotizacionSS, payroll.formacionProfesional],
    ['Mecanismo de Equidad Intergeneracional (MEI)', '0,15%', payroll.baseCotizacionSS, payroll.mei],
    ['Subtotal Seguridad Social Trabajador', 'Suma S.S.', payroll.baseCotizacionSS, payroll.totalSeguridadSocial, true],
    ['Retención I.R.P.F.', `${payroll.retencionIrpf.toFixed(2).replace('.', ',')}%`, Math.max(0, payroll.totalDevengado - payroll.dietasExentas), payroll.retencionIrpfImporte],
  ];
  if (payroll.cuotaSindical > 0) {
    dedRowsData.push(['Cuota Sindical (Art. 36 Convenio)', 'Fija', 'Convenio', payroll.cuotaSindical]);
  }
  if (payroll.anticipos > 0) {
    dedRowsData.push(['Anticipos a cuenta', 'Compensación', 'Nómina', payroll.anticipos]);
  }
  const rDedFirst = rows1.length;
  dedRowsData.forEach(([name, pct, base, amt]) => {
    pushRow1([name, pct, base, amt], 21);
  });
  const rDedLast = rows1.length - 1;
  const rDedTotal = pushRow1(['TOTAL A DEDUCIR', '', '', payroll.totalDeducido], 24);
  pushRow1(['', '', '', ''], 12);

  // Sección IV: Totales Finales
  const rSecTotTitle = pushRow1(['IV. LÍQUIDO A PERCIBIR Y BASES INFORMATIVAS', '', '', ''], 24);
  const rLiquido = pushRow1(['LÍQUIDO TOTAL A PERCIBIR (NETO EN CUENTA)', `${monthName} ${payroll.year}`, 'Neto transferencia', payroll.liquidoPercibir], 28);
  const rBaseSS = pushRow1(['Base de Cotización Seguridad Social', 'Mensual S.S.', 'Topes vigentes', payroll.baseCotizacionSS], 21);
  const rCosteEmp = pushRow1(['Coste Total Empresa Estimado', 'Bruto + Seg. Soc. Patronal', 'Informativo', payroll.totalCosteEmpresa], 21);

  const ws1 = XLSX.utils.aoa_to_sheet(rows1);
  ws1['!merges'] = [
    { s: { r: rTitle, c: 0 }, e: { r: rTitle, c: 3 } },
    { s: { r: rSub, c: 0 }, e: { r: rSub, c: 3 } },
    { s: { r: rSecJornadaTitle, c: 0 }, e: { r: rSecJornadaTitle, c: 3 } },
    { s: { r: rSecDevTitle, c: 0 }, e: { r: rSecDevTitle, c: 3 } },
    { s: { r: rSecDedTitle, c: 0 }, e: { r: rSecDedTitle, c: 3 } },
    { s: { r: rSecTotTitle, c: 0 }, e: { r: rSecTotTitle, c: 3 } },
  ];

  // Apply rich styling to Sheet 1
  styleRange(ws1, rTitle, 0, rTitle, 3, () => STYLE_TITLE_BANNER);
  styleRange(ws1, rSub, 0, rSub, 3, () => STYLE_SUBTITLE_BANNER);
  styleRange(ws1, rMetaStart, 0, rMetaEnd, 3, (_r, c) => (c === 0 || c === 2 ? STYLE_META_LABEL : STYLE_META_VALUE));

  styleRange(ws1, rSecJornadaTitle, 0, rSecJornadaTitle, 3, () => makeSectionHeaderStyle('0F172A'));
  styleRange(ws1, rSecJornadaHead, 0, rSecJornadaHead, 3, (_r, c) =>
    makeTableColHeaderStyle('E2E8F0', c === 1 ? 'right' : c === 2 ? 'center' : 'left')
  );
  styleRange(ws1, rJornadaFirst, 0, rJornadaLast, 3, (r, c) => {
    const idx = r - rJornadaFirst;
    const isHighlight = idx >= 8; // Convenio hours rows
    const zebra = idx % 2 === 1;
    const fmt = jornadaRows[idx]?.[4];
    return makeDataCellStyle(zebra, {
      align: c === 1 ? 'right' : c === 2 ? 'center' : 'left',
      bold: isHighlight && c <= 1,
      bgHex: isHighlight ? 'EFF6FF' : undefined,
      colorHex: isHighlight ? '1E3A8A' : '1E293B',
      numFmt: c === 1 ? fmt : undefined,
    });
  });

  styleRange(ws1, rSecDevTitle, 0, rSecDevTitle, 3, () => makeSectionHeaderStyle('1D4ED8'));
  styleRange(ws1, rSecDevHead, 0, rSecDevHead, 3, (_r, c) =>
    makeTableColHeaderStyle('DBEAFE', c >= 2 ? 'right' : c === 1 ? 'center' : 'left')
  );
  styleRange(ws1, rDevFirst, 0, rDevLast, 3, (r, c) => {
    const idx = r - rDevFirst;
    const lineName = payroll.lines[idx]?.name || '';
    const isVac = lineName.toLowerCase().includes('vacaciones');
    return makeDataCellStyle(idx % 2 === 1, {
      align: c >= 2 ? 'right' : c === 1 ? 'center' : 'left',
      bold: c === 3 || isVac,
      bgHex: isVac ? 'ECFEFF' : undefined,
      colorHex: isVac ? '155E75' : '0F172A',
      numFmt: c >= 2 ? CURRENCY_FMT : undefined,
    });
  });
  styleRange(ws1, rDevTotal, 0, rDevTotal, 3, (_r, c) =>
    makeTotalRowStyle('DCFCE7', '065F46', c === 3 ? 'right' : 'left', c === 3 ? CURRENCY_FMT : undefined, 11)
  );

  styleRange(ws1, rSecDedTitle, 0, rSecDedTitle, 3, () => makeSectionHeaderStyle('BE123C'));
  styleRange(ws1, rSecDedHead, 0, rSecDedHead, 3, (_r, c) =>
    makeTableColHeaderStyle('FFE4E6', c >= 2 ? 'right' : c === 1 ? 'center' : 'left')
  );
  styleRange(ws1, rDedFirst, 0, rDedLast, 3, (r, c) => {
    const idx = r - rDedFirst;
    const isSubtotal = Boolean(dedRowsData[idx]?.[4]);
    const hasNumericBase = typeof dedRowsData[idx]?.[2] === 'number';
    return makeDataCellStyle(idx % 2 === 1, {
      align: c >= 2 ? 'right' : c === 1 ? 'center' : 'left',
      bold: isSubtotal || c === 3,
      bgHex: isSubtotal ? 'FFF1F2' : undefined,
      colorHex: isSubtotal ? '9F1239' : '1E293B',
      numFmt: c === 3 || (c === 2 && hasNumericBase) ? CURRENCY_FMT : undefined,
    });
  });
  styleRange(ws1, rDedTotal, 0, rDedTotal, 3, (_r, c) =>
    makeTotalRowStyle('FFE4E6', '9F1239', c === 3 ? 'right' : 'left', c === 3 ? CURRENCY_FMT : undefined, 11)
  );

  styleRange(ws1, rSecTotTitle, 0, rSecTotTitle, 3, () => makeSectionHeaderStyle('065F46'));
  styleRange(ws1, rLiquido, 0, rLiquido, 3, (_r, c) => ({
    font: { name: FONT_FAMILY, sz: c === 3 ? 13 : 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '059669' } },
    alignment: { horizontal: c === 3 ? 'right' : c === 2 ? 'center' : 'left', vertical: 'center', wrapText: true },
    border: BORDER_TOTAL,
    ...(c === 3 ? { numFmt: CURRENCY_FMT } : {}),
  }));
  styleRange(ws1, rBaseSS, 0, rCosteEmp, 3, (r, c) =>
    makeDataCellStyle(r === rCosteEmp, {
      align: c === 3 ? 'right' : c === 2 ? 'center' : 'left',
      bold: c === 0 || c === 3,
      numFmt: c === 3 ? CURRENCY_FMT : undefined,
    })
  );

  ws1['!cols'] = autoFitColumns(rows1, [46, 24, 26, 44], [58, 30, 32, 54]);
  ws1['!rows'] = rowHeights1;
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Nómina');

  // =========================================================================
  // HOJA 2: PARTES Y TURNOS (Cuadrante ordenado con anchos amplios)
  // =========================================================================
  const cuadranteTitle = [`CUADRANTE DETALLADO DE PARTES Y SERVICIOS · ${monthName.toUpperCase()} ${payroll.year}`, '', '', '', '', '', '', '', ''];
  const cuadranteHeader = [
    'Fecha',
    'Día',
    'Código Parte',
    'Servicio / Terminal',
    'Horario Inicio',
    'Horario Fin',
    'Duración Total',
    'Extras y Particularidades',
    'Tarifa Estimada (€)',
  ];

  const monthStartStrExcel = `${payroll.year}-${String(payroll.month).padStart(2, '0')}-01`;
  const monthEndStrExcel = `${payroll.year}-${String(payroll.month).padStart(2, '0')}-${String(payroll.totalDays).padStart(2, '0')}`;
  const excelWindowStart = payroll.extrasCutoffStartDate < monthStartStrExcel ? payroll.extrasCutoffStartDate : monthStartStrExcel;
  const excelWindowEnd = payroll.extrasCutoffEndDate > monthEndStrExcel ? payroll.extrasCutoffEndDate : monthEndStrExcel;
  const sortedAssignments = [...assignments]
    .filter((a) => a.date >= excelWindowStart && a.date <= excelWindowEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
  const cuadranteRows = sortedAssignments.map((item) => {
    const shift = shiftsMap.get(item.shiftCode || '') || Array.from(shiftsMap.values()).find((s) => s.code === item.shiftCode);
    const extraParts: string[] = [];
    if (item.isHoliday) extraParts.push(`Plus Festivo (+${(activeRate.plusFestivoMayor4h ?? 40.80).toFixed(2)}€)`);
    if (item.extras && item.extras.length > 0) {
      item.extras.forEach((e) => {
        if (item.isHoliday && e.name.toLowerCase().includes('plus festivo')) return;
        extraParts.push(`${e.name} (+${e.amount.toFixed(2)}€)`);
      });
    }
    if (item.lateFinishMinutes && item.lateFinishMinutes > 0) {
      extraParts.push(`Exceso +${item.lateFinishMinutes} min`);
    }
    const extrasStr = extraParts.length > 0 ? extraParts.join('; ') : '-';
    const dayNum = item.date.split('-')[2];
    const isVac = item.shiftCode === 'V' || item.isVacation;
    const isRest = item.shiftCode === 'D' || item.isRest;

    const amountVal = shift && !isRest && !isVac
      ? computeShiftRateFromConvenio(shift, activeRate, { isHoliday: Boolean(item.isHoliday) }).totalRate
      : isRest
      ? 0
      : isVac
      ? baseDayRate +
        (profile.hasVacationPlus !== false
          ? parseFloat(
              ((activeRate.plusVacacionesDia && activeRate.plusVacacionesDia > 0
                ? activeRate.plusVacacionesDia
                : 10.0) * payroll.partTimeFactor).toFixed(2)
            )
          : 0)
      : baseDayRate;

    return [
      item.date,
      `Día ${dayNum}`,
      isVac ? 'V (Vacaciones)' : item.shiftCode || 'Descanso',
      shift?.terminal || shift?.title || (isRest ? 'Descanso Semanal' : isVac ? 'Vacaciones Retribuidas (Art. 9)' : '-'),
      item.customStartTime || shift?.startTime || '-',
      item.customEndTime || shift?.endTime || '-',
      shift?.computedDuration || (isVac ? 'Jornada vacaciones retribuida' : '-'),
      extrasStr,
      amountVal,
    ];
  });

  const sheet2AoA: Array<Array<string | number>> = [cuadranteTitle, cuadranteHeader, ...cuadranteRows];
  const wsCuadrante = XLSX.utils.aoa_to_sheet(sheet2AoA);
  wsCuadrante['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
  styleRange(wsCuadrante, 0, 0, 0, 8, () => STYLE_TITLE_BANNER);
  styleRange(wsCuadrante, 1, 0, 1, 8, (_r, c) =>
    makeTableColHeaderStyle('DBEAFE', c === 8 ? 'right' : c <= 2 || c === 4 || c === 5 ? 'center' : 'left')
  );
  if (cuadranteRows.length > 0) {
    styleRange(wsCuadrante, 2, 0, 1 + cuadranteRows.length, 8, (r, c) => {
      const idx = r - 2;
      return makeDataCellStyle(idx % 2 === 1, {
        align: c === 8 ? 'right' : c <= 2 || c === 4 || c === 5 ? 'center' : 'left',
        bold: c === 2 || c === 8,
        numFmt: c === 8 ? CURRENCY_FMT : undefined,
      });
    });
  }
  wsCuadrante['!cols'] = autoFitColumns(
    sheet2AoA,
    [13, 10, 16, 38, 14, 14, 24, 38, 20],
    [15, 12, 20, 48, 16, 16, 30, 56, 22]
  );
  wsCuadrante['!rows'] = [{ hpt: 28 }, { hpt: 24 }, ...cuadranteRows.map(() => ({ hpt: 20 }))];
  XLSX.utils.book_append_sheet(wb, wsCuadrante, 'Partes y Turnos');

  // =========================================================================
  // HOJA 3: EXTRAS Y VARIABLES DEL PERÍODO (Diferenciando tramo mes anterior vs actual)
  // =========================================================================
  const extrasTitle = [`DETALLE DE PLUSES Y VARIABLES EN CORTE (${payroll.extrasCutoffPeriod})`, '', '', '', ''];
  const extrasHeader = ['Fecha', 'Tramo del Período', 'Concepto / Particularidad', 'Notas / Observaciones', 'Importe Bruto (€)'];
  const nonZeroExtrasForSheet = payroll.extrasItemsList.filter((e) => e.amount > 0);
  const extrasRows =
    nonZeroExtrasForSheet.length > 0
      ? nonZeroExtrasForSheet.map((e) => [
          e.date,
          e.date < monthStartStrExcel ? 'Mes anterior (corte)' : `${monthName} (en curso)`,
          e.name,
          e.notes || '-',
          e.amount,
        ])
      : [['-', '-', 'Sin pluses variables ni apuntes extra (> 0 €) registrados en el período de corte', '-', 0]];

  const sheet3AoA: Array<Array<string | number>> = [extrasTitle, extrasHeader, ...extrasRows];
  const wsExtras = XLSX.utils.aoa_to_sheet(sheet3AoA);
  wsExtras['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  styleRange(wsExtras, 0, 0, 0, 4, () => STYLE_TITLE_BANNER);
  styleRange(wsExtras, 1, 0, 1, 4, (_r, c) =>
    makeTableColHeaderStyle('FEF3C7', c === 4 ? 'right' : c === 0 ? 'center' : 'left')
  );
  styleRange(wsExtras, 2, 0, 1 + extrasRows.length, 4, (r, c) =>
    makeDataCellStyle((r - 2) % 2 === 1, {
      align: c === 4 ? 'right' : c === 0 ? 'center' : 'left',
      bold: c === 4,
      numFmt: c === 4 ? CURRENCY_FMT : undefined,
    })
  );
  wsExtras['!cols'] = autoFitColumns(sheet3AoA, [14, 22, 40, 40, 20], [16, 26, 52, 54, 24]);
  wsExtras['!rows'] = [{ hpt: 28 }, { hpt: 24 }, ...extrasRows.map(() => ({ hpt: 20 }))];
  XLSX.utils.book_append_sheet(wb, wsExtras, 'Extras del Período');

  // =========================================================================
  // HOJA 4: TABLAS DEL CONVENIO
  // =========================================================================
  const convRates = Object.values(convenio.ratesByYear);
  const convenioData: Array<Array<string | number>> = [
    ['CONVENIO COLECTIVO DEL TRANSPORTE DE VIAJEROS DE ZARAGOZA', '', '', '', '', '', '', '', '', ''],
    ['Normativa:', convenio.title, '', '', 'BOPZ:', convenio.bopzNumber, 'Vigencia:', `${convenio.validFrom} al ${convenio.validTo}`, 'Ultraact.:', `Hasta ${convenio.ultractividadTo}`],
    ['', '', '', '', '', '', '', '', '', ''],
    [
      'Año',
      'Salario Base/Día (€)',
      'Salario Anual (€)',
      'Hora Ordinaria (€)',
      'Plus Nocturno/h (€)',
      'Plus Conductor/Día (€)',
      'Quebranto/Día (€)',
      'Plus Retén/Día (€)',
      'Plus Festivo >4h (€)',
      'Plus Vacaciones/Día (€)',
    ],
    ...convRates.map((r) => [
      r.year,
      r.salarioBaseDia,
      r.salarioBaseAnual,
      r.horaOrdinaria,
      r.plusNocturnidadHora,
      r.plusConductorPerceptorDia,
      r.quebrantoMonedaDia,
      r.plusRetenDia ?? 8.25,
      r.plusFestivoMayor4h,
      r.plusVacacionesDia ?? 10.0,
    ]),
  ];

  const wsConvenio = XLSX.utils.aoa_to_sheet(convenioData);
  wsConvenio['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
  ];
  styleRange(wsConvenio, 0, 0, 0, 9, () => STYLE_TITLE_BANNER);
  styleRange(wsConvenio, 1, 0, 1, 9, (_r, c) =>
    c === 0 || c === 4 || c === 6 || c === 8 ? STYLE_META_LABEL : STYLE_META_VALUE
  );
  styleRange(wsConvenio, 3, 0, 3, 9, (_r, c) =>
    makeTableColHeaderStyle('DBEAFE', c === 0 ? 'center' : 'right')
  );
  if (convRates.length > 0) {
    styleRange(wsConvenio, 4, 0, 3 + convRates.length, 9, (r, c) =>
      makeDataCellStyle((r - 4) % 2 === 1, {
        align: c === 0 ? 'center' : 'right',
        bold: c === 0,
        numFmt: c === 0 ? '0' : CURRENCY_FMT,
      })
    );
  }
  wsConvenio['!cols'] = [
    { wch: 12 },
    { wch: 21 },
    { wch: 20 },
    { wch: 20 },
    { wch: 21 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 24 },
  ];
  wsConvenio['!rows'] = [{ hpt: 28 }, { hpt: 28 }, { hpt: 10 }, { hpt: 26 }, ...convRates.map(() => ({ hpt: 21 }))];
  XLSX.utils.book_append_sheet(wb, wsConvenio, 'Tablas Convenio');

  XLSX.writeFile(wb, `Nomina_Transporte_${monthName}_${payroll.year}.xlsx`);
}
