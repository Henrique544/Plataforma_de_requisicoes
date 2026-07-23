'use strict';

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const setText = (el, text) => { if (el) el.textContent = String(text ?? ''); };

const setField = (el, val) => {
  if (!el) return;
  const v = String(val ?? '');
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
    el.value = v;
  } else {
    el.textContent = v;
  }
};

const html = (strings, ...values) => {
  return strings.reduce((acc, str, i) => {
    const val = values[i];
    return acc + str + (val !== undefined ? escapeHtml(String(val)) : '');
  });
};

const escapeHtml = (str) => {
  const map = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
};

const State = {
  user: null,
  currentView: 'dashboard',
  pendingCount: 0
};

const API = {
  async request(method, path, body = null) {
    const opts = {
      method: method.toUpperCase(),
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(`/api${path}`, opts);
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: { message: 'Erro de ligação.' } };
    }
  },
  get:    (p)    => API.request('GET', p),
  post:   (p, b) => API.request('POST', p, b),
  put:    (p, b) => API.request('PUT', p, b),
  delete: (p)    => API.request('DELETE', p)
};

const Toast = {
  show(msg, type = 'success', duration = 4000) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const container = $('#toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconEl = document.createElement('span');
    iconEl.className = 'toast-icon';
    setText(iconEl, icons[type] || 'ℹ️');

    const msgEl = document.createElement('span');
    msgEl.className = 'toast-msg';
    setText(msgEl, msg);

    toast.appendChild(iconEl);
    toast.appendChild(msgEl);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastIn 0.3s reverse both';
      setTimeout(() => toast.remove(), 300); 
    }, duration);
  }
};

const Alert = {
  show(elId, msg, type = 'error') {
    const el = $(elId);
    if (!el) return;
    const div = document.createElement('div');
    div.className = `alert alert-${type}`;
    setText(div, msg);
    el.innerHTML = '';
    el.appendChild(div);
  },
  clear(elId) {
    const el = $(elId);
    if (el) el.innerHTML = '';
  }
};

const Modals = {
  open(id) {
    const el = $(`#${id}`);
    if (el) el.classList.add('active');
  },
  close(id) {
    const el = $(`#${id}`);
    if (el) el.classList.remove('active');
  },
  closeAll() {
    $$('.modal-overlay').forEach(m => m.classList.remove('active'));
  }
};

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    Modals.closeAll();
  }
  const closeTarget = e.target.closest('[data-close]');
  if (closeTarget) {
    Modals.close(closeTarget.dataset.close);
  }
  const navTarget = e.target.closest('[data-nav]');
  if (navTarget) {
    App.navigateTo(navTarget.dataset.nav);
  }
});

const Auth = {
  async login(email, password) {
    const res = await API.post('/auth/login', { email, password });
    if (res.ok) {
      State.user = res.data.user;
      return { ok: true };
    }
    return { ok: false, message: res.data.message || 'Erro ao fazer login.' };
  },

  async logout() {
    await API.post('/auth/logout');
    State.user = null;
    App.showLogin();
  },

  async getMe() {
    const res = await API.get('/auth/me');
    if (res.ok) {
      State.user = res.data.user;
      return true;
    }
    return false;
  },

  async forgotPassword(email) {
    return await API.post('/auth/forgot-password', { email });
  },

  async resetPassword(token, password) {
    return await API.post('/auth/reset-password', { token, password });
  }
};

const Nav = {
  getItems() {
    const role = State.user?.role;   // o que cada cargo pode acessar na plataforma
    const items = [
      { id: 'dashboard', label: 'Dashboard', roles: ['aluno','professor','gestor','admin'] },
      { id: 'materials', label: 'Materiais', roles: ['aluno','professor','gestor','admin'] },
      { id: 'aquisicoes', label: 'As Minhas Requisições', roles: ['aluno'] },
      { id: 'aquisicoes', label: 'Requisições', roles: ['professor'] },
      { id: 'aquisicoes', label: 'Gestão de Requisições', roles: ['gestor'] },
      { id: 'aquisicoes', label: 'Todas as Requisições', roles: ['admin'] },
      { id: 'users', label: 'Utilizadores', roles: ['gestor','admin'] }
    ];
    return items.filter(i => i.roles.includes(role));
  },

  render() {
    const nav = $('#sidebarNav');
    nav.innerHTML = '';
    this.getItems().forEach(item => {
      const el = document.createElement('div');
      el.className = `nav-item${State.currentView === item.id ? ' active' : ''}`;
      el.dataset.view = item.id;

      const label = document.createElement('span');
      setText(label, item.label);

      el.appendChild(label);

      if (item.id === 'dashboard' && State.user?.role === 'admin') {
        const badge = document.createElement('span');
        badge.className = `nav-badge${State.pendingCount > 0 ? ' show' : ''}`;
        badge.id = 'navPendingBadge';
        setText(badge, State.pendingCount > 0 ? State.pendingCount : '');
        el.appendChild(badge);
      }

      el.addEventListener('click', () => App.navigateTo(item.id));
      nav.appendChild(el);
    });
  },

  setActive(viewId) {
    $$('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewId);
    });
  }
};

const App = {
  async init() {
    this.bindEvents();

    // Verifica se há token de reset na URL (link de email)
    const resetToken = new URLSearchParams(window.location.search).get('token');
    if (resetToken) {
      this.showLogin();
      this.showResetPassword();
      return;
    }

    // Verifica sessão existente
    const loggedIn = await Auth.getMe();
    if (loggedIn) {
      this.showApp();
    } else {
      this.showLogin();
    }
  },

  showLogin() {
    $$('.page').forEach(p => { p.classList.remove('active'); p.style.display = ''; });
    const lp = $('#loginPage');
    lp.classList.add('active');
    lp.style.display = 'flex';
    $('#appPage').style.display = 'none';
    $('#appPage').classList.remove('active');
    this.showLoginSection();
  },

  showApp() {
    const lp = $('#loginPage');
    lp.classList.remove('active');
    lp.style.display = 'none';
    const ap = $('#appPage');
    ap.classList.add('active');
    ap.style.display = 'block';

    const u = State.user;
    setText($('#userNameDisplay'), u.nome);
    setText($('#userRoleDisplay'), u.role.charAt(0).toUpperCase() + u.role.slice(1));
    setText($('#userAvatar'), u.nome.charAt(0).toUpperCase());

    Nav.render();
    this.navigateTo('dashboard');
  },

  showForgotPassword() {
    $('#loginForm').style.display = 'none';
    $('#forgotPasswordSection').style.display = 'block';
    $('#resetPasswordSection').style.display = 'none';
    const forgotLinkP = $('#forgotLink')?.closest('p');
    if (forgotLinkP) forgotLinkP.style.display = 'none';
    Alert.clear('#loginAlert');
    Alert.clear('#forgotAlert');
    setField($('#forgotEmail'), '');
  },

  showLoginSection() {
    $('#loginForm').style.display = '';
    $('#forgotPasswordSection').style.display = 'none';
    $('#resetPasswordSection').style.display = 'none';
    const forgotLinkP = $('#forgotLink')?.closest('p');
    if (forgotLinkP) forgotLinkP.style.display = '';
    Alert.clear('#loginAlert');
    Alert.clear('#forgotAlert');
  },

  showResetPassword() {
    $('#loginForm').style.display = 'none';
    $('#forgotPasswordSection').style.display = 'none';
    $('#resetPasswordSection').style.display = 'block';
    const forgotLinkP = $('#forgotLink')?.closest('p');
    if (forgotLinkP) forgotLinkP.style.display = 'none';
    Alert.clear('#resetAlert');
  },

  navigateTo(viewId) {
    State.currentView = viewId;
    Nav.setActive(viewId);

    $$('.view').forEach(v => v.classList.remove('active'));

    const viewEl = $(`#view${viewId.charAt(0).toUpperCase() + viewId.slice(1)}`);
    if (viewEl) viewEl.classList.add('active');

    const titles = {
      dashboard:  ['Dashboard', 'Visão geral do sistema'],
      materials:  ['Materiais', 'Consulte e requisite material escolar'],
      aquisicoes: ['Requisições',
        State.user?.role === 'admin' ? 'Gestão de todas as requisições'
        : State.user?.role === 'gestor' ? 'Gerir requisições ativas das duas escolas'
        : State.user?.role === 'professor' ? 'As suas e as dos alunos que o escolheram'
        : 'As suas requisições'],
      users:      ['Utilizadores', 'Gestão de utilizadores do sistema']
    };
    const [title, subtitle] = titles[viewId] || ['—', ''];
    setText($('#viewTitle'), title);
    setText($('#viewSubtitle'), subtitle);

    this.renderHeaderActions(viewId);

    switch (viewId) {
      case 'dashboard':  Views.loadDashboard(); break;
      case 'materials':  Views.loadMaterials(); break;
      case 'aquisicoes': Views.loadAquisicoes(); break;
      case 'users':      Views.loadUsers(); break;
    }
  },

  renderHeaderActions(viewId) {
    const container = $('#headerActions');
    container.innerHTML = '';
    const role = State.user?.role;

    if (viewId === 'materials' && role === 'admin') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '+ Adicionar Material';
      btn.addEventListener('click', () => MaterialAdmin.openForm());
      container.appendChild(btn);
    }
    if (viewId === 'users' && role === 'admin') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '+ Novo Utilizador';
      btn.addEventListener('click', () => UserAdmin.openForm());
      container.appendChild(btn);
    }
  },

  bindEvents() {
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      Alert.clear('#loginAlert');

      const email = $('#loginEmail').value.trim();
      const password = $('#loginPassword').value;

      if (!email || !password) {
        Alert.show('#loginAlert', 'Preencha todos os campos.');
        return;
      }

      const btn = $('#loginBtn');
      setText(btn, 'A entrar...');
      btn.disabled = true;

      const result = await Auth.login(email, password);

      if (result.ok) {
        this.showApp();
      } else {
        Alert.show('#loginAlert', result.message || 'Credenciais inválidas.');
        setText(btn, 'Entrar');
        btn.disabled = false;
      }
    });

    $('#logoutBtn').addEventListener('click', () => Auth.logout());

    $('#forgotLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      App.showForgotPassword();
    });

    $('#forgotBackBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      App.showLoginSection();
    });

    $('#forgotForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      Alert.clear('#forgotAlert');

      const email = $('#forgotEmail').value.trim();
      if (!email) {
        Alert.show('#forgotAlert', 'Por favor insira o seu email.');
        return;
      }

      const btn = $('#forgotSubmitBtn');
      setText(btn, 'A enviar...');
      btn.disabled = true;

      await Auth.forgotPassword(email);

      setText(btn, 'Enviar instruções');
      btn.disabled = false;

      // Mensagem genérica por segurança (não revela se o email existe ou não)
      Alert.show('#forgotAlert', 'Se o email existir na nossa base de dados, receberá um link em breve.', 'success');
      $('#forgotEmail').value = '';
    });

    // Redefinir password (via link de email com ?token=)
    $('#resetPasswordForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      Alert.clear('#resetAlert');

      const password    = $('#resetPassword').value;
      const confirmPass = $('#resetPasswordConfirm').value;

      if (!password || !confirmPass) {
        Alert.show('#resetAlert', 'Preencha todos os campos.');
        return;
      }
      if (password.length < 8) {
        Alert.show('#resetAlert', 'A password deve ter pelo menos 8 caracteres.');
        return;
      }
      if (password !== confirmPass) {
        Alert.show('#resetAlert', 'As passwords não coincidem.');
        return;
      }

      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) {
        Alert.show('#resetAlert', 'Token inválido ou expirado. Solicite um novo link.');
        return;
      }

      const btn = $('#resetSubmitBtn');
      setText(btn, 'A guardar...');
      btn.disabled = true;

      const res = await Auth.resetPassword(token, password);

      setText(btn, 'Guardar nova password');
      btn.disabled = false;

      if (res.ok) {
        Alert.show('#resetAlert', 'Password alterada com sucesso! Pode agora fazer login com a sua nova password.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => App.showLogin(), 2500);
      } else {
        Alert.show('#resetAlert', res.data.message || 'Token inválido ou expirado. Solicite um novo link.');
      }
    });

    let matSearchTimeout;
    $('#matSearch').addEventListener('input', () => {
      clearTimeout(matSearchTimeout);
      matSearchTimeout = setTimeout(() => Views.loadMaterials(), 400);
    });
    $('#matCatFilter')?.addEventListener('change', () => Views.loadMaterials());
    $('#matStatusFilter')?.addEventListener('change', () => Views.loadMaterials());
    $('#matEscolaFilter')?.addEventListener('change', () => Views.loadMaterials());

    $('#aqStatusFilter').addEventListener('change', () => Views.loadAquisicoes());

    $('#userRoleFilter').addEventListener('change', () => Views.loadUsers());

    $('#reqSubmitBtn').addEventListener('click', () => Acquisitions.submitRequest());

    let profSearchTimeout;
    $('#reqProfSearch')?.addEventListener('input', (e) => {
      clearTimeout(profSearchTimeout);
      const val = e.target.value;
      profSearchTimeout = setTimeout(() => Professores.render(val), 200);
    });

    $('#matFormSubmitBtn').addEventListener('click', () => MaterialAdmin.submitForm());

    $('#userFormSubmitBtn').addEventListener('click', () => UserAdmin.submitForm());

    $('#aqEditSubmitBtn')?.addEventListener('click', () => AquisicaoEdit.submit());
  }
};

const Views = {
  async loadDashboard() {
    const role = State.user?.role;

    const statsGrid = $('#statsGrid');
    statsGrid.innerHTML = '<div class="loading-wrapper"><div class="spinner"></div></div>';

    const [matRes, aqRes] = await Promise.all([
      API.get('/materials'),
      API.get('/aquisicoes')
    ]);

    const aq = aqRes.ok ? (aqRes.data.aquisicoes || []) : [];
    const totalAq = aqRes.ok ? (aqRes.data.total || 0) : 0;
    const pendentes = aq.filter(a => a.status === 'pendente').length;
    const emUso = aq.filter(a => ['aprovado','em_uso'].includes(a.status)).length;
    const totalMat = matRes.ok ? (matRes.data.total || 0) : 0;

    if (aqRes.ok) {
      State.pendingCount = pendentes;
      const badge = $('#navPendingBadge');
      if (badge) {
        badge.classList.toggle('show', pendentes > 0);
        setText(badge, pendentes > 0 ? pendentes : '');
      }
    }

    const stats = [
      { label: 'Total de Materiais', value: totalMat,   },
      { label: 'Requisições',        value: totalAq,  },
      { label: 'Em Uso',             value: emUso,   },
    ];
    if (role === 'admin' || role === 'professor') {
      stats.push({ label: 'Pendentes', value: pendentes,  });
    }

  statsGrid.innerHTML = '';
  stats.forEach((s, i) => {
  const card = document.createElement('div');
  card.className = 'stat-card';
  card.style.animationDelay = `${i * 0.08}s`;

  const infoDiv = document.createElement('div');

  const valueDiv = document.createElement('div');
  valueDiv.className = 'stat-value';
  setText(valueDiv, s.value ?? 0);

  const labelDiv = document.createElement('div');
  labelDiv.className = 'stat-label';
  setText(labelDiv, s.label);

  infoDiv.appendChild(valueDiv);
  infoDiv.appendChild(labelDiv);

  card.appendChild(infoDiv);

  statsGrid.appendChild(card);
});

    const pendingSection = $('#pendingSection');
    if (role === 'admin' || role === 'professor') {
      pendingSection.classList.remove('hidden');
      this.loadPending();
    } else {
      pendingSection.classList.add('hidden');
    }

    this.renderRecentAquisicoes(
      aqRes.ok ? (aqRes.data.aquisicoes?.slice(0, 5) || []) : null
    );
  },

  async loadPending() {
    const list = $('#pendingList');
    list.innerHTML = '<div class="loading-wrapper"><div class="spinner"></div></div>';

    const res = await API.get('/aquisicoes/pendentes');
    if (!res.ok) {
      list.innerHTML = '<p style="color:var(--gray-300);padding:20px">Erro ao carregar pedidos.</p>';
      return;
    }

    const pendentes = res.data.pendentes || [];
    State.pendingCount = pendentes.length;

    const badge = $('#navPendingBadge');
    if (badge) {
      badge.classList.toggle('show', pendentes.length > 0);
      setText(badge, pendentes.length > 0 ? pendentes.length : '');
    }

    list.innerHTML = '';
    if (pendentes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<div class="empty-state-icon">🎉</div>';
      const h3 = document.createElement('h3');
      setText(h3, 'Sem pedidos pendentes');
      const p = document.createElement('p');
      setText(p, 'Todos os pedidos foram processados.');
      empty.appendChild(h3);
      empty.appendChild(p);
      list.appendChild(empty);
      return;
    }

    pendentes.forEach(p => {
      const card = document.createElement('div');
      card.className = 'pending-card';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'pending-card-info';

      const title = document.createElement('div');
      title.className = 'pending-card-title';
      setText(title, `${p.material?.icone || '📦'} ${p.material?.nome || 'Material'}`);

      const meta = document.createElement('div');
      meta.className = 'pending-card-meta';
      const solicitante = p.solicitante;
      const nome = solicitante?.nome || 'Desconhecido';
      const numero = solicitante?.numero ? ` (${solicitante.numero})` : '';
      const periodo = `${formatDate(p.dataInicio)} → ${formatDate(p.dataFim)}`;
      const profInfo = (State.user?.role === 'admin' && p.professor?.nome)
        ? ` · Prof: ${p.professor.nome}` : '';
      setText(meta, `${nome}${numero} · Qtd: ${p.quantidade} · ${periodo}${profInfo}`);

      infoDiv.appendChild(title);
      infoDiv.appendChild(meta);

      const motivo = document.createElement('div');
      motivo.style.cssText = 'font-size:12px;color:var(--gray-500);margin-top:4px;';
      setText(motivo, `Motivo: ${p.motivo}`);
      infoDiv.appendChild(motivo);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'pending-card-actions';

      const approveBtn = document.createElement('button');
      approveBtn.className = 'btn btn-success btn-sm';
      setText(approveBtn, '✓ Aprovar');
      approveBtn.addEventListener('click', () => Acquisitions.approve(p._id));

      const rejectBtn = document.createElement('button');
      rejectBtn.className = 'btn btn-danger btn-sm';
      setText(rejectBtn, '✗ Rejeitar');
      rejectBtn.addEventListener('click', () => Acquisitions.openReject(p._id));

      actionsDiv.appendChild(approveBtn);
      actionsDiv.appendChild(rejectBtn);

      card.appendChild(infoDiv);
      card.appendChild(actionsDiv);
      list.appendChild(card);
    });
  },

  renderRecentAquisicoes(aquisicoes) {
    const list = $('#recentList');
    list.innerHTML = '';

    if (aquisicoes === null) {
      const p = document.createElement('p');
      p.style.cssText = 'color:var(--gray-300);padding:24px;text-align:center;font-size:14px;';
      setText(p, 'Não foi possível carregar as requisições.');
      list.appendChild(p);
      return;
    }

    if (!aquisicoes.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const icon = document.createElement('div');
      icon.className = 'empty-state-icon';
      setText(icon, '📭');
      const h3 = document.createElement('h3');
      setText(h3, 'Sem requisições');
      const p = document.createElement('p');
      setText(p, 'Ainda não fez nenhuma requisição.');
      empty.appendChild(icon);
      empty.appendChild(h3);
      empty.appendChild(p);
      list.appendChild(empty);
      return;
    }

    const tableDiv = document.createElement('div');
    tableDiv.className = 'table-container';
    const table = document.createElement('table');

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>Material</th><th>Solicitante</th><th>Estado</th><th>Data Fim</th>
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    aquisicoes.forEach(a => {
      const tr = this.buildAquisicaoRow(a, false);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableDiv.appendChild(table);
    list.appendChild(tableDiv);
  },

  buildAquisicaoRow(a, showActions = true) {
    const tr = document.createElement('tr');
    const role = State.user?.role;

    const tdMat = document.createElement('td');
    tdMat.style.fontWeight = '500';
    const matText = `${a.material?.icone || '📦'} ${a.material?.nome || 'Material removido'}`;
    const nomeDiv = document.createElement('div');
    setText(nomeDiv, matText);
    tdMat.appendChild(nomeDiv);
    // Códigos das unidades atribuídas (preenchido quando a requisição é aprovada)
    if (Array.isArray(a.codigosUnidades) && a.codigosUnidades.length) {
      const codDiv = document.createElement('div');
      setText(codDiv, `🏷️ ${a.codigosUnidades.join(', ')}`);
      codDiv.style.cssText = 'font-size:12px;font-weight:400;color:var(--gray-500);margin-top:2px;';
      tdMat.appendChild(codDiv);
    }
    tr.appendChild(tdMat);

    const tdSol = document.createElement('td');
    if (role === 'admin' || role === 'professor') {
      setText(tdSol, a.solicitante?.nome || 'Desconhecido');
      tdSol.style.color = 'var(--gray-500)';
    }
    tr.appendChild(tdSol);

    if (showActions) {
      const tdQty = document.createElement('td');
      setText(tdQty, a.quantidade);
      tr.appendChild(tdQty);

      const tdPeriod = document.createElement('td');
      setText(tdPeriod, `${formatDate(a.dataInicio)} → ${formatDate(a.dataFim)}`);
      tdPeriod.style.fontSize = '12px';
      tr.appendChild(tdPeriod);
    }

    const tdStatus = document.createElement('td');
    tdStatus.appendChild(buildStatusBadge(a.status));
    tr.appendChild(tdStatus);

    if (!showActions) {
      const tdDate = document.createElement('td');
      setText(tdDate, formatDate(a.dataFim));
      tdDate.style.fontSize = '12px';
      tr.appendChild(tdDate);
    } else {
      const tdActions = document.createElement('td');
      tdActions.style.whiteSpace = 'nowrap';

      const ativa = ['aprovado','em_uso','por_entregar'].includes(a.status);
      const podeGerir = role === 'admin' || role === 'gestor';

      // Editar requisição ativa (admin e gestor)
      if (ativa && podeGerir) {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-sm';
        editBtn.style.marginRight = '4px';
        setText(editBtn, '✏️ Editar');
        editBtn.addEventListener('click', () => AquisicaoEdit.open(a));
        tdActions.appendChild(editBtn);
      }

      // Devolver (dono, admin ou gestor) — inclui itens "por entregar"
      if (ativa) {
        const isOwner = a.solicitante?._id === State.user?._id;
        if (isOwner || podeGerir) {
          const btn = document.createElement('button');
          btn.className = 'btn btn-secondary btn-sm';
          setText(btn, 'Devolver');
          btn.addEventListener('click', () => Acquisitions.returnItem(a._id));
          tdActions.appendChild(btn);
        }
      }

      if (role === 'admin' && a.status === 'pendente') {
        const aBtn = document.createElement('button');
        aBtn.className = 'btn btn-success btn-sm';
        setText(aBtn, '✓');
        aBtn.style.marginRight = '4px';
        aBtn.addEventListener('click', () => Acquisitions.approve(a._id));

        const rBtn = document.createElement('button');
        rBtn.className = 'btn btn-danger btn-sm';
        setText(rBtn, '✗');
        rBtn.addEventListener('click', () => Acquisitions.openReject(a._id));

        tdActions.appendChild(aBtn);
        tdActions.appendChild(rBtn);
      }

      if (a.status === 'pendente') {
        const isOwner = a.solicitante?._id === State.user?._id;
        if (isOwner) {
          const btn = document.createElement('button');
          btn.className = 'btn btn-secondary btn-sm';
          btn.style.marginLeft = '4px';
          setText(btn, '✕ Cancelar');
          btn.addEventListener('click', () => Acquisitions.cancel(a._id));
          tdActions.appendChild(btn);
        }
      }

      tr.appendChild(tdActions);
    }

    return tr;
  },

  async loadMaterials() {
    const grid = $('#materialsGrid');
    grid.innerHTML = '<div class="loading-wrapper" style="grid-column:1/-1"><div class="spinner"></div></div>';

    const search = $('#matSearch')?.value.trim() || '';
    const cat = $('#matCatFilter')?.value || '';
    const status = $('#matStatusFilter')?.value || '';
    const escola = $('#matEscolaFilter')?.value || '';

    // Filtro de escola só aparece a quem vê as duas escolas (admin/gestor)
    const escFilterEl = $('#matEscolaFilter');
    if (escFilterEl) {
      const veTodas = State.user?.role === 'admin' || State.user?.role === 'gestor';
      escFilterEl.style.display = veTodas ? '' : 'none';
    }

    let url = '/materials?limit=1000';   // renderiza ate 1000
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (cat) url += `&categoria=${encodeURIComponent(cat)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (escola) url += `&escola=${encodeURIComponent(escola)}`;

    const res = await API.get(url);
    grid.innerHTML = '';

    if (!res.ok) {
      grid.innerHTML = '<p style="color:var(--red)">Erro ao carregar materiais.</p>';
      return;
    }

    const materials = res.data.materials || [];

    if (!materials.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.gridColumn = '1/-1';
      const icon = document.createElement('div');
      icon.className = 'empty-state-icon';
      setText(icon, '🔍');
      const h3 = document.createElement('h3');
      setText(h3, 'Sem resultados');
      const p = document.createElement('p');
      setText(p, 'Tente ajustar os filtros de pesquisa.');
      empty.appendChild(icon); empty.appendChild(h3); empty.appendChild(p);
      grid.appendChild(empty);
      return;
    }

    materials.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'material-card';
      card.style.animationDelay = `${i * 0.05}s`;

      const icon = document.createElement('span');
      icon.className = 'material-card-icon';
      setText(icon, m.icone || '📦');

      const name = document.createElement('div');
      name.className = 'material-card-name';
      setText(name, m.nome);

      const cat = document.createElement('div');
      cat.className = 'material-card-cat';
      setText(cat, `🏷️ ${m.categoria}`);

      const footer = document.createElement('div');
      footer.className = 'material-card-footer';

      const qty = document.createElement('div');
      qty.className = 'material-qty';
      const qtyStrong = document.createElement('strong');
      setText(qtyStrong, m.quantidadeDisponivel ?? m.quantidade);
      qty.textContent = 'Disponível: ';
      qty.appendChild(qtyStrong);

      // Se quantidade disponível for 0, mostra que está esgotado
      const disponivel = m.quantidadeDisponivel ?? m.quantidade;
      const statusVisual = (m.status === 'disponivel' && disponivel === 0) 
      ? 'indisponivel' 
      : m.status;
      const badge = buildStatusBadge(statusVisual, 'material');
      footer.appendChild(qty);
      footer.appendChild(badge);

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(cat);

      // Etiqueta de escola (visível para quem vê as duas escolas)
      if (m.escola && (State.user?.role === 'admin' || State.user?.role === 'gestor')) {
        const escEl = document.createElement('div');
        escEl.className = 'material-card-cat';
        escEl.style.color = 'var(--navy)';
        setText(escEl, `🏫 ${escolaLabel(m.escola)}`);
        card.appendChild(escEl);
      }

      card.appendChild(footer);

      card.addEventListener('click', () => MaterialDetail.open(m._id));
      grid.appendChild(card);
    });
  },

  async loadAquisicoes() {
    const tbody = $('#aquisicoesTbody');
    tbody.innerHTML = '<tr><td colspan="6"><div class="loading-wrapper"><div class="spinner"></div></div></td></tr>';

    const status = $('#aqStatusFilter')?.value || '';
    let url = '/aquisicoes?limit=1000';   // renderiza ate 1000
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const res = await API.get(url);
    tbody.innerHTML = '';

    if (!res.ok || !res.data.aquisicoes?.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.textAlign = 'center';
      td.style.padding = '48px';
      td.style.color = 'var(--gray-300)';
      setText(td, 'Sem requisições para mostrar.');
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    res.data.aquisicoes.forEach(a => {
      tbody.appendChild(this.buildAquisicaoRow(a, true));
    });
  },

  async loadUsers() {
    const tbody = $('#usersTbody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-wrapper"><div class="spinner"></div></div></td></tr>';

    const role = $('#userRoleFilter')?.value || '';
    let url = '/users?limit=10000';  // renderiza ate 10000
    if (role) url += `&role=${encodeURIComponent(role)}`;

    const res = await API.get(url);
    tbody.innerHTML = '';

    if (!res.ok) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7; setText(td, 'Erro ao carregar utilizadores.');
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }

    const users = res.data.users || [];

    users.forEach(u => {
      const tr = document.createElement('tr');
      
      const cols = [
        { val: u.nome, style: 'font-weight:600' },
        { val: u.email, style: 'color:var(--gray-500);font-size:13px' },
        { val: u.numero || '—', style: 'color:var(--gray-500)' }
      ];

      cols.forEach(c => {
        const td = document.createElement('td');
        if (c.style) td.style.cssText = c.style;
        setText(td, c.val);
        tr.appendChild(td);
      });

      const tdRole = document.createElement('td');
      tdRole.appendChild(buildRoleBadge(u.role));
      tr.appendChild(tdRole);

      const tdAtivo = document.createElement('td');
      const ativoBadge = document.createElement('span');
      ativoBadge.className = u.ativo ? 'badge badge-green' : 'badge badge-red';
      setText(ativoBadge, u.ativo ? '✓ Ativo' : '✗ Inativo');
      tdAtivo.appendChild(ativoBadge);
      tr.appendChild(tdAtivo);

      const tdDate = document.createElement('td');
      setText(tdDate, formatDate(u.createdAt));
      tdDate.style.fontSize = '13px';
      tr.appendChild(tdDate);

      const tdActions = document.createElement('td');
      tdActions.style.whiteSpace = 'nowrap';

      // Apenas o admin pode editar/ativar; o gestor vê em modo leitura
      if (State.user?.role === 'admin') {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-sm';
        setText(editBtn, '✏️ Editar');
        editBtn.style.marginRight = '6px';
        editBtn.addEventListener('click', () => UserAdmin.openForm(u));

        const toggleBtn = document.createElement('button');
        toggleBtn.className = u.ativo ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm';
        setText(toggleBtn, u.ativo ? 'Desativar' : 'Ativar');
        toggleBtn.addEventListener('click', () => UserAdmin.toggleActive(u._id, !u.ativo));

        tdActions.appendChild(editBtn);
        tdActions.appendChild(toggleBtn);
      } else {
        const dash = document.createElement('span');
        dash.style.color = 'var(--gray-300)';
        setText(dash, '—');
        tdActions.appendChild(dash);
      }
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }
};

const MaterialDetail = {
  async open(id) {
    const body = $('#materialModalBody');
    const footer = $('#materialModalFooter');
    body.innerHTML = '<div class="loading-wrapper"><div class="spinner"></div></div>';
    footer.innerHTML = '';
    Modals.open('materialModal');

    const res = await API.get(`/materials/${id}`);
    if (!res.ok) {
      body.innerHTML = '';
      const p = document.createElement('p');
      setText(p, 'Erro ao carregar material.');
      body.appendChild(p);
      return;
    }

    const { material, activeAquisicoes } = res.data;
    body.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'material-detail-header';

    const iconEl = document.createElement('div');
    iconEl.className = 'material-detail-icon';
    setText(iconEl, material.icone || '📦');

    const infoEl = document.createElement('div');
    infoEl.className = 'material-detail-info';

    const nameEl = document.createElement('h3');
    setText(nameEl, material.nome);

    const metaEl = document.createElement('div');
    metaEl.className = 'material-detail-meta';
    const disponivel = material.quantidadeDisponivel ?? material.quantidade;
    const statusVisual = (material.status === 'disponivel' && disponivel === 0) 
    ? 'indisponivel' 
    : material.status;
    metaEl.appendChild(buildStatusBadge(statusVisual, 'material'));

    const catBadge = document.createElement('span');
    catBadge.className = 'badge badge-navy';
    setText(catBadge, material.categoria);
    metaEl.appendChild(catBadge);

    if (material.escola) {
      const escBadge = document.createElement('span');
      escBadge.className = 'badge badge-navy';
      setText(escBadge, `🏫 ${escolaLabel(material.escola)}`);
      metaEl.appendChild(escBadge);
    }

    infoEl.appendChild(nameEl);

    if (material.descricao) {
      const desc = document.createElement('p');
      desc.style.cssText = 'font-size:14px;color:var(--gray-500);margin:8px 0;';
      setText(desc, material.descricao);
      infoEl.appendChild(desc);
    }

    infoEl.appendChild(metaEl);
    header.appendChild(iconEl);
    header.appendChild(infoEl);
    body.appendChild(header);

    const qtyDiv = document.createElement('div');
    qtyDiv.style.cssText = 'display:flex;gap:24px;padding:16px;background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:20px;';
    
    [
      { label: 'Total', val: material.quantidade },
      { label: 'Disponível', val: material.quantidadeDisponivel },
      { label: 'Em uso', val: material.quantidade - material.quantidadeDisponivel }
    ].forEach(q => {
      const item = document.createElement('div');
      const val = document.createElement('div');
      val.style.cssText = 'font-family:"Playfair Display",serif;font-size:24px;font-weight:700;color:var(--navy)';
      setText(val, q.val);
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:12px;color:var(--gray-500);';
      setText(lbl, q.label);
      item.appendChild(val);
      item.appendChild(lbl);
      qtyDiv.appendChild(item);
    });
    body.appendChild(qtyDiv);

   const role = State.user?.role;

    if (material.status === 'disponivel' && material.quantidadeDisponivel > 0) {
      const reqBtn = document.createElement('button');
      reqBtn.className = 'btn btn-primary';
      setText(reqBtn, 'Requisitar');
      reqBtn.addEventListener('click', () => {
        Modals.close('materialModal');
        Acquisitions.openRequest(material);
      });
      footer.appendChild(reqBtn);
    }

    if (role === 'admin') {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary';
      setText(editBtn, 'Editar');
      editBtn.addEventListener('click', () => {
        Modals.close('materialModal');
        MaterialAdmin.openForm(material);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      setText(delBtn, 'Eliminar');
      delBtn.addEventListener('click', () => MaterialAdmin.delete(material._id));

      footer.insertBefore(editBtn, footer.firstChild);
      footer.insertBefore(delBtn, editBtn);
    }
  }
};

// Professores (selector para requisições)
const Professores = {
  cache: null,
  selectedId: null,

  async fetch(search = '') {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await API.get(`/users/professores${qs}`);
    return res.ok ? (res.data.professores || []) : [];
  },

  async render(searchTerm = '') {
    const list = $('#reqProfessoresList');
    if (!list) return;
    list.innerHTML = '<div class="loading-wrapper"><div class="spinner"></div></div>';

    if (!this.cache) {
      this.cache = await this.fetch();
    }
    const term = (searchTerm || '').trim().toLowerCase();
    const professores = term
      ? this.cache.filter(p => p.nome.toLowerCase().includes(term))
      : this.cache;

    list.innerHTML = '';

    if (!professores.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.padding = '24px';
      setText(empty, 'Sem professores encontrados.');
      list.appendChild(empty);
      return;
    }

    professores.forEach(p => {
      const item = document.createElement('div');
      item.className = `prof-item${this.selectedId === p._id ? ' selected' : ''}`;
      item.dataset.id = p._id;

      const avatar = document.createElement('div');
      avatar.className = 'prof-avatar';
      setText(avatar, p.nome.charAt(0).toUpperCase());

      const info = document.createElement('div');
      info.className = 'prof-info';

      const name = document.createElement('div');
      name.className = 'prof-name';
      setText(name, p.nome);

      const meta = document.createElement('div');
      meta.className = 'prof-meta';
      setText(meta, p.escola === 'rainha' ? 'Esc. Rainha D. Leonor' : 'Esc. Eugénio dos Santos');

      info.appendChild(name);
      info.appendChild(meta);
      item.appendChild(avatar);
      item.appendChild(info);

      item.addEventListener('click', () => this.select(p._id));
      list.appendChild(item);
    });
  },

  select(id) {
    this.selectedId = id;
    $$('#reqProfessoresList .prof-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === id);
    });
    // Activar botão de submit porque começa desativado devido ao facto de ainda não estar um professor selecionado por parte do aluno
    const btn = $('#reqSubmitBtn');
    if (btn) btn.disabled = false;
    Alert.clear('#requestAlert');
  },

  reset() {
    this.selectedId = null;
    this.cache = null;
    const search = $('#reqProfSearch');
    if (search) search.value = '';
  }
};

const Acquisitions = {
  openRequest(material) {
    Alert.clear('#requestAlert');
    setField($('#reqMaterialName'), material.nome);
    $('#reqMaterialId').value = material._id;
    setField($('#reqDisponivel'), material.quantidadeDisponivel);
    $('#reqQuantidade').value = 1;
    $('#reqQuantidade').max = material.quantidadeDisponivel;
    $('#reqMotivo').value = '';

    const today = new Date().toISOString().split('T')[0];
    $('#reqDataInicio').value = today;
    $('#reqDataInicio').min = today;
    $('#reqDataFim').value = '';
    $('#reqDataFim').min = today;

    const approvalInfo = $('#reqAprovacaoInfo');
    if (State.user?.role === 'aluno') {
      approvalInfo.classList.remove('hidden');
    } else {
      approvalInfo.classList.add('hidden');
    }

    Professores.reset();
    $('#reqSubmitBtn').disabled = true;
    Professores.render();

    Modals.open('requestModal');
  },

  async submitRequest() {
    Alert.clear('#requestAlert');
    const materialId  = $('#reqMaterialId').value;
    const professorId = Professores.selectedId;
    const quantidade  = parseInt($('#reqQuantidade').value);
    const motivo      = $('#reqMotivo').value.trim();
    const dataInicio  = $('#reqDataInicio').value;
    const dataFim     = $('#reqDataFim').value;

    if (!professorId) {
      Alert.show('#requestAlert', 'Tem de selecionar um professor.');
      return;
    }
    if (!materialId || !quantidade || !motivo || !dataInicio || !dataFim) {
      Alert.show('#requestAlert', 'Preencha todos os campos obrigatórios.');
      return;
    }
    if (motivo.length < 10) {
      Alert.show('#requestAlert', 'O motivo deve ter pelo menos 10 caracteres.');
      return;
    }

    const btn = $('#reqSubmitBtn');
    setText(btn, 'A submeter...');
    btn.disabled = true;

    const res = await API.post('/aquisicoes', {
      material: materialId,
      professor: professorId,
      quantidade, motivo, dataInicio, dataFim
    });

    setText(btn, 'Submeter Requisição');
    btn.disabled = false;

    if (res.ok) {
      Modals.close('requestModal');
      Toast.show(res.data.message || 'Requisição submetida', 'success');
      if (State.currentView === 'dashboard') Views.loadDashboard();
      if (State.currentView === 'aquisicoes') Views.loadAquisicoes();
    } else {
      Alert.show('#requestAlert', res.data.message || 'Erro ao submeter requisição.');
    }
  },

  async approve(id) {
    const res = await API.put(`/aquisicoes/${id}/aprovar`);
    if (res.ok) {
      Toast.show('Requisição aprovada', 'success');
      Views.loadDashboard();
    } else {
      Toast.show(res.data.message || 'Erro ao aprovar.', 'error');
    }
  },

  openReject(id) {
    $('#rejectMotivo').value = '';
    const oldBtn = $('#rejectConfirmBtn');
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', () => this.reject(id));
    Modals.open('rejectModal');
},

  async reject(id) {
    const motivo = $('#rejectMotivo').value.trim();
    const res = await API.put(`/aquisicoes/${id}/rejeitar`, { motivo });
    Modals.close('rejectModal');
    if (res.ok) {
      Toast.show('Requisição rejeitada.', 'warning');
      if (State.currentView === 'dashboard') Views.loadDashboard();
      if (State.currentView === 'aquisicoes') Views.loadAquisicoes();
    } else {
      Toast.show(res.data.message || 'Erro ao rejeitar.', 'error');
    }
  },

  async returnItem(id) {
    if (!confirm('Confirma a devolução deste material?')) return;
    const res = await API.put(`/aquisicoes/${id}/devolver`);
    if (res.ok) {
      Toast.show('Material devolvido com sucesso', 'success');
      if (State.currentView === 'dashboard') Views.loadDashboard();
      if (State.currentView === 'aquisicoes') Views.loadAquisicoes();
    } else {
      Toast.show(res.data.message || 'Erro ao devolver.', 'error');
    }
  },

  async cancel(id) {
    if (!confirm('Confirma o cancelamento desta requisição?')) return;
    const res = await API.delete(`/aquisicoes/${id}`);
    if (res.ok) {
      Toast.show('Requisição cancelada.', 'info');
      if (State.currentView === 'dashboard') Views.loadDashboard();
      if (State.currentView === 'aquisicoes') Views.loadAquisicoes();
    } else {
      Toast.show(res.data.message || 'Erro ao cancelar.', 'error');
    }
  }
};

// Edição de requisições ativas (admin e gestor)
const AquisicaoEdit = {
  editId: null,

  open(a) {
    Alert.clear('#aqEditAlert');
    this.editId = a._id;
    $('#aqEditId').value = a._id;
    setField($('#aqEditMaterial'), `${a.material?.icone || '📦'} ${a.material?.nome || 'Material'}`);
    $('#aqEditQuantidade').value = a.quantidade;
    $('#aqEditStatus').value     = a.status;
    $('#aqEditMotivo').value     = a.motivo || '';
    $('#aqEditObservacao').value = a.observacaoAdmin || '';
    $('#aqEditDataInicio').value = (a.dataInicio || '').split('T')[0];
    $('#aqEditDataFim').value    = (a.dataFim || '').split('T')[0];
    Modals.open('aqEditModal');
  },

  async submit() {
    Alert.clear('#aqEditAlert');
    const id = this.editId;
    if (!id) return;

    const quantidade = parseInt($('#aqEditQuantidade').value);
    const status     = $('#aqEditStatus').value;
    const motivo     = $('#aqEditMotivo').value.trim();
    const observacaoAdmin = $('#aqEditObservacao').value.trim();
    const dataInicio = $('#aqEditDataInicio').value;
    const dataFim    = $('#aqEditDataFim').value;

    if (!quantidade || !motivo || !dataInicio || !dataFim) {
      Alert.show('#aqEditAlert', 'Preencha todos os campos.');
      return;
    }
    if (motivo.length < 10) {
      Alert.show('#aqEditAlert', 'O motivo deve ter pelo menos 10 caracteres.');
      return;
    }
    const ms = new Date(dataFim) - new Date(dataInicio);
    if (ms <= 0) {
      Alert.show('#aqEditAlert', 'A data de fim deve ser posterior à de início.');
      return;
    }
    if (ms > 7 * 24 * 60 * 60 * 1000) {
      Alert.show('#aqEditAlert', 'O período máximo de uma requisição é de 1 semana (7 dias).');
      return;
    }

    const btn = $('#aqEditSubmitBtn');
    const orig = btn.textContent;
    setText(btn, 'A guardar...');
    btn.disabled = true;

    const res = await API.put(`/aquisicoes/${id}`, { quantidade, status, motivo, observacaoAdmin, dataInicio, dataFim });

    setText(btn, orig);
    btn.disabled = false;

    if (res.ok) {
      Modals.close('aqEditModal');
      Toast.show('Requisição atualizada!', 'success');
      if (State.currentView === 'dashboard') Views.loadDashboard();
      if (State.currentView === 'aquisicoes') Views.loadAquisicoes();
    } else {
      Alert.show('#aqEditAlert', res.data.message || 'Erro ao atualizar requisição.');
    }
  }
};

const MaterialAdmin = {
  editId: null,

  openForm(material = null) {
    Alert.clear('#materialFormAlert');
    this.editId = material?._id || null;

    const title = material ? 'Editar Material' : 'Adicionar Material';
    setText($('#materialFormTitle'), title);
    setText($('#matFormSubmitBtn'), material ? 'Guardar Alterações' : 'Adicionar Material');

    $('#matFormNome').value      = material?.nome || '';
    $('#matFormIcone').value     = material?.icone || '📦';
    $('#matFormDescricao').value = material?.descricao || '';
    $('#matFormCategoria').value = material?.categoria || '';
    $('#matFormQuantidade').value= material?.quantidade ?? '';
    $('#matFormStatus').value    = material?.status || 'disponivel';
    $('#matFormEscola').value    = material?.escola || 'rainha';
    $('#matFormId').value        = material?._id || '';

    Modals.open('materialFormModal');
  },

  async submitForm() {
    Alert.clear('#materialFormAlert');
    const id = this.editId;

    const data = {
      nome:       $('#matFormNome').value.trim(),
      icone:      $('#matFormIcone').value.trim() || '📦',
      descricao:  $('#matFormDescricao').value.trim(),
      categoria:  $('#matFormCategoria').value,
      quantidade: parseInt($('#matFormQuantidade').value),
      status:     $('#matFormStatus').value,
      escola:     $('#matFormEscola').value
    };

    if (!data.nome || !data.categoria || isNaN(data.quantidade)) {
      Alert.show('#materialFormAlert', 'Preencha todos os campos obrigatórios.');
      return;
    }

    const btn = $('#matFormSubmitBtn');
    const origText = btn.textContent;
    setText(btn, 'A guardar...');
    btn.disabled = true;

    const res = id
      ? await API.put(`/materials/${id}`, data)
      : await API.post('/materials', data);

    setText(btn, origText);
    btn.disabled = false;

    if (res.ok) {
      Modals.close('materialFormModal');
      Toast.show(id ? 'Material atualizado!' : 'Material adicionado!', 'success');
      Views.loadMaterials();
    } else {
      Alert.show('#materialFormAlert', res.data.message || 'Erro ao guardar.');
    }
  },

  async delete(id) {
    if (!confirm('Tem a certeza que quer eliminar este material?')) return;
    Modals.close('materialModal');
    const res = await API.delete(`/materials/${id}`);
    if (res.ok) {
      Toast.show('Material eliminado.', 'success');
      Views.loadMaterials();
    } else {
      Toast.show(res.data.message || 'Erro ao eliminar.', 'error');
    }
  }
};

const UserAdmin = {
  editId: null,

  openForm(user = null) {
    Alert.clear('#userFormAlert');
    this.editId = user?._id || null;

    const isEdit = !!user;
    setText($('#userFormTitle'), isEdit ? 'Editar Utilizador' : 'Novo Utilizador');
    setText($('#userFormSubmitBtn'), isEdit ? 'Guardar Alterações' : 'Criar Utilizador');

    $('#userFormNome').value    = user?.nome || '';
    $('#userFormNumero').value  = user?.numero || '';
    $('#userFormEmail').value   = user?.email || '';
    $('#userFormRole').value    = user?.role || 'aluno';
    $('#userFormAtivo').value   = user ? String(user.ativo) : 'true';
    $('#userFormEscola').value  = user?.escola || 'rainha';
    $('#userFormPassword').value = '';
    $('#userFormId').value      = user?._id || '';

    const pwGroup = $('#userFormPasswordGroup');
    const pwInput = $('#userFormPassword');
    if (isEdit) {
      pwGroup.style.display = 'none';
      pwInput.required = false;
    } else {
      pwGroup.style.display = 'block';
      pwInput.required = true;
    }

    $('#userFormEmail').disabled = isEdit;

    Modals.open('userFormModal');
  },

  async submitForm() {
    Alert.clear('#userFormAlert');
    const id = this.editId;
    const isEdit = !!id;

    const data = {
      nome:   $('#userFormNome').value.trim(),
      numero: $('#userFormNumero').value.trim(),
      role:   $('#userFormRole').value,
      escola: $('#userFormEscola').value,
      ativo:  $('#userFormAtivo').value === 'true'
    };

    if (!isEdit) {
      data.email    = $('#userFormEmail').value.trim();
      data.password = $('#userFormPassword').value;
    }

    if (!data.nome) {
      Alert.show('#userFormAlert', 'Nome é obrigatório.');
      return;
    }
    if (!isEdit && (!data.email || !data.password)) {
      Alert.show('#userFormAlert', 'Email e password são obrigatórios.');
      return;
    }

    const btn = $('#userFormSubmitBtn');
    const origText = btn.textContent;
    setText(btn, 'A guardar...');
    btn.disabled = true;

    const res = isEdit
      ? await API.put(`/users/${id}`, data)
      : await API.post('/users', data);
    setText(btn, origText);
    btn.disabled = false;

    if (res.ok) {
      Modals.close('userFormModal');
      Toast.show(isEdit ? 'Utilizador atualizado!' : 'Utilizador criado!', 'success');
      Views.loadUsers();
    } else {
      Alert.show('#userFormAlert', res.data.message || 'Erro ao guardar utilizador.');
    }
  },

  async toggleActive(id, ativo) {
    const res = await API.put(`/users/${id}`, { ativo });
    if (res.ok) {
      Toast.show(ativo ? 'Utilizador ativado.' : 'Utilizador desativado.', 'success');
      Views.loadUsers();
    } else {
      Toast.show(res.data.message || 'Erro.', 'error');
    }
  }
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}

function buildStatusBadge(status, type = 'aquisicao') {
  const badge = document.createElement('span');

  if (type === 'material') {
    const map = {
      disponivel:   ['badge-green', 'Disponível'],
      indisponivel: ['badge-red',   'Indisponível'],
      manutencao:   ['badge-amber', 'Manutenção']
    };
    const [cls, label] = map[status] || ['badge-gray', status];
    badge.className = `badge ${cls}`;
    setText(badge, label);
    return badge;
  }

  const map = {
    pendente:     ['badge-amber',  'Pendente'],
    aprovado:     ['badge-green',  'Aprovado'],
    rejeitado:    ['badge-red',    'Rejeitado'],
    em_uso:       ['badge-blue',   'Em Uso'],
    por_entregar: ['badge-orange', 'Por Entregar'],
    devolvido:    ['badge-gray',   'Devolvido'],
    cancelado:    ['badge-gray',   'Cancelado']
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  badge.className = `badge ${cls}`;
  setText(badge, label);
  return badge;
}

function buildRoleBadge(role) {
  const badge = document.createElement('span');
  const map = {
    admin:     ['badge-amber', '⭐ Admin'],
    gestor:    ['badge-navy',  '🛠️ Gestor'],
    professor: ['badge-blue',  '👨‍🏫 Professor'],
    aluno:     ['badge-green', '🎓 Aluno']
  };
  const [cls, label] = map[role] || ['badge-gray', role];
  badge.className = `badge ${cls}`;
  setText(badge, label);
  return badge;
}

function escolaLabel(e) {
  return e === 'rainha'  ? 'Rainha D. Leonor'
       : e === 'eugenio' ? 'Eugénio dos Santos'
       : (e || '—');
}

window.App = App;
window.Modals = Modals;

document.addEventListener('DOMContentLoaded', () => App.init());