# SISTEMA EMG-PM/3 — DOCUMENTAÇÃO TÉCNICA E MODELO DE REPLICAÇÃO (VERSÃO 3.0)
## Manual de Arquitetura, Kill-Switch Remoto via Google Sheets e Prompt Mestre

> **Finalidade deste Documento:**  
> Este documento consolida todas as inovações, regras de negócio, especificações visuais e o mecanismo de **Bloqueio/Desconexão Remota em Tempo Real (Kill-Switch)** desenvolvidos para o sistema EMG-PM/3.  
> Ele serve tanto como documentação oficial deste projeto quanto como **molde/template completo para clonagem e replicação em novos sistemas** (ex.: Eleições futuras, Carnaval, Réveillon, Grandes Eventos ou Operações Integradas).

---

# PARTE 1: ORIENTAÇÃO OPERACIONAL — APÓS O TÉRMINO DA OPERAÇÃO

Como a eleição terminou e a próxima do mesmo tipo só ocorrerá em 2 anos, existem **3 caminhos operacionais** para o sistema e o link no Vercel:

### 1. Opção Recomendada: Manter na Vercel e Ativar o Bloqueio na Planilha (`BLOQUEADO`)
- **Como funciona:** Você simplesmente abre a Planilha Google de Controle de Acesso e altera a célula **A2** para **`BLOQUEADO`**.
- **O que acontece:** Qualquer pessoa que tenha o link salvo (no celular, favoritos ou histórico) não conseguirá visualizar nenhum dado. A tela de login exibirá imediatamente:
  > *"ACESSO SUSPENSO PELA ADMINISTRAÇÃO: O acesso para usuários visitantes foi interrompido!"*
- **Vantagem:** O custo na Vercel é **zero (gratuito)**. O link permanece guardado e, daqui a 2 anos ou num teste futuro, basta você alterar a célula para `LIBERADO` e o sistema volta a funcionar instantaneamente, sem precisar reconfigurar servidores ou reimportar repositórios.

### 2. Opção Pausar o Projeto na Vercel (*Pause Project*)
- **Como funciona:** No painel da Vercel (`vercel.com`), acesse o projeto `Settings` ➔ `General` ➔ Role até o final ➔ Clique em **"Pause Project"**.
- **O que acontece:** O domínio para de responder na web (exibe tela padrão de projeto pausado). Ninguém consegue acessar nem a tela de login.
- **Vantagem:** Totalmente reversível com um único clique em *"Resume Project"*.

### 3. Opção Excluir o Projeto na Vercel (*Delete Project*)
- **Como funciona:** No painel da Vercel ➔ `Settings` ➔ `Advanced` ➔ `Delete Project`.
- **Consequências:**
  - O link atual (ex.: `eleicoes-pmerj.vercel.app`) é **apagado imediatamente** da internet.
  - O código-fonte **NÃO se perde**, pois ele fica guardado no repositório Git e no AI Studio.
  - Daqui a 2 anos, quando for subir novamente, você poderá conectar o novo repositório na Vercel. Se o nome anterior estiver vago, poderá usar o mesmo, ou poderá escolher um novo endereço mais adequado (ex.: `eleicoes2028-pmerj.vercel.app`).
  - **Recomendação:** Se você não quer deixar nenhum rastro público online durante o intervalo de 2 anos, a exclusão na Vercel é 100% segura e limpa.

---

# PARTE 2: ESPECIFICAÇÃO DE DESIGN, CORES E INTERFACE

### 1. Paleta de Cores (Tailwind CSS)
O sistema adota um padrão visual sóbrio, corporativo e com rigor militar:

| Função Visual | Classes Tailwind | Hexadecimal Aproximado | Aplicação no Sistema |
| :--- | :--- | :--- | :--- |
| **Fundo Principal** | `bg-slate-100` / `bg-slate-50` | `#F1F5F9` / `#F8FAFC` | Fundo geral da aplicação e áreas de leitura |
| **Superfícies / Cards**| `bg-white` + `border-slate-200` | `#FFFFFF` / `#E2E8F0` | Cards de KPIs, tabelas, modais |
| **Cabeçalhos e Texto Forte** | `text-slate-900` / `bg-slate-900` | `#0F172A` | Títulos oficiais, badges de identificação e footer |
| **Azul Institucional** | `bg-blue-700` / `text-blue-700` | `#1D4ED8` | Ações principais, aba ativa, destaques e botões |
| **Verde Status Liberado** | `bg-emerald-500` / `text-emerald-700` | `#10B981` / `#047857` | Badge de visitantes liberados, confirmações |
| **Vermelho Alerta / Bloqueio** | `bg-rose-600` / `text-rose-700` | `#E11D48` / `#BE123C` | Badge de bloqueio, áreas sensíveis, avisos de corte |
| **Âmbar Atenção** | `bg-amber-500` / `text-amber-700` | `#F59E0B` / `#B45309` | Urnas em implantação, alertas operacionais |

### 2. Tipografia e Densidade
- **Fonte Padrão:** Sans-serif nativa de alta legibilidade (`Inter`, `system-ui`).
- **Tabelas Compactas:** Altura de linha padronizada (`py-2` a `py-2.5`), sem estufamento por textos longos. Textos longos são truncados ou visualizados via modal dedicado (*"Ficha da Ocorrência"*).
- **Sem Emojis Informais:** Interface utiliza exclusivamente ícones profissionais da biblioteca `lucide-react` (ex.: `Shield`, `FileSpreadsheet`, `Download`, `RefreshCw`, `Lock`, `ExternalLink`).

---

# PARTE 3: AUTENTICAÇÃO E PERFIS DE USUÁRIO (RBAC)

O sistema possui controle de acesso com 2 perfis claramente segregados:

| Perfil | Usuário | Senha Padrão | Funcionalidades Permitidas | Restrições |
| :--- | :--- | :--- | :--- | :--- |
| **ADMINISTRADOR** | `admin` | `74029jr` | - Acesso total às 5 abas<br>- Configuração de URLs de planilhas (Item 1 ao 4)<br>- Aba exclusiva: **Verificação e Auditoria de Faltas**<br>- Visualização do badge de status do Kill-Switch no topo<br>- Imune ao bloqueio de visitantes | Nenhuma restrição |
| **OPERADOR / VISITANTE** | `pm3` | `pm3` | - Visualização de Locais de Votação<br>- Visualização de Ocorrências e Ficha detalhada<br>- Visualização de Faltas e Ficha de Envio<br>- Acesso ao Dashboard de BI (Looker Studio)<br>- Exportação de relatórios em PDF | - **Botão de Configurar Planilhas OCULTO**<br>- **Aba de Verificação de Faltas OCULTA**<br>- **Sujeito à expulsão imediata pelo Kill-Switch** |

---

# PARTE 4: O MECANISMO DE KILL-SWITCH REMOTO (BLOQUEIO E DESCONEXÃO)

Esta é uma das maiores inovações arquiteturais do projeto: **controle centralizado em tempo real sem necessidade de servidor de banco de dados próprio (serverless puro)**.

### Como Funciona a Comunicação Cruzada (Celular Admin ➔ PC Visitante)
1. **Origem da Verdade:** Uma Planilha Google dedicada (`CONTROLE ACESSO`).
   - Coluna A, Linha 1: Cabeçalho `CONTROLE`
   - Coluna A, Linha 2: Dropdown com as opções `LIBERADO` ou `BLOQUEADO`
2. **Sincronização em Tempo Real (Polling a cada 5 segundos):**
   - O computador do visitante executa um ciclo de verificação em background a cada 5.000ms via `checkLiveControleStatus()`.
   - A requisição utiliza cache-busting dinâmico (`_t=${Date.now()}`) para impedir que a Vercel ou o navegador entreguem dados em cache.
3. **Ação Imediata ao Detectar `BLOQUEADO`:**
   - O sistema do visitante **purga instantaneamente** o `localStorage` (`auth_token`, `user_role`).
   - Altera os estados da aplicação para deslogado (`isAuthenticated = false`, `userRole = ''`).
   - Redireciona o usuário para a tela de login exibindo o banner:
     > **ACESSO SUSPENSO PELA ADMINISTRAÇÃO: O acesso para usuários visitantes foi interrompido!**
   - Não exibe ícones agressivos de alerta — visual limpo, centralizado e corporativo.
   - Qualquer nova tentativa de login do usuário `pm3` é sumariamente rejeitada enquanto a planilha estiver `BLOQUEADO`.
4. **Painel do Administrador:**
   - No cabeçalho superior (`Header`), o Admin visualiza um indicador visual em tempo real:
     - `VISITANTES: LIBERADO` (em tom esmeralda discreto)
     - `VISITANTES: BLOQUEADO` (em tom vermelho rose)
   - No modal de planilhas (**Item 4**): O Admin conta com o botão **"Abrir Planilha no Google"**, que abre diretamente o Google Sheets para alterar a célula A2 do celular ou de qualquer computador.

---

# PARTE 5: ARQUITETURA DE DADOS E CONEXÃO COM AS 4 PLANILHAS GOOGLE

Todas as conexões utilizam o formato CSV público exportado pelo Google Sheets:

1. **Planilha 1: Locais de Votação (5.102 registros)**
   - Extrai: Zona Eleitoral, Seção, Local, Endereço, Bairro, Município, CPA, OPM, Total de Eleitores, Indicador de Local Sensível e Falhas de Energia Elétrica.
2. **Planilha 2: Ocorrências de Vulto (Respostas do Google Forms)**
   - Extrai: Carimbo de data/hora, CPA, OPM, Município, as 5 Perguntas Oficiais de Crimes e a Dinâmica Narrativa do Fato.
   - **Nota Metodológica Obrigatória:** Todo relatório e card de ocorrências exibe a nota explicativa de que os números referem-se a ocorrências/registros, constando os indivíduos na dinâmica.
3. **Planilha 3: Faltas de Efetivo no POE (Respostas do Google Forms)**
   - Heurística inteligente que identifica nomes, patentes militares (SD, CB, SGT, SUBTEN, TEN, CAP, MAJ, CEL) e RGs.
   - Suporte a múltiplos militares na mesma resposta separados por quebra de linha, ponto e vírgula ou barras (ex: `2º SGT PM RG 87.096 DAS NEVES - 2º BPM / CB PM RG 104.996 DEBAQUER - 2º BPM` computa exatamente 2 faltas).
   - Ignora automaticamente envios sem faltas (*"Sem alteração"*, *"Zero"*, *"OK"*).
   - Ficha de Envio com botão de cópia formatada para despacho militar/WhatsApp.
   - Visão simplificada com quantidade de faltas por CPA e por OPM.
4. **Planilha 4: Controle de Acesso (Kill-Switch)**
   - Lê a célula A2 para autorizar ou suspender o acesso em massa dos visitantes.
   - Tolerância do parser a arquivos curtos (`CONTROLE\r\nLIBERADO` tem 18 caracteres).

---

# PARTE 6: PROMPT MESTRE PARA COPIAR E COLAR NO AI STUDIO (REPLICAÇÃO EM OUTROS SISTEMAS)

Copie o conteúdo dentro do bloco de código abaixo e cole no AI Studio para recriar esta mesma arquitetura em qualquer novo projeto:

```markdown
Atue como Engenheiro de Software Sênior especialista em aplicações corporativas e de segurança pública. Construa um Sistema Integrado de Gestão e Acompanhamento Operacional com arquitetura React + Vite + TypeScript + Tailwind CSS, com controle de perfis (RBAC) e Mecanismo de Kill-Switch Remoto via Google Sheets conforme as especificações detalhadas abaixo:

---

### 1. IDENTIDADE VISUAL E DESIGN SYSTEM
- Paleta Militar/Corporativa: Fundo cinza suave (slate-100/slate-50), cards brancos com bordas slate-200, azul operacional (blue-700), esmeralda (emerald-600) para status liberado e rose (rose-600) para status bloqueado ou alertas.
- Tipografia limpa, tabelas compactas sem estufamento de linhas por narrativas longas.
- Ícones profissionais da biblioteca Lucide React (sem emojis informais).
- Responsividade completa para smartphones e desktops (touch-pan-x, menus adaptáveis).

---

### 2. CONTROLE DE ACESSO E PERFIS (RBAC)
- Tela de Login com validação de perfis:
  1. Perfil ADMIN (usuário: `admin` / senha: `[SENHA_ADMIN]`): Acesso irrestrito a todas as abas, modal de configuração de links das planilhas Google e abas de auditoria. Imune ao corte de visitantes.
  2. Perfil OPERADOR / VISITANTE (usuário: `visitante` ou `pm3` / senha: `[SENHA_VISITANTE]`): Acesso às abas operacionais. Botão de configuração de planilhas e abas de auditoria ficam estritamente ocultos. Sujeito ao Kill-Switch remoto.

---

### 3. MECANISMO DE KILL-SWITCH REMOTO EM TEMPO REAL (DESCONEXÃO VIA GOOGLE SHEETS)
- O sistema deve permitir que o Administrador suspenda o acesso de todos os visitantes em tempo real diretamente por uma Planilha Google (sem necessidade de banco de dados SQL).
- Especificação da Planilha de Controle:
  - Cabeçalho A1: `CONTROLE`
  - Célula A2: Dropdown com as opções `LIBERADO` ou `BLOQUEADO`.
- Polling em Segundo Plano:
  - O aplicativo do visitante faz requisições a cada 5 segundos na URL CSV da planilha com parâmetro de cache-busting (`_t=${Date.now()}`).
  - O parser de CSV deve aceitar respostas curtas (o texto `CONTROLE\r\nLIBERADO` possui menos de 20 caracteres).
- Ação de Desconexão Imediata:
  - No segundo em que a célula A2 se torna `BLOQUEADO`, qualquer sessão de visitante ativa é encerrada imediatamente. O localStorage de autenticação é apagado, a tela fecha e redireciona para o login.
  - Mensagem padronizada na tela de login:
    "ACESSO SUSPENSO PELA ADMINISTRAÇÃO: O acesso para usuários visitantes foi interrompido!"
  - Estilização do aviso: texto centralizado, elegante, fundo suave com borda de destaque, sem ícones agressivos.
  - Novas tentativas de login de visitantes são bloqueadas enquanto a célula estiver `BLOQUEADO`.
- Painel do Administrador:
  - Exibe no cabeçalho um badge em tempo real com o status atual: `VISITANTES: LIBERADO` (verde) ou `VISITANTES: BLOQUEADO` (vermelho).
  - No modal de configuração de planilhas, disponibilizar campo de URL e botão direto "Abrir Planilha no Google" para permitir que o Admin alterne entre LIBERADO e BLOQUEADO direto no celular.

---

### 4. INTEGRAÇÃO COM PLANILHAS GOOGLE (CSV EXPORT)
- Conexão via URLs públicas do Google Sheets no formato CSV (`/pub?gid=...&single=true&output=csv`).
- Sanitização de CSV de alta tolerância: remoção de Byte Order Mark (BOM \uFEFF), suporte a quebras de linha dentro de células entre aspas duplas, e normalização automática de nomes de unidades/comandos.
- Fallback Offline/Contingência: Armazenamento em cache local e persistência em arquivos JSON locais para garantir que a aplicação continue funcionando mesmo se a conexão cair temporariamente.

---

### 5. EXPORTAÇÃO E FERRAMENTAS DE DESPACHO
- Exportação de relatórios analíticos em PDF (paisagem A4) utilizando jsPDF + jspdf-autotable, com cabeçalho oficial, totalizadores e numeração de páginas.
- Modais de detalhamento ("Ficha de Ocorrência" / "Ficha de Envio") com botão de cópia rápida para transferência formatada para despacho militar e WhatsApp.
- Rodapé com identificação da equipe responsável, desenvolvedor e versão registrada do sistema.
```

---

# PARTE 7: CRÉDITOS E REGISTRO DE VERSÃO

- **Sistema:** EMG-PM/3 — Planejamento e Acompanhamento Operacional (Eleições)
- **Versão Homologada:** `Versão 3.0`
- **Desenvolvedor:** Dev.Fiel.26
- **Equipe Responsável:**
  - Chefe da PM/3: Coronel Christoph
  - Subchefe da PM/3: Ten. Coronel Moraes
  - Encarregado: Major Zelenka
