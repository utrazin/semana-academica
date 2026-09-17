export function contarVagasOcupadas(inscricoes) {
  return inscricoes.filter((i) => i.status === 'confirmada' || i.status === 'convocada').length;
}