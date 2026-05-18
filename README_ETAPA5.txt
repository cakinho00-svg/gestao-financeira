ETAPA 5 - CARTÕES E FATURA AUTOMÁTICA

Nesta versão foi adicionada a tela Cartões.

Funcionalidades incluídas:
- Cadastro de cartão de crédito.
- Campos: nome, limite, dia de fechamento, dia de vencimento, cor e status.
- Edição e exclusão de cartões.
- Cartões salvos no Firestore por usuário logado.
- Cartões cadastrados passam a aparecer na lista de cartão do lançamento.
- Dashboard com cards adicionais:
  - Faturas do mês
  - Limite utilizado
  - Economia do mês
- Cálculo automático da fatura conforme data da compra e dia de fechamento do cartão.

Regra adotada para fatura:
- Se a compra acontecer até o dia de fechamento, entra na fatura do mês seguinte.
- Se a compra acontecer após o fechamento, entra na fatura do segundo mês seguinte.

Exemplo:
- Compra em 18/05
- Fechamento dia 25
- A fatura será considerada em junho.

Observação:
- As regras do Firestore continuam compatíveis, pois permitem subcoleções dentro de usuarios/{uid}.
