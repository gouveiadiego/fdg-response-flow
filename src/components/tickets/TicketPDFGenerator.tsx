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

// Premium Brand Theme
const THEME = {
  // Brand Colors
  primary: { r: 18, g: 18, b: 18 },      // #121212 (Near Black - Logo Style)
  dark: { r: 10, g: 10, b: 10 },         // #0A0A0A (Pure Dark)

  // UI Colors
  text: { r: 30, g: 41, b: 59 },         // Slate 800
  secondaryText: { r: 100, g: 116, b: 139 }, // Slate 500
  background: { r: 248, g: 250, b: 252 }, // Slate 50 (Very light gray page background)
  cardBg: { r: 255, g: 255, b: 255 },    // White (Cards)
  border: { r: 226, g: 232, b: 240 },    // Slate 200
  white: { r: 255, g: 255, b: 255 },

  // Shadows
  shadow: { r: 203, g: 213, b: 225 },    // Slate 300
  success: { r: 34, g: 197, b: 94 },     // Emerald 500
  warning: { r: 245, g: 158, b: 11 },    // Amber 500
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
  alarme: 'Alarme',
  averiguacao: 'Averiguação',
  preservacao: 'Preservação',
  acompanhamento_logistico: 'Acompanhamento Logístico',
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

// Start Helpers
const setColor = (pdf: jsPDF, color: { r: number; g: number; b: number }) => {
  pdf.setFillColor(color.r, color.g, color.b);
  pdf.setDrawColor(color.r, color.g, color.b);
  pdf.setTextColor(color.r, color.g, color.b);
};

const formatDurationText = (minutes: number | null): string => {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours}h ${mins}m`;
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
  if (armados > 0) parts.push(`${armados} Armado${armados > 1 ? 's' : ''}`);
  if (desarmados > 0) parts.push(`${desarmados} Desarmado${desarmados > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(' + ') : '-';
};

// Graphics & Icons
const drawRoundedRect = (pdf: jsPDF, x: number, y: number, w: number, h: number, r: number, style: string = 'F') => {
  pdf.roundedRect(x, y, w, h, r, r, style);
};

const drawShadowRect = (pdf: jsPDF, x: number, y: number, w: number, h: number, r: number) => {
  pdf.setGState(new (pdf as any).GState({ opacity: 0.1 }));
  setColor(pdf, { r: 0, g: 0, b: 0 }); // Black but semi-transparent for realism
  drawRoundedRect(pdf, x + 1, y + 1, w, h, r, 'F');
  pdf.setGState(new (pdf as any).GState({ opacity: 1.0 }));
};

const drawIconPhone = (pdf: jsPDF, x: number, y: number, color: { r: number, g: number, b: number }) => {
  setColor(pdf, color);
  pdf.setLineWidth(0.3);

  // Phone body - Smaller
  pdf.roundedRect(x, y, 3, 4.5, 0.4, 0.4, 'S');
  // Screen line
  pdf.line(x + 0.8, y + 0.6, x + 2.2, y + 0.6);
  // Bottom button
  pdf.circle(x + 1.5, y + 3.9, 0.2, 'F');
};

const drawIconEmail = (pdf: jsPDF, x: number, y: number, color: { r: number, g: number, b: number }) => {
  setColor(pdf, color);
  pdf.setLineWidth(0.3);
  // Envelope body - Smaller
  pdf.rect(x, y + 1, 4, 2.8, 'S');
  // Envelope flap
  pdf.line(x, y + 1, x + 2, y + 2.4);
  pdf.line(x + 4, y + 1, x + 2, y + 2.4);
};

const drawIconGlobe = (pdf: jsPDF, x: number, y: number, color: { r: number, g: number, b: number }) => {
  setColor(pdf, color);
  pdf.setLineWidth(0.3);
  const r = 2; // Smaller radius
  const cx = x + r;
  const cy = y + r;

  pdf.circle(cx, cy, r, 'S');
  pdf.line(x, cy, x + (r * 2), cy); // Equator
  pdf.line(cx, y, cx, y + (r * 2)); // Meridian
};

// Main Drawing Functions
const drawPremiumHeader = async (
  pdf: jsPDF,
  pageWidth: number,
  logo: { dataUrl: string; width: number; height: number } | null,
  bg: { dataUrl: string; width: number; height: number } | null
): Promise<number> => {
  const headerH = 45; // Tall, impactful header

  // Background - Use local luxury image if available, else fallback to solid black
  if (bg) {
    try {
      // Background should COVER the header area without stretching
      const imgRatio = bg.width / bg.height;
      const targetRatio = pageWidth / headerH;

      let drawW, drawH, offsetX = 0, offsetY = 0;
      if (imgRatio > targetRatio) {
        // Image is wider than needed
        drawH = headerH;
        drawW = headerH * imgRatio;
        offsetX = (pageWidth - drawW) / 2;
      } else {
        // Image is taller than needed
        drawW = pageWidth;
        drawH = pageWidth / imgRatio;
        offsetY = (headerH - drawH) / 2;
      }

      pdf.addImage(bg.dataUrl, 'PNG', offsetX, offsetY, drawW, drawH);
    } catch (e) {
      console.error('Error adding header background:', e);
      setColor(pdf, THEME.primary);
      pdf.rect(0, 0, pageWidth, headerH, 'F');
    }
  } else {
    setColor(pdf, THEME.primary);
    pdf.rect(0, 0, pageWidth, headerH, 'F');
  }

  const margin = 15;

  // Logo Area - Integrated directly on black background
  if (logo) {
    try {
      // Maintain aspect ratio for logo
      const logoMaxW = 35;
      const logoMaxH = 35;
      const logoRatio = logo.width / logo.height;

      let finalW, finalH;
      if (logoRatio > 1) {
        finalW = logoMaxW;
        finalH = logoMaxW / logoRatio;
      } else {
        finalH = logoMaxH;
        finalW = logoMaxH * logoRatio;
      }

      // Center logo vertically in the header (using some padding)
      const logoY = (headerH - finalH) / 2;
      pdf.addImage(logo.dataUrl, 'PNG', margin, logoY, finalW, finalH);
    } catch (e) {
      console.error('Error adding logo:', e);
    }
  }

  // Title & Subtitle - Aligned with logo presence
  const textStartX = margin + 40;
  setColor(pdf, THEME.white);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('RELATÓRIO DE ATENDIMENTO', textStartX, 18);

  // Motto / Phrase - New
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8.5);
  pdf.setGState(new (pdf as any).GState({ opacity: 0.8 }));
  pdf.text('Pronta Resposta padrão alto | Atuação 24h com rede validada.', textStartX, 23);
  pdf.setGState(new (pdf as any).GState({ opacity: 1.0 }));


  // Contact Info - Refined and grouped
  const iconY = 34;
  const gap = 38;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);

  let currentX = textStartX;

  // Phone
  drawIconPhone(pdf, currentX, iconY - 3.5, THEME.white);
  pdf.text(COMPANY_INFO.phoneCommercial, currentX + 5, iconY);

  // Email
  currentX += (gap - 2);
  drawIconEmail(pdf, currentX, iconY - 3.5, THEME.white);
  pdf.text('contato@fdgprontaresposta.com.br', currentX + 6, iconY);

  // Website
  currentX += (gap + 15);
  if (currentX + 30 < pageWidth) {
    drawIconGlobe(pdf, currentX, iconY - 3.5, THEME.white);
    pdf.text('www.fdgprontaresposta.com.br', currentX + 6, iconY);
  }

  return headerH + 10;
};

const drawFooter = (pdf: jsPDF, pageWidth: number, pageHeight: number) => {
  const footerH = 12;
  const y = pageHeight - footerH;

  // Footer Background
  setColor(pdf, THEME.dark);
  pdf.rect(0, y, pageWidth, footerH, 'F');

  // Text
  setColor(pdf, THEME.secondaryText); // actually light gray on dark bg
  pdf.setTextColor(200, 200, 200);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    `${COMPANY_INFO.name}  •  CNPJ ${COMPANY_INFO.cnpj}  •  ${COMPANY_INFO.address}`,
    pageWidth / 2,
    y + 8,
    { align: 'center' }
  );
};

const drawCard = (pdf: jsPDF, x: number, y: number, w: number, h: number, title: string) => {
  // Shadow
  drawShadowRect(pdf, x, y, w, h, 2);

  // Main background
  setColor(pdf, THEME.cardBg);
  drawRoundedRect(pdf, x, y, w, h, 2, 'F');

  // Header strip
  setColor(pdf, THEME.dark);
  pdf.path([
    { op: 'm', c: [x, y + 8] },
    { op: 'l', c: [x, y + 2] },
    { op: 'c', c: [x, y, x, y, x + 2, y] }, // top-left corner
    { op: 'l', c: [x + w - 2, y] },
    { op: 'c', c: [x + w, y, x + w, y, x + w, y + 2] }, // top-right
    { op: 'l', c: [x + w, y + 8] },
    { op: 'l', c: [x, y + 8] }, // close
  ]).fill();

  // Highlight line
  setColor(pdf, THEME.primary);
  pdf.rect(x, y + 8, w, 0.8, 'F');

  // Title
  setColor(pdf, THEME.white);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title.toUpperCase(), x + 4, y + 5.5);
};

const drawField = (
  pdf: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number
): number => {
  setColor(pdf, THEME.secondaryText);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text(label.toUpperCase(), x, y);

  setColor(pdf, THEME.text);
  pdf.setFontSize(9.5);
  pdf.setFont('helvetica', 'normal');

  // Check width
  let displayValue = value || '-';
  if (pdf.getTextWidth(displayValue) > w) {
    const lines = pdf.splitTextToSize(displayValue, w);
    pdf.text(lines[0] + '...', x, y + 4.5);
  } else {
    pdf.text(displayValue, x, y + 4.5);
  }

  return y + 10; // line height
};

export async function generateTicketPDF(data: TicketPDFData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // Set page background color (visual only, drawing huge rect)
  setColor(pdf, THEME.background);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Load assets
  let logoImg: { dataUrl: string; width: number; height: number } | null = null;
  let headerBgImg: { dataUrl: string; width: number; height: number } | null = null;
  try {
    logoImg = await loadImage('/logo-fdg-premium.png');
    headerBgImg = await loadImage('/header-luxury-bg.png');
  } catch (e) {
    console.error('Error loading PDF assets:', e);
    // Fallback to simpler logo if premium fails
    try {
      logoImg = await loadImage('/logo-fdg.png');
    } catch (fe) { }
  }

  // ==================== PAGE 1 ====================
  let y = await drawPremiumHeader(pdf, pageWidth, logoImg, headerBgImg);

  // Summary Banner (Floating Card) with Status
  const summaryH = 25;
  const summaryY = y;

  // Draw Status Badge style card
  drawShadowRect(pdf, margin, summaryY, contentWidth, summaryH, 3);
  setColor(pdf, THEME.white);
  drawRoundedRect(pdf, margin, summaryY, contentWidth, summaryH, 3, 'F');

  // Service Type Large
  setColor(pdf, THEME.primary);
  // Service Type Large - Use label or fallback to raw
  const serviceLabel = serviceTypeLabels[data.service_type.toLowerCase()] || data.service_type;
  setColor(pdf, THEME.primary);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(serviceLabel.toUpperCase(), margin + 8, summaryY + 10);

  // Status Badge
  const statusColor = data.status === 'finalizado' ? THEME.success : (data.status === 'em_andamento' ? THEME.primary : THEME.warning);
  setColor(pdf, statusColor);
  drawRoundedRect(pdf, pageWidth - margin - 40, summaryY + 5, 30, 8, 2, 'F');
  setColor(pdf, THEME.white);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.status.toUpperCase(), pageWidth - margin - 25, summaryY + 9.5, { align: 'center' });

  // Quick Info Row inside Summary Card
  const infoY = summaryY + 18;
  const colW = contentWidth / 4;

  // Function to draw mini stats
  const drawMiniStat = (label: string, val: string, xPos: number) => {
    setColor(pdf, THEME.secondaryText);
    pdf.setFontSize(7);
    pdf.text(label, xPos, infoY);
    setColor(pdf, THEME.text);
    pdf.setFontSize(8.5); // Slightly smaller to fit operator name
    pdf.setFont('helvetica', 'bold');

    // Check if value is too long
    const valText = val || '-';
    if (pdf.getTextWidth(valText) > colW - 5) {
      pdf.setFontSize(7);
    }
    pdf.text(valText, xPos, infoY + 4);
    pdf.setFontSize(9); // Reset
  };

  const protocolText = data.operator_name || 'N/A';
  drawMiniStat('OPERADOR', protocolText, margin + 8);
  drawMiniStat('DATA', data.start_datetime ? format(new Date(data.start_datetime), 'dd/MM/yyyy') : '-', margin + 8 + colW);
  drawMiniStat('CIDADE', `${data.city}/${data.state}`, margin + 8 + colW * 2);
  drawMiniStat('PLANO', data.plan.name, margin + 8 + colW * 3);

  y += summaryH + 10;

  // Two Columns Layout
  const colOneX = margin;
  const colTwoX = pageWidth / 2 + 5;
  const colWidth = (contentWidth / 2) - 5;
  const cardH = 55;

  // Card: SOLICITANTE
  drawCard(pdf, colOneX, y, colWidth, cardH, 'DADOS DO SOLICITANTE');
  let cy = y + 16;
  cy = drawField(pdf, 'Cliente', data.client.name, colOneX + 6, cy, colWidth - 10);
  cy = drawField(pdf, 'Telefone', data.client.contact_phone || '-', colOneX + 6, cy, colWidth - 10);
  cy = drawField(pdf, 'Solicitante (Op)', data.operator_name || '-', colOneX + 6, cy, colWidth - 10);

  // Card: VEÍCULO / ALVO
  drawCard(pdf, colTwoX, y, colWidth, cardH, 'VEÍCULO / ALVO');
  cy = y + 16;
  cy = drawField(pdf, 'Descrição', data.vehicle.description, colTwoX + 6, cy, colWidth - 10);

  let plateInfo = data.vehicle.tractor_plate || '-';
  if (data.vehicle.tractor_brand) plateInfo += ` • ${data.vehicle.tractor_brand}`;
  cy = drawField(pdf, 'Cavalo/Placa', plateInfo, colTwoX + 6, cy, colWidth - 10);

  let trailerInfo = data.vehicle.trailer1_plate || 'N/A';
  if (data.vehicle.trailer1_body_type) trailerInfo += ` (${data.vehicle.trailer1_body_type})`;
  cy = drawField(pdf, 'Carreta/Tipo', trailerInfo, colTwoX + 6, cy, colWidth - 10);

  y += cardH + 10;

  // Card: OPERAÇÃO (Full Width)
  const opH = 50;
  drawCard(pdf, margin, y, contentWidth, opH, 'DETALHES DA OPERAÇÃO');

  // Col 1 insde Op Card
  cy = y + 16;
  const innerColW = (contentWidth / 3) - 5;

  // Team
  drawField(pdf, 'Equipe Mobilizada', calculateEfetivoMobilizado(data), margin + 6, cy, innerColW * 2);
  drawField(pdf, 'Início', data.start_datetime ? format(new Date(data.start_datetime), "dd/MM 'às' HH:mm") : '-', margin + 6, cy + 12, innerColW);
  drawField(pdf, 'Término', data.end_datetime ? format(new Date(data.end_datetime), "dd/MM 'às' HH:mm") : '-', margin + 6, cy + 24, innerColW);

  // Col 2 inside Op Card
  const col2InnerX = margin + 6 + innerColW + 10;
  drawField(pdf, 'KM Rodado', data.km_start && data.km_end ? `${data.km_end - data.km_start} km` : '-', col2InnerX, cy + 12, innerColW);
  drawField(pdf, 'Duração Total', formatDurationText(data.duration_minutes), col2InnerX, cy + 24, innerColW);

  // Col 3 inside Op Card (Coordinates)
  const col3InnerX = margin + 6 + (innerColW * 2) + 10;
  drawField(pdf, 'Coordenadas', data.coordinates_lat ? `${data.coordinates_lat}, ${data.coordinates_lng}` : '-', col3InnerX, cy + 12, innerColW);

  drawFooter(pdf, pageWidth, pageHeight);

  // ==================== PAGE 2: RELATO ====================
  pdf.addPage();
  setColor(pdf, THEME.background); // refill background
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  y = await drawPremiumHeader(pdf, pageWidth, logoImg, headerBgImg);

  // Relato Card
  if (data.detailed_report) {
    const reportTitle = 'RELATÓRIO DETALHADO DA OCORRÊNCIA';
    setColor(pdf, THEME.primary);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(reportTitle, margin, y + 10);

    // Gradient Divider line
    setColor(pdf, THEME.primary);
    pdf.rect(margin, y + 14, 20, 1, 'F');
    setColor(pdf, THEME.border);
    pdf.rect(margin + 20, y + 14, contentWidth - 20, 0.5, 'F');

    y += 25;

    // Paper Effect for Text
    const textMargin = margin;
    const textWidth = contentWidth;

    // Draw white paper background behind text
    // We estimate height or just fill page
    const remainingH = pageHeight - y - 30;
    drawShadowRect(pdf, textMargin, y, textWidth, remainingH, 1);
    setColor(pdf, THEME.white);
    drawRoundedRect(pdf, textMargin, y, textWidth, remainingH, 1, 'F');

    // Text Content
    setColor(pdf, THEME.text);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const lines = pdf.splitTextToSize(data.detailed_report, textWidth - 10);
    let textY = y + 8;

    for (const line of lines) {
      if (textY > pageHeight - 40) {
        // Footer & New Page
        drawFooter(pdf, pageWidth, pageHeight);
        pdf.addPage();
        setColor(pdf, THEME.background);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');

        y = await drawPremiumHeader(pdf, pageWidth, logoImg, headerBgImg);
        textY = y + 10;

        // Continuation background
        const contH = pageHeight - textY - 30;
        drawShadowRect(pdf, textMargin, textY - 5, textWidth, contH, 1);
        setColor(pdf, THEME.white);
        drawRoundedRect(pdf, textMargin, textY - 5, textWidth, contH, 1, 'F');
      }
      pdf.text(line, textMargin + 5, textY);
      textY += 6;
    }
  }

  drawFooter(pdf, pageWidth, pageHeight);

  // ==================== PAGE 3+: PHOTOS ====================
  if (data.photos && data.photos.length > 0) {
    // Group photos: by caption, max 4 per group
    const groupedPhotos: Array<{ photos: any[], caption: string | null }> = [];
    let currentGroup: any[] = [];
    let lastCaption: string | null = null;

    data.photos.forEach((photo, idx) => {
      const sameCaption = photo.caption === lastCaption;
      const groupNotFull = currentGroup.length < 4;

      if (sameCaption && groupNotFull) {
        currentGroup.push(photo);
      } else {
        if (currentGroup.length > 0) {
          groupedPhotos.push({ photos: currentGroup, caption: lastCaption });
        }
        currentGroup = [photo];
        lastCaption = photo.caption;
      }
    });
    if (currentGroup.length > 0) {
      groupedPhotos.push({ photos: currentGroup, caption: lastCaption });
    }

    for (const group of groupedPhotos) {
      pdf.addPage();
      setColor(pdf, THEME.background);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      y = await drawPremiumHeader(pdf, pageWidth, logoImg, headerBgImg);

      // Section Title - CENTRALIZED
      setColor(pdf, THEME.dark);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('REGISTRO FOTOGRÁFICO', pageWidth / 2, y + 10, { align: 'center' });

      // Divider - CENTRALIZED
      setColor(pdf, THEME.primary);
      const dividerW = 30;
      pdf.rect((pageWidth - dividerW) / 2, y + 14, dividerW, 1.2, 'F');

      y += 30;

      // Group Grid Config (2x2 grid)
      const gap = 8;
      const photoW = (contentWidth - gap) / 2;
      const photoH = photoW * 0.75; // Standard rectangle area for the card

      for (let i = 0; i < group.photos.length; i++) {
        const photo = group.photos[i];
        const col = i % 2;
        const row = Math.floor(i / 2);

        const xStr = margin + col * (photoW + gap);
        const yStr = y + row * (photoH + gap);

        // Card Effect
        drawShadowRect(pdf, xStr, yStr, photoW, photoH, 2);
        setColor(pdf, THEME.white);
        drawRoundedRect(pdf, xStr, yStr, photoW, photoH, 2, 'F');

        try {
          const imgP = await loadImage(photo.file_url);
          const padding = 2;
          const availableW = photoW - (padding * 2);
          const availableH = photoH - (padding * 2);

          // Calculate Proportions to avoid stretching
          const imgRatio = imgP.width / imgP.height;
          const targetRatio = availableW / availableH;

          let finalW, finalH;
          if (imgRatio > targetRatio) {
            // Wider than target (Horizontal landscape)
            finalW = availableW;
            finalH = availableW / imgRatio;
          } else {
            // Taller than target
            finalH = availableH;
            finalW = availableH * imgRatio;
          }

          // Center image inside the card area
          const imgX = xStr + padding + (availableW - finalW) / 2;
          const imgY = yStr + padding + (availableH - finalH) / 2;

          pdf.addImage(imgP.dataUrl, 'JPEG', imgX, imgY, finalW, finalH);
        } catch (e) {
          setColor(pdf, THEME.border);
          pdf.rect(xStr + 2, yStr + 2, photoW - 4, photoH - 4, 'F');
          setColor(pdf, THEME.secondaryText);
          pdf.setFontSize(7);
          pdf.text('Imagem indisponível', xStr + (photoW / 2), yStr + (photoH / 2), { align: 'center' });
        }
      }

      // Shared Caption below the block - ENHANCED & CENTRALIZED
      const gridTotalH = Math.ceil(group.photos.length / 2) * (photoH + gap);
      const captionY = y + gridTotalH + 8;

      if (group.caption) {
        const capW = contentWidth;
        const capLines = pdf.splitTextToSize(group.caption, capW - 30);
        const capH = (capLines.length * 5) + 12;

        drawShadowRect(pdf, margin, captionY, capW, capH, 1.5);
        setColor(pdf, THEME.white);
        drawRoundedRect(pdf, margin, captionY, capW, capH, 1.5, 'F');

        setColor(pdf, THEME.text);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(capLines, margin + (capW / 2), captionY + 8, { align: 'center' });
      } else {
        setColor(pdf, THEME.secondaryText);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.text('Sem descrição para este lote de fotos.', pageWidth / 2, captionY + 8, { align: 'center' });
      }

      drawFooter(pdf, pageWidth, pageHeight);
    }
  }

  // Save PDF
  pdf.save(`Relatorio_${data.code || 'FDG'}.pdf`);
}

async function loadImage(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
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
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: img.width,
          height: img.height
        });
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export type { TicketPDFData };
