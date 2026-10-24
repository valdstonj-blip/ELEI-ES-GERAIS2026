# PROMPT MESTRE E ESPECIFICAÇÃO DE REPLICAÇÃO DO SISTEMA
## EMG-PM/3 — SISTEMA INTEGRADO DE GESTÃO E ACOMPANHAMENTO OPERACIONAL (ELEIÇÕES)

> **Como usar este documento:**  
> Caso deseje criar um sistema idêntico ou uma variação deste sistema (ex.: para Eleições Municipais, Grandes Eventos, Carnaval, Réveillon ou Operações Especiais), copie o bloco **"PROMPT MESTRE PARA O AI STUDIO"** abaixo e cole na primeira mensagem do novo projeto no AI Studio. Ele contém todas as diretrizes de arquitetura, peculiaridades de regras de negócio, tratamento de planilhas e interface.

---

```markdown
# PROMPT MESTRE PARA COPIAR E COLAR NO AI STUDIO:

Atue como Engenheiro de Software Sênior especialista em aplicações militares e de segurança pública. Construa um Sistema Integrado de Gestão e Acompanhamento Operacional para a Seção de Planejamento e Operações (EMG-PM/3) com as seguintes especificações e padrões rigorosos:

---

### 1. ARQUITETURA GERAL E STACK TECNOLÓGICA
- **Framework:** React SPA com Vite e TypeScript.
- **Estilização:** Tailwind CSS (tema sóbrio e militar: slate-900, azul operacional blue-600, alertas rose-600, âmbar para atenção e esmeralda para confirmações).
- **Ícones:** Lucide React (visual limpo, corporativo e sem emojis informais).
- **Exportação de Relatórios:** jsPDF + jspdf-autotable (relatórios paisagem A4 com cabeçalho oficial, numeração de páginas, totalizadores e formatação de tabela compacta).
- **Persistência e Cache:** LocalStorage para retenção de sessão, configurações de links e cache resiliente offline em caso de falha de conexão com a nuvem.
- **Dispositivos Móveis:** Totalmente responsivo para smartphones e computadores (menu com rolagem horizontal suave touch-pan-x, cards flexíveis e botões com área de toque ergonômica).

---

### 2. CONTROLE DE ACESSO E PERFIS (RBAC)
- Tela de Login com segurança de perfil:
  - **Perfil ADMIN** (`admin` / senha `74029jr`): Acesso irrestrito a todas as abas, modal de configuração de links das planilhas Google Sheets, auditoria de faltas e ferramentas de purga de cache.
  - **Perfil OPERACIONAL PM3** (`pm3` / senha `pm3`): Visualização operacional completa (Locais, Ocorrências, Faltas, Dashboard BI), porém o botão de configuração de links de planilhas e a aba de Verificação de Faltas ficam ocultos.

---

### 3. ESTRUTURA DAS 5 ABAS PRINCIPAIS

#### ABA 1: LOCAIS DE VOTAÇÃO
- **Objetivo:** Gestão dos locais de votação, distribuição de efetivo, locais sensíveis e controle de implantação/desmobilização de urnas.
- **Filtros:** Busca textual rápida (bairro, colégio, zona eleitoral, endereço), filtro por Comando Intermediário (1º a 8º CPA, CPP, COE, CPE), filtro por OPM e status de área sensível.
- **Indicadores:** Total de locais, total de eleitores aptos, total de seções, locais sensíveis (com badge vermelho), urnas implantadas e desmobilizadas.
- **Coluna Especial de Energia Elétrica:** Campo dedicado para registrar furto de cabos ou falhas na rede elétrica da concessionária.
- **Exportação PDF:** Relatório analítico completo e resumido por CPA/OPM.

#### ABA 2: OCORRÊNCIAS DE VULTO DO PLEITO
- **Origem:** Planilha de Respostas do Google Forms da Operação.
- **As 5 Perguntas Oficiais de Múltipla Escolha:**
  1. Crimes comuns contra candidatos
  2. Crimes comuns nos locais de votação/apuração
  3. Crimes Eleitorais
  4. Ocorrências e Incidentes de Segurança Pública no entorno/locais
  5. Prisões/apreensões no entorno e/ou locais de votação
- **Card de Apenas Dinâmica:** Ocorrências que narraram fatos relevantes no histórico sem assinalar uma tipificação específica.
- **Nota Metodológica Oficial (Texto Exato e Obrigatório):**
  `* NOTA METODOLÓGICA / TÉCNICA: Os quantitativos referem-se ao número de ocorrências e registros informados pelas OPMs via formulário de ocorrência. O quantitativo exato de indivíduos conduzidos/custodiados caso existam, constam no histórico (Dinâmica do Fato) de cada registro na tabela.`
- **Tooltips dos Cards:** Texto orientativo: `(o número exato de indivíduos consta na dinâmica da ocorrência.)`.
- **Tabela Compacta e Uniforme:** As linhas da tabela mantêm altura padronizada; a narrativa longa da dinâmica NÃO estufa a tabela.
- **Modal "Ficha da Ocorrência":** Ao clicar em "Ver Ficha", abre modal com todos os dados da ocorrência, destaque para a dinâmica e botão **"Copiar Histórico"** para a área de transferência com feedback visual temporário (*"Copiado com sucesso!"*).

#### ABA 3: FALTAS DE EFETIVO NO POE
- **Origem:** Planilha do Formulário de Faltas do POE.
- **Heurística de Contagem Inteligente:**
  - Identificação precisa de militares faltosos em campos de texto livre com separadores (ponto e vírgula, quebra de linha).
  - Reconhecimento de patentes (SD, CB, SGT, SUBTEN, TEN, CAP, MAJ, CEL) e registros gerais (RG).
  - Exclusão rigorosa de termos de "sem falta" (*"Sem alteração"*, *"Nada consta"*, *"Não houve"*, *"OK"*, *"0"*).
- **Consolidação Estatística:** Total de envios, total de policiais faltosos, OPMs afetadas, e resumo diário por Carimbo de Data/Hora.
- **Modal "Ficha de Envio":** Modal detalhado contendo no rodapé o botão **"Copiar Toda a Ficha"**, que formata um texto limpo e padronizado pronto para envio via WhatsApp ou despacho militar:
  ```text
  === FICHA DE ENVIO DE FALTAS NO POE ===
  Carimbo Data/Hora: [Data/Hora]
  Comando Intermediário: [CPA]
  OPM: [BPM]
  Serviço / Turno: [Serviço]
  Informante: [Posto Nome] (RG PM: [RG])
  Quantitativo de Faltas: [X] falta(s)

  --- RELAÇÃO DE POLICIAIS FALTOSOS (POE) ---
  [Lista dos militares faltosos]

  --- DISPENSAS REGISTRADAS NO POE ---
  [Dispensas se houver]
  ```

#### ABA 4: VERIFICAÇÃO DE FALTAS (EXCLUSIVA ADMIN)
- **Objetivo:** Auditoria contra envios duplicados pela mesma OPM, identificação de divergências e validação para confecção do relatório oficial de efetivo.

#### ABA 5: DASHBOARD ELEIÇÕES 2026 (BUSINESS INTELLIGENCE)
- **Integração:** Incorporação via `<iframe>` do painel oficial do Google Looker Studio / Data Studio.
- **Acesso Seguro:** Exibe banner orientando que o acesso é restrito aos e-mails autorizados no Google corporativo. Se o usuário não possuir autorização no Google, o próprio Looker bloqueia o acesso com tela de permissão.
- **Botões de Ação:** "Recarregar Painel" e "Abrir no Looker Studio" (abertura direta em tela cheia / nova aba).
- **Compatibilidade Móvel:** Dica para girar o aparelho na horizontal ou abrir em tela cheia no navegador do celular.

---

### 4. INTEGRAÇÃO E PARSING DAS PLANILHAS GOOGLE (CSV EXPORT)
- Utilizar links publicados da web do Google Sheets (`/pub?gid=...&single=true&output=csv`).
- Sanitização de CSV resiliente:
  - Remoção de BOM (`\uFEFF`).
  - Suporte a células com quebras de linha entre aspas duplas (`"texto\ncom\nquebra"`).
  - Limpeza e normalização dos nomes de Comandos Intermediários (ex.: converter `1 CPA`, `1o CPA`, `1º cpa` para o padrão canônico `1º CPA`).
- Modal de Configuração de Links acessível pelo Admin para trocar ou redefinir os links das planilhas em tempo de execução sem alterar o código-fonte.
```

---

## ESTRUTURA DOS ARQUIVOS DO PROJETO

Caso vá criar os arquivos manualmente ou precise inspecionar a arquitetura:

| Arquivo / Diretório | Responsabilidade |
| :--- | :--- |
| `src/types.ts` | Tipos TypeScript centrais (`LocalVotacao`, `Ocorrencia`, `FaltaEfetivo`, `ActiveTab`). |
| `src/App.tsx` | Componente raiz, controle de autenticação, polling/sincronização de planilhas e roteamento de abas. |
| `src/components/Header.tsx` | Cabeçalho superior com identificação institucional, contadores dinâmicos, ações rápidas e barra de navegação com 5 abas. |
| `src/components/Footer.tsx` | Rodapé com identificação da equipe (EMG-PM/3), desenvolvedor e versão registrada do sistema (`Versão 3.0`). |
| `src/components/LoginScreen.tsx` | Tela de autenticação com separação de perfis (`admin` e `pm3`). |
| `src/components/LocaisTab.tsx` | Dashboard completo de locais de votação, seções, eleitores, áreas sensíveis e desmobilização. |
| `src/components/OcorrenciasTab.tsx` | Dashboard de ocorrências e crimes, notas metodológicas, modais e cópia de histórico. |
| `src/components/FaltasTab.tsx` | Tabela analítica de faltas, heurística de contagem de policiais faltosos e ficha com cópia formatada. |
| `src/components/VerificacaoTab.tsx` | Painel de auditoria de duplicidades e validação de envios das OPMs (restrito Admin). |
| `src/components/DashboardEleicoesTab.tsx` | Visualizador integrado do Google Looker Studio com suporte mobile e links diretos. |
| `src/components/SheetConnectionModal.tsx` | Gerenciador de URLs do Google Sheets com validação, persistência e fallback. |
| `src/services/sheetService.ts` | Parsers de CSV de alta tolerância a falhas para Locais, Ocorrências e Faltas. |
| `src/services/pdfService.ts` | Motor de geração de relatórios em PDF com cabeçalho oficial, notas técnicas e paginação. |
| `src/lib/csvHelper.ts` | Módulo utilitário para download com timeout, armazenamento em cache e persistência em arquivos JSON locais. |

---

## REGRAS CRÍTICAS DE NEGÓCIO E METODOLOGIA OPERACIONAL

### 1. Distinção entre "Número de Ocorrências" e "Número de Indivíduos"
- O formulário do Google Forms registra **formulários enviados pelas OPMs**.
- Um único envio pode narrar a condução de 1, 5 ou nenhum indivíduo (ex.: condução que não resultou em flagrante).
- Por isso, os cards de crimes e relatórios sempre contabilizam **ocorrências** e exibem obrigatoriamente a nota metodológica:
  > *"Os quantitativos referem-se ao número de ocorrências e registros informados pelas OPMs via formulário de ocorrência. O quantitativo exato de indivíduos conduzidos/custodiados caso existam, constam no histórico (Dinâmica do Fato) de cada registro na tabela."*

### 2. Heurística de Faltas no POE
- Policiais não devem ser contados se o texto contiver frases de normalidade como *"Sem alteração"*, *"Nenhum militar faltoso"*, *"Zero faltas"*, *"OK"*.
- Quando há militares faltosos, o sistema busca quebras de linha ou ponto-e-vírgula e valida patentes militares ou formato de RG (`RG 12.345` ou números com 5 a 7 dígitos).

### 3. Normalização de Comandos Intermediários (CPAs)
Os Comandos Intermediários aceitos e normalizados canonicamente são:
- `1º CPA` (Zona Central/Portuária/Sul da Capital)
- `2º CPA` (Zona Oeste da Capital)
- `3º CPA` (Baixada Fluminense)
- `4º CPA` (Niterói, São Gonçalo e Região dos Lagos)
- `5º CPA` (Sul Fluminense e Costa Verde)
- `6º CPA` (Norte e Noroeste Fluminense)
- `7º CPA` (Região Serrana)
- `8º CPA` (Zona Norte da Capital e Subúrbio)
- `CPP` (Comando de Polícia Pacificadora)
- `COE` (Comando de Operações Especiais)
- `CPE` (Comando de Policiamento Especializado)

---

## CREDENCIAIS PADRÃO DO SISTEMA

| Perfil | Usuário | Senha | Nível de Acesso |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin` | `74029jr` | Acesso total, configuração de planilhas e auditoria. |
| **Operador PM/3** | `pm3` | `pm3` | Visualização operacional, consultas e exportação de PDF. |

---

*(Fim do documento de replicação e documentação técnica oficial)*
