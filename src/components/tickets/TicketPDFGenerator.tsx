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

// Premium color palette - Clean theme matching logo
const COLORS = {
  primary: { r: 18, g: 18, b: 18 },      // Pure black (matching logo background)
  secondary: { r: 40, g: 40, b: 40 },    // Dark gray
  accent: { r: 59, g: 130, b: 246 },     // Blue
  silver: { r: 180, g: 185, b: 195 },    // Silver/steel for accents
  light: { r: 248, g: 250, b: 252 },     // Light gray background
  white: { r: 255, g: 255, b: 255 },
  text: { r: 30, g: 41, b: 59 },
  muted: { r: 100, g: 116, b: 139 },
  cardBg: { r: 255, g: 255, b: 255 },    // White cards
  cardBorder: { r: 226, g: 232, b: 240 }, // Light border
};

interface TicketPDFData {
  code: string | null;
  operator_name: string | null;
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

// Draw a phone icon (handset shape)
const drawPhoneIcon = (pdf: jsPDF, cx: number, cy: number, size: number, color: { r: number; g: number; b: number }) => {
  pdf.setDrawColor(color.r, color.g, color.b);
  pdf.setLineWidth(0.4);
  // Simple phone: circle + receiver lines
  pdf.circle(cx, cy, size, 'S');
  // Receiver inside
  const s = size * 0.5;
  pdf.line(cx - s, cy - s * 0.6, cx - s * 0.3, cy - s);
  pdf.line(cx - s * 0.3, cy - s, cx + s * 0.3, cy + s);
  pdf.line(cx + s * 0.3, cy + s, cx + s, cy + s * 0.6);
};

// Draw a small circle dot icon
const drawDotIcon = (pdf: jsPDF, cx: number, cy: number, r: number, color: { r: number; g: number; b: number }) => {
  pdf.setFillColor(color.r, color.g, color.b);
  pdf.circle(cx, cy, r, 'F');
};

// Draw premium header with logo - Ultra premium design
const drawHeader = async (pdf: jsPDF, pageWidth: number, margin: number, logoImg: string | null): Promise<number> => {
  const headerH = 44;
  
  // Header background - Gradient effect (dark layers)
  pdf.setFillColor(12, 12, 12);
  pdf.rect(0, 0, pageWidth, headerH, 'F');
  
  // Subtle gradient overlay (slightly lighter strip)
  pdf.setFillColor(22, 22, 26);
  pdf.rect(0, headerH * 0.6, pageWidth, headerH * 0.4, 'F');
  
  // Bottom accent line - thin elegant silver
  setColor(pdf, COLORS.silver);
  pdf.rect(0, headerH, pageWidth, 0.4, 'F');
  
  // Logo
  if (logoImg) {
    try {
      pdf.addImage(logoImg, 'PNG', margin + 2, 3, 38, 38);
    } catch (e) {
      console.error('Error adding logo:', e);
    }
  }
  
  // Tagline - elegant italic
  const tagX = logoImg ? margin + 46 : margin;
  setColor(pdf, COLORS.silver);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'italic');
  pdf.text('Pronta Resposta padrao alto  |  Atuacao 24h com rede validada', tagX, 38);
  
  // Contact info on the right with dot bullet icons
  const rightX = pageWidth - margin;
  const dotR = 1;
  const lineSpacing = 6.5;
  let contactY = 9;
  
  const drawContactLine = (text: string, y: number) => {
    // Dot bullet
    drawDotIcon(pdf, rightX - pdf.getTextWidth(text) - 5, y - 0.5, dotR, COLORS.silver);
    // Text
    setColor(pdf, COLORS.white);
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(text, rightX, y, { align: 'right' });
  };
  
  drawContactLine(COMPANY_INFO.phoneCommercial + '  Comercial', contactY);
  contactY += lineSpacing;
  drawContactLine(COMPANY_INFO.phoneMonitoring + '  Monitoramento', contactY);
  contactY += lineSpacing;
  drawContactLine(COMPANY_INFO.email, contactY);
  contactY += lineSpacing;
  drawContactLine(COMPANY_INFO.website, contactY);
  contactY += lineSpacing;
  drawContactLine(COMPANY_INFO.instagram, contactY);
  
  return headerH + 6;
};

// Draw footer - refined and elegant
const drawFooter = (pdf: jsPDF, pageWidth: number, pageHeight: number) => {
  const footerH = 16;
  const footerY = pageHeight - footerH;
  
  // Footer background
  pdf.setFillColor(12, 12, 12);
  pdf.rect(0, footerY, pageWidth, footerH, 'F');
  
  // Top accent line - thin silver
  setColor(pdf, COLORS.silver);
  pdf.rect(0, footerY, pageWidth, 0.3, 'F');
  
  // Left info
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  setColor(pdf, { r: 140, g: 140, b: 150 });
  pdf.text(`CNPJ ${COMPANY_INFO.cnpj}  ·  ${COMPANY_INFO.address}`, 12, footerY + 7);
  
  // Right info
  pdf.text(COMPANY_INFO.website, pageWidth - 12, footerY + 7, { align: 'right' });
  
  // Center
  setColor(pdf, { r: 100, g: 100, b: 110 });
  pdf.setFontSize(5.5);
  pdf.text('Documento gerado automaticamente', pageWidth / 2, footerY + 12, { align: 'center' });
};

// Draw section title - Refined dark bar with silver left accent
const drawSectionTitle = (pdf: jsPDF, title: string, x: number, y: number, width: number): number => {
  // Dark background with rounded corners
  pdf.setFillColor(28, 28, 32);
  drawRoundedRect(pdf, x, y, width, 7.5, 1.5);
  
  // Silver accent bar on left
  setColor(pdf, COLORS.silver);
  pdf.rect(x, y + 0.5, 2.5, 6.5, 'F');
  
  setColor(pdf, COLORS.white);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, x + 6, y + 5.2);
  
  return y + 11;
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

// Draw card-style box - Premium with elegant shadow
const drawCard = (pdf: jsPDF, x: number, y: number, w: number, h: number) => {
  // Multi-layer shadow for depth
  pdf.setFillColor(210, 215, 220);
  drawRoundedRect(pdf, x + 0.6, y + 0.6, w, h, 3);
  pdf.setFillColor(195, 200, 210);
  drawRoundedRect(pdf, x + 0.3, y + 0.3, w, h, 3);
  
  // Card background
  setColor(pdf, COLORS.cardBg);
  drawRoundedRect(pdf, x, y, w, h, 3);
  
  // Border
  pdf.setDrawColor(220, 225, 235);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(x, y, w, h, 3, 3, 'S');
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
  
  // Background - subtle warm gray
  pdf.setFillColor(245, 246, 250);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Header
  let y = await drawHeader(pdf, pageWidth, margin, logoImg);
  
  // Document title - elegant dark bar
  pdf.setFillColor(28, 28, 32);
  drawRoundedRect(pdf, margin, y, contentWidth, 16, 3);
  
  setColor(pdf, COLORS.white);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RELATORIO DE ATENDIMENTO', pageWidth / 2, y + 7.5, { align: 'center' });
  
  // Service type badge - silver pill
  const serviceLabel = serviceTypeLabels[data.service_type] || data.service_type.toUpperCase();
  const badgeWidth = pdf.getTextWidth(serviceLabel) + 10;
  setColor(pdf, COLORS.silver);
  drawRoundedRect(pdf, (pageWidth - badgeWidth) / 2, y + 10, badgeWidth, 5, 2);
  pdf.setFillColor(28, 28, 32);
  pdf.setTextColor(28, 28, 32);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text(serviceLabel, pageWidth / 2, y + 13.5, { align: 'center' });
  
  y += 22;
  
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
  if (data.code) {
    cardY = drawInfoRow(pdf, 'Processo:', data.code, margin + cardPadding, cardY, labelWidth, maxValueWidth);
  }
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
  
  // Card 5: Team & Operator Info (full width)
  drawCard(pdf, margin, y, contentWidth, data.operator_name ? 24 : 18);
  cardY = drawSectionTitle(pdf, 'EQUIPE MOBILIZADA', margin + 2, y + 3, contentWidth - 4);
  
  cardY = drawInfoRow(pdf, 'Efetivo:', calculateEfetivoMobilizado(data), margin + 4, cardY);
  if (data.operator_name) {
    cardY = drawInfoRow(pdf, 'Operador:', data.operator_name, margin + 4, cardY);
  }
  
  y += (data.operator_name ? 30 : 24);
  
  // Footer
  drawFooter(pdf, pageWidth, pageHeight);
  
  // ==================== PAGE 2: DESCRIÇÃO DO EVENTO ====================
  pdf.addPage();
  
  // Background
  pdf.setFillColor(245, 246, 250);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Header
  y = await drawHeader(pdf, pageWidth, margin, logoImg);
  
  // Document title - dark bar
  pdf.setFillColor(28, 28, 32);
  drawRoundedRect(pdf, margin, y, contentWidth, 12, 3);
  setColor(pdf, COLORS.white);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DESCRICAO DO EVENTO', pageWidth / 2, y + 8, { align: 'center' });
  
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
        
         pdf.setFillColor(245, 246, 250);
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
  
  // ==================== PAGE 3+: PHOTOS (2x2 grid, 4 per page) ====================
  if (data.photos && data.photos.length > 0) {
    const photosPerPage = 4;
    const totalPages = Math.ceil(data.photos.length / photosPerPage);
    
    // Fixed grid dimensions for uniform alignment
    const gapX = 8; // horizontal gap between photos
    const gapY = 10; // vertical gap between rows (photo + caption)
    const photoWidth = (contentWidth - gapX) / 2;
    const photoHeight = photoWidth * 0.6; // 5:3 landscape ratio
    const captionHeight = 7; // reserved space for caption below photo
    const cellHeight = photoHeight + captionHeight + gapY;
    
    for (let page = 0; page < totalPages; page++) {
      pdf.addPage();
      
      // Background
      pdf.setFillColor(245, 246, 250);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      
      // Header
      y = await drawHeader(pdf, pageWidth, margin, logoImg);
      
      // Title - dark bar
      pdf.setFillColor(28, 28, 32);
      drawRoundedRect(pdf, margin, y, contentWidth, 12, 3);
      setColor(pdf, COLORS.white);
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text('REGISTRO FOTOGRAFICO', pageWidth / 2, y + 8, { align: 'center' });
      
      // Page counter
      setColor(pdf, COLORS.muted);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Pagina ${page + 1} de ${totalPages}  ·  Fotos ${page * photosPerPage + 1} a ${Math.min((page + 1) * photosPerPage, data.photos.length)} de ${data.photos.length}`, pageWidth / 2, y + 16, { align: 'center' });
      
      y += 22;
      
      const startIdx = page * photosPerPage;
      const endIdx = Math.min(startIdx + photosPerPage, data.photos.length);
      
      for (let i = startIdx; i < endIdx; i++) {
        const photo = data.photos[i];
        const localIdx = i - startIdx;
        const col = localIdx % 2;
        const row = Math.floor(localIdx / 2);
        
        const x = margin + col * (photoWidth + gapX);
        const photoY = y + row * cellHeight;
        
        try {
          // Photo frame with subtle shadow
          pdf.setFillColor(200, 200, 200);
          drawRoundedRect(pdf, x + 1, photoY + 1, photoWidth, photoHeight, 3);
          
          // White background
          setColor(pdf, COLORS.white);
          drawRoundedRect(pdf, x, photoY, photoWidth, photoHeight, 3);
          
          // Load and add image - uniform padding
          const img = await loadImage(photo.file_url);
          const imgPad = 2;
          pdf.addImage(img, 'JPEG', x + imgPad, photoY + imgPad, photoWidth - imgPad * 2, photoHeight - imgPad * 2);
          
          // Border
          pdf.setDrawColor(COLORS.cardBorder.r, COLORS.cardBorder.g, COLORS.cardBorder.b);
          pdf.setLineWidth(0.5);
          pdf.roundedRect(x, photoY, photoWidth, photoHeight, 3, 3, 'S');
          
          // Caption below photo - fixed position
          if (photo.caption) {
            setColor(pdf, COLORS.muted);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'italic');
            const captionLines = pdf.splitTextToSize(photo.caption, photoWidth - 4);
            pdf.text(captionLines[0], x + photoWidth / 2, photoY + photoHeight + 4, { align: 'center' });
          }
          
          // Photo number badge - dark circle
          pdf.setFillColor(28, 28, 32);
          pdf.circle(x + 6.5, photoY + 6.5, 4, 'F');
          setColor(pdf, COLORS.white);
          pdf.setFontSize(6.5);
          pdf.setFont('helvetica', 'bold');
          pdf.text((i + 1).toString(), x + 6.5, photoY + 8, { align: 'center' });
          
        } catch (error) {
          console.error('Erro ao carregar imagem:', error);
          
          // Placeholder
          setColor(pdf, COLORS.light);
          drawRoundedRect(pdf, x, photoY, photoWidth, photoHeight, 3);
          pdf.setDrawColor(200, 200, 200);
          pdf.roundedRect(x, photoY, photoWidth, photoHeight, 3, 3, 'S');
          
          setColor(pdf, COLORS.muted);
          pdf.setFontSize(9);
          pdf.text('Imagem não disponível', x + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
        }
      }
      
      // Footer
      drawFooter(pdf, pageWidth, pageHeight);
    }
  }
  
  // Save PDF
  pdf.save(`Relatorio_${data.code || 'Atendimento'}.pdf`);
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
