# Autoescola Vale do Pindaré

Aplicativo web instalável para alunos com foto, impressão de fichas, matrículas, aulas, financeiro com parcelamento e backup JSON.

Endereço: https://diw87.github.io/Diw87-DW-tech/autoescola/

Desenvolvido por **DW Tech · Programador Dill Wherbeth**. Contato: **(99) 98110-3894**.

## Instalação

- PC: Chrome ou Edge, botão **Instalar app** ou ícone de instalação do navegador.
- Android: Chrome, botão **Instalar app** ou menu **Instalar app / Adicionar à tela inicial**.
- iPhone/iPad: Safari, **Compartilhar → Adicionar à Tela de Início → Adicionar**.

O acesso e o salvamento de cadastros exigem conexão à internet. Alunos, matrículas, aulas, instrutores, veículos e financeiro são armazenados no banco Supabase da autoescola e sincronizados entre aparelhos (consulta a cada aproximadamente 8 segundos). Para transferir os registros locais da versão antiga, use **Configurações → Importar cadastros antigos deste aparelho** no notebook que possui os cadastros, ou restaure um backup JSON.

O serviço offline usa escopo e cache próprios em `/autoescola/`. A publicação segue o workflow Pages existente do repositório. A aplicação principal na raiz permanece independente.

## Acesso

Tela de login com usuário administrativo fixo e senha validada no servidor, sessão mantida na aba, botão Sair e serviço de API no Supabase. Não há gravação automática de dados pessoais no armazenamento local; somente a sessão permanece no sessionStorage.

## Início sem registros — 21/10/2026

Os exemplos foram removidos. Na primeira abertura desta versão, os registros anteriores de alunos, matrículas, aulas, financeiro, instrutores e veículos são zerados uma única vez por navegador, conforme solicitado pelo proprietário. As configurações da escola e o acesso administrativo são mantidos. O marcador `CLEAN_START_VERSION` deve permanecer igual nas próximas versões para preservar novos cadastros.

## Correção de valores — 23/10/2026

O campo de valor de matrícula e parcelas permite centavos sem erro de intervalo HTML (step=any), com arredondamento para duas casas decimais no salvamento. Versão do aplicativo atualizada para 1.6 e cache PWA renovado, sem apagar registros existentes.

## Migração para a nuvem — 23/10/2026

Versão 2.0. Agora usa API privada da Edge Function `autoescola-gateway` e banco `autoescola_shared_state`, com validação da conta no servidor. Conflitos de atualização entre aparelhos são mesclados por registro e salvos com controle de versão. Sincronização/consulta a cada ~8 segundos. O aplicativo não deve ser fechado se indicar "Não sincronizado". O backup JSON continua disponível. Não publique senha ou chave de serviço no repositório.
