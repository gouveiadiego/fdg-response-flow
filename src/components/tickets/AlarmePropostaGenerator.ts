import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COMPANY_INFO = {
    name: 'FALCO PEREGRINUS OPERAÇÕES LOGÍSTICAS',
    cnpj: '59.355.128/0001-10',
    address: 'R. Dona Francisca, 801 Sala 05 - Saguaçu, Joinville - SC, 89221-006',
    phone: '(47) 99135-6830',
    email: 'contato@falcoperegrinus.com.br',
    website: 'www.falcoperegrinus.com.br',
};

const ALARME_PRICING = {
    base: 180,
    includedMinutes: 30,
    includedKm: 50,
    extraHourRate: 40,
    extraKmRate: 2.50,
};

const THEME = {
    black: { r: 18, g: 18, b: 18 },
    white: { r: 255, g: 255, b: 255 },
    text: { r: 30, g: 41, b: 59 },
    muted: { r: 100, g: 116, b: 139 },
    border: { r: 226, g: 232, b: 240 },
    bg: { r: 248, g: 250, b: 252 },
    orange: { r: 234, g: 88, b: 12 },
    orangeLight: { r: 254, g: 243, b: 235 },
    green: { r: 22, g: 163, b: 74 },
};

export interface AlarmePropostaData {
    code: string | null;
    client_name: string;
    city: string;
    state: string;
    start_datetime: string;
    end_datetime: string | null;
    km_total: number;
    duration_hours: number;
    toll_cost: number;
    operator_name: string;
}

function setFill(pdf: jsPDF, c: { r: number; g: number; b: number }) {
    pdf.setFillColor(c.r, c.g, c.b);
}
function setDraw(pdf: jsPDF, c: { r: number; g: number; b: number }) {
    pdf.setDrawColor(c.r, c.g, c.b);
}
function setTxt(pdf: jsPDF, c: { r: number; g: number; b: number }) {
    pdf.setTextColor(c.r, c.g, c.b);
}

export async function generateAlarmePropostaPDF(data: AlarmePropostaData): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const contentW = pageWidth - margin * 2;
    let y = 0;

    // ── Background ──────────────────────────────────
    setFill(pdf, THEME.bg);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    // ── Header ──────────────────────────────────────
    const headerH = 42;
    setFill(pdf, THEME.black);
    pdf.rect(0, 0, pageWidth, headerH, 'F');

    // Logo placeholder + company name
    setTxt(pdf, THEME.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text(COMPANY_INFO.name, margin, 18);

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setGState(new (pdf as any).GState({ opacity: 0.75 }));
    pdf.text('Excelência em Operações Logísticas | Atuação 24h', margin, 23.5);
    pdf.setGState(new (pdf as any).GState({ opacity: 1.0 }));

    // Contact on right
    const contactX = pageWidth - margin;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    setTxt(pdf, { r: 200, g: 200, b: 200 });
    pdf.text(COMPANY_INFO.phone, contactX, 14, { align: 'right' });
    pdf.text(COMPANY_INFO.email, contactX, 19, { align: 'right' });
    pdf.text(COMPANY_INFO.website, contactX, 24, { align: 'right' });

    // Orange accent line
    setFill(pdf, THEME.orange);
    pdf.rect(0, headerH, pageWidth, 2, 'F');

    y = headerH + 12;

    // ── Document title ───────────────────────────────
    setTxt(pdf, THEME.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('PROPOSTA DE ATENDIMENTO', margin, y);

    y += 5;
    setFill(pdf, THEME.orange);
    pdf.rect(margin, y, 60, 1, 'F');

    y += 6;
    setTxt(pdf, THEME.muted);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8.5);
    pdf.text(`Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por ${data.operator_name}`, margin, y);

    y += 10;

    // ── Service type badge ───────────────────────────
    setFill(pdf, THEME.orangeLight);
    setDraw(pdf, THEME.orange);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(margin, y, 55, 10, 2, 2, 'FD');

    setTxt(pdf, THEME.orange);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('🔔 ACIONAMENTO DE ALARME', margin + 4, y + 6.5);

    y += 16;

    // ── Client info card ──────────────────────────────
    setFill(pdf, THEME.white);
    setDraw(pdf, THEME.border);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(margin, y, contentW, 32, 2, 2, 'FD');

    // Card header strip
    setFill(pdf, THEME.black);
    pdf.roundedRect(margin, y, contentW, 8, 2, 2, 'F');
    pdf.rect(margin, y + 4, contentW, 4, 'F'); // flatten bottom corners
    setTxt(pdf, THEME.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.text('DADOS DO CHAMADO', margin + 4, y + 5.5);

    const innerY = y + 13;
    const col = contentW / 3;

    // Client
    setTxt(pdf, THEME.muted);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.text('CLIENTE', margin + 4, innerY);
    setTxt(pdf, THEME.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(data.client_name, margin + 4, innerY + 6);

    // Code
    setTxt(pdf, THEME.muted);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.text('CÓD. CHAMADO', margin + col + 4, innerY);
    setTxt(pdf, THEME.text);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(data.code || '-', margin + col + 4, innerY + 6);

    // Location
    setTxt(pdf, THEME.muted);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.text('LOCAL', margin + col * 2 + 4, innerY);
    setTxt(pdf, THEME.text);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`${data.city} / ${data.state}`, margin + col * 2 + 4, innerY + 6);

    // Date row
    setTxt(pdf, THEME.muted);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.text('DATA/HORA DO ACIONAMENTO', margin + 4, innerY + 14);
    setTxt(pdf, THEME.text);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(format(new Date(data.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), margin + 4, innerY + 19);

    y += 42;

    // ── Pricing table ─────────────────────────────────
    y += 4;
    setTxt(pdf, THEME.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('CONDIÇÕES DO ATENDIMENTO', margin, y);
    setFill(pdf, THEME.orange);
    pdf.rect(margin, y + 1.5, 25, 0.8, 'F');

    y += 10;

    const tableRows: Array<{ label: string; value: string; highlight?: boolean }> = [
        { label: 'Pacote Inicial (Base)', value: `R$ ${ALARME_PRICING.base.toFixed(2).replace('.', ',')}`, highlight: true },
        { label: `Tempo incluso no pacote`, value: `${ALARME_PRICING.includedMinutes} minutos` },
        { label: 'Quilometragem inclusa (deslocamento completo)', value: `${ALARME_PRICING.includedKm} km` },
        { label: 'Hora adicional (após os 30 minutos iniciais)', value: `R$ ${ALARME_PRICING.extraHourRate.toFixed(2).replace('.', ',')} / hora` },
        { label: 'Quilômetro adicional (acima dos 50 km)', value: `R$ ${ALARME_PRICING.extraKmRate.toFixed(2).replace('.', ',')} / km` },
        { label: 'Pedágio', value: 'Reembolso integral c/ comprovante' },
    ];

    const rowH = 9;
    tableRows.forEach((row, i) => {
        const ry = y + i * rowH;
        if (row.highlight) {
            setFill(pdf, THEME.orangeLight);
        } else {
            setFill(pdf, i % 2 === 0 ? THEME.white : { r: 250, g: 250, b: 252 });
        }
        pdf.rect(margin, ry, contentW, rowH, 'F');

        setDraw(pdf, THEME.border);
        pdf.setLineWidth(0.2);
        pdf.line(margin, ry + rowH, margin + contentW, ry + rowH);

        setTxt(pdf, row.highlight ? THEME.orange : THEME.text);
        pdf.setFont('helvetica', row.highlight ? 'bold' : 'normal');
        pdf.setFontSize(8.5);
        pdf.text(row.label, margin + 4, ry + 6);

        setTxt(pdf, row.highlight ? THEME.orange : THEME.text);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.text(row.value, margin + contentW - 4, ry + 6, { align: 'right' });
    });

    y += tableRows.length * rowH + 10;

    // ── Calculated total ─────────────────────────────
    // Compute extra
    const extraHours = Math.max(0, data.duration_hours - 0.5);
    const extraKm = Math.max(0, data.km_total - 50);
    const totalValue = ALARME_PRICING.base
        + extraHours * ALARME_PRICING.extraHourRate
        + extraKm * ALARME_PRICING.extraKmRate
        + data.toll_cost;

    const breakdown: Array<{ label: string; value: string; isSub?: boolean }> = [
        { label: 'Valor Base', value: `R$ ${ALARME_PRICING.base.toFixed(2).replace('.', ',')}` },
    ];

    if (extraHours > 0) {
        const h = Math.floor(extraHours);
        const m = Math.round((extraHours - h) * 60);
        const extraLabel = `Tempo extra (${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}min` : ''} × R$ ${ALARME_PRICING.extraHourRate}/h)`;
        breakdown.push({ label: extraLabel, value: `+ R$ ${(extraHours * ALARME_PRICING.extraHourRate).toFixed(2).replace('.', ',')}`, isSub: true });
    }
    if (extraKm > 0) {
        breakdown.push({ label: `KM extra (${extraKm.toFixed(1)} km × R$ ${ALARME_PRICING.extraKmRate}/km)`, value: `+ R$ ${(extraKm * ALARME_PRICING.extraKmRate).toFixed(2).replace('.', ',')}`, isSub: true });
    }
    if (data.toll_cost > 0) {
        breakdown.push({ label: `Pedágio (reembolso)`, value: `+ R$ ${data.toll_cost.toFixed(2).replace('.', ',')}`, isSub: true });
    }

    // Total card
    setFill(pdf, { r: 15, g: 15, b: 15 });
    pdf.roundedRect(margin, y, contentW, 14 + breakdown.length * 7, 3, 3, 'F');

    setTxt(pdf, { r: 160, g: 160, b: 160 });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text('COMPOSIÇÃO DO VALOR', margin + 6, y + 6);

    breakdown.forEach((b, i) => {
        const by = y + 10 + i * 7;
        setTxt(pdf, b.isSub ? { r: 200, g: 200, b: 200 } : THEME.white);
        pdf.setFont('helvetica', b.isSub ? 'normal' : 'bold');
        pdf.setFontSize(8);
        pdf.text(b.label, margin + 6, by);
        pdf.text(b.value, margin + contentW - 6, by, { align: 'right' });
    });

    y += 14 + breakdown.length * 7;

    // Final total
    setFill(pdf, THEME.orange);
    pdf.roundedRect(margin, y, contentW, 14, 3, 3, 'F');
    setTxt(pdf, THEME.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('VALOR TOTAL A COBRAR', margin + 6, y + 9.5);
    pdf.setFontSize(13);
    pdf.text(`R$ ${totalValue.toFixed(2).replace('.', ',')}`, margin + contentW - 6, y + 9.5, { align: 'right' });

    y += 22;

    // ── Payment conditions ───────────────────────────
    setFill(pdf, THEME.white);
    setDraw(pdf, THEME.border);
    pdf.setLineWidth(0.4);
    const condH = 24;
    pdf.roundedRect(margin, y, contentW, condH, 2, 2, 'FD');

    setFill(pdf, THEME.green);
    pdf.roundedRect(margin, y, 2.5, condH, 1.5, 1.5, 'F');

    setTxt(pdf, THEME.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text('CONDIÇÕES DE PAGAMENTO', margin + 8, y + 8);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    setTxt(pdf, THEME.muted);
    pdf.text('Prazo de 1 dia útil em horário comercial após o recebimento da documentação completa.', margin + 8, y + 15);
    pdf.text('(Relatório fotográfico com timestamps + extrato de pedágio, quando aplicável)', margin + 8, y + 20);

    y += condH + 14;

    // ── Notes ───────────────────────────────────────
    setTxt(pdf, THEME.muted);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.5);
    const notes = [
        '• Contagem de tempo inicia a partir do primeiro registro fotográfico com timestamp no local da ocorrência.',
        '• Quilometragem considera o trajeto completo (base do profissional → local → retorno à base).',
        '• Pedágio reembolsável mediante apresentação de comprovante fotográfico ou extrato do sistema Sem Parar.',
    ];
    notes.forEach((note) => {
        pdf.text(note, margin, y);
        y += 5;
    });

    y += 8;

    // ── Signature ───────────────────────────────────
    setFill(pdf, THEME.border);
    pdf.rect(margin, y, contentW, 0.5, 'F');
    y += 8;

    setTxt(pdf, THEME.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('Cordialmente,', margin, y);
    y += 6;
    pdf.setFontSize(11);
    pdf.text(COMPANY_INFO.name, margin, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    setTxt(pdf, THEME.muted);
    pdf.text('Coordenação Operacional', margin, y);

    // ── Footer ──────────────────────────────────────
    const footerY = pageHeight - 10;
    setFill(pdf, THEME.black);
    pdf.rect(0, footerY - 4, pageWidth, 14, 'F');
    setTxt(pdf, { r: 160, g: 160, b: 160 });
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
        `${COMPANY_INFO.name}  •  CNPJ ${COMPANY_INFO.cnpj}  •  ${COMPANY_INFO.address}`,
        pageWidth / 2,
        footerY + 3,
        { align: 'center' }
    );

    // Save
    const fileName = `proposta-alarme-${data.code || 'chamado'}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
    pdf.save(fileName);
}
