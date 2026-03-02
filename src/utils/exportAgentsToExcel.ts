import * as XLSX from 'xlsx';

interface Agent {
  id: string;
  name: string;
  document: string;
  phone: string;
  email: string | null;
  status: 'ativo' | 'inativo';
  is_armed: boolean | null;
  performance_level: 'ruim' | 'bom' | 'otimo';
  vehicle_type: 'carro' | 'moto' | null;
  vehicle_plate: string | null;
  has_alarm_skill: boolean;
  has_investigation_skill: boolean;
  has_preservation_skill: boolean;
  has_logistics_skill: boolean;
  has_auditing_skill: boolean;
}

const boolToText = (value: boolean | null | undefined): string => {
  return value ? 'Sim' : 'Não';
};

const statusToText = (status: 'ativo' | 'inativo'): string => {
  return status === 'ativo' ? 'Ativo' : 'Inativo';
};

const performanceToText = (level: 'ruim' | 'bom' | 'otimo'): string => {
  const map: Record<string, string> = {
    ruim: 'Ruim',
    bom: 'Bom',
    otimo: 'Ótimo',
  };
  return map[level] ?? level;
};

const vehicleTypeToText = (type: 'carro' | 'moto' | null): string => {
  if (!type) return '-';
  return type === 'carro' ? 'Carro' : 'Moto';
};

export const exportAgentsToExcel = (agents: Agent[]): void => {
  // Map agents to rows with Portuguese headers
  const rows = agents.map((agent) => ({
    'Nome': agent.name,
    'CPF': agent.document || '-',
    'Telefone': agent.phone,
    'E-mail': agent.email || '-',
    'Status': statusToText(agent.status),
    'Desempenho': performanceToText(agent.performance_level),
    'Armado': boolToText(agent.is_armed),
    'Tipo de Veículo': vehicleTypeToText(agent.vehicle_type),
    'Placa do Veículo': agent.vehicle_plate ? agent.vehicle_plate.toUpperCase() : '-',
    'Habilidade: Alarme': boolToText(agent.has_alarm_skill),
    'Habilidade: Averiguação': boolToText(agent.has_investigation_skill),
    'Habilidade: Preservação': boolToText(agent.has_preservation_skill),
    'Habilidade: Logística': boolToText(agent.has_logistics_skill),
    'Habilidade: Sindicância': boolToText(agent.has_auditing_skill),
  }));

  // Create worksheet from rows
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns based on content
  const headers = Object.keys(rows[0] || {});
  const colWidths = headers.map((header) => {
    const maxContentLength = Math.max(
      header.length,
      ...rows.map((row) => {
        const val = (row as Record<string, string>)[header] ?? '';
        return val.toString().length;
      })
    );
    return { wch: maxContentLength + 2 };
  });
  worksheet['!cols'] = colWidths;

  // Style header row (bold)
  headers.forEach((_, colIndex) => {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    if (!worksheet[cellAddress]) return;
    worksheet[cellAddress].s = {
      font: { bold: true },
      alignment: { horizontal: 'center' },
    };
  });

  // Create workbook and append the worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Agentes');

  // Generate date string for filename
  const now = new Date();
  const datePart = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
  const filename = `agentes_${datePart}.xlsx`;

  // Trigger download
  XLSX.writeFile(workbook, filename);
};
