import { INICIO_DO_RELOGIO } from './dados-iniciais.js';

let fixo = null;

export function ehModoTeste() {
  return process.env.MODO_TESTE === '1';
}

export function agora() {
  if (!ehModoTeste()) return new Date();
  if (fixo === null) fixo = new Date(INICIO_DO_RELOGIO);
  return fixo;
}

export function resetarRelogio() {
  if (!ehModoTeste()) return false;
  fixo = new Date(INICIO_DO_RELOGIO);
  return true;
}

export function definirRelogio(iso) {
  if (!ehModoTeste()) return false;
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return false;
  fixo = instante;
  return true;
}