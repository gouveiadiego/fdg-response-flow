import * as XLSX from 'xlsx';

interface Client {
    id: string;
    name: string;
    document: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    cep: string | null;
    street: string | null;
    street_number: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
    notes: string | null;
}

const val = (v: string | null | undefined) => v || '-';

export const exportClientsToExcel = (clients: Client[]): void => {
    const rows = clients.map((c) => ({
        'Razão Social / Nome': c.name,
        'CNPJ / CPF': c.document,
        'Nome do Contato': val(c.contact_name),
        'Telefone': val(c.contact_phone),
        'E-mail': val(c.contact_email),
        'CEP': val(c.cep),
        'Rua / Logradouro': val(c.street),
        'Número / Complemento': val(c.street_number),
        'Bairro': val(c.neighborhood),
        'Cidade': c.city,
        'Estado (UF)': c.state,
        'Observações': val(c.notes),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto column widths
    const headers = Object.keys(rows[0] ?? {});
    worksheet['!cols'] = headers.map((h) => ({
        wch: Math.max(h.length, ...rows.map((r) => String((r as Record<string, unknown>)[h] ?? '').length)) + 2,
    }));

    // Bold headers
    headers.forEach((_, colIndex) => {
        const cell = XLSX.utils.encode_cell({ r: 0, c: colIndex });
        if (worksheet[cell]) worksheet[cell].s = { font: { bold: true } };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');

    const datePart = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    XLSX.writeFile(workbook, `clientes_${datePart}.xlsx`);
};
