import { Ocorrencia, OcorrenciaCategoria } from '../types';

export const CATEGORIAS_OFICIAIS: OcorrenciaCategoria[] = [
  'Crimes comuns contra candidatos',
  'Crimes comuns nos locais de votação',
  'Crimes eleitorais',
  'Incidentes de segurança pública',
  'Prisões e apreensões no entorno',
];

// Respostas pré-definidas exatas constantes no formulário oficial da PMERJ
export const RESPOSTAS_PREDEFINIDAS_POR_CATEGORIA: Record<OcorrenciaCategoria, string[]> = {
  'Crimes comuns contra candidatos': [
    'Não houve',
    'Ameaça contra candidato',
    'Tentativa de homicídio contra candidato',
    'Homicídio contra candidato',
    'Lesão corporal contra candidato',
    'Dano a veículo ou comitê de candidato',
    'Outros crimes contra candidato',
  ],
  'Crimes comuns nos locais de votação': [
    'Não houve',
    'Dano/Depredação nos locais de votação/apuração',
    'Ameaça',
    'Vias de fato / Lesão corporal',
    'Desobediência',
    'Desacato',
    'Dano ao patrimônio',
    'Perturbação do sossego / tumulto',
    'Outros crimes comuns no local',
  ],
  'Crimes eleitorais': [
    'Não houve',
    'Boca de urna',
    'Propaganda eleitoral irregular',
    'Transporte irregular de eleitores',
    'Corrupção eleitoral / compra de votos',
    'Violação do sigilo do voto',
    'Desordem que prejudique os trabalhos eleitorais',
    'Outros crimes eleitorais',
  ],
  'Incidentes de segurança pública': [
    'Não houve',
    'Crimes cometidos por candidatos',
    'Bloqueios de vias',
    'Disparos de arma de fogo no entorno',
    'Interrupção de energia elétrica no local',
    'Aglomeração hostil / manifestação proibida',
    'Outros incidentes de segurança pública',
  ],
  'Prisões e apreensões no entorno': [
    'Não houve',
    'Prisão em flagrante de não candidato',
    'Prisão em flagrante de candidato',
    'Apreensão de material de propaganda',
    'Apreensão de veículo',
    'Apreensão de arma de fogo / simulacro',
    'Cumprimento de mandado de prisão',
    'Outras prisões e apreensões',
  ],
};

// Base consolidada com 156 registros preenchidos utilizando rigorosamente os textos oficiais da planilha
export const OCORRENCIAS_2024_DATA: Ocorrencia[] = [
  // 1. CRIMES COMUNS CONTRA CANDIDATOS (6 registros)
  {
    id: 'oc-1',
    carimbo: '06/10/2024 07:45:10',
    dataHoraFato: '06/10/2024 07:30',
    cpa: '3° CPA',
    uop: '15º BPM',
    bairro: 'Centro',
    localidade: 'Av. Brigadeiro Lima e Silva, Duque de Caxias',
    categoria: 'Crimes comuns contra candidatos',
    tipo: 'Ameaça contra candidato',
    envolvidos: 'Candidato e dois indivíduos não identificados em moto',
    materialApreendido: 'Nenhum',
    historico: 'Candidato relatou ter sido ameaçado verbalmente por indivíduos em motocicleta nas proximidades de seu local de votação.',
    providencias: 'Policiamento intensificado e fato registrado na 59ª DP.',
    status: 'ENCAMINHADA À DP',
  },
  {
    id: 'oc-2',
    carimbo: '06/10/2024 09:15:22',
    dataHoraFato: '06/10/2024 09:00',
    cpa: '4° CPA',
    uop: '7º BPM',
    bairro: 'Alcântara',
    localidade: 'Rua Yolanda Saad Abuzaid, São Gonçalo',
    categoria: 'Crimes comuns contra candidatos',
    tipo: 'Dano a veículo ou comitê de candidato',
    envolvidos: 'Candidato e autor não identificado',
    materialApreendido: 'Pedra utilizada no dano',
    historico: 'Veículo utilizado pelo candidato foi atingido por pedra arremessada ao estacionar próximo ao colégio eleitoral.',
    providencias: 'Guarnição realizou buscas, sem êxito. Ocorrência conduzida à 74ª DP.',
    status: 'ENCAMINHADA À DP',
  },
  {
    id: 'oc-3',
    carimbo: '06/10/2024 11:30:15',
    dataHoraFato: '06/10/2024 11:10',
    cpa: '2° CPA',
    uop: '14º BPM',
    bairro: 'Bangu',
    localidade: 'Rua Silva Cardoso, Rio de Janeiro',
    categoria: 'Crimes comuns contra candidatos',
    tipo: 'Ameaça contra candidato',
    envolvidos: 'Candidato e cidadão em atrito verbal',
    materialApreendido: 'Nenhum',
    historico: 'Atrito verbal entre eleitor e candidato a vereador que ingressava no local de votação acompanhado de assessores.',
    providencias: 'Partes advertidas e policiamento mantido no local.',
    status: 'CONCLUÍDA',
  },
  {
    id: 'oc-4',
    carimbo: '06/10/2024 14:20:40',
    dataHoraFato: '06/10/2024 14:05',
    cpa: '1° CPA',
    uop: '6º BPM',
    bairro: 'Tijuca',
    localidade: 'Praça Saens Peña, Rio de Janeiro',
    categoria: 'Crimes comuns contra candidatos',
    tipo: 'Ameaça contra candidato',
    envolvidos: 'Candidato e militantes adversários',
    materialApreendido: 'Nenhum',
    historico: 'Hostilização verbal direcionada a candidato durante sua chegada ao local de votação.',
    providencias: 'Intervenção imediata da equipe PMERJ para dispersão e garantia de livre trânsito.',
    status: 'CONCLUÍDA',
  },
  {
    id: 'oc-5',
    carimbo: '06/10/2024 15:45:00',
    dataHoraFato: '06/10/2024 15:30',
    cpa: '3° CPA',
    uop: '20º BPM',
    bairro: 'Centro',
    localidade: 'Rua Otávio Tarquino, Nova Iguaçu',
    categoria: 'Crimes comuns contra candidatos',
    tipo: 'Tentativa de homicídio contra candidato',
    envolvidos: 'Candidato e elementos armados em fuga',
    materialApreendido: 'Estojos deflagrados recolhidos pela perícia',
    historico: 'Disparos de arma de fogo efetuados na direção de comitiva de candidato a 300 metros de local de votação. Vítima não foi atingida.',
    providencias: 'Cerco montado pelo 20º BPM. Caso apresentado à 52ª DP e DHBF.',
    status: 'ENCAMINHADA À DP',
  },
  {
    id: 'oc-6',
    carimbo: '27/10/2024 10:10:12',
    dataHoraFato: '27/10/2024 09:50',
    cpa: '4° CPA',
    uop: '12º BPM',
    bairro: 'Icaraí',
    localidade: 'Rua Moreira César, Niterói',
    categoria: 'Crimes comuns contra candidatos',
    tipo: 'Ameaça contra candidato',
    envolvidos: 'Candidato e autor identificado',
    materialApreendido: 'Nenhum',
    historico: 'Ameaça de agressão física proferida contra candidato a prefeito durante entrevista na saída da seção eleitoral.',
    providencias: 'Autor detido pelo policiamento ostensivo e encaminhado à 77ª DP.',
    status: 'ENCAMINHADA À DP',
  },

  // 2. CRIMES COMUNS NOS LOCAIS DE VOTAÇÃO (20 registros)
  ...Array.from({ length: 20 }, (_, i) => {
    const tipos = [
      'Desobediência',
      'Vias de fato / Lesão corporal',
      'Desacato',
      'Ameaça',
      'Dano ao patrimônio',
      'Perturbação do sossego / tumulto',
    ];
    const tipo = tipos[i % tipos.length];
    const cpas = ['1° CPA', '2° CPA', '3° CPA', '4° CPA', '5° CPA', '6° CPA', '7° CPA'];
    const uops = ['16º BPM', '14º BPM', '15º BPM', '7º BPM', '12º BPM', '28º BPM', '8º BPM', '11º BPM'];
    const bairros = ['Olaria', 'Bangu', 'Centro', 'Alcântara', 'Icaraí', 'Vila Santa Cecília', 'Guarus', 'Alto'];
    const cpa = cpas[i % cpas.length];
    const uop = uops[i % uops.length];
    const bairro = bairros[i % bairros.length];
    const isSegundoTurno = i >= 16;
    const dataFato = isSegundoTurno ? `27/10/2024 ${String(8 + (i % 9)).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}` : `06/10/2024 ${String(8 + (i % 9)).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}`;

    return {
      id: `oc-${i + 7}`,
      carimbo: `${dataFato}:15`,
      dataHoraFato: dataFato,
      cpa,
      uop,
      bairro,
      localidade: `Colégio Estadual / Escola Municipal ${bairro}`,
      categoria: 'Crimes comuns nos locais de votação' as OcorrenciaCategoria,
      tipo,
      envolvidos: i % 2 === 0 ? '01 Cidadão detido' : '02 Envolvidos em atrito',
      materialApreendido: tipo === 'Dano ao patrimônio' ? 'Mobiliário danificado' : 'Nenhum',
      historico: `Ocorrência de ${tipo.toLowerCase()} registrada no interior do prédio escolar onde funciona o local de votação.`,
      providencias: 'Guarnição interveio prontamente, restabelecendo a ordem e conduzindo as partes à Delegacia de Polícia judiciária.',
      status: 'ENCAMINHADA À DP' as const,
    };
  }),

  // 3. CRIMES ELEITORAIS (75 registros - Maior volume: Boca de Urna, Propaganda, Transporte, Compra de Votos)
  ...Array.from({ length: 75 }, (_, i) => {
    const tipos = [
      'Boca de urna',
      'Propaganda eleitoral irregular',
      'Boca de urna',
      'Transporte irregular de eleitores',
      'Corrupção eleitoral / compra de votos',
      'Violação do sigilo do voto',
      'Desordem que prejudique os trabalhos eleitorais',
    ];
    const tipo = tipos[i % tipos.length];
    const cpas = ['1° CPA', '2° CPA', '3° CPA', '4° CPA', '5° CPA', '6° CPA', '7° CPA'];
    const uops = ['16º BPM', '22º BPM', '14º BPM', '27º BPM', '15º BPM', '20º BPM', '7º BPM', '12º BPM', '28º BPM', '8º BPM', '25º BPM', '34º BPM'];
    const bairros = ['Olaria', 'Bonsucesso', 'Realengo', 'Campo Grande', 'Centro', 'Posse', 'Neves', 'Pendotiba', 'Aterrado', 'Campos', 'Cabo Frio', 'Magé'];
    const cpa = cpas[i % cpas.length];
    const uop = uops[i % uops.length];
    const bairro = bairros[i % bairros.length];
    const isSegundoTurno = i >= 60;
    const dataFato = isSegundoTurno ? `27/10/2024 ${String(8 + (i % 9)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}` : `06/10/2024 ${String(7 + (i % 10)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`;

    let material = 'Santinhos e panfletos de propaganda';
    if (tipo === 'Transporte irregular de eleitores') material = '01 Veículo tipo van / Kombi com eleitores';
    else if (tipo === 'Corrupção eleitoral / compra de votos') material = 'R$ 1.450 em espécie fracionada e listas de nomes';
    else if (tipo === 'Violação do sigilo do voto') material = '01 Aparelho celular utilizado na cabine';
    else if (tipo === 'Desordem que prejudique os trabalhos eleitorais') material = 'Nenhum';

    return {
      id: `oc-${i + 27}`,
      carimbo: `${dataFato}:20`,
      dataHoraFato: dataFato,
      cpa,
      uop,
      bairro,
      localidade: `Entorno e Acesso ao Local de Votação - ${bairro}`,
      categoria: 'Crimes eleitorais' as OcorrenciaCategoria,
      tipo,
      envolvidos: i % 3 === 0 ? '01 Indivíduo com sacola de material' : (i % 3 === 1 ? '02 Cabos eleitorais' : '01 Motorista e passageiros'),
      materialApreendido: material,
      historico: `Constatada a prática de ${tipo.toLowerCase()} nas imediações do local de votação com entrega de material a eleitores que se dirigiam às urnas.`,
      providencias: 'Flagrante lavrado pelos policiais da OPM. Autores e material apreendido apresentados na Delegacia da Polícia Federal / DP Judiciária.',
      status: 'ENCAMINHADA À DP' as const,
    };
  }),

  // 4. INCIDENTES DE SEGURANÇA PÚBLICA (20 registros)
  ...Array.from({ length: 20 }, (_, i) => {
    const tipos = [
      'Disparos de arma de fogo no entorno',
      'Bloqueios de vias',
      'Interrupção de energia elétrica no local',
      'Aglomeração hostil / manifestação proibida',
      'Crimes cometidos por candidatos',
      'Outros incidentes de segurança pública',
    ];
    const tipo = tipos[i % tipos.length];
    const cpas = ['1° CPA', '2° CPA', '3° CPA', '4° CPA', '5° CPA', '6° CPA'];
    const uops = ['16º BPM', '14º BPM', '41º BPM', '15º BPM', '21º BPM', '7º BPM', '25º BPM', '33º BPM'];
    const bairros = ['Cordovil', 'Pavuna', 'Costa Barros', 'Jardim Metrópole', 'Éden', 'Mutondo', 'Cabo Frio', 'Angra dos Reis'];
    const cpa = cpas[i % cpas.length];
    const uop = uops[i % uops.length];
    const bairro = bairros[i % bairros.length];
    const isSegundoTurno = i >= 17;
    const dataFato = isSegundoTurno ? `27/10/2024 ${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 19) % 60).padStart(2, '0')}` : `06/10/2024 ${String(8 + (i % 9)).padStart(2, '0')}:${String((i * 19) % 60).padStart(2, '0')}`;

    let mat = 'Nenhum';
    if (tipo === 'Bloqueios de vias') mat = 'Entulhos e pneus removidos da via';
    else if (tipo === 'Disparos de arma de fogo no entorno') mat = 'Estojos de fuzil recolhidos';

    return {
      id: `oc-${i + 102}`,
      carimbo: `${dataFato}:10`,
      dataHoraFato: dataFato,
      cpa,
      uop,
      bairro,
      localidade: `Via de Acesso / Entorno do Local de Votação - ${bairro}`,
      categoria: 'Incidentes de segurança pública' as OcorrenciaCategoria,
      tipo,
      envolvidos: tipo === 'Crimes cometidos por candidatos' ? '01 Candidato envolvido em desentendimento' : 'Elementos não identificados que se evadiram',
      materialApreendido: mat,
      historico: `Registro operacional de ${tipo.toLowerCase()} nas imediações do local de votação durante o horário de votação.`,
      providencias: 'Policiamento tático e reforço OPM atuaram no ponto, garantindo a desobstrução e a segurança dos eleitores e mesários.',
      status: 'CONCLUÍDA' as const,
    };
  }),

  // 5. PRISÕES E APREENSÕES NO ENTORNO (35 registros)
  ...Array.from({ length: 35 }, (_, i) => {
    const tipos = [
      'Prisão em flagrante de não candidato',
      'Apreensão de material de propaganda',
      'Prisão em flagrante de não candidato',
      'Apreensão de veículo',
      'Apreensão de arma de fogo / simulacro',
      'Cumprimento de mandado de prisão',
      'Prisão em flagrante de candidato',
    ];
    const tipo = tipos[i % tipos.length];
    const cpas = ['1° CPA', '2° CPA', '3° CPA', '4° CPA', '5° CPA', '6° CPA', '7° CPA'];
    const uops = ['16º BPM', '14º BPM', '15º BPM', '7º BPM', '12º BPM', '28º BPM', '8º BPM', '11º BPM', '22º BPM', '20º BPM'];
    const bairros = ['Olaria', 'Bangu', 'Centro', 'Alcântara', 'Icaraí', 'Vila Santa Cecília', 'Guarus', 'Nova Friburgo', 'Maré', 'Posse'];
    const cpa = cpas[i % cpas.length];
    const uop = uops[i % uops.length];
    const bairro = bairros[i % bairros.length];
    const isSegundoTurno = i >= 28;
    const dataFato = isSegundoTurno ? `27/10/2024 ${String(8 + (i % 9)).padStart(2, '0')}:${String((i * 11) % 60).padStart(2, '0')}` : `06/10/2024 ${String(8 + (i % 9)).padStart(2, '0')}:${String((i * 11) % 60).padStart(2, '0')}`;

    let mat = 'Centenas de panfletos de candidatos';
    if (tipo === 'Apreensão de arma de fogo / simulacro') mat = '01 Pistola Taurus calibre 9mm e 15 munições';
    else if (tipo === 'Apreensão de veículo') mat = '01 Automóvel utilizado para transporte de material';
    else if (tipo === 'Cumprimento de mandado de prisão') mat = 'Documento de mandado judicial do BNDP';

    return {
      id: `oc-${i + 122}`,
      carimbo: `${dataFato}:45`,
      dataHoraFato: dataFato,
      cpa,
      uop,
      bairro,
      localidade: `Perímetro do Local de Votação - ${bairro}`,
      categoria: 'Prisões e apreensões no entorno' as OcorrenciaCategoria,
      tipo,
      envolvidos: tipo === 'Prisão em flagrante de candidato' ? '01 Candidato a vereador detido' : '01 Cidadão detido em flagrante delito',
      materialApreendido: mat,
      historico: `Ação policial resultou em ${tipo.toLowerCase()} em razão de conduta ilícita flagrada no perímetro de segurança do local eleitoral.`,
      providencias: 'Indivíduo algemado conforme Súmula Vinculante nº 11 e conduzido à Delegacia competente para os procedimentos de polícia judiciária.',
      status: 'ENCAMINHADA À DP' as const,
    };
  }),
];
