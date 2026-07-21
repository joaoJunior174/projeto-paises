(() => {
  const API_BASE = '';

  const el = {
    form: document.getElementById('form-sorteio'),
    email: document.getElementById('email'),
    btnSortear: document.getElementById('btn-sortear'),
    btnAtualizar: document.getElementById('btn-atualizar'),
    alerta: document.getElementById('alerta'),
    totalPaises: document.getElementById('total-paises'),
    listaPaises: document.getElementById('lista-paises'),
    roleta: document.getElementById('roleta'),
    roletaInner: document.getElementById('roleta-inner'),
    spinningLabel: document.getElementById('spinning-label'),
    resultados: document.getElementById('resultados'),
    nomePrincipal: document.getElementById('nome-principal'),
    contPrincipal: document.getElementById('cont-principal'),
    nomeSobremesa: document.getElementById('nome-sobremesa'),
    contSobremesa: document.getElementById('cont-sobremesa'),
  };

  let paises = [];
  let anguloAtual = 0;
  let sorteando = false;

  function mostrarAlerta(tipo, mensagem) {
    el.alerta.className = `alert alert-${tipo} mt-3`;
    el.alerta.textContent = mensagem;
    el.alerta.classList.remove('d-none');
  }

  function limparAlerta() {
    el.alerta.classList.add('d-none');
    el.alerta.textContent = '';
  }

  function montarRoleta(lista) {
    const amostra = lista.slice(0, 12);
    if (!amostra.length) {
      el.roletaInner.innerHTML = '';
      return;
    }

    const fatia = 360 / amostra.length;
    const cores = [
      '#c45c26',
      '#2f5d50',
      '#d4a017',
      '#8b4513',
      '#3f7a69',
      '#b85c38',
      '#1f4d3f',
      '#e0b84a',
      '#a0522d',
      '#245c4b',
      '#c9892d',
      '#6b3a1f',
    ];

    const gradient = amostra
      .map((_, i) => {
        const cor = cores[i % cores.length];
        const inicio = i * fatia;
        const fim = (i + 1) * fatia;
        return `${cor} ${inicio}deg ${fim}deg`;
      })
      .join(', ');

    el.roleta.style.background = `conic-gradient(from 0deg, ${gradient})`;

    const labels = amostra
      .map((pais, i) => {
        const rot = i * fatia + fatia / 2;
        return `<span class="roulette-label" style="transform: rotate(${rot}deg) translateY(-50%);">${escapeHtml(
          pais.nome
        )}</span>`;
      })
      .join('');

    el.roletaInner.innerHTML = `<div class="roulette-labels">${labels}</div>`;
  }

  function escapeHtml(texto) {
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderLista(lista) {
    el.totalPaises.textContent = String(lista.length);

    if (!lista.length) {
      el.listaPaises.innerHTML = '<p class="text-muted mb-0">Nenhum país disponível no momento.</p>';
      return;
    }

    el.listaPaises.innerHTML = lista
      .map(
        (p) => `
        <div class="country-chip" title="${escapeHtml(p.continente)}">
          ${escapeHtml(p.nome)}
          <span class="chip-continent">${escapeHtml(p.continente)}</span>
        </div>`
      )
      .join('');
  }

  async function carregarPaises() {
    const res = await fetch(`${API_BASE}/api/paises`);
    if (!res.ok) {
      throw new Error('Não foi possível carregar os países.');
    }
    const data = await res.json();
    paises = data.paises || [];
    renderLista(paises);
    montarRoleta(paises);
  }

  function girarRoleta() {
    return new Promise((resolve) => {
      const voltas = 5 + Math.floor(Math.random() * 3);
      const extra = Math.floor(Math.random() * 360);
      anguloAtual += voltas * 360 + extra;

      el.roleta.classList.add('spinning');
      el.spinningLabel.classList.remove('d-none');
      el.resultados.classList.add('d-none');

      el.roleta.style.transform = `rotate(${anguloAtual}deg)`;

      const onEnd = () => {
        el.roleta.removeEventListener('transitionend', onEnd);
        el.roleta.classList.remove('spinning');
        el.spinningLabel.classList.add('d-none');
        resolve();
      };

      el.roleta.addEventListener('transitionend', onEnd);

      setTimeout(() => {
        el.roleta.removeEventListener('transitionend', onEnd);
        el.roleta.classList.remove('spinning');
        el.spinningLabel.classList.add('d-none');
        resolve();
      }, 4500);
    });
  }

  function exibirResultado(dados) {
    el.nomePrincipal.textContent = dados.prato_principal.nome;
    el.contPrincipal.textContent = dados.prato_principal.continente;
    el.nomeSobremesa.textContent = dados.sobremesa.nome;
    el.contSobremesa.textContent = dados.sobremesa.continente;
    el.resultados.classList.remove('d-none');
  }

  function emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function realizarSorteio(evento) {
    evento.preventDefault();
    if (sorteando) return;

    limparAlerta();
    const email = el.email.value.trim();

    if (!email) {
      mostrarAlerta('danger', 'Informe o e-mail.');
      return;
    }

    if (!emailValido(email)) {
      mostrarAlerta('danger', 'E-mail inválido.');
      return;
    }

    sorteando = true;
    el.btnSortear.disabled = true;

    try {
      const animacao = girarRoleta();

      const res = await fetch(`${API_BASE}/api/sorteio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      await animacao;

      if (!res.ok) {
        throw new Error(data.erro || 'Falha no sorteio.');
      }

      exibirResultado(data);

      mostrarAlerta(
        'success',
        `Sorteio concluído! Principal: ${data.prato_principal.nome} | Sobremesa: ${data.sobremesa.nome}.`
      );

      await carregarPaises();
    } catch (err) {
      mostrarAlerta('danger', err.message || 'Erro inesperado.');
    } finally {
      sorteando = false;
      el.btnSortear.disabled = false;
    }
  }

  el.form.addEventListener('submit', realizarSorteio);
  el.btnAtualizar.addEventListener('click', async () => {
    try {
      limparAlerta();
      await carregarPaises();
      mostrarAlerta('info', 'Lista de países atualizada.');
    } catch (err) {
      mostrarAlerta('danger', err.message);
    }
  });

  carregarPaises().catch((err) => {
    mostrarAlerta('danger', err.message);
    el.listaPaises.innerHTML = '<p class="text-muted mb-0">Erro ao carregar países.</p>';
  });
})();
