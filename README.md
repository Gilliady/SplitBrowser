# Fixed Tool 📌

> **Desktop overlay app** — Fixe qualquer site ou aplicação web no topo da sua tela enquanto trabalha ou joga.

O **Fixed Tool** é uma ferramenta desktop construída com Electron que permite fixar múltiplos websites e ferramentas em janelas flutuantes com transparência ajustável, múltiplos layouts de grade, suporte a áreas de trabalho (workspaces) e modo *click-through* (onde os cliques passam diretamente para a janela de baixo).

---

## ✨ Funcionalidades

- **Sempre no Topo (Always-on-Top):** Mantenha suas anotações, guias, vídeos ou ferramentas de monitoramento visíveis sobre qualquer aplicação ou jogo.
- **Múltiplos Workspaces & Abas:** Crie áreas de trabalho separadas com diferentes coleções de páginas.
- **Layouts em Grade Flexíveis:**
  - `1x1` (Foco total / 1 janela)
  - `1x2` (Lado a lado / 2 colunas)
  - `2x1` (Empilhado / 2 linhas)
  - `2x2` (Grade com 4 quadrantes)
  - `1x3` e `3x1` (3 colunas ou 3 linhas)
  - `3x3` (Grade com até 9 quadrantes)
  - `Auto` (Distribuição dinâmica automática)
- **Modo Click-Through:** Torne a janela translúcida para cliques do mouse, permitindo interagir diretamente com o conteúdo que está atrás do overlay.
- **Controle de Opacidade:** Ajuste deslizante em tempo real entre 10% e 100%.
- **Otimização de RAM e Cache:** Controle estrito de heap V8, limpeza manual de cache/RAM com botão dedicado e rotina periódica automática para prevenir alto consumo de memória.
- **Hibernação Inteligente de Abas:** Suspende abas inativas para economizar recursos da máquina.
- **Bandeja do Sistema (System Tray):** Acesso rápido, controle de visibilidade e encerramento diretamente pela bandeja do Windows.

---

## ⌨️ Atalhos Globais Padrão

| Ação | Atalho Padrão | Descrição |
| :--- | :---: | :--- |
| **Alternar Click-Through** | `Ctrl + Shift + O` | Ativa/desativa a passagem de cliques através do overlay |
| **Ocultar / Exibir Janela** | `Ctrl + Shift + H` | Esconde ou restaura a janela principal instantaneamente |

*(Os atalhos podem ser personalizados na janela de **Configurações**)*

---

## 📋 Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:

- [Node.js](https://nodejs.org/) (versão **18.x** ou superior recomendada; testado com Node 20+ e 24+)
- **npm** (incluso com o Node.js) ou outro gerenciador de pacotes compatível
- **Sistema Operacional:** Windows 10/11 (para build do instalador NSIS e executável portátil x64)

---

## 🚀 Instalação e Inicialização

### 1. Clonar o repositório

```bash
git clone https://github.com/PeakGilli/Fixed-tool.git
cd "Fixed tool"
```

### 2. Instalar as dependências

```bash
npm install
```

---

## 💻 Execução em Desenvolvimento

Para rodar o aplicativo localmente em modo de desenvolvimento:

```bash
# Execução padrão
npm start

# Execução em modo dev (com flags de desenvolvimento)
npm run dev
```

---

## 📦 Build e Empacotamento

O projeto utiliza o **electron-builder** configurado para gerar instaladores e binários portáteis para Windows (x64).

### Gerar os Executáveis de Produção

```bash
npm run build
```

Este comando gera os seguintes arquivos no diretório `dist/`:
- `Fixed Tool Setup <versao>.exe`: Instalador assistido (NSIS) com opção de escolher pasta de instalação.
- `Fixed Tool <versao>.exe`: Versão portátil (não necessita de instalação).

### Teste Rápido de Empacotamento (Sem criar instalador)

Para validar o empacotamento sem gerar o arquivo `.exe` instalador final:

```bash
npm run pack
```

Os arquivos da aplicação descompactada serão criados em `dist/win-unpacked/`.

---

## 📁 Estrutura do Projeto

```text
Fixed tool/
├── dist/                 # Artefatos compilados e instaladores gerados pelo build
├── src/
│   ├── index.html        # Interface principal (workspaces, toolbar e grid de webviews)
│   ├── index.css         # Estilização da interface principal
│   ├── renderer.js       # Lógica do renderer (gerenciamento de abas, layouts, webviews)
│   ├── settings.html     # Janela de configurações
│   ├── settings.css      # Estilização das configurações
│   └── settings.js       # Lógica de salvamento das opções do usuário
├── main.js               # Processo principal do Electron (lifecycle, janelas, tray, atalhos)
├── preload.js            # Context bridge segura entre o Electron e o frontend
├── store.js              # Gerenciamento de estado persistente com electron-store
├── package.json          # Metadados, dependências e scripts npm
└── README.md             # Documentação do projeto
```

---

## 🛠️ Tecnologias Utilizadas

- [Electron](https://www.electronjs.org/)
- [electron-builder](https://www.electron.build/)
- [electron-store](https://github.com/sindresorhus/electron-store)
- HTML5 / CSS3 / JavaScript (Vanilla)

---

## 📄 Licença

Distribuído sob a licença de seu criador original. Consulte os arquivos de projeto para mais informações.
