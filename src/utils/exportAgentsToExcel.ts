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
  address: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  pix_key: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: 'corrente' | 'poupanca' | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const bool = (v: boolean | null | undefined) => (v ? 'Sim' : 'Não');

const statusLabel = (s: string) => (s === 'ativo' ? 'Ativo' : 'Inativo');

const performanceLabel = (p: string) =>
  ({ ruim: 'Ruim', bom: 'Bom', otimo: 'Ótimo' }[p] ?? p);

const vehicleLabel = (v: string | null) =>
  ({ carro: 'Carro', moto: 'Moto' }[v ?? ''] ?? '-');

const bankAccountTypeLabel = (t: string | null) =>
  ({ corrente: 'Conta Corrente', poupanca: 'Conta Poupança' }[t ?? ''] ?? '-');

/**
 * Tenta separar o endereço livre nos seus componentes.
 * Formato esperado (gerado pelo useCepLookup): "Rua X, Bairro, Cidade, UF"
 */
const parseAddress = (address: string | null) => {
  if (!address) return { rua: '-', bairro: '-', cidade: '-', estado: '-' };

  const parts = address.split(',').map((p) => p.trim());

  return {
    rua: parts[0] ?? '-',
    bairro: parts[1] ?? '-',
    cidade: parts[2] ?? '-',
    estado: parts[3] ?? '-',
  };
};

// ─── Sheet builder helpers ───────────────────────────────────────────────────

/** Auto-adjust column widths based on header + content */
function autoColWidths(
  rows: Record<string, string | number>[],
  headers: string[]
): XLSX.ColInfo[] {
  return headers.map((header) => {
    const maxLen = Math.max(
      header.length,
      ...rows.map((r) => String(r[header] ?? '').length)
    );
    return { wch: maxLen + 2 };
  });
}

/** Build a worksheet with bold headers and auto-widths */
function buildSheet(rows: Record<string, string | number>[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] ?? {});
  ws['!cols'] = autoColWidths(rows, headers);
  // Bold header row
  headers.forEach((_, colIndex) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    if (ws[cell]) {
      ws[cell].s = { font: { bold: true }, alignment: { horizontal: 'center' } };
    }
  });
  return ws;
}

// ─── Main export function ────────────────────────────────────────────────────

export const exportAgentsToExcel = (agents: Agent[]): void => {
  const workbook = XLSX.utils.book_new();

  // ── ABA 1: Dados Gerais ──────────────────────────────────────────────────
  const dadosGerais = agents.map((a) => ({
    'Nome': a.name,
    'CPF': a.document || '-',
    'Telefone': a.phone,
    'E-mail': a.email || '-',
    'Status': statusLabel(a.status),
    'Desempenho': performanceLabel(a.performance_level),
    'Armado': bool(a.is_armed),
    'Tipo de Veículo': vehicleLabel(a.vehicle_type),
    'Placa do Veículo': a.vehicle_plate ? a.vehicle_plate.toUpperCase() : '-',
    'Observações': a.notes || '-',
  }));
  XLSX.utils.book_append_sheet(workbook, buildSheet(dadosGerais), 'Dados Gerais');

  // ── ABA 2: Endereço e Localização ────────────────────────────────────────
  const endereco = agents.map((a) => {
    const { rua, bairro, cidade, estado } = parseAddress(a.address);
    return {
      'Nome': a.name,
      'CEP': a.cep || '-',
      'Rua / Logradouro': rua,
      'Bairro': bairro,
      'Cidade': cidade,
      'Estado (UF)': estado,
      'Endereço Completo': a.address || '-',
      'Latitude': a.latitude ?? '-',
      'Longitude': a.longitude ?? '-',
      'Coordenadas (Google Maps)':
        a.latitude && a.longitude
          ? `${a.latitude}, ${a.longitude}`
          : '-',
    };
  });
  XLSX.utils.book_append_sheet(workbook, buildSheet(endereco), 'Endereço e Localização');

  // ── ABA 3: Habilidades ───────────────────────────────────────────────────
  const habilidades = agents.map((a) => ({
    'Nome': a.name,
    'Armado': bool(a.is_armed),
    'Alarme': bool(a.has_alarm_skill),
    'Averiguação': bool(a.has_investigation_skill),
    'Preservação': bool(a.has_preservation_skill),
    'Logística': bool(a.has_logistics_skill),
    'Sindicância': bool(a.has_auditing_skill),
  }));
  XLSX.utils.book_append_sheet(workbook, buildSheet(habilidades), 'Habilidades');

  // ── ABA 4: Dados Bancários ───────────────────────────────────────────────
  const bancarios = agents.map((a) => ({
    'Nome': a.name,
    'Chave PIX': a.pix_key || '-',
    'Banco': a.bank_name || '-',
    'Tipo de Conta': bankAccountTypeLabel(a.bank_account_type),
    'Agência': a.bank_agency || '-',
    'Conta': a.bank_account || '-',
  }));
  XLSX.utils.book_append_sheet(workbook, buildSheet(bancarios), 'Dados Bancários');

  // ── Download ─────────────────────────────────────────────────────────────
  const now = new Date();
  const datePart = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
  XLSX.writeFile(workbook, `agentes_${datePart}.xlsx`);
};
