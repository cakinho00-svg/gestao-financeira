Correções da Etapa 4

Ajustes realizados:
- Corrigido o funcionamento dos botões de editar/excluir lançamentos com dados vindos do Firestore.
- Dashboard passou a ter filtro de mês/ano.
- Histórico de lançamentos passou a ter filtro de mês/ano.
- Dashboard não inicia mais com lançamentos fixos de exemplo.
- Últimos lançamentos do dashboard agora refletem o mês selecionado.
- Cards de receitas, despesas e saldo agora consideram o mês selecionado.
- Despesas fixas ativas entram automaticamente no mês selecionado.
- Gastos por categoria agora exibem valor e percentual na legenda.
- Gráfico de categoria agora é atualizado com os dados reais do Firestore.

Observação:
- Se você lançar uma despesa em um mês diferente do filtro atual, o app agora muda automaticamente o filtro para o mês do lançamento.
- Os dados continuam separados por usuário logado no Firebase Authentication.
