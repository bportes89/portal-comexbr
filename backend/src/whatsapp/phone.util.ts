export function normalizeWhatsAppNumber(input: string): string {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) {
    throw new Error('Número de telefone inválido');
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}
