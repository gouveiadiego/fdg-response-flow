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

// Minimalist color palette - Clean monochromatic theme
const COLORS = {
  black: { r: 0, g: 0, b: 0 },              // Main text
  gray900: { r: 17, g: 24, b: 39 },         // Headings
  gray600: { r: 75, g: 85, b: 99 },         // Labels
  gray400: { r: 156, g: 163, b: 175 },      // Details/captions
  gray200: { r: 229, g: 231, b: 235 },      // Separator lines
  gray50: { r: 249, g: 250, b: 251 },       // Background (if needed)
  white: { r: 255, g: 255, b: 255 },        // Page background
  blue: { r: 59, g: 130, b: 246 },          // Accent (minimal use)
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

// Helper to set color
const setColor = (pdf: jsPDF, color: { r: number; g: number; b: number }) => {
  pdf.setFillColor(color.r, color.g, color.b);
  pdf.setDrawColor(color.r, color.g, color.b);
  pdf.setTextColor(color.r, color.g, color.b);
};

// Draw minimalist header
const drawHeader = async (pdf: jsPDF, pageWidth: number, margin: number, logoImg: string | null): Promise<number> => {
  const headerH = 28;

  // Logo
  if (logoImg) {
    try {
      pdf.addImage(logoImg, 'PNG', margin, 6, 30, 30);
    } catch (e) {
      console.error('Error adding logo:', e);
    }
  }

  // Contact info - single line, right aligned
  const rightX = pageWidth - margin;
  setColor(pdf, COLORS.gray600);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${COMPANY_INFO.email}  •  ${COMPANY_INFO.phoneCommercial}  •  ${COMPANY_INFO.website}`, rightX, 12, { align: 'right' });

  // Bottom separator line
  setColor(pdf, COLORS.gray200);
  pdf.setLineWidth(0.5);
  pdf.line(margin, headerH, pageWidth - margin, headerH);

  return headerH + 8;
};

// Draw minimalist footer
const drawFooter = (pdf: jsPDF, pageWidth: number, pageHeight: number) => {
  const footerY = pageHeight - 15;

  // Top separator line
  setColor(pdf, COLORS.gray200);
  pdf.setLineWidth(0.5);
  pdf.line(18, footerY, pageWidth - 18, footerY);

  // Footer text - single centered line
  setColor(pdf, COLORS.gray400);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    `${COMPANY_INFO.name}  •  CNPJ ${COMPANY_INFO.cnpj}  •  ${COMPANY_INFO.address}`,
    pageWidth / 2,
    footerY + 6,
    { align: 'center' }
  );
};

// Draw section title - minimalist
const drawSectionTitle = (pdf: jsPDF, title: string, x: number, y: number, width: number): number => {
  // Top line
  setColor(pdf, COLORS.gray200);
  pdf.setLineWidth(0.5);
  pdf.line(x, y, x + width, y);

  // Title text
  setColor(pdf, COLORS.gray900);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title.toUpperCase(), x, y + 6);

  return y + 12;
};

// Draw info row with label and value
const drawInfoRow = (
  pdf: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number = 40,
  maxValueWidth: number = 80
): number => {
  // Label
  setColor(pdf, COLORS.gray600);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(label, x, y);

  // Value
  setColor(pdf, COLORS.black);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');

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

  return y + 7;
};

export async function generateTicketPDF(data: TicketPDFData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18; // Increased from 12 for more breathing room
  const contentWidth = pageWidth - 2 * margin;

  // Load logo
  let logoImg: string | null = null;
  try {
    logoImg = await loadImage('/logo-fdg.png');
  } catch (e) {
    console.error('Error loading logo:', e);
  }

  // ==================== PAGE 1: RELATÓRIO DE ATENDIMENTO ====================

  // Header
  let y = await drawHeader(pdf, pageWidth, margin, logoImg);

  // Document title
  setColor(pdf, COLORS.gray900);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Relatório de Atendimento', pageWidth / 2, y, { align: 'center' });

  // Service type subtitle
  const serviceLabel = serviceTypeLabels[data.service_type] || data.service_type;
  setColor(pdf, COLORS.gray600);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(serviceLabel, pageWidth / 2, y + 7, { align: 'center' });

  y += 20;

  // Section: SOLICITANTE
  const colWidth = (contentWidth - 12) / 2;
  const labelWidth = 40;
  const maxValueWidth = colWidth - labelWidth - 8;

  let sectionY = drawSectionTitle(pdf, 'Solicitante', margin, y, colWidth);
  sectionY = drawInfoRow(pdf, 'Cliente:', data.client.name, margin, sectionY, labelWidth, maxValueWidth);
  sectionY = drawInfoRow(pdf, 'Contato:', data.client.contact_phone || '-', margin, sectionY, labelWidth, maxValueWidth);
  if (data.code) {
    sectionY = drawInfoRow(pdf, 'Processo:', data.code, margin, sectionY, labelWidth, maxValueWidth);
  }
  sectionY = drawInfoRow(pdf, 'Plano:', data.plan.name, margin, sectionY, labelWidth, maxValueWidth);

  // Section: LOCALIZAÇÃO (right column)
  const col2X = margin + colWidth + 12;
  let col2Y = drawSectionTitle(pdf, 'Localização', col2X, y, colWidth);
  col2Y = drawInfoRow(pdf, 'Cidade/UF:', `${data.city}/${data.state}`, col2X, col2Y, labelWidth, maxValueWidth);
  col2Y = drawInfoRow(
    pdf,
    'Coordenadas:',
    data.coordinates_lat && data.coordinates_lng
      ? `${data.coordinates_lat.toFixed(6)}, ${data.coordinates_lng.toFixed(6)}`
      : '-',
    col2X,
    col2Y,
    labelWidth,
    maxValueWidth
  );

  y = Math.max(sectionY, col2Y) + 12;

  // Section: DATA E HORA
  sectionY = drawSectionTitle(pdf, 'Data e Hora', margin, y, colWidth);

  if (data.start_datetime) {
    const startDate = new Date(data.start_datetime);
    sectionY = drawInfoRow(
      pdf,
      'Início:',
      format(startDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      margin,
      sectionY,
      labelWidth,
      maxValueWidth
    );
  }

  if (data.end_datetime) {
    const endDate = new Date(data.end_datetime);
    sectionY = drawInfoRow(
      pdf,
      'Término:',
      format(endDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      margin,
      sectionY,
      labelWidth,
      maxValueWidth
    );
  }

  sectionY = drawInfoRow(pdf, 'Duração:', formatDurationText(data.duration_minutes), margin, sectionY, labelWidth, maxValueWidth);
  sectionY = drawInfoRow(
    pdf,
    'KM Rodado:',
    data.km_start && data.km_end ? `${data.km_end - data.km_start} km` : '-',
    margin,
    sectionY,
    labelWidth,
    maxValueWidth
  );

  // Section: VEÍCULO (right column)
  col2Y = drawSectionTitle(pdf, 'Veículo', col2X, y, colWidth);
  col2Y = drawInfoRow(pdf, 'Descrição:', data.vehicle.description, col2X, col2Y, labelWidth, maxValueWidth);

  if (data.vehicle.tractor_plate) {
    col2Y = drawInfoRow(
      pdf,
      'Cavalo:',
      `${data.vehicle.tractor_plate}${data.vehicle.tractor_brand ? ' - ' + data.vehicle.tractor_brand : ''}${data.vehicle.tractor_model ? ' ' + data.vehicle.tractor_model : ''
      }`,
      col2X,
      col2Y,
      labelWidth,
      maxValueWidth
    );
  }

  if (data.vehicle.trailer1_plate) {
    col2Y = drawInfoRow(
      pdf,
      'Carreta 1:',
      `${data.vehicle.trailer1_plate} (${bodyTypeLabels[data.vehicle.trailer1_body_type || ''] || data.vehicle.trailer1_body_type || '-'})`,
      col2X,
      col2Y,
      labelWidth,
      maxValueWidth
    );
  }

  if (data.vehicle.trailer2_plate) {
    col2Y = drawInfoRow(
      pdf,
      'Carreta 2:',
      `${data.vehicle.trailer2_plate} (${bodyTypeLabels[data.vehicle.trailer2_body_type || ''] || data.vehicle.trailer2_body_type || '-'})`,
      col2X,
      col2Y,
      labelWidth,
      maxValueWidth
    );
  }

  y = Math.max(sectionY, col2Y) + 12;

  // Section: EQUIPE MOBILIZADA (full width)
  sectionY = drawSectionTitle(pdf, 'Equipe Mobilizada', margin, y, contentWidth);
  sectionY = drawInfoRow(pdf, 'Efetivo:', calculateEfetivoMobilizado(data), margin, sectionY);
  if (data.operator_name) {
    sectionY = drawInfoRow(pdf, 'Operador:', data.operator_name, margin, sectionY);
  }

  // Footer
  drawFooter(pdf, pageWidth, pageHeight);

  // ==================== PAGE 2: DESCRIÇÃO DO EVENTO ====================
  pdf.addPage();

  // Header
  y = await drawHeader(pdf, pageWidth, margin, logoImg);

  // Document title
  setColor(pdf, COLORS.gray900);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Descrição do Evento', pageWidth / 2, y, { align: 'center' });

  // Subtitle
  setColor(pdf, COLORS.gray600);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Relato de Atendimento – ${serviceLabel}`, pageWidth / 2, y + 7, { align: 'center' });

  y += 20;

  // Detailed report section
  if (data.detailed_report) {
    sectionY = drawSectionTitle(pdf, 'Relatório Detalhado', margin, y, contentWidth);

    setColor(pdf, COLORS.black);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const lines = pdf.splitTextToSize(data.detailed_report, contentWidth - 8);
    let textY = sectionY + 2;

    for (const line of lines) {
      if (textY > pageHeight - 35) {
        // Need new page
        drawFooter(pdf, pageWidth, pageHeight);
        pdf.addPage();

        y = await drawHeader(pdf, pageWidth, margin, logoImg);
        textY = y + 6;

        setColor(pdf, COLORS.black);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
      }

      pdf.text(line, margin + 4, textY);
      textY += 6;
    }
  }

  // Footer
  drawFooter(pdf, pageWidth, pageHeight);

  // ==================== PAGE 3+: PHOTOS (2x2 grid, 4 per page) ====================
  if (data.photos && data.photos.length > 0) {
    const photosPerPage = 4;
    const totalPages = Math.ceil(data.photos.length / photosPerPage);

    const gapX = 12;
    const gapY = 12;
    const photoWidth = (contentWidth - gapX) / 2;
    const photoHeight = photoWidth * 0.65;
    const captionHeight = 10;
    const cellHeight = photoHeight + captionHeight + gapY;

    for (let page = 0; page < totalPages; page++) {
      pdf.addPage();

      // Header
      y = await drawHeader(pdf, pageWidth, margin, logoImg);

      // Title
      setColor(pdf, COLORS.gray900);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Registro Fotográfico', pageWidth / 2, y, { align: 'center' });

      // Page counter
      setColor(pdf, COLORS.gray400);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `Página ${page + 1} de ${totalPages}  •  Fotos ${page * photosPerPage + 1} a ${Math.min(
          (page + 1) * photosPerPage,
          data.photos.length
        )} de ${data.photos.length}`,
        pageWidth / 2,
        y + 7,
        { align: 'center' }
      );

      y += 18;

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
          // Load and add image
          const img = await loadImage(photo.file_url);
          pdf.addImage(img, 'JPEG', x, photoY, photoWidth, photoHeight);

          // Border
          setColor(pdf, COLORS.gray200);
          pdf.setLineWidth(0.5);
          pdf.rect(x, photoY, photoWidth, photoHeight, 'S');

          // Caption below photo
          if (photo.caption) {
            setColor(pdf, COLORS.gray600);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            const captionLines = pdf.splitTextToSize(photo.caption, photoWidth - 4);
            pdf.text(captionLines[0], x + photoWidth / 2, photoY + photoHeight + 6, { align: 'center' });
          }

          // Photo number (top left corner)
          setColor(pdf, COLORS.gray600);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`#${i + 1}`, x + 3, photoY + 5);
        } catch (error) {
          console.error('Erro ao carregar imagem:', error);

          // Placeholder
          setColor(pdf, COLORS.gray50);
          pdf.rect(x, photoY, photoWidth, photoHeight, 'F');
          setColor(pdf, COLORS.gray200);
          pdf.rect(x, photoY, photoWidth, photoHeight, 'S');

          setColor(pdf, COLORS.gray400);
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
