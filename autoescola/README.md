# Autoescola Vale do Pindaré

Aplicativo web instalável para alunos com foto, impressão de fichas, matrículas, aulas, financeiro com parcelamento e backup JSON.

Endereço: https://diw87.github.io/Diw87-DW-tech/autoescola/

Desenvolvido por **DW Tech · Programador Dill Wherbeth**. Contato: **(99) 98110-3894**.

## Instalação

- PC: Chrome ou Edge, botão **Instalar app** ou ícone de instalação do navegador.
- Android: Chrome, botão **Instalar app** ou menu **Instalar app / Adicionar à tela inicial**.
- iPhone/iPad: Safari, **Compartilhar → Adicionar à Tela de Início → Adicionar**.

O primeiro acesso precisa de internet para armazenar os arquivos necessários ao uso offline. Os cadastros são locais por navegador/aparelho; não há sincronização entre dispositivos. Exporte o backup JSON no arquivo anterior e restaure em **Configurações** nesta versão para transferir os registros.

O serviço offline usa escopo e cache próprios em `/autoescola/`. A publicação segue o workflow Pages existente do repositório. A aplicação principal na raiz permanece independente.

## Acesso

Tela de login com marca DW Tech, opção de mostrar senha, sessão da aba e botão Sair. Este é um controle local no navegador, não autenticação em servidor. Os dados continuam no armazenamento local; não há sincronização entre aparelhos.

## Início sem registros — 21/10/2026

Os exemplos foram removidos. Na primeira abertura desta versão, os registros anteriores de alunos, matrículas, aulas, financeiro, instrutores e veículos são zerados uma única vez por navegador, conforme solicitado pelo proprietário. As configurações da escola e o acesso administrativo são mantidos. O marcador `CLEAN_START_VERSION` deve permanecer igual nas próximas versões para preservar novos cadastros.
