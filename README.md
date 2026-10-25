# Sistema EMG-PM/3 — Planejamento e Acompanhamento das Eleições 2026 (Versão 3.0)

Sistema desenvolvido para a Seção de Planejamento e Operações do Estado-Maior Geral (EMG-PM/3), integrando dados operacionais dos Locais de Votação, Ocorrências de Vulto, Faltas de Efetivo no POE, Painel Estratégico de BI (Google Looker Studio) e **Mecanismo de Bloqueio/Desconexão Remota em Tempo Real (Kill-Switch via Google Sheets)**.

---

## 📋 Documentação Completa e Modelo para Outros Sistemas

O projeto conta com documentação técnica detalhada, orientações pós-eleição e um **Prompt Mestre pronto para copiar e colar no AI Studio** para replicar esta arquitetura em qualquer novo projeto:

👉 **Consulte:** [`PROMPT_REPLICACAO_SISTEMA.md`](./PROMPT_REPLICACAO_SISTEMA.md)

### Conteúdo do Documento de Replicação:
1. **Orientações Operacionais Pós-Eleição (Vercel):** Como proceder ao término das eleições de 2 em 2 anos (bloquear planilha, pausar projeto ou excluir).
2. **Design System & Cores:** Paleta corporativa/militar em Tailwind CSS, tipografia e densidade de tabelas.
3. **Controle de Acesso (RBAC):** Diferenças entre Admin (`admin` / `74029jr`) e Visitante (`pm3` / `pm3`).
4. **Mecanismo de Kill-Switch Remoto:** Arquitetura de desconexão instantânea via Google Sheets (`LIBERADO` / `BLOQUEADO`), polling de 5s e banner oficial sem ícones.
5. **Integração das 4 Planilhas Google:** Parsers tolerantes a falhas, cache-busting e resiliência offline.
6. **Prompt Mestre Copiável:** Modelo completo e estruturado para iniciar novos projetos no AI Studio com todas essas funções nativas.

---

## 🚀 Módulos e Abas Ativas

1. **Locais de Votação:** Totalização de eleitores, seções, áreas sensíveis, controle de implantação/desmobilização e filtro por CPA/OPM.
2. **Ocorrências (2º Turno):** Apuração dos 5 tipos de crimes do formulário, contagem exata de ocorrências com nota metodológica oficial e Ficha com cópia rápida do histórico.
3. **Faltas (2º Turno):** Tabela analítica com contagem inteligente de faltosos, exclusão de registros "sem alteração" e Ficha com botão de cópia formatada para despacho/WhatsApp.
4. **Verificação de Faltas (Exclusiva Admin):** Módulo de auditoria para identificar duplicidades ou divergências enviadas pelas OPMs.
5. **Dashboard Eleições 2026:** Painel de BI oficial integrado do Google Looker Studio com visualização interna e atalho para tela cheia, protegido por permissões do Google Workspace.

---

## 🔐 Acesso e Perfis

| Perfil | Usuário | Senha | Nível de Acesso |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin` | `74029jr` | Acesso irrestrito a todas as abas, configuração de planilhas e auditoria. |
| **Operador PM/3** | `pm3` | `pm3` | Visualização operacional, consultas e exportação de PDF. |

---

## 🛠️ Execução e Desenvolvimento

- **Servidor Dev:** `npm run dev` (Porta 3000)
- **Compilação e Verificação:** `npm run lint` e `npm run build`
