# Sistema EMG-PM/3 — Planejamento e Acompanhamento das Eleições 2026 (Versão 3.0)

Sistema desenvolvido para a Seção de Planejamento e Operações do Estado-Maior Geral (EMG-PM/3), integrando dados operacionais dos Locais de Votação, Ocorrências de Vulto, Faltas de Efetivo no POE e Painel Estratégico de BI (Google Looker Studio).

---

## 📋 Documentação para Replicação do Sistema

Caso deseje criar outro sistema baseado neste modelo ou duplicar esta aplicação para um novo evento/operação, consulte o arquivo mestre:

👉 **[`PROMPT_REPLICACAO_SISTEMA.md`](./PROMPT_REPLICACAO_SISTEMA.md)**

Neste arquivo você encontrará o **Prompt Mestre pronto para copiar e colar no AI Studio**, contendo todas as regras de negócio, heurísticas de contagem, notas metodológicas oficiais e arquitetura de componentes.

---

## 🚀 Módulos e Abas Ativas

1. **Locais de Votação:** Totalização de eleitores, seções, áreas sensíveis, controle de implantação/desmobilização e filtro por CPA/OPM.
2. **Ocorrências (2º Turno):** Apuração dos 5 tipos de crimes do formulário, contagem exata de ocorrências com nota metodológica oficial e Ficha com cópia rápida do histórico.
3. **Faltas (2º Turno):** Tabela analítica com contagem inteligente de faltosos, exclusão de registros "sem alteração" e Ficha com botão de cópia formatada para despacho/WhatsApp.
4. **Verificação de Faltas (Admin):** Módulo de auditoria para identificar duplicidades ou divergências enviadas pelas OPMs.
5. **Dashboard Eleições 2026:** Painel de BI oficial integrado do Google Looker Studio com visualização interna e atalho para tela cheia, protegido por permissões do Google Workspace.

---

## 🔐 Acesso e Perfis

- **Administrador:** Usuário `admin` / Senha `74029jr`
- **Operador PM/3:** Usuário `pm3` / Senha `pm3`

---

## 🛠️ Execução e Desenvolvimento

- **Servidor Dev:** `npm run dev` (Porta 3000)
- **Compilação e Verificação:** `npm run lint` e `npm run build`
