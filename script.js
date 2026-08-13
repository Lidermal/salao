// ESTÚDIO AMOR QUE CUIDA - JAVASCRIPT

const AppState = {
    currentUser: null,
    userRole: null,
    currentView: 'dashboard',
    selectedDate: new Date().toISOString().split('T')[0],
    data: { appointments: [], clients: [], services: [], products: [], expenses: [], employees: [], comandas: [], messages: [] }
};

const MockData = {
    users: [
        { username: 'andressa.vieira', role: 'owner', first_login: true, name: 'Andressa Vieira' },
        { username: 'admin.teste', role: 'owner', first_login: false, password: '123456', name: 'Admin Teste' },
        { username: 'maria.silva', role: 'freelancer', first_login: true, name: 'Maria Silva' },
        { username: 'joao.santos', role: 'freelancer', first_login: false, password: '123456', name: 'João Santos' }
    ],
    services: [
        { id: 1, name: 'Corte Feminino', duration: 45, price: 80, cost: 20, active: true },
        { id: 2, name: 'Coloração', duration: 90, price: 150, cost: 40, active: true },
        { id: 3, name: 'Escova', duration: 30, price: 50, cost: 10, active: true },
        { id: 4, name: 'Hidratação', duration: 45, price: 70, cost: 15, active: true }
    ],
    clients: [
        { id: 1, name: 'Ana Paula Costa', whatsapp: '11999887766', last_visit: '2026-08-10', total_spent: 450 },
        { id: 2, name: 'Beatriz Oliveira', whatsapp: '11988776655', last_visit: '2026-08-12', total_spent: 320 },
        { id: 3, name: 'Carla Mendes', whatsapp: '11977665544', last_visit: '2026-08-11', total_spent: 280 }
    ],
    appointments: [
        { id: 1, client: 'Ana Paula Costa', whatsapp: '11999887766', service: 'Corte Feminino', date: '2026-08-13', time: '09:00', professional: 'Andressa Vieira', status: 'confirmed' },
        { id: 2, client: 'Beatriz Oliveira', whatsapp: '11988776655', service: 'Coloração', date: '2026-08-13', time: '10:30', professional: 'Maria Silva', status: 'pending' },
        { id: 3, client: 'Carla Mendes', whatsapp: '11977665544', service: 'Escova', date: '2026-08-13', time: '14:00', professional: 'Andressa Vieira', status: 'confirmed' }
    ],
    products: [
        { id: 1, name: 'Shampoo Profissional 500ml', price: 45, stock: 12, min_stock: 5, cost: 25 },
        { id: 2, name: 'Condicionador Profissional 500ml', price: 45, stock: 3, min_stock: 5, cost: 25 }
    ],
    expenses: [
        { id: 1, description: 'Aluguel do Salão', category: 'Aluguel', value: 2500, date: '2026-08-01', payment_method: 'Transferência', status: 'paid' },
        { id: 2, description: 'Produtos de Limpeza', category: 'Material', value: 150, date: '2026-08-05', payment_method: 'Cartão', status: 'paid' }
    ],
    employees: [
        { id: 1, name: 'Andressa Vieira', specialty: 'Cabeleireira', commission: 40, color: '#B76E79', available: true },
        { id: 2, name: 'Maria Silva', specialty: 'Colorista', commission: 35, color: '#F4C2C2', available: true }
    ],
    comandas: [
        { id: 1, client: 'Ana Paula Costa', whatsapp: '11999887766', total: 150, open_date: '2026-08-13', status: 'open' },
        { id: 2, client: 'Beatriz Oliveira', whatsapp: '11988776655', total: 80, open_date: '2026-08-13', status: 'open' }
    ],
    messageTemplates: [
        { id: 1, name: 'Confirmação de Agendamento', text: 'Olá! Confirmamos seu agendamento para {data} às {hora}. Serviço: {serviço}. Aguardamos você!' },
        { id: 2, name: 'Lembrete 24h', text: 'Oi! Lembrando que amanhã você tem horário conosco às {hora}. Estamos ansiosas para te atender!' },
        { id: 3, name: 'Parabéns Aniversário', text: 'Feliz aniversário! Que seu dia seja especial como você! Venha nos visitar e ganhe 10% de desconto!' }
    ]
};

const Utils = {
    formatCurrency(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); },
    formatDate(dateString) { const d = new Date(dateString + 'T00:00:00'); return d.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); },
    validateWhatsApp(whatsapp) { const cleaned = whatsapp.replace(/\D/g, ''); return cleaned.length >= 10 && cleaned.length <= 11; },
    generateId() { return Date.now() + Math.random().toString(36).substr(2, 9); },
    debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; }
};

const Navigation = {
    showScreen(screenId) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(screenId)?.classList.add('active'); },
    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${viewId}-view`)?.classList.add('active');
        AppState.currentView = viewId;
        this.updatePageTitle(viewId);
        this.updateBottomNav(viewId);
        this.loadDataForView(viewId);
    },
    updatePageTitle(viewId) {
        const titles = { dashboard: 'Dashboard', agenda: 'Agenda', comandas: 'Comandas', clientes: 'Clientes', mensagens: 'Mensagens', servicos: 'Serviços', produtos: 'Produtos', despesas: 'Despesas', funcionarios: 'Funcionários', relatorios: 'Relatórios', configuracoes: 'Configurações' };
        const el = document.getElementById('page-title'); if (el) el.textContent = titles[viewId] || 'Estúdio';
    },
    updateBottomNav(viewId) { document.querySelectorAll('.nav-item').forEach(item => { item.classList.toggle('active', item.dataset.view === viewId); }); },
    loadDataForView(viewId) {
        const loaders = { dashboard: Dashboard.load, agenda: Agenda.load, comandas: Comandas.load, clientes: Clientes.load, servicos: Servicos.load, produtos: Produtos.load, despesas: Despesas.load, funcionarios: Funcionarios.load, relatorios: Relatorios.load, mensagens: Mensagens.load };
        loaders[viewId]?.();
    },
    openModal(modalId) { const m = document.getElementById(modalId); if (m) { m.classList.remove('hidden'); setTimeout(() => m.classList.add('active'), 10); } },
    closeModal(modalId) { const m = document.getElementById(modalId); if (m) { m.classList.remove('active'); setTimeout(() => m.classList.add('hidden'), 300); } }
};

const Auth = {
    tempUsername: null,
    init() {
        document.getElementById('login-form')?.addEventListener('submit', e => { e.preventDefault(); this.handleLogin(); });
        document.getElementById('create-password-form')?.addEventListener('submit', e => { e.preventDefault(); this.handleCreatePassword(); });
        document.getElementById('enter-password-form')?.addEventListener('submit', e => { e.preventDefault(); this.handleEnterPassword(); });
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
    },
    handleLogin() {
        const username = document.getElementById('username').value.trim().toLowerCase();
        const errorDiv = document.getElementById('login-error');
        if (!username) { this.showError(errorDiv, 'Digite seu usuário'); return; }
        const user = MockData.users.find(u => u.username === username);
        if (!user) { this.showError(errorDiv, 'Usuário não encontrado ou desativado'); return; }
        this.tempUsername = username;
        Navigation.showScreen(user.first_login ? 'create-password-screen' : 'enter-password-screen');
        if (!user.first_login) document.getElementById('user-display-name').textContent = `Olá, ${user.name}`;
    },
    handleCreatePassword() {
        const newPass = document.getElementById('new-password').value;
        const confirmPass = document.getElementById('confirm-password').value;
        const errorDiv = document.getElementById('password-error');
        if (newPass.length < 6) { this.showError(errorDiv, 'Senha muito curta (mínimo 6 caracteres)'); return; }
        if (newPass !== confirmPass) { this.showError(errorDiv, 'As senhas não coincidem'); return; }
        const user = MockData.users.find(u => u.username === this.tempUsername);
        if (user) { user.password = newPass; user.first_login = false; }
        this.completeLogin(this.tempUsername);
    },
    handleEnterPassword() {
        const password = document.getElementById('current-password').value;
        const errorDiv = document.getElementById('password-login-error');
        const user = MockData.users.find(u => u.username === this.tempUsername);
        if (!user || user.password !== password) { this.showError(errorDiv, 'Senha incorreta'); return; }
        this.completeLogin(this.tempUsername);
    },
    completeLogin(username) {
        const user = MockData.users.find(u => u.username === username);
        if (user) { AppState.currentUser = user; AppState.userRole = user.role; document.getElementById('main-app').classList.remove('hidden'); Navigation.showView('dashboard'); }
    },
    logout() {
        AppState.currentUser = null; AppState.userRole = null; AppState.currentView = 'dashboard';
        document.getElementById('main-app').classList.add('hidden');
        ['username', 'current-password', 'new-password', 'confirm-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        Navigation.showScreen('login-screen');
    },
    showError(element, message) { if (element) { element.textContent = message; element.classList.remove('hidden'); setTimeout(() => element.classList.add('hidden'), 3000); } },
    checkOwnerPermissions() { return AppState.userRole === 'owner'; }
};

const Dashboard = {
    load() {
        const today = new Date().toISOString().split('T')[0];
        const todayApts = MockData.appointments.filter(a => a.date === today);
        const revenue = todayApts.reduce((sum, apt) => { const svc = MockData.services.find(s => s.name === apt.service); return sum + (svc ? svc.price : 0); }, 0);
        const pending = todayApts.filter(a => a.status === 'pending').length;
        document.getElementById('today-revenue').textContent = Utils.formatCurrency(revenue);
        document.getElementById('today-appointments').textContent = todayApts.length;
        document.getElementById('pending-count').textContent = pending;
        
        const container = document.getElementById('upcoming-appointments');
        let apts = todayApts.filter(a => AppState.userRole === 'freelancer' ? a.professional === AppState.currentUser.name : true);
        apts.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 3);
        container.innerHTML = apts.length ? apts.map(apt => `<div class="appointment-item"><div class="appointment-time">${apt.time}</div><div class="appointment-details"><div class="appointment-client">${apt.client}</div><div class="appointment-service">${apt.service}</div></div><span class="badge badge-${apt.status}">${apt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}</span></div>`).join('') : '<p class="text-muted">Nenhum agendamento para hoje</p>';
    }
};

const Agenda = {
    load() {
        const dateInput = document.getElementById('agenda-date');
        if (dateInput) { dateInput.value = AppState.selectedDate; dateInput.addEventListener('change', e => { AppState.selectedDate = e.target.value; this.renderAppointments(); }); }
        
        const filterDiv = document.getElementById('agenda-filter');
        const select = document.getElementById('professional-filter');
        if (AppState.userRole === 'owner') {
            filterDiv.classList.remove('hidden');
            const professionals = [...new Set(MockData.appointments.map(a => a.professional))];
            select.innerHTML = '<option value="all">Todos os Profissionais</option>' + professionals.map(p => `<option value="${p}">${p}</option>`).join('');
            select.addEventListener('change', () => this.renderAppointments());
        } else { filterDiv.classList.add('hidden'); }
        this.renderAppointments();
    },
    renderAppointments() {
        const container = document.getElementById('agenda-list');
        const selectedDate = document.getElementById('agenda-date').value;
        const selectedProf = document.getElementById('professional-filter')?.value || 'all';
        let apts = MockData.appointments.filter(a => a.date === selectedDate);
        if (AppState.userRole === 'freelancer') apts = apts.filter(a => a.professional === AppState.currentUser.name);
        else if (selectedProf !== 'all') apts = apts.filter(a => a.professional === selectedProf);
        apts.sort((a, b) => a.time.localeCompare(b.time));
        container.innerHTML = apts.length ? apts.map(apt => `<div class="appointment-item"><div class="appointment-time">${apt.time}</div><div class="appointment-details"><div class="appointment-client">${apt.client}</div><div class="appointment-service">${apt.service} • ${apt.professional}</div></div><span class="badge badge-${apt.status}">${apt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}</span></div>`).join('') : '<p class="text-muted">Nenhum agendamento para esta data</p>';
    }
};

const Comandas = {
    load() { this.renderComandas(); this.setupSearch('comanda-search', '.comanda-item'); },
    renderComandas() {
        const container = document.getElementById('comandas-list');
        const openComandas = MockData.comandas.filter(c => c.status === 'open');
        container.innerHTML = openComandas.length ? openComandas.map(c => `<div class="comanda-item"><div class="item-header"><div class="item-title">${c.client}</div><div class="item-value">${Utils.formatCurrency(c.total)}</div></div><div class="item-subtitle">📱 ${c.whatsapp}</div><div class="item-meta"><span>Aberta em: ${Utils.formatDate(c.open_date)}</span><button class="btn btn-secondary" onclick="Comandas.fecharComanda(${c.id})">Fechar</button></div></div>`).join('') : '<p class="text-muted">Nenhuma comanda aberta</p>';
    },
    setupSearch(inputId, itemSelector) {
        const input = document.getElementById(inputId);
        if (input) input.addEventListener('input', Utils.debounce(e => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll(itemSelector).forEach(item => { item.style.display = item.textContent.toLowerCase().includes(query) ? 'block' : 'none'; });
        }, 300));
    },
    fecharComanda(id) { const c = MockData.comandas.find(x => x.id === id); if (c) { c.status = 'closed'; this.renderComandas(); alert(`Comanda de ${c.client} fechada!`); } }
};

const Clientes = {
    load() { this.renderClientes(); Comandas.setupSearch('cliente-search', '.cliente-item'); },
    renderClientes() {
        const container = document.getElementById('clientes-list');
        container.innerHTML = MockData.clients.length ? MockData.clients.map(c => `<div class="cliente-item" onclick="Clientes.showDetail(${c.id})"><div class="item-header"><div class="item-title">${c.name}</div><div class="item-value">${Utils.formatCurrency(c.total_spent)}</div></div><div class="item-subtitle">📱 ${c.whatsapp}</div><div class="item-meta"><span>Última visita: ${Utils.formatDate(c.last_visit)}</span></div></div>`).join('') : '<p class="text-muted">Nenhum cliente cadastrado</p>';
    },
    showDetail(clientId) {
        const client = MockData.clients.find(c => c.id === clientId);
        if (client) {
            document.getElementById('cliente-detail-name').textContent = client.name;
            document.getElementById('cliente-history').innerHTML = `<div class="history-item"><div class="history-date">${Utils.formatDate('2026-08-10')}</div><div class="history-service">Corte Feminino</div><div class="history-notes">Cliente satisfeita</div></div><div class="history-item"><div class="history-date">${Utils.formatDate('2026-07-25')}</div><div class="history-service">Coloração + Escova</div><div class="history-notes">Cor: Castanho claro</div></div>`;
            Navigation.openModal('cliente-detail-modal');
        }
    }
};

const Servicos = {
    load() { this.renderServicos(); this.checkPermissions('add-servico-btn'); },
    renderServicos() {
        const container = document.getElementById('servicos-list');
        container.innerHTML = MockData.services.length ? MockData.services.map(s => `<div class="servico-item"><div class="item-header"><div class="item-title">${s.name}</div><div class="item-value">${Utils.formatCurrency(s.price)}</div></div><div class="item-meta"><span>${s.duration} min</span><span>Custo: ${Utils.formatCurrency(s.cost)}</span><span>${s.active ? 'Ativo' : 'Inativo'}</span></div></div>`).join('') : '<p class="text-muted">Nenhum serviço cadastrado</p>';
    },
    checkPermissions(btnId) { const btn = document.getElementById(btnId); if (btn) btn.classList.toggle('hidden', !Auth.checkOwnerPermissions()); }
};

const Produtos = {
    load() { this.renderProdutos(); Servicos.checkPermissions('add-produto-btn'); },
    renderProdutos() {
        const container = document.getElementById('produtos-list');
        container.innerHTML = MockData.products.length ? MockData.products.map(p => { const low = p.stock <= p.min_stock; return `<div class="produto-item"><div class="item-header"><div class="item-title">${p.name}</div><div class="item-value">${Utils.formatCurrency(p.price)}</div></div><div class="item-meta"><span>Estoque: ${p.stock} unid.</span><span>Custo: ${Utils.formatCurrency(p.cost)}</span>${low ? '<span style="color:var(--danger)">Estoque baixo!</span>' : ''}</div></div>`; }).join('') : '<p class="text-muted">Nenhum produto cadastrado</p>';
    }
};

const Despesas = {
    load() { this.renderDespesas(); Servicos.checkPermissions('add-despesa-btn'); },
    renderDespesas() {
        const container = document.getElementById('despesas-list');
        container.innerHTML = MockData.expenses.length ? MockData.expenses.map(e => `<div class="despesa-item"><div class="item-header"><div class="item-title">${e.description}</div><div class="item-value">${Utils.formatCurrency(e.value)}</div></div><div class="item-subtitle">${e.category}</div><div class="item-meta"><span>${Utils.formatDate(e.date)}</span><span>${e.payment_method}</span><span>${e.status === 'paid' ? 'Pago' : 'Pendente'}</span></div></div>`).join('') : '<p class="text-muted">Nenhuma despesa registrada</p>';
    }
};

const Funcionarios = {
    load() { this.renderFuncionarios(); Servicos.checkPermissions('add-funcionario-btn'); },
    renderFuncionarios() {
        const container = document.getElementById('funcionarios-list');
        container.innerHTML = MockData.employees.length ? MockData.employees.map(e => `<div class="funcionario-item" style="border-left:4px solid ${e.color}"><div class="item-header"><div class="item-title">${e.name}</div><div class="item-value">${e.commission}% comissão</div></div><div class="item-subtitle">${e.specialty}</div><div class="item-meta"><span>${e.available ? 'Disponível' : 'Indisponível'}</span></div></div>`).join('') : '<p class="text-muted">Nenhum funcionário cadastrado</p>';
    }
};

const Relatorios = {
    load() {
        this.setupTabs();
        const totalRevenue = MockData.appointments.reduce((sum, apt) => { const svc = MockData.services.find(s => s.name === apt.service); return sum + (svc ? svc.price : 0); }, 0);
        const totalExpenses = MockData.expenses.reduce((sum, e) => sum + e.value, 0);
        document.getElementById('total-revenue').textContent = Utils.formatCurrency(totalRevenue);
        document.getElementById('total-expenses').textContent = Utils.formatCurrency(totalExpenses);
        document.getElementById('net-profit').textContent = Utils.formatCurrency(totalRevenue - totalExpenses);
        
        const sorted = [...MockData.clients].sort((a, b) => b.total_spent - a.total_spent);
        document.getElementById('top-clients-list').innerHTML = sorted.map((c, i) => `<div class="ranking-item"><div class="ranking-position">${i + 1}</div><div class="ranking-info"><div class="ranking-name">${c.name}</div><div class="ranking-stats">Última visita: ${Utils.formatDate(c.last_visit)}</div></div><div class="ranking-value">${Utils.formatCurrency(c.total_spent)}</div></div>`).join('');
    },
    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.report-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`report-${btn.dataset.tab}`).classList.add('active');
            });
        });
    }
};

const Mensagens = {
    load() {
        const container = document.getElementById('templates-list');
        container.innerHTML = MockData.messageTemplates.length ? MockData.messageTemplates.map(t => `<div class="template-item" onclick="Mensagens.copyTemplate(${t.id})"><div class="template-name">${t.name}</div><div class="template-preview">${t.text}</div></div>`).join('') : '<p class="text-muted">Nenhuma mensagem pré-definida</p>';
    },
    copyTemplate(id) {
        const t = MockData.messageTemplates.find(x => x.id === id);
        if (t) { navigator.clipboard.writeText(t.text).then(() => alert('Mensagem copiada!')).catch(() => console.error('Erro ao copiar')); }
    }
};

const Modals = {
    init() {
        document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => Navigation.closeModal(btn.closest('.modal').id)));
        document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) Navigation.closeModal(m.id); }));
        
        const form = document.getElementById('agendamento-form');
        if (form) {
            form.addEventListener('submit', e => {
                e.preventDefault();
                const cliente = document.getElementById('ag-cliente').value.trim();
                const whatsapp = document.getElementById('ag-whatsapp').value.trim();
                const servico = document.getElementById('ag-servico').value;
                const data = document.getElementById('ag-data').value;
                const hora = document.getElementById('ag-hora').value;
                const profissional = document.getElementById('ag-profissional').value || AppState.currentUser.name;
                
                if (!cliente || !whatsapp || !servico || !data || !hora) { alert('Preencha todos os campos'); return; }
                if (!Utils.validateWhatsApp(whatsapp)) { alert('WhatsApp inválido'); return; }
                
                MockData.appointments.push({ id: Utils.generateId(), client: cliente, whatsapp, service: servico, date: data, time: hora, professional, status: 'pending' });
                alert('Agendamento criado!');
                Navigation.closeModal('agendamento-modal');
                form.reset();
                if (AppState.currentView === 'agenda') Agenda.load();
            });
            
            const servSelect = document.getElementById('ag-servico');
            if (servSelect) servSelect.innerHTML = '<option value="">Selecione...</option>' + MockData.services.map(s => `<option value="${s.name}">${s.name} - ${Utils.formatCurrency(s.price)}</option>`).join('');
            
            const profSelect = document.getElementById('ag-profissional');
            const profGroup = document.getElementById('ag-profissional-group');
            if (profSelect && profGroup) {
                if (AppState.userRole === 'freelancer') { profGroup.classList.add('hidden'); profSelect.value = AppState.currentUser.name; }
                else { profGroup.classList.remove('hidden'); profSelect.innerHTML = '<option value="">Selecione...</option>' + MockData.employees.map(e => `<option value="${e.name}">${e.name}</option>`).join(''); }
            }
        }
    }
};

const App = {
    async init() {
        await new Promise(r => { Navigation.showScreen('splash-screen'); setTimeout(r, 1200); });
        Auth.init();
        Modals.init();
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const viewId = item.dataset.view;
                viewId === 'mais' ? Navigation.openModal('menu-modal') : Navigation.showView(viewId);
            });
        });
        
        document.querySelectorAll('#menu-modal li').forEach(item => {
            item.addEventListener('click', () => { Navigation.closeModal('menu-modal'); Navigation.showView(item.dataset.view); });
        });
        
        document.getElementById('menu-btn')?.addEventListener('click', () => Navigation.openModal('menu-modal'));
        Navigation.showScreen('login-screen');
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.Comandas = Comandas;
window.Clientes = Clientes;
window.Mensagens = Mensagens;
