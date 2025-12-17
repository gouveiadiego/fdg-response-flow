import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  acompanhamento_logistico: 'ACOMPANHAMENTO LOGÍSTICO DE VEÍCULO',
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
  return `${hours} hora${hours > 1 ? 's' : ''} e ${mins} minuto${mins > 1 ? 's' : ''}`;
};

const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
};

// Calculate "Efetivo mobilizado" based on agents
const calculateEfetivoMobilizado = (data: TicketPDFData): string => {
  let armados = 0;
  let desarmados = 0;

  // Main agent
  if (data.agent) {
    if (data.agent.is_armed) armados++;
    else desarmados++;
  }

  // Support agent 1
  if (data.support_agent_1) {
    if (data.support_agent_1.is_armed) armados++;
    else desarmados++;
  }

  // Support agent 2
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

export async function generateTicketPDF(data: TicketPDFData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('FDG PRONTA RESPOSTA', pageWidth / 2, y, { align: 'center' });
  y += 8;
  
  pdf.setFontSize(12);
  pdf.text('RELATÓRIO DE ATENDIMENTO', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Line
  pdf.setDrawColor(0);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Part 1: Tabular Report
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const addRow = (label: string, value: string) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${label}:`, margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value || '-', margin + 45, y);
    y += 6;
    if (y > 270) {
      pdf.addPage();
      y = margin;
    }
  };

  addRow('Solicitante', data.client.name);
  addRow('Processo', data.code);
  addRow('Contato', data.client.contact_phone || '-');
  addRow('Coordenadas', data.coordinates_lat && data.coordinates_lng 
    ? `${data.coordinates_lat.toFixed(6)}, ${data.coordinates_lng.toFixed(6)}` 
    : '-');
  addRow('Tipo de Atendimento', serviceTypeLabels[data.service_type] || data.service_type);
  addRow('Cidade/Estado', `${data.city}/${data.state}`);
  
  if (data.start_datetime) {
    const startDate = new Date(data.start_datetime);
    addRow('Data Inicial', format(startDate, 'dd/MM/yyyy', { locale: ptBR }));
    addRow('Hora Inicial', format(startDate, 'HH:mm', { locale: ptBR }));
  }
  
  if (data.end_datetime) {
    const endDate = new Date(data.end_datetime);
    addRow('Data Final', format(endDate, 'dd/MM/yyyy', { locale: ptBR }));
    addRow('Hora Final', format(endDate, 'HH:mm', { locale: ptBR }));
  }
  
  addRow('Duração Total', formatDurationText(data.duration_minutes));
  addRow('KM Total', data.km_start && data.km_end 
    ? `${data.km_end - data.km_start} km` 
    : '-');

  y += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.text('VEÍCULO:', margin, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  
  addRow('Descrição', data.vehicle.description);
  if (data.vehicle.tractor_brand || data.vehicle.tractor_model) {
    addRow('Cavalo Mecânico', `${data.vehicle.tractor_brand || ''} ${data.vehicle.tractor_model || ''}`.trim());
  }
  if (data.vehicle.tractor_plate) {
    addRow('Placa Cavalo', data.vehicle.tractor_plate);
  }
  
  if (data.vehicle.trailer1_plate) {
    addRow('Carreta 1', `${data.vehicle.trailer1_plate} - ${bodyTypeLabels[data.vehicle.trailer1_body_type || ''] || data.vehicle.trailer1_body_type || '-'}`);
  }
  if (data.vehicle.trailer2_plate) {
    addRow('Carreta 2', `${data.vehicle.trailer2_plate} - ${bodyTypeLabels[data.vehicle.trailer2_body_type || ''] || data.vehicle.trailer2_body_type || '-'}`);
  }
  if (data.vehicle.trailer3_plate) {
    addRow('Carreta 3', `${data.vehicle.trailer3_plate} - ${bodyTypeLabels[data.vehicle.trailer3_body_type || ''] || data.vehicle.trailer3_body_type || '-'}`);
  }

  // Page break before description
  pdf.addPage();
  y = margin;

  // Part 2: Event Description
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DESCRIÇÃO DO EVENTO', pageWidth / 2, y, { align: 'center' });
  y += 8;
  
  pdf.setFontSize(10);
  pdf.text(`RELATO DE ATENDIMENTO – ${serviceTypeLabels[data.service_type] || data.service_type.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Line
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  pdf.setFontSize(10);
  addRow('Cliente', data.client.name);
  addRow('Plano', data.plan.name);
  addRow('Efetivo Mobilizado', calculateEfetivoMobilizado(data));
  
  // Team info
  y += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.text('EQUIPE MOBILIZADA:', margin, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');

  const teamMembers: string[] = [];
  if (data.agent) {
    teamMembers.push(`${data.agent.name} (Principal${data.agent.is_armed ? ' - Armado' : ' - Desarmado'})`);
  }
  if (data.support_agent_1) {
    teamMembers.push(`${data.support_agent_1.name} (Apoio 1${data.support_agent_1.is_armed ? ' - Armado' : ' - Desarmado'})`);
  }
  if (data.support_agent_2) {
    teamMembers.push(`${data.support_agent_2.name} (Apoio 2${data.support_agent_2.is_armed ? ' - Armado' : ' - Desarmado'})`);
  }

  teamMembers.forEach(member => {
    pdf.text(`• ${member}`, margin + 5, y);
    y += 5;
  });

  y += 6;

  // Detailed report
  if (data.detailed_report) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('RELATÓRIO DETALHADO:', margin, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    
    const lines = pdf.splitTextToSize(data.detailed_report, pageWidth - 2 * margin);
    lines.forEach((line: string) => {
      if (y > 270) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 5;
    });
  }

  // Part 3: Photos (4 per page, 2x2 grid)
  if (data.photos && data.photos.length > 0) {
    pdf.addPage();
    y = margin;
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('REGISTRO FOTOGRÁFICO', pageWidth / 2, y, { align: 'center' });
    y += 10;

    const photoWidth = (pageWidth - 3 * margin) / 2;
    const photoHeight = photoWidth * 0.75; // 4:3 aspect ratio (landscape)
    let photoIndex = 0;

    for (let i = 0; i < data.photos.length; i++) {
      const photo = data.photos[i];
      const col = photoIndex % 2;
      const row = Math.floor(photoIndex % 4 / 2);
      
      const x = margin + col * (photoWidth + margin / 2);
      const photoY = y + row * (photoHeight + 15);

      try {
        // Load image and add to PDF
        const img = await loadImage(photo.file_url);
        pdf.addImage(img, 'JPEG', x, photoY, photoWidth, photoHeight);
        
        // Add caption if exists
        if (photo.caption) {
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'italic');
          const captionLines = pdf.splitTextToSize(photo.caption, photoWidth);
          pdf.text(captionLines[0], x, photoY + photoHeight + 4);
        }
      } catch (error) {
        console.error('Erro ao carregar imagem:', error);
        pdf.setDrawColor(200);
        pdf.rect(x, photoY, photoWidth, photoHeight);
        pdf.setFontSize(8);
        pdf.text('Imagem não disponível', x + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
      }

      photoIndex++;
      
      // New page every 4 photos
      if (photoIndex % 4 === 0 && i < data.photos.length - 1) {
        pdf.addPage();
        y = margin;
      }
    }
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
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export type { TicketPDFData };
