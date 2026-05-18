import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

let usuarioAtual = null;
let unsubscribeLancamentos = null;
let unsubscribeFixas = null;
let unsubscribeCartoes = null;
let editandoId = null;
let excluindoId = null;
let editandoCartaoId = null;
let excluindoCartaoId = null;
let fixaToggleState = true;

let lancamentos = [];
let fixas = [];
let cartoes = [];
let filtroDashboardMes = mesAtual();
let filtroLancamentosMes = mesAtual();

const coresCategorias = ['#378ADD', '#1D9E75', '#EF9F27', '#D85A30', '#7F77DD', '#5DCAA5', '#A969C7', '#607D8B'];

const opcoesPadrao = {
  tiposLancamento: ['Despesa', 'Receita'],
  categoriasLancamento: ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Outros'],
  contasLancamento: ['Conta corrente', 'Cartão de crédito', 'Poupança'],
  cartoesCredito: ['Não se aplica', 'Nubank', 'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa', 'Inter', 'C6 Bank'],
  categoriasFixas: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Assinaturas', 'Outros']
};

let opcoesLancamento = JSON.parse(JSON.stringify(opcoesPadrao));
let charts = {};

function mesAtual() {
  const hoje = new Date();
  return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
}

function nomeMesAno(mesAno) {
  if (!mesAno) return '';
  const [ano, mes] = mesAno.split('-');
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function caminhoUsuario() {
  if (!usuarioAtual) throw new Error('Usuário não autenticado.');
  return doc(db, 'usuarios', usuarioAtual.uid);
}

function colUsuario(nomeColecao) {
  if (!usuarioAtual) throw new Error('Usuário não autenticado.');
  return collection(db, 'usuarios', usuarioAtual.uid, nomeColecao);
}

function docUsuario(nomeColecao, id) {
  if (!usuarioAtual) throw new Error('Usuário não autenticado.');
  return doc(db, 'usuarios', usuarioAtual.uid, nomeColecao, String(id));
}

function fmt(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatData(d) {
  if (!d) return '';
  const p = String(d).split('-');
  if (p.length !== 3) return d;
  return p[2] + '/' + p[1] + '/' + p[0];
}

function pertenceAoMes(data, mesAno) {
  if (!data || !mesAno) return false;
  return String(data).slice(0, 7) === mesAno;
}

function fixaValeParaMes(fixa, mesAno) {
  if (!fixa || !fixa.ativa) return false;
  if (!mesAno) return true;
  const inicio = String(fixa.dataInicio || '').slice(0, 7);
  return !inicio || inicio <= mesAno;
}

function despesasFixasAtivasNoMes(mesAno) {
  return fixas.filter((f) => fixaValeParaMes(f, mesAno));
}

function cartaoPorNome(nome) {
  if (!nome || nome === 'Não se aplica') return null;
  return cartoes.find((c) => String(c.nome || '').toLowerCase() === String(nome).toLowerCase()) || null;
}

function lancamentoEhCartao(l) {
  return !!cartaoPorNome(l.cartao);
}

function mesFaturaLancamento(l) {
  const cartao = cartaoPorNome(l.cartao);
  if (!cartao || !l.data) return String(l.data || '').slice(0, 7);
  const partes = String(l.data).split('-').map(Number);
  if (partes.length !== 3) return String(l.data).slice(0, 7);
  const [ano, mes, dia] = partes;
  const fechamento = Number(cartao.fechamento || 25);

  // Regra correta:
  // compra até o dia de fechamento entra na fatura do mesmo mês;
  // compra depois do fechamento entra na fatura do próximo mês.
  const mesesAdicionar = dia <= fechamento ? 0 : 1;
  const dataFatura = new Date(ano, mes - 1 + mesesAdicionar, 1);
  return dataFatura.getFullYear() + '-' + String(dataFatura.getMonth() + 1).padStart(2, '0');
}

function lancamentosCartaoDaFatura(mesAno) {
  return lancamentos.filter((l) => l.tipo !== 'Receita' && lancamentoEhCartao(l) && mesFaturaLancamento(l) === mesAno);
}

function lancamentosCartaoCompradosNoMes(mesAno) {
  return lancamentos.filter((l) => pertenceAoMes(l.data, mesAno) && l.tipo !== 'Receita' && lancamentoEhCartao(l));
}

function despesasParaDashboardMes(mesAno) {
  // O card de despesas e o gráfico de categoria mostram o que foi comprado/pago no mês selecionado.
  // Assim, uma compra no cartão em maio aparece como despesa de maio e também reduz o limite do cartão.
  return lancamentos.filter((l) => pertenceAoMes(l.data, mesAno) && l.tipo !== 'Receita');
}

function receitasParaDashboardMes(mesAno) {
  return lancamentos.filter((l) => pertenceAoMes(l.data, mesAno) && l.tipo === 'Receita');
}

function totalFaturasMes(mesAno) {
  // Para a visão principal, mostramos o total comprado no cartão dentro do mês selecionado.
  return lancamentosCartaoCompradosNoMes(mesAno).reduce((s, l) => s + Number(l.val || 0), 0);
}

function limiteTotalAtivo() {
  return cartoes.filter((c) => c.ativo !== false).reduce((s, c) => s + Number(c.limite || 0), 0);
}


function escapeHtml(texto) {
  return String(texto || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setText(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function limparFormularioLancamento() {
  const ids = ['f-desc', 'f-val', 'f-data'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (document.getElementById('f-conta')) document.getElementById('f-conta').value = opcoesLancamento.contasLancamento[0] || '';
  if (document.getElementById('f-cartao')) document.getElementById('f-cartao').value = opcoesLancamento.cartoesCredito[0] || '';
}

function montarDetalheLancamento(l) {
  const partes = [l.cat, formatData(l.data)];
  if (l.conta) partes.push(l.conta);
  if (l.cartao && l.cartao !== 'Não se aplica') partes.push(l.cartao);
  return partes.filter(Boolean).join(' · ');
}

function popularSelect(selectId, lista) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const valorAtual = select.value;
  select.innerHTML = lista.map((item) => `<option>${escapeHtml(item)}</option>`).join('');
  if (valorAtual && lista.includes(valorAtual)) select.value = valorAtual;
}

function renderOpcoesLancamento() {
  const nomesCartoesCadastrados = cartoes.map((c) => c.nome).filter(Boolean);
  const listaCartoes = Array.from(new Set([...(opcoesLancamento.cartoesCredito || []), ...nomesCartoesCadastrados]));
  opcoesLancamento.cartoesCredito = listaCartoes;
  popularSelect('f-tipo', opcoesLancamento.tiposLancamento);
  popularSelect('e-tipo', opcoesLancamento.tiposLancamento);
  popularSelect('f-cat', opcoesLancamento.categoriasLancamento);
  popularSelect('e-cat', opcoesLancamento.categoriasLancamento);
  popularSelect('f-conta', opcoesLancamento.contasLancamento);
  popularSelect('e-conta', opcoesLancamento.contasLancamento);
  popularSelect('f-cartao', listaCartoes);
  popularSelect('e-cartao', listaCartoes);
  popularSelect('fix-cat', opcoesLancamento.categoriasFixas);
}

async function salvarOpcoesLancamento() {
  if (!usuarioAtual) return;
  await setDoc(doc(db, 'usuarios', usuarioAtual.uid, 'configuracoes', 'opcoes'), opcoesLancamento, { merge: true });
}

async function carregarOpcoesFirestore() {
  if (!usuarioAtual) return;
  const ref = doc(db, 'usuarios', usuarioAtual.uid, 'configuracoes', 'opcoes');
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const salvas = snap.data();
    opcoesLancamento = {
      tiposLancamento: salvas.tiposLancamento || opcoesPadrao.tiposLancamento.slice(),
      categoriasLancamento: salvas.categoriasLancamento || opcoesPadrao.categoriasLancamento.slice(),
      contasLancamento: salvas.contasLancamento || opcoesPadrao.contasLancamento.slice(),
      cartoesCredito: salvas.cartoesCredito || opcoesPadrao.cartoesCredito.slice(),
      categoriasFixas: salvas.categoriasFixas || opcoesPadrao.categoriasFixas.slice()
    };
  } else {
    opcoesLancamento = JSON.parse(JSON.stringify(opcoesPadrao));
    await salvarOpcoesLancamento();
  }

  renderOpcoesLancamento();
}

function garantirOpcaoExistente(chave, valor) {
  if (!valor || !opcoesLancamento[chave]) return;
  const existe = opcoesLancamento[chave].some((item) => item.toLowerCase() === String(valor).toLowerCase());
  if (!existe) opcoesLancamento[chave].push(valor);
}

function lancamentosDoMes(mesAno) {
  return lancamentos.filter((l) => pertenceAoMes(l.data, mesAno));
}

function despesasFixasAtivas() {
  return fixas.filter((f) => f.ativa);
}

function htmlLancamento(l) {
  const isRec = l.tipo === 'Receita';
  const id = JSON.stringify(l.id);
  return '<div class="trans-item">' +
    '<div class="trans-icon ' + (isRec ? 'rec' : 'desp') + '"><i class="ti ti-' + (isRec ? 'coin' : 'shopping-cart') + '" aria-hidden="true"></i></div>' +
    '<div class="trans-info"><div class="trans-name">' + escapeHtml(l.desc) + '</div><div class="trans-cat">' + escapeHtml(montarDetalheLancamento(l)) + '</div></div>' +
    '<div class="trans-val ' + (isRec ? 'pos' : 'neg') + '">' + (isRec ? '+ ' : '- ') + fmt(l.val) + '</div>' +
    '<div class="trans-actions">' +
      '<button type="button" class="btn-icon" data-action="editar-lancamento" data-id=' + id + ' aria-label="Editar"><i class="ti ti-edit" aria-hidden="true"></i></button>' +
      '<button type="button" class="btn-icon del" data-action="excluir-lancamento" data-id=' + id + ' aria-label="Excluir"><i class="ti ti-trash" aria-hidden="true"></i></button>' +
    '</div>' +
  '</div>';
}

function renderLancamentos() {
  const el = document.getElementById('lista-lancamentos');
  if (!el) return;

  const filtrados = lancamentosDoMes(filtroLancamentosMes);
  if (filtrados.length === 0) {
    el.innerHTML = '<div class="empty-state">Nenhum lançamento encontrado para ' + escapeHtml(nomeMesAno(filtroLancamentosMes)) + '.</div>';
  } else {
    el.innerHTML = filtrados.map(htmlLancamento).join('');
  }

  atualizarDashboard();
  renderCartoes();
}

function renderUltimosLancamentosDashboard(lancamentosMes) {
  const el = document.getElementById('dash-ultimos-lancamentos');
  if (!el) return;

  if (lancamentosMes.length === 0) {
    el.innerHTML = '<div class="empty-state">Nenhum lançamento no mês selecionado.</div>';
    return;
  }

  el.innerHTML = lancamentosMes.slice(0, 5).map(htmlLancamento).join('');
}

function renderFixas() {
  const el = document.getElementById('lista-fixas');
  if (!el) return;

  const total = despesasFixasAtivasNoMes(filtroDashboardMes).reduce((s, f) => s + Number(f.val || 0), 0);
  setText('total-fixas', 'Total no mês selecionado: ' + fmt(total) + '/mês');

  if (fixas.length === 0) {
    el.innerHTML = '<div class="empty-state">Nenhuma despesa fixa cadastrada ainda.</div>';
    atualizarDashboard();
    return;
  }

  el.innerHTML = fixas.map((f) => {
    const id = JSON.stringify(f.id);
    return '<div class="trans-item">' +
      '<div class="trans-icon fix"><i class="ti ti-refresh" aria-hidden="true"></i></div>' +
      '<div class="trans-info"><div class="trans-name">' + escapeHtml(f.desc) + ' <span class="badge ' + (f.ativa ? 'badge-blue' : 'badge-amber') + '">' + (f.ativa ? 'ativa' : 'pausada') + '</span></div>' +
      '<div class="trans-cat">' + escapeHtml(f.cat || '') + ' · vence dia ' + escapeHtml(f.dia || '') + (f.dataInicio ? ' · início: ' + escapeHtml(nomeMesAno(f.dataInicio)) : '') + '</div></div>' +
      '<div class="trans-val neg">- ' + fmt(f.val) + '</div>' +
      '<div class="trans-actions">' +
        '<button type="button" class="btn-icon" data-action="toggle-fixa" data-id=' + id + ' aria-label="' + (f.ativa ? 'Pausar' : 'Ativar') + '"><i class="ti ti-' + (f.ativa ? 'player-pause' : 'player-play') + '" aria-hidden="true"></i></button>' +
        '<button type="button" class="btn-icon del" data-action="excluir-fixa" data-id=' + id + ' aria-label="Excluir"><i class="ti ti-trash" aria-hidden="true"></i></button>' +
      '</div>' +
    '</div>';
  }).join('');

  atualizarDashboard();
}

function atualizarDashboard() {
  const mesSelecionado = filtroDashboardMes;
  const lMes = lancamentosDoMes(mesSelecionado);
  const fixasAtivas = despesasFixasAtivasNoMes(mesSelecionado);
  const despesasDashboard = despesasParaDashboardMes(mesSelecionado);

  const receitas = receitasParaDashboardMes(mesSelecionado).reduce((s, l) => s + Number(l.val || 0), 0);
  const despesasLancamentos = despesasDashboard.reduce((s, l) => s + Number(l.val || 0), 0);
  const despesasFixasTotal = fixasAtivas.reduce((s, f) => s + Number(f.val || 0), 0);
  const faturasTotal = totalFaturasMes(mesSelecionado);
  const despesas = despesasLancamentos + despesasFixasTotal;
  const saldo = receitas - despesas;
  const limiteTotal = limiteTotalAtivo();
  const limiteUsadoPerc = limiteTotal ? (faturasTotal / limiteTotal) * 100 : 0;

  setText('dashboard-title', 'Dashboard — ' + nomeMesAno(mesSelecionado));
  setText('dash-rec', fmt(receitas));
  setText('dash-desp', fmt(despesas));
  setText('dash-saldo', fmt(saldo));
  setText('dash-fixas-total', fmt(despesasFixasTotal));
  setText('dash-faturas', fmt(faturasTotal));
  setText('dash-limite-usado', limiteUsadoPerc.toFixed(1).replace('.', ',') + '%');
  setText('dash-economia', fmt(saldo > 0 ? saldo : 0));

  const categorias = {};
  despesasDashboard.forEach((l) => {
    const cat = l.cat || 'Outros';
    categorias[cat] = (categorias[cat] || 0) + Number(l.val || 0);
  });
  fixasAtivas.forEach((f) => {
    const cat = f.cat || 'Outros';
    categorias[cat] = (categorias[cat] || 0) + Number(f.val || 0);
  });

  const labels = Object.keys(categorias);
  const valores = labels.map((k) => categorias[k]);
  const totalCat = valores.reduce((s, v) => s + v, 0);
  atualizarLegendaCategorias(labels, valores, totalCat);
  atualizarChartCategorias(labels, valores);
  atualizarEvolucaoMensal();
  renderUltimosLancamentosDashboard(lMes);
}

function atualizarLegendaCategorias(labels, valores, total) {
  const el = document.getElementById('dash-cat-legend');
  if (!el) return;

  if (!labels.length || total === 0) {
    el.innerHTML = '<span>Sem despesas no período.</span>';
    return;
  }

  el.innerHTML = labels.map((label, i) => {
    const perc = total ? ((valores[i] / total) * 100).toFixed(1).replace('.', ',') : '0,0';
    const cor = coresCategorias[i % coresCategorias.length];
    return '<span><span class="legend-dot" style="background:' + cor + '"></span>' + escapeHtml(label) + ' ' + fmt(valores[i]) + ' · ' + perc + '%</span>';
  }).join('');
}

function atualizarChartCategorias(labels, valores) {
  if (!charts.pieChart) return;
  const semDados = !labels.length;
  charts.pieChart.data.labels = semDados ? ['Sem despesas'] : labels;
  charts.pieChart.data.datasets[0].data = semDados ? [1] : valores;
  charts.pieChart.data.datasets[0].backgroundColor = (semDados ? ['#D8DEE6'] : labels.map((_, i) => coresCategorias[i % coresCategorias.length]));
  charts.pieChart.update();
}

function atualizarEvolucaoMensal() {
  if (!charts.lineChart) return;
  const base = filtroDashboardMes || mesAtual();
  const [anoBase, mesBase] = base.split('-').map(Number);
  const labels = [];
  const receitas = [];
  const despesas = [];

  for (let i = 4; i >= 0; i--) {
    const data = new Date(anoBase, mesBase - 1 - i, 1);
    const mesAno = data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');
    labels.push(data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''));
    receitas.push(receitasParaDashboardMes(mesAno).reduce((s, l) => s + Number(l.val || 0), 0));
    despesas.push(despesasParaDashboardMes(mesAno).reduce((s, l) => s + Number(l.val || 0), 0) + despesasFixasAtivasNoMes(mesAno).reduce((s, f) => s + Number(f.val || 0), 0));
  }

  charts.lineChart.data.labels = labels;
  charts.lineChart.data.datasets[0].data = receitas;
  charts.lineChart.data.datasets[1].data = despesas;
  charts.lineChart.update();
}


function renderCartoes() {
  const el = document.getElementById('lista-cartoes');
  if (!el) return;

  const faturaMes = totalFaturasMes(filtroDashboardMes);
  const limiteTotal = limiteTotalAtivo();
  setText('cartoes-limite-total', fmt(limiteTotal));
  setText('cartoes-fatura-mes', fmt(faturaMes));
  setText('cartoes-limite-disponivel', fmt(Math.max(limiteTotal - faturaMes, 0)));

  if (cartoes.length === 0) {
    el.innerHTML = '<div class="empty-state">Nenhum cartão cadastrado ainda.</div>';
    renderOpcoesLancamento();
    atualizarDashboard();
    return;
  }

  el.innerHTML = cartoes.map((c) => {
    const id = JSON.stringify(c.id);
    const gasto = lancamentosCartaoCompradosNoMes(filtroDashboardMes).filter((l) => String(l.cartao || '').toLowerCase() === String(c.nome || '').toLowerCase()).reduce((s, l) => s + Number(l.val || 0), 0);
    const limite = Number(c.limite || 0);
    const perc = limite ? ((gasto / limite) * 100).toFixed(1).replace('.', ',') : '0,0';
    return '<div class="trans-item">' +
      '<div class="trans-icon fix" style="background:' + escapeHtml(c.cor || '#E6F1FB') + '22;color:' + escapeHtml(c.cor || '#185FA5') + '"><i class="ti ti-credit-card" aria-hidden="true"></i></div>' +
      '<div class="trans-info"><div class="trans-name">' + escapeHtml(c.nome) + ' <span class="badge ' + (c.ativo === false ? 'badge-amber' : 'badge-blue') + '">' + (c.ativo === false ? 'inativo' : 'ativo') + '</span></div>' +
      '<div class="trans-cat">Limite: ' + fmt(c.limite) + ' · fechamento dia ' + escapeHtml(c.fechamento || '') + ' · vencimento dia ' + escapeHtml(c.vencimento || '') + ' · usado no mês: ' + perc + '%</div></div>' +
      '<div class="trans-val neg">' + fmt(gasto) + '</div>' +
      '<div class="trans-actions">' +
        '<button type="button" class="btn-icon" data-action="editar-cartao" data-id=' + id + ' aria-label="Editar"><i class="ti ti-edit" aria-hidden="true"></i></button>' +
        '<button type="button" class="btn-icon del" data-action="excluir-cartao" data-id=' + id + ' aria-label="Excluir"><i class="ti ti-trash" aria-hidden="true"></i></button>' +
      '</div>' +
    '</div>';
  }).join('');

  renderOpcoesLancamento();
  atualizarDashboard();
}

function limparFormularioCartao() {
  ['card-nome','card-limite','card-fechamento','card-vencimento'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cor = document.getElementById('card-cor'); if (cor) cor.value = '#185FA5';
  const ativo = document.getElementById('card-ativo'); if (ativo) ativo.value = 'true';
  const btn = document.getElementById('btn-salvar-cartao'); if (btn) btn.textContent = 'Salvar cartão';
  const cancelar = document.getElementById('btn-cancelar-cartao'); if (cancelar) cancelar.style.display = 'none';
  editandoCartaoId = null;
}

function iniciarListenersFirestore() {
  if (unsubscribeLancamentos) unsubscribeLancamentos();
  if (unsubscribeFixas) unsubscribeFixas();
  if (unsubscribeCartoes) unsubscribeCartoes();

  const qLancamentos = query(colUsuario('lancamentos'), orderBy('criadoEm', 'desc'));
  unsubscribeLancamentos = onSnapshot(qLancamentos, (snapshot) => {
    lancamentos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderLancamentos();
  }, (error) => {
    console.error(error);
    alert('Não foi possível carregar os lançamentos. Verifique as regras do Firestore.');
  });

  const qFixas = query(colUsuario('despesasFixas'), orderBy('criadoEm', 'desc'));
  unsubscribeFixas = onSnapshot(qFixas, (snapshot) => {
    fixas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderFixas();
  }, (error) => {
    console.error(error);
    alert('Não foi possível carregar as despesas fixas. Verifique as regras do Firestore.');
  });

  const qCartoes = query(colUsuario('cartoes'), orderBy('criadoEm', 'desc'));
  unsubscribeCartoes = onSnapshot(qCartoes, (snapshot) => {
    cartoes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCartoes();
  }, (error) => {
    console.error(error);
    alert('Não foi possível carregar os cartões. Verifique as regras do Firestore.');
  });

}

function pararListenersFirestore() {
  if (unsubscribeLancamentos) unsubscribeLancamentos();
  if (unsubscribeFixas) unsubscribeFixas();
  if (unsubscribeCartoes) unsubscribeCartoes();
  unsubscribeLancamentos = null;
  unsubscribeFixas = null;
  unsubscribeCartoes = null;
  lancamentos = [];
  fixas = [];
  cartoes = [];
  renderLancamentos();
  renderFixas();
  renderCartoes();
}

function iniciarCharts() {
  if (charts.pieChart) return;

  charts.pieChart = new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: { labels: ['Sem despesas'], datasets: [{ data: [1], backgroundColor: ['#D8DEE6'], borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const total = ctx.dataset.data.reduce((s, v) => s + Number(v || 0), 0);
              const valor = Number(ctx.raw || 0);
              const perc = total ? ((valor / total) * 100).toFixed(1).replace('.', ',') : '0,0';
              return ctx.label + ': ' + fmt(valor) + ' (' + perc + '%)';
            }
          }
        }
      }
    }
  });

  charts.lineChart = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Receitas', data: [], borderColor: '#1D9E75', backgroundColor: 'rgba(29,158,117,0.07)', tension: 0.3, fill: true }, { label: 'Despesas', data: [], borderColor: '#D85A30', backgroundColor: 'transparent', tension: 0.3, fill: false, borderDash: [5, 3] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => 'R$' + (v / 1000).toFixed(0) + 'k' } } } }
  });

  const invCanvas = document.getElementById('invChart');
  if (invCanvas) {
    charts.invChart = new Chart(invCanvas, {
      type: 'doughnut',
      data: { labels: ['Renda Fixa', 'FIIs', 'Ações'], datasets: [{ data: [72, 19, 9], backgroundColor: ['#378ADD', '#7F77DD', '#EF9F27'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  charts.relChart = new Chart(document.getElementById('relChart'), {
    type: 'bar',
    data: { labels: ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'], datasets: [{ label: 'Receitas', data: [0, 0, 0, 0, 0, 0], backgroundColor: '#1D9E75' }, { label: 'Despesas', data: [0, 0, 0, 0, 0, 0], backgroundColor: '#D85A30' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => 'R$' + (v / 1000).toFixed(0) + 'k' } } } }
  });

  charts.barCat = new Chart(document.getElementById('barCat'), {
    type: 'bar',
    data: { labels: ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Outros'], datasets: [{ data: [0, 0, 0, 0, 0, 0], backgroundColor: ['#378ADD', '#1D9E75', '#EF9F27', '#D85A30', '#7F77DD', '#5DCAA5'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: (v) => 'R$' + (v / 1000).toFixed(1) + 'k' } } } }
  });
}

window.showPage = function (id, el) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
};

window.alterarMesDashboard = function (valor) {
  filtroDashboardMes = valor || mesAtual();
  atualizarDashboard();
};

window.alterarMesLancamentos = function (valor) {
  filtroLancamentosMes = valor || mesAtual();
  renderLancamentos();
};

window.adicionarOpcao = async function (chave, inputId, selectId) {
  const input = document.getElementById(inputId);
  const select = document.getElementById(selectId);
  if (!input || !select || !opcoesLancamento[chave]) return;

  const novaOpcao = input.value.trim();
  if (!novaOpcao) return;

  const existente = opcoesLancamento[chave].find((item) => item.toLowerCase() === novaOpcao.toLowerCase());
  if (!existente) {
    opcoesLancamento[chave].push(novaOpcao);
    await salvarOpcoesLancamento();
  }

  renderOpcoesLancamento();
  select.value = existente || novaOpcao;
  input.value = '';
};

window.removerOpcao = async function (chave, selectId) {
  const select = document.getElementById(selectId);
  if (!select || !opcoesLancamento[chave]) return;

  const valor = select.value;
  if (!valor) return;

  if (opcoesLancamento[chave].length <= 1) {
    alert('Não é possível excluir a última opção desta lista.');
    return;
  }

  const confirmar = confirm('Deseja excluir a opção "' + valor + '" desta lista? Os lançamentos já cadastrados não serão alterados.');
  if (!confirmar) return;

  opcoesLancamento[chave] = opcoesLancamento[chave].filter((item) => item.toLowerCase() !== String(valor).toLowerCase());
  await salvarOpcoesLancamento();
  renderOpcoesLancamento();
};

window.salvarLancamento = async function () {
  const desc = document.getElementById('f-desc').value.trim();
  const val = parseFloat(document.getElementById('f-val').value);
  const tipo = document.getElementById('f-tipo').value;
  const cat = document.getElementById('f-cat').value;
  const data = document.getElementById('f-data').value;
  const conta = document.getElementById('f-conta').value;
  const cartao = document.getElementById('f-cartao').value;

  if (!desc || !val || !data) {
    alert('Informe descrição, valor e data do lançamento.');
    return;
  }

  await addDoc(colUsuario('lancamentos'), {
    desc,
    val,
    tipo,
    cat,
    data,
    conta,
    cartao,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  });

  filtroDashboardMes = data.slice(0, 7);
  filtroLancamentosMes = data.slice(0, 7);
  const fd = document.getElementById('filtro-dashboard-mes');
  const fl = document.getElementById('filtro-lancamentos-mes');
  if (fd) fd.value = filtroDashboardMes;
  if (fl) fl.value = filtroLancamentosMes;

  limparFormularioLancamento();
};

window.abrirEdicao = function (id) {
  const l = lancamentos.find((x) => String(x.id) === String(id));
  if (!l) {
    alert('Não foi possível localizar este lançamento para edição.');
    return;
  }

  editandoId = id;
  document.getElementById('e-desc').value = l.desc || '';
  document.getElementById('e-val').value = l.val || '';
  document.getElementById('e-data').value = l.data || '';

  garantirOpcaoExistente('tiposLancamento', l.tipo);
  garantirOpcaoExistente('categoriasLancamento', l.cat);
  garantirOpcaoExistente('contasLancamento', l.conta);
  garantirOpcaoExistente('cartoesCredito', l.cartao);
  renderOpcoesLancamento();

  document.getElementById('e-tipo').value = l.tipo || opcoesLancamento.tiposLancamento[0] || '';
  document.getElementById('e-cat').value = l.cat || opcoesLancamento.categoriasLancamento[0] || '';
  document.getElementById('e-conta').value = l.conta || opcoesLancamento.contasLancamento[0] || '';
  document.getElementById('e-cartao').value = l.cartao || opcoesLancamento.cartoesCredito[0] || '';
  document.getElementById('modal-edit').classList.add('show');
};

window.confirmarEdicao = async function () {
  if (!editandoId) return;
  const novaData = document.getElementById('e-data').value;

  if (!document.getElementById('e-desc').value.trim() || !novaData) {
    alert('Informe descrição e data do lançamento.');
    return;
  }

  await updateDoc(docUsuario('lancamentos', editandoId), {
    desc: document.getElementById('e-desc').value.trim(),
    val: parseFloat(document.getElementById('e-val').value) || 0,
    tipo: document.getElementById('e-tipo').value,
    cat: document.getElementById('e-cat').value,
    data: novaData,
    conta: document.getElementById('e-conta').value,
    cartao: document.getElementById('e-cartao').value,
    atualizadoEm: serverTimestamp()
  });

  filtroDashboardMes = novaData.slice(0, 7);
  filtroLancamentosMes = novaData.slice(0, 7);
  const fd = document.getElementById('filtro-dashboard-mes');
  const fl = document.getElementById('filtro-lancamentos-mes');
  if (fd) fd.value = filtroDashboardMes;
  if (fl) fl.value = filtroLancamentosMes;

  window.fecharModal();
};

window.abrirExclusao = function (id) {
  excluindoId = id;
  const l = lancamentos.find((x) => String(x.id) === String(id));
  document.getElementById('del-nome').textContent = l ? '"' + l.desc + '" — ' + fmt(l.val) : '';
  document.getElementById('modal-del').classList.add('show');
};

window.confirmarExclusao = async function () {
  if (!excluindoId) return;
  await deleteDoc(docUsuario('lancamentos', excluindoId));
  window.fecharModal();
};

window.fecharModal = function () {
  document.querySelectorAll('.modal-bg').forEach((m) => m.classList.remove('show'));
  editandoId = null;
  excluindoId = null;
  excluindoCartaoId = null;
};

window.cancelarEdicao = function () {
  editandoId = null;
  limparFormularioLancamento();
};

window.toggleFixed = function (el) {
  el.classList.toggle('on');
  fixaToggleState = el.classList.contains('on');
  document.getElementById('fix-toggle-label').textContent = fixaToggleState ? 'Ativa — será lançada todo mês' : 'Pausada — não será lançada';
};

window.addFixa = async function () {
  const desc = document.getElementById('fix-desc').value.trim();
  const val = parseFloat(document.getElementById('fix-val').value);
  const cat = document.getElementById('fix-cat').value;
  const dia = parseInt(document.getElementById('fix-dia').value) || 1;
  const dataInicio = document.getElementById('fix-inicio').value || mesAtual();

  if (!desc || !val) {
    alert('Informe a descrição e o valor da despesa fixa.');
    return;
  }

  await addDoc(colUsuario('despesasFixas'), {
    desc,
    val,
    cat,
    dia,
    dataInicio,
    ativa: fixaToggleState,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  });

  document.getElementById('fix-desc').value = '';
  document.getElementById('fix-val').value = '';
  document.getElementById('fix-dia').value = '';
  document.getElementById('fix-inicio').value = mesAtual();
};

window.toggleFixaItem = async function (id) {
  const f = fixas.find((x) => String(x.id) === String(id));
  if (!f) return;
  await updateDoc(docUsuario('despesasFixas', id), {
    ativa: !f.ativa,
    atualizadoEm: serverTimestamp()
  });
};

window.excluirFixa = async function (id) {
  const confirmar = confirm('Deseja excluir esta despesa fixa?');
  if (!confirmar) return;
  await deleteDoc(docUsuario('despesasFixas', id));
};


window.salvarCartao = async function () {
  const nome = document.getElementById('card-nome').value.trim();
  const limite = parseFloat(document.getElementById('card-limite').value) || 0;
  const fechamento = parseInt(document.getElementById('card-fechamento').value) || 25;
  const vencimento = parseInt(document.getElementById('card-vencimento').value) || 5;
  const cor = document.getElementById('card-cor').value || '#185FA5';
  const ativo = document.getElementById('card-ativo').value === 'true';

  if (!nome || !limite) {
    alert('Informe o nome e o limite do cartão.');
    return;
  }

  const payload = { nome, limite, fechamento, vencimento, cor, ativo, atualizadoEm: serverTimestamp() };
  if (editandoCartaoId) {
    await updateDoc(docUsuario('cartoes', editandoCartaoId), payload);
  } else {
    await addDoc(colUsuario('cartoes'), { ...payload, criadoEm: serverTimestamp() });
  }

  garantirOpcaoExistente('cartoesCredito', nome);
  await salvarOpcoesLancamento();
  limparFormularioCartao();
};

window.editarCartao = function (id) {
  const c = cartoes.find((x) => String(x.id) === String(id));
  if (!c) return;
  editandoCartaoId = id;
  document.getElementById('card-nome').value = c.nome || '';
  document.getElementById('card-limite').value = c.limite || '';
  document.getElementById('card-fechamento').value = c.fechamento || '';
  document.getElementById('card-vencimento').value = c.vencimento || '';
  document.getElementById('card-cor').value = c.cor || '#185FA5';
  document.getElementById('card-ativo').value = c.ativo === false ? 'false' : 'true';
  document.getElementById('btn-salvar-cartao').textContent = 'Salvar alterações';
  document.getElementById('btn-cancelar-cartao').style.display = 'inline-flex';
};

window.cancelarEdicaoCartao = function () {
  limparFormularioCartao();
};

window.abrirExclusaoCartao = function (id) {
  excluindoCartaoId = id;
  const c = cartoes.find((x) => String(x.id) === String(id));
  document.getElementById('del-card-nome').textContent = c ? '"' + c.nome + '" — limite ' + fmt(c.limite) : '';
  document.getElementById('modal-del-card').classList.add('show');
};

window.confirmarExclusaoCartao = async function () {
  if (!excluindoCartaoId) return;
  await deleteDoc(docUsuario('cartoes', excluindoCartaoId));
  window.fecharModal();
};

window.sendPrompt = function (text) {
  alert(text);
};

function inicializarFiltrosMes() {
  const fd = document.getElementById('filtro-dashboard-mes');
  const fl = document.getElementById('filtro-lancamentos-mes');
  if (fd) fd.value = filtroDashboardMes;
  if (fl) fl.value = filtroLancamentosMes;
  const fi = document.getElementById('fix-inicio');
  if (fi && !fi.value) fi.value = mesAtual();
}

function configurarEventosDelegados() {
  document.addEventListener('click', function (event) {
    const botao = event.target.closest('[data-action]');
    if (!botao) return;

    const action = botao.dataset.action;
    const id = botao.dataset.id;

    if (action === 'editar-lancamento') window.abrirEdicao(id);
    if (action === 'excluir-lancamento') window.abrirExclusao(id);
    if (action === 'toggle-fixa') window.toggleFixaItem(id);
    if (action === 'excluir-fixa') window.excluirFixa(id);
    if (action === 'editar-cartao') window.editarCartao(id);
    if (action === 'excluir-cartao') window.abrirExclusaoCartao(id);
  });
}

configurarEventosDelegados();

onAuthStateChanged(auth, async (user) => {
  usuarioAtual = user;
  iniciarCharts();
  inicializarFiltrosMes();

  if (user) {
    await setDoc(caminhoUsuario(), {
      email: user.email || '',
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await carregarOpcoesFirestore();
    iniciarListenersFirestore();
  } else {
    pararListenersFirestore();
  }
});

renderOpcoesLancamento();
iniciarCharts();
inicializarFiltrosMes();
atualizarDashboard();

renderCartoes();
