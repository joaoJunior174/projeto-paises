(() => {
  const API_BASE = '';

  const CONTINENTES = [
    'Europa',
    'América Latina',
    'América do Norte',
    'África',
    'Ásia',
    'Oriente Médio',
    'Oceania',
  ];

  const CORES = [
    '#c45c26',
    '#2f5d50',
    '#d4a017',
    '#8b4513',
    '#3f7a69',
    '#b85c38',
    '#1f4d3f',
  ];

  const FATIA = 360 / CONTINENTES.length;
  const SPIN_MS = 4200;

  const el = {
    form: document.getElementById('form-sorteio'),
    email: document.getElementById('email'),
    btnSortear: document.getElementById('btn-sortear'),
    btnAtualizar: document.getElementById('btn-atualizar'),
    alerta: document.getElementById('alerta'),
    totalPaises: document.getElementById('total-paises'),
    listaPaises: document.getElementById('lista-paises'),
    roletaPrincipal: document.getElementById('roleta-principal'),
    roletaPrincipalInner: document.getElementById('roleta-principal-inner'),
    roletaSobremesa: document.getElementById('roleta-sobremesa'),
    roletaSobremesaInner: document.getElementById('roleta-sobremesa-inner'),
    spinningLabel: document.getElementById('spinning-label'),
    resultados: document.getElementById('resultados'),
    nomePrincipal: document.getElementById('nome-principal'),
    contPrincipal: document.getElementById('cont-principal'),
    nomeSobremesa: document.getElementById('nome-sobremesa'),
    contSobremesa: document.getElementById('cont-sobremesa'),
    previewPratoPrincipal: document.getElementById('preview-prato-principal'),
    previewPratoSobremesa: document.getElementById('preview-prato-sobremesa'),
    pratoPrincipalNome: document.getElementById('prato-principal-nome'),
    pratoSobremesaNome: document.getElementById('prato-sobremesa-nome'),
    imgPrincipal: document.getElementById('img-prato-principal'),
    imgSobremesa: document.getElementById('img-prato-sobremesa'),
    curiosidadePrincipal: document.getElementById('curiosidade-principal'),
    curiosidadeSobremesa: document.getElementById('curiosidade-sobremesa'),
    togglePratoPrincipal: document.getElementById('toggle-prato-principal'),
    togglePratoSobremesa: document.getElementById('toggle-prato-sobremesa'),
    detalhePratoPrincipal: document.getElementById('detalhe-prato-principal'),
    detalhePratoSobremesa: document.getElementById('detalhe-prato-sobremesa'),
  };

  let paises = [];
  let anguloPrincipal = 0;
  let anguloSobremesa = 0;
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

  function escapeHtml(texto) {
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function montarRoleta(roletaEl, innerEl) {
    const gradient = CONTINENTES.map((_, i) => {
      const cor = CORES[i % CORES.length];
      const inicio = i * FATIA;
      const fim = (i + 1) * FATIA;
      return `${cor} ${inicio}deg ${fim}deg`;
    }).join(', ');

    roletaEl.style.background = `conic-gradient(from 0deg, ${gradient})`;
    roletaEl.style.transform = 'rotate(0deg)';

    // Cada label fica no centro da fatia: 0deg do conic = topo (ponteiro).
    const labels = CONTINENTES.map((continente, i) => {
      const centroFatia = i * FATIA + FATIA / 2;
      return `
        <div class="roulette-label" style="transform: rotate(${centroFatia}deg)">
          <span class="roulette-label-text">${escapeHtml(continente)}</span>
        </div>`;
    }).join('');

    innerEl.innerHTML = `<div class="roulette-labels">${labels}</div>`;
  }

  function indiceContinente(nome) {
    const idx = CONTINENTES.findIndex(
      (c) => c.toLowerCase() === String(nome || '').trim().toLowerCase()
    );
    return idx >= 0 ? idx : 0;
  }

  /**
   * Ponteiro fixo no topo (0deg).
   * Após rotacionar a roleta em R (horário), o ângulo local sob o ponteiro é (360 - R%360)%360.
   * Queremos esse valor = centro da fatia do continente sorteado.
   */
  function anguloParaContinente(continente, anguloAtual) {
    const idx = indiceContinente(continente);
    const centroFatia = idx * FATIA + FATIA / 2;
    const alvoMod = (360 - centroFatia + 360) % 360;
    const atualMod = ((anguloAtual % 360) + 360) % 360;
    let delta = (alvoMod - atualMod + 360) % 360;
    // Garante várias voltas visíveis mesmo se já estiver no alvo
    if (delta < 20) delta += 360;
    const voltas = 5 + Math.floor(Math.random() * 2);
    return anguloAtual + voltas * 360 + delta;
  }

  function girarRoleta(roletaEl, anguloFinal) {
    return new Promise((resolve) => {
      // Força o browser a aplicar o transform atual antes da nova transição
      void roletaEl.offsetWidth;

      roletaEl.classList.add('spinning');
      roletaEl.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.08, 1)`;
      roletaEl.style.transform = `rotate(${anguloFinal}deg)`;

      let finalizado = false;
      const finalizar = () => {
        if (finalizado) return;
        finalizado = true;
        roletaEl.classList.remove('spinning');
        roletaEl.removeEventListener('transitionend', onEnd);
        resolve();
      };

      const onEnd = (ev) => {
        if (ev.propertyName && ev.propertyName !== 'transform') return;
        finalizar();
      };

      roletaEl.addEventListener('transitionend', onEnd);
      setTimeout(finalizar, SPIN_MS + 200);
    });
  }

  function resumirTexto(texto, max = 42) {
    const t = String(texto || '').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  function configurarExpandivel(toggleEl, panelEl, aberto) {
    toggleEl.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    panelEl.hidden = !aberto;
    toggleEl.classList.toggle('is-open', aberto);
    const hint = toggleEl.querySelector('.expand-hint');
    if (hint) {
      hint.textContent = aberto ? 'Toque para recolher' : 'Toque para expandir';
    }
  }

  function resetExpandiveis() {
    configurarExpandivel(el.togglePratoPrincipal, el.detalhePratoPrincipal, false);
    configurarExpandivel(el.togglePratoSobremesa, el.detalhePratoSobremesa, false);
  }

  function setImagem(imgEl, url, alt) {
    if (!imgEl) return;
    if (url) {
      imgEl.onerror = () => {
        imgEl.hidden = true;
      };
      imgEl.src = url;
      imgEl.alt = alt || 'Prato típico';
      imgEl.hidden = false;
    } else {
      imgEl.removeAttribute('src');
      imgEl.hidden = true;
    }
  }

  function exibirResultado(dados) {
    el.nomePrincipal.textContent = dados.prato_principal.nome;
    el.contPrincipal.textContent = dados.prato_principal.continente;
    el.nomeSobremesa.textContent = dados.sobremesa.nome;
    el.contSobremesa.textContent = dados.sobremesa.continente;

    el.previewPratoPrincipal.textContent = resumirTexto(dados.prato_principal.prato);
    el.previewPratoSobremesa.textContent = resumirTexto(dados.sobremesa.prato);
    el.pratoPrincipalNome.textContent = dados.prato_principal.prato;
    el.pratoSobremesaNome.textContent = dados.sobremesa.prato;
    el.curiosidadePrincipal.textContent = dados.prato_principal.curiosidade;
    el.curiosidadeSobremesa.textContent = dados.sobremesa.curiosidade;

    setImagem(
      el.imgPrincipal,
      dados.prato_principal.imagem,
      dados.prato_principal.prato
    );
    setImagem(el.imgSobremesa, dados.sobremesa.imagem, dados.sobremesa.prato);

    resetExpandiveis();
    el.resultados.classList.remove('d-none');
  }

  function renderLista(lista) {
    el.totalPaises.textContent = String(lista.length);

    if (!lista.length) {
      el.listaPaises.innerHTML =
        '<p class="text-muted mb-0">Nenhum país disponível no momento.</p>';
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
    el.resultados.classList.add('d-none');
    el.spinningLabel.classList.remove('d-none');

    try {
      const res = await fetch(`${API_BASE}/api/sorteio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || 'Falha no sorteio.');
      }

      // Ângulos calculados a partir do continente retornado pelo backend
      anguloPrincipal = anguloParaContinente(
        data.prato_principal.continente,
        anguloPrincipal
      );
      anguloSobremesa = anguloParaContinente(
        data.sobremesa.continente,
        anguloSobremesa
      );

      el.spinningLabel.textContent = `Parando em ${data.prato_principal.continente} e ${data.sobremesa.continente}...`;

      await Promise.all([
        girarRoleta(el.roletaPrincipal, anguloPrincipal),
        girarRoleta(el.roletaSobremesa, anguloSobremesa),
      ]);

      el.spinningLabel.classList.add('d-none');
      el.spinningLabel.textContent = 'Sorteando continentes...';
      exibirResultado(data);

      mostrarAlerta(
        'success',
        `Sorteio concluído! Principal: ${data.prato_principal.nome} (${data.prato_principal.continente}) | Sobremesa: ${data.sobremesa.nome} (${data.sobremesa.continente}).`
      );

      await carregarPaises();
    } catch (err) {
      el.spinningLabel.classList.add('d-none');
      el.spinningLabel.textContent = 'Sorteando continentes...';
      mostrarAlerta('danger', err.message || 'Erro inesperado.');
    } finally {
      sorteando = false;
      el.btnSortear.disabled = false;
    }
  }

  el.togglePratoPrincipal.addEventListener('click', () => {
    const aberto = el.togglePratoPrincipal.getAttribute('aria-expanded') === 'true';
    configurarExpandivel(el.togglePratoPrincipal, el.detalhePratoPrincipal, !aberto);
  });

  el.togglePratoSobremesa.addEventListener('click', () => {
    const aberto = el.togglePratoSobremesa.getAttribute('aria-expanded') === 'true';
    configurarExpandivel(el.togglePratoSobremesa, el.detalhePratoSobremesa, !aberto);
  });

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

  montarRoleta(el.roletaPrincipal, el.roletaPrincipalInner);
  montarRoleta(el.roletaSobremesa, el.roletaSobremesaInner);

  carregarPaises().catch((err) => {
    mostrarAlerta('danger', err.message);
    el.listaPaises.innerHTML =
      '<p class="text-muted mb-0">Erro ao carregar países.</p>';
  });
})();
