import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Company data
const COMPANY_INFO = {
  name: 'FDG PRONTA RESPOSTA',
  cnpj: '59.355.128/0001-10',
  address: 'R. Dona Francisca, 801 Sala 05 - Saguaçu, Joinville - SC, 89221-006',
  phoneCommercial: '(47) 99135-6830',
  phoneMonitoring: '(47) 99160-7491',
  email: 'contato@fdgprontaresposta.com.br',
  instagram: '@fdgprontaresposta',
  website: 'www.fdgprontaresposta.com.br',
};

// Premium color palette - Black theme matching logo
const COLORS = {
  primary: { r: 18, g: 18, b: 18 },      // Pure black (matching logo background)
  secondary: { r: 40, g: 40, b: 40 },    // Dark gray
  accent: { r: 59, g: 130, b: 246 },     // Blue
  gold: { r: 212, g: 175, b: 55 },       // Premium gold
  silver: { r: 192, g: 192, b: 192 },    // Silver for icons
  light: { r: 248, g: 250, b: 252 },     // Light gray background
  white: { r: 255, g: 255, b: 255 },
  text: { r: 30, g: 41, b: 59 },
  muted: { r: 100, g: 116, b: 139 },
  cardBg: { r: 255, g: 255, b: 255 },    // White cards
  cardBorder: { r: 226, g: 232, b: 240 }, // Light border
};

interface TicketPDFData {
  code: string;
  status: string;
  city: string;
  state: string;
  start_datetime: string;
  end_datetime: string | null;
  coordinates_lat: number | null;
  coordinates_lng: number | null;
  km_start: number | null;
  km_end: number | null;
  toll_cost: number | null;
  food_cost: number | null;
  other_costs: number | null;
  total_cost: number | null;
  duration_minutes: number | null;
  detailed_report: string | null;
  service_type: string;
  client: {
    name: string;
    contact_phone: string | null;
  };
  agent: {
    name: string;
    is_armed: boolean | null;
  };
  support_agent_1?: {
    name: string;
    is_armed: boolean | null;
  } | null;
  support_agent_2?: {
    name: string;
    is_armed: boolean | null;
  } | null;
  vehicle: {
    description: string;
    tractor_plate: string | null;
    tractor_brand: string | null;
    tractor_model: string | null;
    trailer1_plate: string | null;
    trailer1_body_type: string | null;
    trailer2_plate: string | null;
    trailer2_body_type: string | null;
    trailer3_plate: string | null;
    trailer3_body_type: string | null;
  };
  plan: {
    name: string;
  };
  photos: Array<{
    file_url: string;
    caption: string | null;
  }>;
}

const serviceTypeLabels: Record<string, string> = {
  alarme: 'ALARME',
  averiguacao: 'AVERIGUAÇÃO',
  preservacao: 'PRESERVAÇÃO',
  acompanhamento_logistico: 'ACOMPANHAMENTO LOGÍSTICO',
};

const bodyTypeLabels: Record<string, string> = {
  grade_baixa: 'Grade Baixa',
  grade_alta: 'Grade Alta',
  bau: 'Baú',
  sider: 'Sider',
  frigorifico: 'Frigorífico',
  container: 'Contêiner',
  prancha: 'Prancha',
};

const formatDurationText = (minutes: number | null): string => {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minutos`;
  if (mins === 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
  return `${hours}h ${mins}min`;
};

const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
};

const calculateEfetivoMobilizado = (data: TicketPDFData): string => {
  let armados = 0;
  let desarmados = 0;

  if (data.agent) {
    if (data.agent.is_armed) armados++;
    else desarmados++;
  }

  if (data.support_agent_1) {
    if (data.support_agent_1.is_armed) armados++;
    else desarmados++;
  }

  if (data.support_agent_2) {
    if (data.support_agent_2.is_armed) armados++;
    else desarmados++;
  }

  const parts: string[] = [];
  
  if (armados > 0) {
    parts.push(`${armados.toString().padStart(2, '0')} agente${armados > 1 ? 's' : ''} armado${armados > 1 ? 's' : ''}`);
  }
  
  if (desarmados > 0) {
    parts.push(`${desarmados.toString().padStart(2, '0')} agente${desarmados > 1 ? 's' : ''} desarmado${desarmados > 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? parts.join(' + ') : '-';
};

// Helper to draw rounded rectangle
const drawRoundedRect = (pdf: jsPDF, x: number, y: number, w: number, h: number, r: number, fill = true, stroke = false) => {
  pdf.roundedRect(x, y, w, h, r, r, fill ? 'F' : stroke ? 'S' : 'FD');
};

// Helper to set color
const setColor = (pdf: jsPDF, color: { r: number; g: number; b: number }) => {
  pdf.setFillColor(color.r, color.g, color.b);
  pdf.setDrawColor(color.r, color.g, color.b);
  pdf.setTextColor(color.r, color.g, color.b);
};

// Draw premium header with logo - Black theme with icons
const drawHeader = async (pdf: jsPDF, pageWidth: number, margin: number, logoImg: string | null): Promise<number> => {
  // Premium header background - Pure black matching logo
  setColor(pdf, COLORS.primary);
  pdf.rect(0, 0, pageWidth, 48, 'F');
  
  // Bottom accent line - Gold
  setColor(pdf, COLORS.gold);
  pdf.rect(0, 48, pageWidth, 1.5, 'F');
  
  // Logo with background highlight
  if (logoImg) {
    try {
      // Logo area
      pdf.addImage(logoImg, 'PNG', margin, 4, 40, 40);
    } catch (e) {
      console.error('Error adding logo:', e);
    }
  }
  
  // Company name - Large and bold
  const textStartX = logoImg ? margin + 48 : margin;
  setColor(pdf, COLORS.white);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('FDG PRONTA RESPOSTA', textStartX, 18);
  
  // Tagline with gold color
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  setColor(pdf, COLORS.gold);
  pdf.text('Segurança e Monitoramento de Cargas', textStartX, 26);
  
  // Contact info on the right - With icons (using symbols)
  const rightX = pageWidth - margin;
  const iconOffset = 3;
  
  pdf.setFontSize(8);
  
  // Phone Commercial - with icon
  setColor(pdf, COLORS.gold);
  pdf.setFont('helvetica', 'bold');
  pdf.text('☎', rightX - pdf.getTextWidth(COMPANY_INFO.phoneCommercial + ' (Comercial)') - iconOffset, 12);
  setColor(pdf, COLORS.white);
  pdf.setFont('helvetica', 'normal');
  pdf.text(COMPANY_INFO.phoneCommercial + ' (Comercial)', rightX, 12, { align: 'right' });
  
  // Phone Monitoring - with icon
  setColor(pdf, COLORS.gold);
  pdf.setFont('helvetica', 'bold');
  pdf.text('☎', rightX - pdf.getTextWidth(COMPANY_INFO.phoneMonitoring + ' (Monitoramento)') - iconOffset, 19);
  setColor(pdf, COLORS.white);
  pdf.setFont('helvetica', 'normal');
  pdf.text(COMPANY_INFO.phoneMonitoring + ' (Monitoramento)', rightX, 19, { align: 'right' });
  
  // Email - with icon
  setColor(pdf, COLORS.gold);
  pdf.setFont('helvetica', 'bold');
  pdf.text('✉', rightX - pdf.getTextWidth(COMPANY_INFO.email) - iconOffset, 26);
  setColor(pdf, COLORS.white);
  pdf.setFont('helvetica', 'normal');
  pdf.text(COMPANY_INFO.email, rightX, 26, { align: 'right' });
  
  // Website - with icon
  setColor(pdf, COLORS.gold);
  pdf.setFont('helvetica', 'bold');
  pdf.text('🌐', rightX - pdf.getTextWidth(COMPANY_INFO.website) - iconOffset, 33);
  setColor(pdf, COLORS.white);
  pdf.setFont('helvetica', 'normal');
  pdf.text(COMPANY_INFO.website, rightX, 33, { align: 'right' });
  
  // Instagram - with icon
  setColor(pdf, COLORS.gold);
  pdf.setFont('helvetica', 'bold');
  pdf.text('📷', rightX - pdf.getTextWidth(COMPANY_INFO.instagram) - iconOffset, 40);
  setColor(pdf, COLORS.white);
  pdf.setFont('helvetica', 'normal');
  pdf.text(COMPANY_INFO.instagram, rightX, 40, { align: 'right' });
  
  return 58;
};

// Draw footer
const drawFooter = (pdf: jsPDF, pageWidth: number, pageHeight: number) => {
  const footerY = pageHeight - 20;
  
  // Footer background
  setColor(pdf, COLORS.primary);
  pdf.rect(0, footerY, pageWidth, 20, 'F');
  
  // Accent line
  setColor(pdf, COLORS.gold);
  pdf.rect(0, footerY, pageWidth, 1, 'F');
  
  // Footer text
  setColor(pdf, COLORS.white);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  
  pdf.text(`CNPJ: ${COMPANY_INFO.cnpj}`, 15, footerY + 8);
  pdf.text(COMPANY_INFO.address, 15, footerY + 13);
  
  pdf.text('Documento gerado automaticamente pelo sistema FDG', pageWidth / 2, footerY + 10, { align: 'center' });
  
  pdf.text(`${COMPANY_INFO.website}`, pageWidth - 15, footerY + 10, { align: 'right' });
};

// Draw section title - Black background matching header
const drawSectionTitle = (pdf: jsPDF, title: string, x: number, y: number, width: number): number => {
  setColor(pdf, COLORS.primary);
  drawRoundedRect(pdf, x, y, width, 8, 2);
  
  // Gold accent line on left
  setColor(pdf, COLORS.gold);
  pdf.rect(x, y, 3, 8, 'F');
  
  setColor(pdf, COLORS.white);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, x + 6, y + 5.5);
  
  return y + 12;
};

// Draw info row with label and value - Fixed width handling
const drawInfoRow = (pdf: jsPDF, label: string, value: string, x: number, y: number, labelWidth: number = 35, maxValueWidth: number = 50): number => {
  setColor(pdf, COLORS.muted);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(label, x, y);
  
  setColor(pdf, COLORS.text);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  
  // Truncate value if too long
  let displayValue = value || '-';
  const valueWidth = pdf.getTextWidth(displayValue);
  if (valueWidth > maxValueWidth) {
    while (pdf.getTextWidth(displayValue + '...') > maxValueWidth && displayValue.length > 0) {
      displayValue = displayValue.slice(0, -1);
    }
    displayValue += '...';
  }
  
  pdf.text(displayValue, x + labelWidth, y);
  
  return y + 5.5;
};

// Draw card-style box - Premium with subtle shadow
const drawCard = (pdf: jsPDF, x: number, y: number, w: number, h: number) => {
  // Subtle shadow effect
  pdf.setFillColor(180, 180, 180);
  drawRoundedRect(pdf, x + 0.8, y + 0.8, w, h, 4);
  
  // Card background - Pure white
  setColor(pdf, COLORS.cardBg);
  drawRoundedRect(pdf, x, y, w, h, 4);
  
  // Border - Subtle
  pdf.setDrawColor(COLORS.cardBorder.r, COLORS.cardBorder.g, COLORS.cardBorder.b);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, h, 4, 4, 'S');
};

export async function generateTicketPDF(data: TicketPDFData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;
  
  // Load logo
  let logoImg: string | null = null;
  try {
    logoImg = await loadImage('/logo-fdg.png');
  } catch (e) {
    console.error('Error loading logo:', e);
  }
  
  // ==================== PAGE 1: RELATÓRIO DE ATENDIMENTO ====================
  
  // Background
  setColor(pdf, COLORS.light);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Header
  let y = await drawHeader(pdf, pageWidth, margin, logoImg);
  
  // Document title card
  drawCard(pdf, margin, y, contentWidth, 18);
  
  setColor(pdf, COLORS.primary);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RELATÓRIO DE ATENDIMENTO', pageWidth / 2, y + 8, { align: 'center' });
  
  // Service type badge
  setColor(pdf, COLORS.accent);
  const serviceLabel = serviceTypeLabels[data.service_type] || data.service_type.toUpperCase();
  const badgeWidth = pdf.getTextWidth(serviceLabel) + 8;
  drawRoundedRect(pdf, (pageWidth - badgeWidth) / 2, y + 10.5, badgeWidth, 6, 2);
  setColor(pdf, COLORS.white);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text(serviceLabel, pageWidth / 2, y + 14.5, { align: 'center' });
  
  y += 25;
  
  // Main info cards row - Better spacing
  const cardWidth = (contentWidth - 8) / 2;
  const cardPadding = 4;
  const labelWidth = 32;
  const maxValueWidth = cardWidth - labelWidth - cardPadding * 2 - 8;
  
  // Card 1: Client Info
  drawCard(pdf, margin, y, cardWidth, 36);
  let cardY = drawSectionTitle(pdf, 'SOLICITANTE', margin + 2, y + 3, cardWidth - 4);
  cardY = drawInfoRow(pdf, 'Cliente:', data.client.name, margin + cardPadding, cardY, labelWidth, maxValueWidth);
  cardY = drawInfoRow(pdf, 'Contato:', data.client.contact_phone || '-', margin + cardPadding, cardY, labelWidth, maxValueWidth);
  cardY = drawInfoRow(pdf, 'Processo:', data.code, margin + cardPadding, cardY, labelWidth, maxValueWidth);
  cardY = drawInfoRow(pdf, 'Plano:', data.plan.name, margin + cardPadding, cardY, labelWidth, maxValueWidth);
  
  // Card 2: Location Info
  const card2X = margin + cardWidth + 8;
  drawCard(pdf, card2X, y, cardWidth, 36);
  cardY = drawSectionTitle(pdf, 'LOCALIZAÇÃO', card2X + 2, y + 3, cardWidth - 4);
  cardY = drawInfoRow(pdf, 'Cidade/UF:', `${data.city}/${data.state}`, card2X + cardPadding, cardY, labelWidth, maxValueWidth);
  cardY = drawInfoRow(pdf, 'Coordenadas:', 
    data.coordinates_lat && data.coordinates_lng 
      ? `${data.coordinates_lat.toFixed(6)}, ${data.coordinates_lng.toFixed(6)}` 
      : '-', 
    card2X + cardPadding, cardY, 42, maxValueWidth);
  
  y += 42;
  
  // Card 3: Date/Time Info
  drawCard(pdf, margin, y, cardWidth, 36);
  cardY = drawSectionTitle(pdf, 'DATA E HORA', margin + 2, y + 3, cardWidth - 4);
  
  if (data.start_datetime) {
    const startDate = new Date(data.start_datetime);
    cardY = drawInfoRow(pdf, 'Início:', format(startDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), margin + cardPadding, cardY, labelWidth, maxValueWidth);
  }
  
  if (data.end_datetime) {
    const endDate = new Date(data.end_datetime);
    cardY = drawInfoRow(pdf, 'Término:', format(endDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), margin + cardPadding, cardY, labelWidth, maxValueWidth);
  }
  
  cardY = drawInfoRow(pdf, 'Duração:', formatDurationText(data.duration_minutes), margin + cardPadding, cardY, labelWidth, maxValueWidth);
  cardY = drawInfoRow(pdf, 'KM Rodado:', 
    data.km_start && data.km_end ? `${data.km_end - data.km_start} km` : '-', 
    margin + cardPadding, cardY, labelWidth, maxValueWidth);
  
  // Card 4: Vehicle Info
  drawCard(pdf, card2X, y, cardWidth, 36);
  cardY = drawSectionTitle(pdf, 'VEÍCULO', card2X + 2, y + 3, cardWidth - 4);
  cardY = drawInfoRow(pdf, 'Descrição:', data.vehicle.description, card2X + cardPadding, cardY, labelWidth, maxValueWidth);
  
  if (data.vehicle.tractor_plate) {
    cardY = drawInfoRow(pdf, 'Cavalo:', 
      `${data.vehicle.tractor_plate}${data.vehicle.tractor_brand ? ' - ' + data.vehicle.tractor_brand : ''}${data.vehicle.tractor_model ? ' ' + data.vehicle.tractor_model : ''}`,
      card2X + cardPadding, cardY, labelWidth, maxValueWidth);
  }
  
  if (data.vehicle.trailer1_plate) {
    cardY = drawInfoRow(pdf, 'Carreta 1:', 
      `${data.vehicle.trailer1_plate} (${bodyTypeLabels[data.vehicle.trailer1_body_type || ''] || data.vehicle.trailer1_body_type || '-'})`,
      card2X + cardPadding, cardY, labelWidth, maxValueWidth);
  }
  
  if (data.vehicle.trailer2_plate) {
    cardY = drawInfoRow(pdf, 'Carreta 2:', 
      `${data.vehicle.trailer2_plate} (${bodyTypeLabels[data.vehicle.trailer2_body_type || ''] || data.vehicle.trailer2_body_type || '-'})`,
      card2X + cardPadding, cardY, labelWidth, maxValueWidth);
  }
  
  y += 42;
  
  // Card 5: Team Info (full width) - Only showing count, no names
  drawCard(pdf, margin, y, contentWidth, 18);
  cardY = drawSectionTitle(pdf, 'EQUIPE MOBILIZADA', margin + 2, y + 3, contentWidth - 4);
  
  cardY = drawInfoRow(pdf, 'Efetivo:', calculateEfetivoMobilizado(data), margin + 4, cardY);
  
  y += 24;
  
  // Footer
  drawFooter(pdf, pageWidth, pageHeight);
  
  // ==================== PAGE 2: DESCRIÇÃO DO EVENTO ====================
  pdf.addPage();
  
  // Background
  setColor(pdf, COLORS.light);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Header
  y = await drawHeader(pdf, pageWidth, margin, logoImg);
  
  // Document title
  drawCard(pdf, margin, y, contentWidth, 12);
  setColor(pdf, COLORS.primary);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DESCRIÇÃO DO EVENTO', pageWidth / 2, y + 8, { align: 'center' });
  
  y += 18;
  
  // Subtitle with service type
  setColor(pdf, COLORS.secondary);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'italic');
  pdf.text(`Relato de Atendimento – ${serviceTypeLabels[data.service_type] || data.service_type.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
  
  y += 10;
  
  // Detailed report card
  if (data.detailed_report) {
    const reportCardHeight = Math.min(pageHeight - y - 30, 180); // Max height before footer
    drawCard(pdf, margin, y, contentWidth, reportCardHeight);
    
    cardY = drawSectionTitle(pdf, 'RELATÓRIO DETALHADO', margin + 2, y + 3, contentWidth - 4);
    
    setColor(pdf, COLORS.text);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    const lines = pdf.splitTextToSize(data.detailed_report, contentWidth - 10);
    let textY = cardY + 2;
    
    for (const line of lines) {
      if (textY > y + reportCardHeight - 10) {
        // Need new page
        drawFooter(pdf, pageWidth, pageHeight);
        pdf.addPage();
        
        setColor(pdf, COLORS.light);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        
        y = await drawHeader(pdf, pageWidth, margin, logoImg);
        
        drawCard(pdf, margin, y, contentWidth, pageHeight - y - 30);
        textY = y + 8;
        
        setColor(pdf, COLORS.text);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
      }
      
      pdf.text(line, margin + 5, textY);
      textY += 5;
    }
  }
  
  // Footer
  drawFooter(pdf, pageWidth, pageHeight);
  
  // ==================== PAGE 3+: PHOTOS (2x2 grid) ====================
  if (data.photos && data.photos.length > 0) {
    pdf.addPage();
    
    // Background
    setColor(pdf, COLORS.light);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Header
    y = await drawHeader(pdf, pageWidth, margin, logoImg);
    
    // Title
    drawCard(pdf, margin, y, contentWidth, 12);
    setColor(pdf, COLORS.primary);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('REGISTRO FOTOGRÁFICO', pageWidth / 2, y + 8, { align: 'center' });
    
    y += 18;
    
    const photoWidth = (contentWidth - 8) / 2;
    const photoHeight = photoWidth * 0.6; // Landscape ratio
    let photoIndex = 0;
    
    for (let i = 0; i < data.photos.length; i++) {
      const photo = data.photos[i];
      const col = photoIndex % 2;
      const row = Math.floor(photoIndex % 4 / 2);
      
      const x = margin + col * (photoWidth + 8);
      const photoY = y + row * (photoHeight + 18);
      
      // Check if we need a new page
      if (photoY + photoHeight + 18 > pageHeight - 30) {
        drawFooter(pdf, pageWidth, pageHeight);
        pdf.addPage();
        
        setColor(pdf, COLORS.light);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        
        y = await drawHeader(pdf, pageWidth, margin, logoImg);
        photoIndex = 0;
        i--; // Retry this photo on new page
        continue;
      }
      
      try {
        // Photo frame with shadow
        pdf.setFillColor(180, 180, 180);
        drawRoundedRect(pdf, x + 2, photoY + 2, photoWidth, photoHeight, 3);
        
        setColor(pdf, COLORS.white);
        drawRoundedRect(pdf, x, photoY, photoWidth, photoHeight, 3);
        
        // Load and add image
        const img = await loadImage(photo.file_url);
        
        // Clip rounded corners effect (simple rectangle for jspdf)
        pdf.addImage(img, 'JPEG', x + 2, photoY + 2, photoWidth - 4, photoHeight - 4);
        
        // Photo border
        pdf.setDrawColor(COLORS.light.r, COLORS.light.g, COLORS.light.b);
        pdf.setLineWidth(1);
        pdf.roundedRect(x, photoY, photoWidth, photoHeight, 3, 3, 'S');
        
        // Caption
        if (photo.caption) {
          setColor(pdf, COLORS.muted);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'italic');
          const captionLines = pdf.splitTextToSize(photo.caption, photoWidth - 4);
          pdf.text(captionLines[0], x + photoWidth / 2, photoY + photoHeight + 5, { align: 'center' });
        }
        
        // Photo number badge
        setColor(pdf, COLORS.accent);
        pdf.circle(x + 8, photoY + 8, 5, 'F');
        setColor(pdf, COLORS.white);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text((i + 1).toString(), x + 8, photoY + 9.5, { align: 'center' });
        
      } catch (error) {
        console.error('Erro ao carregar imagem:', error);
        
        // Placeholder for failed image
        setColor(pdf, COLORS.light);
        drawRoundedRect(pdf, x, photoY, photoWidth, photoHeight, 3);
        
        pdf.setDrawColor(200, 200, 200);
        pdf.roundedRect(x, photoY, photoWidth, photoHeight, 3, 3, 'S');
        
        setColor(pdf, COLORS.muted);
        pdf.setFontSize(9);
        pdf.text('Imagem não disponível', x + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
      }
      
      photoIndex++;
      
      // New page every 4 photos
      if (photoIndex % 4 === 0 && i < data.photos.length - 1) {
        drawFooter(pdf, pageWidth, pageHeight);
        pdf.addPage();
        
        setColor(pdf, COLORS.light);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        
        y = await drawHeader(pdf, pageWidth, margin, logoImg);
      }
    }
    
    // Footer for last photo page
    drawFooter(pdf, pageWidth, pageHeight);
  }
  
  // Save PDF
  pdf.save(`Relatorio_${data.code}.pdf`);
}

async function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export type { TicketPDFData };
