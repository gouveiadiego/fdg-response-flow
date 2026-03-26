import jsPDF from 'jspdf';
// v3 - force build
import { format } from 'date-fns';

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
  accent: { r: 18, g: 18, b: 18 },     // Using primary for professional look
};

interface InvoicePDFData {
  ticketCode: string;
  clientName: string;
  serviceType: string;
  planName: string;
  vehiclePlate: string;
  durationHours: number;
  totalKm: number;
  baseValue: number;
  includedHours: number;
  includedKm: number;
  extraHourRate: number;
  extraKmRate: number;
  extraHours: number;
  extraKm: number;
  discountAddition: number;
  total: number;
  agentBreakdown: {
    name: string;
    role: string;
    hours: number;
    km: number;
    startTime: Date | null;
    endTime: Date | null;
    startKm: number;
    endKm: number;
  }[];
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

export async function generateClientInvoicePDF(data: InvoicePDFData): Promise<void> {
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
    } catch (fe) { /* ignore */ }
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
  pdf.text('DEMONSTRATIVO DE FATURAMENTO', margin + 42, 20);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(`CHAMADO: ${data.ticketCode}`, margin + 42, 26);
  pdf.text(`DATA DE EMISSÃO: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin + 42, 30);

  // Business Address in header
  pdf.setFontSize(7);
  pdf.text(COMPANY_INFO.address, margin + 42, 36);
  pdf.text(`CNPJ: ${COMPANY_INFO.cnpj} | ${COMPANY_INFO.email}`, margin + 42, 40);

  let y = 55;

  // --- IDENTIFICAÇÃO DO CLIENTE ---
  setColor(pdf, THEME.white);
  drawRoundedRect(pdf, margin, y, contentWidth, 25, 2, 'F');
  setColor(pdf, THEME.primary);
  pdf.rect(margin, y, 1.5, 25, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  setColor(pdf, THEME.secondaryText);
  pdf.text('CLIENTE ATENDIDO', margin + 6, y + 6);
  
  setColor(pdf, THEME.primary);
  pdf.setFontSize(12);
  pdf.text(data.clientName.toUpperCase(), margin + 6, y + 13);
  
  setColor(pdf, THEME.secondaryText);
  pdf.setFontSize(8);
  pdf.text(`PEDIDO / REFERÊNCIA: ${data.ticketCode}`, margin + 6, y + 19);

  y += 32;

  // --- DETALHES DA OPERAÇÃO ---
  setColor(pdf, THEME.white);
  drawRoundedRect(pdf, margin, y, contentWidth, 35, 2, 'F');
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  setColor(pdf, THEME.primary);
  pdf.text('RESUMO DA OPERAÇÃO', margin + 6, y + 7);
  pdf.line(margin + 6, y + 9, margin + 45, y + 9);

  const colW = (contentWidth - 12) / 3;
  const cx = margin + 6;
  const cy = y + 16;

  // Overview info
  pdf.setFontSize(7);
  setColor(pdf, THEME.secondaryText);
  pdf.text('PLACA DO VEÍCULO', cx, cy);
  pdf.text('TIPO DE SERVIÇO', cx + colW, cy);
  pdf.text('PLANO CONTRATADO', cx + colW * 2, cy);

  setColor(pdf, THEME.text);
  pdf.setFontSize(8.5);
  pdf.text(data.vehiclePlate || 'N/A', cx, cy + 5);
  pdf.text(data.serviceType, cx + colW, cy + 5);
  pdf.text(data.planName, cx + colW * 2, cy + 5);

  // Stats
  const cy2 = cy + 12;
  setColor(pdf, THEME.secondaryText);
  pdf.setFontSize(7);
  pdf.text('TEMPO TOTAL', cx, cy2);
  pdf.text('KM PERCORRIDOS', cx + colW, cy2);
  pdf.text('LOCALIDADE', cx + colW * 2, cy2);

  setColor(pdf, THEME.text);
  pdf.setFontSize(8.5);
  pdf.text(`${data.durationHours.toFixed(2)} horas`, cx, cy2 + 5);
  pdf.text(`${data.totalKm.toFixed(0)} km`, cx + colW, cy2 + 5);
  pdf.text('BRASIL', cx + colW * 2, cy2 + 5);

  y += 42;

  // --- DETALHAMENTO POR AGENTE ---
  if (data.agentBreakdown && data.agentBreakdown.length > 0) {
    const rowHeight = 12;
    const totalBreakdownHeight = 10 + (data.agentBreakdown.length * rowHeight);
    
    setColor(pdf, THEME.white);
    drawRoundedRect(pdf, margin, y, contentWidth, totalBreakdownHeight, 2, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    setColor(pdf, THEME.primary);
    pdf.text('DETALHAMENTO POR AGENTE', margin + 6, y + 7);
    
    let ay = y + 14;
    pdf.setFontSize(7);
    
    data.agentBreakdown.forEach((agent) => {
      // Header: Generic Role (No real names for client PDF)
      pdf.setFont('helvetica', 'bold');
      setColor(pdf, THEME.primary);
      
      const roleStr = agent.role.toUpperCase();
      const displayName = roleStr === 'PRINCIPAL' 
        ? 'AGENTE PRINCIPAL' 
        : `AGENTE DE ${roleStr}`;
        
      pdf.text(displayName, margin + 8, ay);
      
      // Details: Times and KM
      ay += 4;
      pdf.setFont('helvetica', 'normal');
      setColor(pdf, THEME.secondaryText);
      
      const timeStr = `Início: ${agent.startTime ? format(agent.startTime, 'HH:mm:ss') : '--:--'} | Fim: ${agent.endTime ? format(agent.endTime, 'HH:mm:ss') : '--:--'}`;
      const kmStr = `KM inicial: ${agent.startKm.toFixed(0)} | KM final: ${agent.endKm.toFixed(0)}`;
      
      pdf.text(timeStr, margin + 8, ay);
      
      // Totals on the right
      const hours = Math.floor(agent.hours);
      const mins = Math.floor((agent.hours - hours) * 60);
      const secs = Math.floor(((agent.hours - hours) * 60 - mins) * 60);
      const durationStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      
      pdf.setFont('helvetica', 'bold');
      setColor(pdf, THEME.primary);
      pdf.text(`${durationStr} • ${agent.km.toFixed(0)} km`, margin + contentWidth - 8, ay, { align: 'right' });
      
      ay += 4;
      pdf.setFont('helvetica', 'normal');
      setColor(pdf, THEME.secondaryText);
      pdf.text(kmStr, margin + 8, ay);
      
      const agentExtraKm = data.totalKm > 0 ? (agent.km / data.totalKm) * data.extraKm : 0;
      const agentExtraHours = data.durationHours > 0 ? (agent.hours / data.durationHours) * data.extraHours : 0;
      const agentCost = (agentExtraKm * data.extraKmRate) + (agentExtraHours * data.extraHourRate);

      if (agentCost > 0) {
        pdf.setFont('helvetica', 'bold');
        setColor(pdf, {r: 249, g: 115, b: 22});
        pdf.text(`Custo Extra: ${formatCurrency(agentCost)}`, margin + contentWidth - 8, ay, { align: 'right' });
      }
      
      ay += 6; // Space between agents
    });

    y += totalBreakdownHeight + 5;
  }

  // --- MEMÓRIA DE CÁLCULO (TABLE STYLE) ---
  setColor(pdf, THEME.white);
  drawRoundedRect(pdf, margin, y, contentWidth, 75, 2, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  setColor(pdf, THEME.primary);
  pdf.text('DETALHAMENTO DE VALORES', margin + 6, y + 7);
  
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
  const baseLabel = data.serviceType === 'alarme' ? 'Pacote Franquia 30 min' : 'Pacote Franquia 3 horas';
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
    pdf.text('Horas Excedentes (Franquia)', margin + 8, rowY);
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
    pdf.text('KM Excedente (Franquia)', margin + 8, rowY);
    setColor(pdf, THEME.text);
  }

  // ADJUSTMENTS
  rowY += 12;
  if (data.discountAddition !== 0) {
    pdf.text('Ajustes / Acréscimos Manuais', margin + 8, rowY);
    pdf.text(formatCurrency(data.discountAddition), margin + contentWidth - 8, rowY, { align: 'right' });
  }

  // TOTAL BOX
  y += 82;
  setColor(pdf, THEME.primary);
  drawRoundedRect(pdf, pageWidth - 80, y, 65, 12, 1, 'F');
  setColor(pdf, THEME.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('VALOR TOTAL DA OPERAÇÃO', pageWidth - 76, y + 8);
  pdf.setFontSize(11);
  pdf.text(formatCurrency(data.total), pageWidth - 19, y + 8, { align: 'right' });

  y += 25;

  // --- FOOTER NOTE ---
  setColor(pdf, {r: 241, g: 245, b: 249});
  drawRoundedRect(pdf, margin, y, contentWidth, 20, 1, 'F');
  
  setColor(pdf, THEME.secondaryText);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  const footerText = 'Demonstrativo de cobrança referente à prestação de serviço de pronta resposta. Este documento não substitui a Nota Fiscal, que será emitido conforme os prazos acordados.';
  pdf.text(pdf.splitTextToSize(footerText, contentWidth - 10), margin + 5, y + 8);

  // --- FOOTER ---
  const footerY = pageHeight - 15;
  pdf.setFontSize(7);
  setColor(pdf, THEME.secondaryText);
  pdf.setFont('helvetica', 'normal');
  pdf.text('FALCO PEREGRINUS OPERAÇÕES LOGÍSTICAS - Excelência em Atendimento.', pageWidth / 2, footerY, { align: 'center' });

  // Save PDF
  const fileName = `FATURAMENTO_${data.clientName.replace(/\s+/g, '_')}_${data.ticketCode}.pdf`;
  pdf.save(fileName);
}
