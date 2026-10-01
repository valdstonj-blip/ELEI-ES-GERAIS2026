import { LocalVotacao } from '../types';
import { normalizeCpaName } from './sheetService';

export interface DuplicateGroup {
  id: string;
  motivo: string;
  tipo: 'CPA' | 'UOP' | 'INTERNA';
  linhas: number[];
  unidades: string[];
  locais: LocalVotacao[];
}

function normalizeText(s: string): string {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddress(s: string): string {
  return normalizeText(s)
    .replace(/\bAV\b/g, 'AVENIDA')
    .replace(/\bR\b/g, 'RUA')
    .replace(/\bPC\b/g, 'PRACA')
    .replace(/\bPCA\b/g, 'PRACA')
    .replace(/\bESTR\b/g, 'ESTRADA')
    .replace(/\bROD\b/g, 'RODOVIA')
    .replace(/\bSN\b/g, 'S N')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Analisa a lista de locais de votação e detecta duplicidades por:
 * 1. Mesmo endereço físico com número de porta em linhas separadas (entre CPAs diferentes, UOPs diferentes ou mesma unidade).
 * 2. Mesmo Código TSE (mesma Zona Eleitoral e mesmo Número de Local do TSE) em unidades distintas.
 */
export function enrichLocaisWithDuplicates(locais: LocalVotacao[]): {
  locaisEnriched: LocalVotacao[];
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;
} {
  const duplicatesMap = new Map<
    string,
    {
      motivo: string;
      tipo: 'CPA' | 'UOP' | 'INTERNA';
      linhasConflito: number[];
      unidadesConflito: string[];
    }
  >();

  const groups: DuplicateGroup[] = [];

  // Regra 1: Mesmo endereço com número predial
  const endGroups = new Map<string, LocalVotacao[]>();
  locais.forEach((l) => {
    const end = normalizeAddress(l.endereco);
    const mun = normalizeText(l.municipio);
    const hasNum = /\b\d{1,5}\b/.test(end);
    if (end.length >= 8 && hasNum) {
      const key = `${mun}__${end}`;
      if (!endGroups.has(key)) endGroups.set(key, []);
      endGroups.get(key)!.push(l);
    }
  });

  endGroups.forEach((list, key) => {
    if (list.length > 1) {
      const cpas = new Set(list.map((l) => normalizeCpaName(l.cpa)));
      const uops = new Set(list.map((l) => (l.uop || '').trim()));
      const tipo: 'CPA' | 'UOP' | 'INTERNA' =
        cpas.size > 1 ? 'CPA' : uops.size > 1 ? 'UOP' : 'INTERNA';
      const linhas = list
        .map((l) => l.linhaPlanilha || 0)
        .filter((ln) => ln > 0)
        .sort((a, b) => a - b);
      const unidades = Array.from(new Set(list.map((l) => `${normalizeCpaName(l.cpa)} (${(l.uop || 'N/I').trim()})`)));

      groups.push({
        id: `end-${key}`,
        motivo: `Mesmo endereço físico: ${list[0].endereco}`,
        tipo,
        linhas,
        unidades,
        locais: list,
      });

      list.forEach((l) => {
        const outrasLinhas = linhas.filter((ln) => ln !== l.linhaPlanilha);
        duplicatesMap.set(l.id, {
          motivo: `Mesmo endereço (${list[0].endereco}): Linha ${l.linhaPlanilha} coincide com Linha(s) ${outrasLinhas.join(', ')} [${unidades.join(' / ')}]`,
          tipo,
          linhasConflito: outrasLinhas,
          unidadesConflito: unidades,
        });
      });
    }
  });

  // Regra 2: Mesma Zona e mesmo Local TSE (em unidades diferentes ou duplicata na mesma unidade)
  const tseGroups = new Map<string, LocalVotacao[]>();
  locais.forEach((l) => {
    const z = String(l.numZona || '').trim();
    const nl = String(l.numLocal || '').trim();
    if (z && nl && nl !== '0' && nl !== 'X' && nl.length >= 3) {
      const key = `${z}__${nl}`;
      if (!tseGroups.has(key)) tseGroups.set(key, []);
      tseGroups.get(key)!.push(l);
    }
  });

  tseGroups.forEach((list, key) => {
    if (list.length > 1) {
      const cpas = new Set(list.map((l) => normalizeCpaName(l.cpa)));
      const uops = new Set(list.map((l) => (l.uop || '').trim()));
      const tipo: 'CPA' | 'UOP' | 'INTERNA' =
        cpas.size > 1 ? 'CPA' : uops.size > 1 ? 'UOP' : 'INTERNA';
      const linhas = list
        .map((l) => l.linhaPlanilha || 0)
        .filter((ln) => ln > 0)
        .sort((a, b) => a - b);
      const unidades = Array.from(new Set(list.map((l) => `${normalizeCpaName(l.cpa)} (${(l.uop || 'N/I').trim()})`)));

      // Evita duplicar grupo se já existe idêntico por endereço
      const existingGroup = groups.find(
        (g) => g.linhas.length === linhas.length && g.linhas.every((ln, i) => ln === linhas[i])
      );

      if (!existingGroup) {
        groups.push({
          id: `tse-${key}`,
          motivo: `Mesmo Código TSE (Zona ${list[0].numZona}, Local ${list[0].numLocal})${
            tipo === 'INTERNA' ? ' registrado em duplicidade na mesma unidade' : ' em unidades diferentes'
          }`,
          tipo,
          linhas,
          unidades,
          locais: list,
        });
      }

      list.forEach((l) => {
        const outrasLinhas = linhas.filter((ln) => ln !== l.linhaPlanilha);
        const existingDup = duplicatesMap.get(l.id);
        const novoMotivo = `Mesmo Código TSE (Zona ${l.numZona}, Local ${l.numLocal}): Linha ${l.linhaPlanilha} coincide com Linha(s) ${outrasLinhas.join(', ')} [${unidades.join(' / ')}]`;
        
        if (!existingDup) {
          duplicatesMap.set(l.id, {
            motivo: novoMotivo,
            tipo,
            linhasConflito: outrasLinhas,
            unidadesConflito: unidades,
          });
        } else {
          // Combina informações para máxima precisão
          existingDup.motivo = `${existingDup.motivo} | ${novoMotivo}`;
          existingDup.linhasConflito = Array.from(new Set([...existingDup.linhasConflito, ...outrasLinhas])).sort(
            (a, b) => a - b
          );
        }
      });
    }
  });

  // Ordena grupos rigorosamente pela primeira linha física na planilha do Google Sheets
  groups.sort((a, b) => (a.linhas[0] || 0) - (b.linhas[0] || 0));

  const locaisEnriched = locais.map((l) => {
    const dup = duplicatesMap.get(l.id);
    if (dup) {
      return {
        ...l,
        isDuplicado: true,
        duplicidadeMotivo: dup.motivo,
        duplicidadeTipo: dup.tipo,
        duplicidadeLinhas: dup.linhasConflito,
        duplicidadeUnidades: dup.unidadesConflito,
      };
    }
    return {
      ...l,
      isDuplicado: false,
    };
  });

  return {
    locaisEnriched,
    duplicateGroups: groups,
    totalDuplicates: duplicatesMap.size,
  };
}
