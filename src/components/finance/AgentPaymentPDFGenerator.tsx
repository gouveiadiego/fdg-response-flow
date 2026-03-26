import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Company data
const COMPANY_INFO = {
  name: 'FALCO PEREGRINUS OPERAÇÕES LOGÍSTICAS',
  cnpj: '59.355.128/0001-10',
  address: 'R. Dona Francisca, 801 Sala 05 - Saguaçu, Joinville - SC, 89221-006',
  email: 'financeiro@falcoperegrinus.com.br',
  phone: '(47) 99135-6830',
  website: 'www.falcoperegrinus.com.br',
};

// Premium Brand Theme
const THEME = {
  primary: { r: 18, g: 18, b: 18 },      // #121212
  text: { r: 30, g: 41, b: 59 },         // Slate 800
  secondaryText: { r: 100, g: 116, b: 139 }, // Slate 500
  background: { r: 248, g: 250, b: 252 }, 
  cardBg: { r: 255, g: 255, b: 255 },
  border: { r: 226, g: 232, b: 240 },
  white: { r: 255, g: 255, b: 255 },
  accent: { r: 245, g: 158, b: 11 },     // Amber 500
};

interface PaymentPDFData {
  ticketCode: string;
  agentName: string;
  agentDocument: string;
  serviceType: string;
  planName: string;
  startTime: Date | null;
  endTime: Date | null;
  startKm: number;
  endKm: number;
  baseValue: number;
  includedHours: number;
  includedKm: number;
  extraHourRate: number;
  extraKmRate: number;
  extraHours: number;
  extraKm: number;
  toll: number;
  food: number;
  other: number;
  total: number;
  bankingInfo: {
    pixKey: string | null;
    bankName: string | null;
    bankAgency: string | null;
    bankAccount: string | null;
    bankAccountType: string | null;
  };
}

// Helpers
const setColor = (pdf: jsPDF, color: { r: number; g: number; b: number }) => {
  pdf.setFillColor(color.r, color.g, color.b);
  pdf.setDrawColor(color.r, color.g, color.b);
  pdf.setTextColor(color.r, color.g, color.b);
};

const drawRoundedRect = (pdf: jsPDF, x: number, y: number, w: number, h: number, r: number, style: string = 'F') => {
  pdf.roundedRect(x, y, w, h, r, r, style);
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatHoursToHMS = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.round(((hours - h) * 60 - m) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const loadImage = (url: string): Promise<{ dataUrl: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width: img.width,
        height: img.height
      });
    };
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

export async function generateAgentPaymentPDF(data: PaymentPDFData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // Background
  setColor(pdf, THEME.background);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Load Logo
  let logoImg: { dataUrl: string; width: number; height: number } | null = null;
  try {
    logoImg = await loadImage('/logo-fdg-premium.png');
  } catch (e) {
    try {
      logoImg = await loadImage('/logo-fdg.png');
    } catch (fe) {}
  }

  // --- HEADER ---
  setColor(pdf, THEME.primary);
  pdf.rect(0, 0, pageWidth, 45, 'F');

  if (logoImg) {
    const logoMaxW = 35;
    const logoRatio = logoImg.width / logoImg.height;
    const finalW = logoMaxW;
    const finalH = logoMaxW / logoRatio;
    pdf.addImage(logoImg.dataUrl, 'PNG', margin, (45 - finalH) / 2, finalW, finalH);
  }

  setColor(pdf, THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('RECIBO DE HONORÁRIOS', margin + 42, 20);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(`CHAMADO: ${data.ticketCode}`, margin + 42, 26);
  pdf.text(`DATA DE EMISSÃO: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin + 42, 30);

  // Business Address in header
  pdf.setFontSize(7);
  pdf.text(COMPANY_INFO.address, margin + 42, 36);
  pdf.text(`CNPJ: ${COMPANY_INFO.cnpj} | ${COMPANY_INFO.email}`, margin + 42, 40);

  let y = 55;

  // --- IDENTIFICAÇÃO DO AGENTE ---
  setColor(pdf, THEME.white);
  drawRoundedRect(pdf, margin, y, contentWidth, 38, 2, 'F');
  setColor(pdf, THEME.primary);
  pdf.rect(margin, y, 1.5, 38, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  setColor(pdf, THEME.secondaryText);
  pdf.text('AGENTE / PRESTADOR', margin + 6, y + 6);
  
  setColor(pdf, THEME.primary);
  pdf.setFontSize(12);
  pdf.text(data.agentName.toUpperCase(), margin + 6, y + 13);
  
  setColor(pdf, THEME.secondaryText);
  pdf.setFontSize(8.5);
  pdf.text(`CPF/CNPJ: ${data.agentDocument || 'N/A'}`, margin + 6, y + 20);

  // PIX & Bank info moved here
  pdf.setFontSize(8.5);
  let identY = y + 26;
  if (data.bankingInfo.pixKey) {
    pdf.text(`PIX: ${data.bankingInfo.pixKey}`, margin + 6, identY);
    identY += 5;
  }
  const bankDetailsShort = `${data.bankingInfo.bankName || 'N/A'} | Ag: ${data.bankingInfo.bankAgency || '-'} | Cta: ${data.bankingInfo.bankAccount || '-'}`;
  pdf.text(bankDetailsShort.toUpperCase(), margin + 6, identY);

  y += 45;

  // --- DETALHES DA OPERAÇÃO ---
  setColor(pdf, THEME.white);
  drawRoundedRect(pdf, margin, y, contentWidth, 35, 2, 'F');
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  setColor(pdf, THEME.primary);
  pdf.text('DADOS DA OPERAÇÃO', margin + 6, y + 7);
  pdf.line(margin + 6, y + 9, margin + 40, y + 9);

  const colW = (contentWidth - 12) / 3;
  let cx = margin + 6;
  const cy = y + 16;

  // Times
  pdf.setFontSize(7);
  setColor(pdf, THEME.secondaryText);
  pdf.text('INÍCIO', cx, cy);
  pdf.text('TÉRMINO', cx + colW, cy);
  pdf.text('DURAÇÃO', cx + colW * 2, cy);

  setColor(pdf, THEME.text);
  pdf.setFontSize(8.5);
  pdf.text(data.startTime ? format(data.startTime, 'dd/MM/yyyy HH:mm') : '-', cx, cy + 5);
  pdf.text(data.endTime ? format(data.endTime, 'dd/MM/yyyy HH:mm') : '-', cx + colW, cy + 5);
  
  if (data.startTime && data.endTime) {
    const diff = data.endTime.getTime() - data.startTime.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    pdf.text(`${h}h ${m}m`, cx + colW * 2, cy + 5);
  } else {
    pdf.text('-', cx + colW * 2, cy + 5);
  }

  // KM
  const cy2 = cy + 12;
  setColor(pdf, THEME.secondaryText);
  pdf.setFontSize(7);
  pdf.text('KM INICIAL', cx, cy2);
  pdf.text('KM FINAL', cx + colW, cy2);
  pdf.text('KM TOTAL', cx + colW * 2, cy2);

  setColor(pdf, THEME.text);
  pdf.setFontSize(8.5);
  pdf.text(`${data.startKm} km`, cx, cy2 + 5);
  pdf.text(`${data.endKm} km`, cx + colW, cy2 + 5);
  pdf.text(`${data.endKm - data.startKm} km`, cx + colW * 2, cy2 + 5);

  y += 42;

  // --- MEMÓRIA DE CÁLCULO (TABLE STYLE) ---
  setColor(pdf, THEME.white);
  drawRoundedRect(pdf, margin, y, contentWidth, 75, 2, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  setColor(pdf, THEME.primary);
  pdf.text('MEMÓRIA DE CÁLCULO', margin + 6, y + 7);
  
  // Table Header
  const tableY = y + 14;
  setColor(pdf, {r: 241, g: 245, b: 249});
  pdf.rect(margin + 4, tableY, contentWidth - 8, 7, 'F');
  
  setColor(pdf, THEME.secondaryText);
  pdf.setFontSize(7);
  pdf.text('DESCRIÇÃO', margin + 8, tableY + 5);
  pdf.text('QTD/UNID', margin + 70, tableY + 5);
  pdf.text('UNITÁRIO', margin + 100, tableY + 5);
  pdf.text('SUBTOTAL', margin + contentWidth - 25, tableY + 5, { align: 'right' });

  let rowY = tableY + 12;
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'normal');
  setColor(pdf, THEME.text);

  // BASE
  const baseLabel = data.serviceType === 'ALARME' ? 'Pacote Franquia 30 min' : 'Pacote Franquia 3 horas';
  pdf.text(baseLabel, margin + 8, rowY);
  pdf.text('1 un', margin + 70, rowY);
  pdf.text(formatCurrency(data.baseValue), margin + 100, rowY);
  pdf.text(formatCurrency(data.baseValue), margin + contentWidth - 8, rowY, { align: 'right' });

  // EXTRA HOURS
  rowY += 8;
  if (data.extraHours > 0) {
    pdf.text('Horas Excedentes', margin + 8, rowY);
    pdf.text(formatHoursToHMS(data.extraHours), margin + 70, rowY);
    pdf.text(formatCurrency(data.extraHourRate), margin + 100, rowY);
    pdf.text(formatCurrency(data.extraHours * data.extraHourRate), margin + contentWidth - 8, rowY, { align: 'right' });
  } else {
    setColor(pdf, {r: 200, g: 200, b: 200});
    pdf.text('Horas Excedentes (Não houve)', margin + 8, rowY);
    setColor(pdf, THEME.text);
  }

  // EXTRA KM
  rowY += 8;
  if (data.extraKm > 0) {
    pdf.text('KM Excedente', margin + 8, rowY);
    pdf.text(`${data.extraKm.toFixed(0)} km`, margin + 70, rowY);
    pdf.text(formatCurrency(data.extraKmRate), margin + 100, rowY);
    pdf.text(formatCurrency(data.extraKm * data.extraKmRate), margin + contentWidth - 8, rowY, { align: 'right' });
  } else {
    setColor(pdf, {r: 200, g: 200, b: 200});
    pdf.text('KM Excedente (Não houve)', margin + 8, rowY);
    setColor(pdf, THEME.text);
  }

  // EXPENSES
  rowY += 4;
  pdf.setDrawColor(241, 245, 249);
  pdf.line(margin + 8, rowY, margin + contentWidth - 8, rowY);
  rowY += 8;

  pdf.text('Pedágio', margin + 8, rowY);
  pdf.text(formatCurrency(data.toll), margin + contentWidth - 8, rowY, { align: 'right' });
  
  rowY += 7;
  pdf.text('Alimentação', margin + 8, rowY);
  pdf.text(formatCurrency(data.food), margin + contentWidth - 8, rowY, { align: 'right' });
  
  rowY += 7;
  pdf.text('Outras Despesas', margin + 8, rowY);
  pdf.text(formatCurrency(data.other), margin + contentWidth - 8, rowY, { align: 'right' });

  // TOTAL BOX
  y += 82;
  setColor(pdf, THEME.primary);
  drawRoundedRect(pdf, pageWidth - 80, y, 65, 12, 1, 'F');
  setColor(pdf, THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('TOTAL A RECEBER', pageWidth - 80, y + 8);
  pdf.setFontSize(11);
  pdf.text(formatCurrency(data.total), pageWidth - 18, y + 8, { align: 'right' });

  y += 18;

  // --- FOOTER ---
  const footerY = pageHeight - 20;
  pdf.setFontSize(7);
  setColor(pdf, THEME.secondaryText);
  pdf.text('Este documento serve como registro para fins de conferência de honorários e despesas.', pageWidth / 2, footerY, { align: 'center' });
  pdf.text('FALCO PEREGRINUS OPERAÇÕES LOGÍSTICAS - Excelência em Atendimento.', pageWidth / 2, footerY + 4, { align: 'center' });

  // Save PDF
  const fileName = `RECIBO_PAGAMENTO_${data.agentName.replace(/\s+/g, '_')}_${data.ticketCode}.pdf`;
  pdf.save(fileName);
}
