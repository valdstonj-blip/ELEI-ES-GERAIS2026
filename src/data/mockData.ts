import { Ocorrencia, FaltaEfetivo } from '../types';

// Ocorrências reais sincronizadas do Formulário Google (2º Turno Oficial: 24 e 25 de Outubro - 1 dado de teste inicial)
export const INITIAL_OCORRENCIAS: Ocorrencia[] = [
  {
    id: 'oc-1',
    carimbo: '24/10/2026 10:14:04',
    comandoIntermediario: '1º CPA',
    opm: '3º BPM',
    posto: 'TEN PM',
    rg: '12345',
    nomeGuerra: 'teste01',
    email: 'teste01@gmail.com',
    servicoDia: 'Serviço do dia 24OUT26 ( SÁBADO - 08:00 até ás 20:00 )',
    crimesCandidatos: 'Não houve',
    crimesLocaisVotacao: 'Dano/Depredação nos locais de votação/apuração',
    crimesEleitorais: 'Não houve',
    incidentesSeguranca: 'Não houve',
    prisoesApreensoes: 'Não houve',
    crimesRegistrados: ['Dano/Depredação nos locais de votação/apuração'],
    seHouverOcorrenciaDizerQual: 'Dano/Depredação nos locais de votação/apuração',
    local: 'Zona Eleitoral 003 - Escola Municipal',
    hora: '10:20:00',
    bopm: '123456',
    ro: 'ro numero 125463',
    dinamica: 'Dano/Depredação nos locais de votação/apuração teste',
    cpa: '1º CPA',
    uop: '3º BPM',
    bairro: 'Méier',
    localidade: 'Méier',
    categoria: 'Crimes comuns nos locais de votação',
    tipo: 'Dano/Depredação nos locais de votação/apuração',
    dataHoraFato: '24/10/2026 10:20:00',
    historico: 'Dano/Depredação nos locais de votação/apuração teste',
    providencias: 'BOPM: 123456 | RO: ro numero 125463',
    envolvidos: 'Em apuração',
    materialApreendido: 'Nenhum',
    status: 'CONCLUÍDA',
  },
];

// Registro de faltas no POE no 2º Turno (24 e 25 de Outubro - 1 dado de teste inicial)
export const INITIAL_FALTAS: FaltaEfetivo[] = [
  {
    id: 'falta-resp-1',
    carimbo: '24/10/2026 08:46:31',
    servicoDia: 'Serviço do dia 24OUT26 ( SÁBADO - 08:00 até ás 20:00 )',
    posto: 'TEN PM',
    rg: '12345',
    nomeGuerra: 'teste01',
    comandoIntermediario: '2º CPA',
    opm: '9º BPM',
    faltasPoe:
      '1° SARGENTO JOSÉ - RG:99999 - 14° BPM;\n2° SARGENTO PEDRO - RG:99999 -12° BPM;',
    dispensasPoe: 'sem alteração',

    // Compatibilidade com exportação e filtros
    data: '24/10/2026',
    turno: 'Serviço do dia 24OUT26 ( SÁBADO - 08:00 até ás 20:00 )',
    postoGrad: 'TEN PM',
    opmOrigem: '2º CPA / 9º BPM',
    uopDestino: '9º BPM',
    localVotacao: 'POE - Escala Operacional',
    motivo:
      '1° SARGENTO JOSÉ - RG:99999 - 14° BPM;\n2° SARGENTO PEDRO - RG:99999 -12° BPM;',
    substituto: 'sem alteração',
    status: 'REGISTRADO',
    cpa: '2º CPA',
    tipoRegistro: 'FALTA',
    informante: 'TEN PM teste01 (RG: 12345)',
  },
];
