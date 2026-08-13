/**
 * ESTÚDIO AMOR QUE CUIDA - VERSÃO BLINDADA
 * Com timer de segurança para evitar tela branca infinita
 */

// ==========================================
// TIMER DE SEGURANÇA (FORÇA SAÍDA DO SPLASH EM 3s)
// ==========================================
let splashTimeout = setTimeout(() => {
    console.warn('⚠️ Timeout de segurança: Forçando saída do Splash Screen');
    document.getElementById('splash-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('loading-status').textContent = 'Erro ao carregar. Tentando login...';
}, 3000);

// ==========================================
// CONFIGURAÇÃO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';

let supabase = null;
let USE_SUPABASE = false;

try {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        USE_SUPABASE = true;
        console.log('✅ Supabase conectado');
    } else {
        throw new Error('Supabase library not loaded');
    }
} catch (e) {
    console.error('❌ Erro Supabase:', e);
    alert('Erro de conexão com o banco de dados. Verifique sua internet.');
}

// ==========================================
// ESTADO DA APLICAÇÃO
// ==========================================
const AppState = {
    currentUser: null,
    userRole: null,
    currentView: 'dashboard',
    selectedDate: new Date().toISOString().split('T')[0],
    data: { appointments: [], clients: [], services: [], products: [], expenses: [], employees: [], comandas: [] }
};

// ==========================================
// UTILITÁRIOS
// ==========================================
const Utils = {
    formatCurrency(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0); },
    formatDate(dateString) { 
        if (!dateString) return '-';
        try { return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } 
        catch(e) { return dateString; }
    },
    debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; }
};

// ==========================================
// NAVEGAÇÃO
// ==========================================
const Navigation = {
    showScreen(screenId) {
        // Cancela o timer de segurança se a navegação funcionar
        clearTimeout(splashTimeout);
        
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            console.log(`Navegando para: ${screenId}`);
        } else {
            console.error(`Tela não encontrada: ${screenId}`);
        }
    },
    
    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`${viewId}-view`);
        if (target) {
            target.classList.add('active');
            AppState.currentView = viewId;
            this.updatePageTitle(viewId);
            this.updateBottomNav(viewId);
            this.loadDataForView(viewId);
        }
    },

    updatePageTitle(viewId) {
        const titles = { dashboard: 'Dashboard', agenda: 'Agenda', comandas: 'Comandas', clientes: 'Clientes', servicos: 'Serviços', produtos: 'Produtos', despesas: 'Despesas', funcionarios: 'Funcionários', relatorios: 'Relatórios', configuracoes: 'Configurações', mensagens: 'Mensagens' };
        const el = document.getElementById('page-title');
        if (el) el.textContent = titles[viewId] || 'Estúdio';
    },

    updateBottomNav(viewId) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === viewId));
    },

    loadDataForView(viewId) {
        const loaders = {
            dashboard: Dashboard.load, agenda: Agenda.load, comandas: Comandas.load,
            clientes: Clientes.load, servicos: Servicos.load, produtos: Produtos.load,
            despesas: Despesas.load, funcionarios: Funcionarios.load, relatorios: Relatorios.load, mensagens: Mensagens.load
        };
        if (loaders[viewId]) {
            try { loaders[viewId](); } 
            catch(e) { console.error(`Erro ao carregar ${viewId}:`, e); }
        }
    },

    openModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) { m.classList.remove('hidden'); setTimeout(() => m.classList.add('active'), 10); }
    },

    closeModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) { m.classList.remove('active'); setTimeout(() => m.classList.add('hidden'), 300); }
    }
};

// ==========================================
// AUTENTICAÇÃO
// ==========================================
const Auth = {
    tempUserData: null,

    init() {
        // Step 1: Buscar usuário
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim().toLowerCase();
            const errorDiv = document.getElementById('login-error');

            if (!username) { this.showError(errorDiv, 'Digite seu usuário'); return; }

            try {
                let data = null;
                if (USE_SUPABASE) {
                    const { data: dbData, error } = await supabase.from('users').select('*').eq('username', username).single();
                    if (error) throw error;
                    data = dbData;
                } else {
                    // Fallback de emergência caso Supabase falhe (apenas para debug)
                    console.warn('Usando fallback local devido a erro no Supabase');
                    // Aqui você poderia ter um dado mínimo só para não travar a tela, 
                    // mas como você pediu sem dados no código, vamos manter o erro visível.
                    throw new Error('Supabase indisponível');
                }

                if (!data) { this.showError(errorDiv, 'Usuário não encontrado'); return; }

                this.tempUserData = data;
                if (data.first_login) Navigation.showScreen('create-password-screen');
                else {
                    document.getElementById('user-display-name').textContent = `Olá, ${data.name}`;
                    Navigation.showScreen('enter-password-screen');
                }
            } catch (err) {
                console.error('Auth Error:', err);
                this.showError(errorDiv, 'Erro de conexão. Verifique o console (F12).');
            }
        });

        // Step 2: Criar senha
        document.getElementById('create-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = document.getElementById('new-password').value;
            const p2 = document.getElementById('confirm-password').value;
            const errorDiv = document.getElementById('password-error');

            if (p1.length < 6) { this.showError(errorDiv, 'Mínimo 6 caracteres'); return; }
            if (p1 !== p2) { this.showError(errorDiv, 'Senhas diferentes'); return; }

            try {
                if (USE_SUPABASE) {
                    const { error } = await supabase.from('users').update({ password: p1, first_login: false }).eq('id', this.tempUserData.id);
                    if (error) throw error;
                }
                this.tempUserData.password = p1;
                this.tempUserData.first_login = false;
                this.completeLogin(this.tempUserData);
            } catch (err) {
                this.showError(errorDiv, 'Erro ao salvar senha.');
            }
        });

        // Step 3: Login normal
        document.getElementById('enter-password-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const pass = document.getElementById('current-password').value;
            const errorDiv = document.getElementById('password-login-error');

            if (pass !== this.tempUserData.password) { this.showError(errorDiv, 'Senha incorreta'); return; }
            this.completeLogin(this.tempUserData);
        });

        document.getElementById('logout-btn').addEventListener('click', () => location.reload());
    },

    completeLogin(user) {
        clearTimeout(splashTimeout); // Garante que o timer não atrapalhe
        AppState.currentUser = user;
        AppState.userRole = user.role;
        
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('main-app').classList.remove('hidden');
        
        Data.loadAll().then(() => Navigation.showView('dashboard'));
    },

    showError(el, msg) {
        el.textContent = msg;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 4000);
    }
};

// ==========================================
// DADOS
// ==========================================
const Data = {
    async loadAll() {
        if (!USE_SUPABASE) return;
        
        try {
            const [svc, apt, cli, prod, exp, emp, com] = await Promise.all([
                supabase.from('services').select('*').eq('active', true),
                supabase.from('appointments').select('*, clients(name), services(name, price), users(name)').order('date', {ascending: true}),
                supabase.from('clients').select('*'),
                supabase.from('products').select('*'),
                supabase.from('expenses').select('*'),
                supabase.from('employees').select('*'),
                supabase.from('comandas').select('*, clients(name)').eq('status', 'open')
            ]);

            AppState.data.services = svc.data || [];
            AppState.data.appointments = apt.data || [];
            AppState.data.clients = cli.data || [];
            AppState.data.products = prod.data || [];
            AppState.data.expenses = exp.data || [];
            AppState.data.employees = emp.data || [];
            AppState.data.comandas = com.data || [];
            
            this.populateSelects();
        } catch (e) { console.error('Erro ao carregar dados:', e); }
    },

    populateSelects() {
        const agSvc = document.getElementById('ag-servico');
        if(agSvc) agSvc.innerHTML = '<option value="">Selecione...</option>' + AppState.data.services.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        
        const agProf = document.getElementById('ag-profissional');
        const filtProf = document.getElementById('professional-filter');
        const opts = AppState.data.employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        
        if(agProf) agProf.innerHTML = '<option value="">Selecione...</option>' + opts;
        if(filtProf) filtProf.innerHTML = '<option value="all">Todos</option>' + opts;
    }
};

// ==========================================
// VIEWS (Resumidas para caber aqui, mas funcionais)
// ==========================================
const Dashboard = {
    load() {
        const today = new Date().toISOString().split('T')[0];
        const appts = AppState.data.appointments.filter(a => a.date === today);
        const rev = appts.reduce((s, a) => s + (parseFloat(a.services?.price)||0), 0);
        
        document.getElementById('today-revenue').textContent = Utils.formatCurrency(rev);
        document.getElementById('today-appointments').textContent = appts.length;
        document.getElementById('pending-count').textContent = appts.filter(a=>a.status==='pending').length;
        
        const list = document.getElementById('upcoming-appointments');
        const display = (AppState.userRole === 'freelancer') ? appts.filter(a=>a.users?.name===AppState.currentUser.name) : appts;
        
        list.innerHTML = display.slice(0,3).map(a => `
            <div class="appointment-item">
                <div class="appointment-time">${a.time}</div>
                <div class="appointment-details" style="flex:1; margin-left:10px;">
                    <div class="appointment-client">${a.clients?.name}</div>
                    <div class="appointment-service">${a.services?.name}</div>
                </div>
                <span class="badge badge-${a.status}">${a.status}</span>
            </div>
        `).join('') || '<p class="text-muted">Sem agendamentos hoje.</p>';
    }
};

const Agenda = {
    load() {
        const dt = document.getElementById('agenda-date');
        if(dt) { dt.value = AppState.selectedDate; dt.onchange = (e)=>{AppState.selectedDate=e.target.value; this.render();}; }
        
        const filt = document.getElementById('agenda-filter');
        const sel = document.getElementById('professional-filter');
        if(AppState.userRole === 'owner') { filt.classList.remove('hidden'); sel.onchange = ()=>this.render(); }
        else filt.classList.add('hidden');
        this.render();
    },
    render() {
        const c = document.getElementById('agenda-list');
        const d = document.getElementById('agenda-date').value;
        let a = AppState.data.appointments.filter(x=>x.date===d);
        if(AppState.userRole==='freelancer') a=a.filter(x=>x.users?.name===AppState.currentUser.name);
        
        c.innerHTML = a.map(x => `
            <div class="appointment-item">
                <div class="appointment-time">${x.time}</div>
                <div class="appointment-details" style="flex:1; margin-left:10px;">
                    <div class="appointment-client">${x.clients?.name}</div>
                    <div class="appointment-service">${x.services?.name} • ${x.users?.name}</div>
                </div>
                <span class="badge badge-${x.status}">${x.status}</span>
            </div>
        `).join('') || '<p class="text-muted">Nenhum agendamento.</p>';
    }
};

const Comandas = {
    load() { this.render(); document.getElementById('comanda-search').oninput = Utils.debounce((e)=>this.render(e.target.value), 300); },
    render(f='') {
        const c = document.getElementById('comandas-list');
        let l = AppState.data.comandas;
        if(f) l=l.filter(x=>x.clients?.name.toLowerCase().includes(f.toLowerCase()));
        c.innerHTML = l.map(x => `
            <div class="comanda-item">
                <div style="flex:1"><div class="item-title">${x.clients?.name}</div><div class="item-subtitle">${Utils.formatDate(x.open_date)}</div></div>
                <div class="item-value">${Utils.formatCurrency(x.total)}</div>
            </div>
        `).join('') || '<p class="text-muted">Nenhuma comanda.</p>';
    }
};

const Clientes = {
    load() { this.render(); document.getElementById('cliente-search').oninput = Utils.debounce((e)=>this.render(e.target.value), 300); },
    render(f='') {
        const c = document.getElementById('clientes-list');
        let l = AppState.data.clients;
        if(f) l=l.filter(x=>x.name.toLowerCase().includes(f.toLowerCase()) || x.whatsapp.includes(f));
        c.innerHTML = l.map(x => `
            <div class="cliente-item" onclick="Clientes.detail(${x.id})">
                <div style="flex:1"><div class="item-title">${x.name}</div><div class="item-subtitle">${x.whatsapp}</div></div>
                <div class="item-value">${Utils.formatCurrency(x.total_spent)}</div>
            </div>
        `).join('') || '<p class="text-muted">Nenhum cliente.</p>';
    },
    detail(id) {
        const cl = AppState.data.clients.find(x=>x.id===id);
        if(cl) {
            document.getElementById('cliente-detail-name').textContent = cl.name;
            document.getElementById('cliente-history').innerHTML = '<div class="history-item"><div class="history-service">Histórico em desenvolvimento</div></div>';
            Navigation.openModal('cliente-detail-modal');
        }
    }
};

const Servicos = {
    load() {
        document.getElementById('servicos-list').innerHTML = AppState.data.services.map(s => `
            <div class="servico-item"><div style="flex:1"><div class="item-title">${s.name}</div><div class="item-subtitle">${s.duration}min</div></div><div class="item-value">${Utils.formatCurrency(s.price)}</div></div>
        `).join('');
        const b = document.getElementById('add-servico-btn'); if(b) b.classList.toggle('hidden', AppState.userRole!=='owner');
    }
};

const Produtos = {
    load() {
        document.getElementById('produtos-list').innerHTML = AppState.data.products.map(p => `
            <div class="produto-item"><div style="flex:1"><div class="item-title">${p.name}</div><div class="item-subtitle">Estoque: ${p.stock}</div></div><div class="item-value">${Utils.formatCurrency(p.price)}</div></div>
        `).join('');
        const b = document.getElementById('add-produto-btn'); if(b) b.classList.toggle('hidden', AppState.userRole!=='owner');
    }
};

const Despesas = {
    load() {
        document.getElementById('despesas-list').innerHTML = AppState.data.expenses.map(e => `
            <div class="despesa-item"><div style="flex:1"><div class="item-title">${e.description}</div><div class="item-subtitle">${e.category}</div></div><div class="item-value" style="color:red">-${Utils.formatCurrency(e.value)}</div></div>
        `).join('');
        const b = document.getElementById('add-despesa-btn'); if(b) b.classList.toggle('hidden', AppState.userRole!=='owner');
    }
};

const Funcionarios = {
    load() {
        document.getElementById('funcionarios-list').innerHTML = AppState.data.employees.map(e => `
            <div class="funcionario-item"><div style="flex:1"><div class="item-title">${e.name}</div><div class="item-subtitle">${e.specialty}</div></div><div class="item-value">${e.commission}%</div></div>
        `).join('');
        const b = document.getElementById('add-funcionario-btn'); if(b) b.classList.toggle('hidden', AppState.userRole!=='owner');
    }
};

const Relatorios = {
    load() {
        document.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
            document.querySelectorAll('.report-content').forEach(x=>x.classList.remove('active'));
            b.classList.add('active'); document.getElementById(`report-${b.dataset.tab}`).classList.add('active');
        });
        
        const rev = AppState.data.appointments.reduce((s,a)=>s+(parseFloat(a.services?.price)||0),0);
        const exp = AppState.data.expenses.reduce((s,e)=>s+e.value,0);
        document.getElementById('total-revenue').textContent = Utils.formatCurrency(rev);
        document.getElementById('total-expenses').textContent = Utils.formatCurrency(exp);
        document.getElementById('net-profit').textContent = Utils.formatCurrency(rev-exp);
        
        document.getElementById('top-clients-list').innerHTML = [...AppState.data.clients].sort((a,b)=>b.total_spent-a.total_spent).map((c,i)=>`
            <div class="ranking-item"><div class="ranking-position">${i+1}</div><div class="ranking-info"><div class="ranking-name">${c.name}</div></div><div class="ranking-value">${Utils.formatCurrency(c.total_spent)}</div></div>
        `).join('');
    }
};

const Mensagens = {
    templates: [{id:1, name:'Confirmação', text:'Olá! Confirmamos seu horário.'}],
    load() {
        document.getElementById('templates-list').innerHTML = this.templates.map(t => `
            <div class="template-item" onclick="navigator.clipboard.writeText('${t.text}');alert('Copiado!')">
                <div class="item-title">${t.name}</div><div class="item-subtitle">${t.text}</div>
            </div>
        `).join('');
    }
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
const App = {
    async init() {
        console.log('Iniciando app...');
        
        // Setup Modais
        document.querySelectorAll('.modal-close').forEach(b => b.onclick = () => Navigation.closeModal(b.closest('.modal').id));
        document.querySelectorAll('.modal').forEach(m => m.onclick = (e) => { if(e.target===m) Navigation.closeModal(m.id); });
        
        // Setup Nav
        document.querySelectorAll('.nav-item').forEach(i => i.onclick = (e) => {
            e.preventDefault();
            const v = i.dataset.view;
            v === 'mais' ? Navigation.openModal('menu-modal') : Navigation.showView(v);
        });
        document.querySelectorAll('#menu-modal li').forEach(i => i.onclick = () => { Navigation.closeModal('menu-modal'); Navigation.showView(i.dataset.view); });
        document.getElementById('menu-btn').onclick = () => Navigation.openModal('menu-modal');

        // Setup Form Agendamento
        const formAg = document.getElementById('agendamento-form');
        if(formAg) {
            formAg.onsubmit = async (e) => {
                e.preventDefault();
                if(!USE_SUPABASE) return alert('Supabase não configurado');
                const payload = {
                    client_id: 1, // Simplificado
                    service_id: document.getElementById('ag-servico').value,
                    professional_id: AppState.userRole==='freelancer' ? AppState.currentUser.id : document.getElementById('ag-profissional').value,
                    date: document.getElementById('ag-data').value,
                    time: document.getElementById('ag-hora').value,
                    status: 'pending'
                };
                const {error} = await supabase.from('appointments').insert(payload);
                if(error) alert('Erro: '+error.message);
                else { alert('Salvo!'); Navigation.closeModal('agendamento-modal'); Data.loadAll(); Navigation.showView('agenda'); }
            };
        }

        // Inicia Auth
        Auth.init();
        
        // Transição final
        console.log('App pronto. Indo para login...');
        Navigation.showScreen('login-screen');
    }
};

// Garante que o DOM esteja pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
