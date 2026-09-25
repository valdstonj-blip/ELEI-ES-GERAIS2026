export interface LocalVotacao {
  id: string;
  numZona: string;
  codMunicipio: string;
  cep: string;
  numLocal: string;
  qtdSecoes: number;
  qtdAptos: number;
  municipio: string;
  bairro: string;
  endereco: string;
  nomeLocal: string;
  cpa: string;
  uop: string;
  areaSensivel: boolean; // 'SIM' | 'NÃO'
  implantacaoDomingo: boolean; // 'SIM' | 'NÃO'
  blindado: boolean; // 'SIM' | 'NÃO'
  efetivoSabado: number;
  efetivoDomingo: number;
  observacoes: string;
  implantada: boolean; // 'SIM' | 'NÃO' - Implantação realizada no dia
  desmobilizada: boolean; // 'SIM' | 'NÃO' - Desmobilização realizada ao término
  horaImplantacao?: string;
  horaDesmobilizacao?: string;
  linhaPlanilha?: number; // Número exato da linha física na planilha (ex: 4978)

  // Compatible aliases for components and reports
  local: string;
  zonaEleitoral: string;
  quantidadeSecoes: number;
  totalEleitoresAptos: number;
  necessidadeImplantacaoDomingo: boolean;
  utilizacaoBlindado: boolean;
  observacao: string;
}

export type OcorrenciaCategoria =
  | 'Crimes comuns contra candidatos'
  | 'Crimes comuns nos locais de votação'
  | 'Crimes eleitorais'
  | 'Incidentes de segurança pública'
  | 'Prisões e apreensões no entorno';

export interface Ocorrencia {
  id: string;
  carimbo: string;
  comandoIntermediario?: string;
  opm?: string;

  // As 5 perguntas com respostas pré-definidas em múltipla escolha
  crimesCandidatos?: string;
  crimesLocaisVotacao?: string;
  crimesEleitorais?: string;
  incidentesSeguranca?: string;
  prisoesApreensoes?: string;

  // Lista de todos os crimes assinalados nesta linha do formulário (suporta mais de 1 crime por envio!)
  crimesRegistrados?: string[];

  // Se houver a ocorrência, dizer qual é (resposta assinalada na múltipla escolha)
  seHouverOcorrenciaDizerQual?: string;

  // Cabeçalhos de detalhamento do fato conforme a planilha
  local?: string;
  hora?: string;
  bopm?: string;
  ro?: string;
  dinamica?: string;

  // Campos de compatibilidade
  cpa: string;
  uop: string;
  categoria: OcorrenciaCategoria | string;
  tipo: string;
  bairro?: string;
  localidade?: string;
  dataHoraFato?: string;
  historico?: string;
  providencias?: string;
  envolvidos?: string;
  materialApreendido?: string;
  status: 'EM APURAÇÃO' | 'ENCAMINHADA À DP' | 'CONCLUÍDA' | 'SEM ALTERAÇÃO';
}

export interface FaltaEfetivo {
  id: string;
  carimbo: string;
  data: string;
  turno: string;
  postoGrad: string;
  rg: string;
  nomeGuerra: string;
  opmOrigem: string;
  uopDestino: string;
  localVotacao: string;
  motivo: string;
  substituto: string;
  status: 'SUBSTITUÍDO' | 'PENDENTE' | 'JUSTIFICADA' | 'NÃO JUSTIFICADA' | 'REGISTRADO';
  cpa?: string;
  tipoRegistro?: 'FALTA' | 'DISPENSA';
  informante?: string;

  // Propriedades fiéis às colunas exatas da planilha do Google Forms
  servicoDia?: string;
  posto?: string;
  comandoIntermediario?: string;
  opm?: string;
  faltasPoe?: string;
  dispensasPoe?: string;
}

export interface SheetConfig {
  locaisUrl: string;
  ocorrenciasUrl: string;
  faltasUrl: string;
  autoRefreshEnabled: boolean;
  refreshIntervalSeconds: number;
  lastUpdated?: string | null;
}

export type ActiveTab = 'locais' | 'ocorrencias' | 'faltas';
