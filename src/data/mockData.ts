import { Ocorrencia, FaltaEfetivo } from '../types';

// Ocorrências reais do Formulário Google (inicia vazio caso nenhuma tenha sido sincronizada)
export const INITIAL_OCORRENCIAS: Ocorrencia[] = [];

// Exatamente 1 registro inicial de faltas no POE conforme a única linha de resposta registrada na Planilha Google
export const INITIAL_FALTAS: FaltaEfetivo[] = [
  {
    id: 'falta-1',
    carimbo: '23/09/2026 11:46:31',
    servicoDia: 'Serviço do dia 03OUT26 ( 14:00 até ás 10:00 do dia 04 de OUT 26 )',
    posto: 'TEN PM',
    rg: '12345',
    nomeGuerra: 'teste01',
    comandoIntermediario: '2 CPA',
    opm: '9º BPM',
    faltasPoe:
      '1° SARGENTO JOSÉ - RG:99999 - 14° BPM; 2° SARGENTO PEDRO - RG:99999 -12° BPM; 3° SARGENTO SILVA - RG:99999 - 27° BPM; CABO SOUZA - RG:99999 - 40° BPM; SOLDADO OLIVEIRA - RG:99999 - 31° BPM; SOLDADO SANTOS - RG:99999 - 18° BPM',
    dispensasPoe: 'sem alteração',

    // Compatibilidade com exportação e filtros
    data: '03/10/2026',
    turno: 'Serviço do dia 03OUT26 ( 14:00 até ás 10:00 do dia 04 de OUT 26 )',
    postoGrad: 'TEN PM',
    opmOrigem: '2 CPA',
    uopDestino: '9º BPM',
    localVotacao: 'POE - Escala Operacional Eleições',
    motivo:
      '1° SARGENTO JOSÉ - RG:99999 - 14° BPM; 2° SARGENTO PEDRO - RG:99999 -12° BPM; 3° SARGENTO SILVA - RG:99999 - 27° BPM; CABO SOUZA - RG:99999 - 40° BPM; SOLDADO OLIVEIRA - RG:99999 - 31° BPM; SOLDADO SANTOS - RG:99999 - 18° BPM',
    substituto: 'sem alteração',
    status: 'REGISTRADO',
    cpa: '2° CPA',
    tipoRegistro: 'FALTA',
    informante: 'TEN PM teste01 (RG: 12345)',
  },
];
