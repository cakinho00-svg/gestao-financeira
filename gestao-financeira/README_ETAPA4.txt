ETAPA 4 - FIRESTORE

Nesta versão, o app passou a salvar na nuvem, por usuário logado:

1. Lançamentos
2. Despesas fixas
3. Opções dinâmicas: tipo, categoria, conta, cartão e categoria de despesa fixa

Antes de testar:

1. Confirme se o arquivo js/firebase.js está com o firebaseConfig do seu projeto.
2. No Firebase Console, deixe Authentication com Email/Senha ativado.
3. No Firestore, crie o banco de dados.
4. Publique as regras do arquivo firestore.rules em Firestore Database > Rules.
5. Rode o index.html pelo Live Server.
6. Faça login/cadastro e teste incluir, editar e excluir lançamentos e despesas fixas.

Estrutura criada no Firestore:

usuarios/{uid}
usuarios/{uid}/lancamentos/{id}
usuarios/{uid}/despesasFixas/{id}
usuarios/{uid}/configuracoes/opcoes
