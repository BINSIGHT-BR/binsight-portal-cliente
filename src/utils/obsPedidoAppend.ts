/** Acrescenta linha em col AA sem apagar histórico existente. */
export function appendObsPedido(existing: string, note: string, authorEmail: string): string {
  const trimmed = note.trim();
  if (!trimmed) return existing.trim();

  const date = new Date().toLocaleDateString('pt-BR');
  const author = authorEmail.split('@')[0] || authorEmail;
  const block = `[${date} · ${author}] ${trimmed}`;

  const prev = existing.trim();
  return prev ? `${prev}\n${block}` : block;
}
