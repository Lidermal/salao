/**
 * ESTÚDIO AMOR QUE CUIDA - VERSÃO PREMIUM
 * Integrado com Supabase Real + Design Sofisticado
 */

// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';

let supabaseClient = null;
let USE_SUPABASE = false;

try {
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        USE_SUPABASE = true;
    }
} catch (e) { console.error('Erro Supabase:', e); }

// ESTADO
const AppState = {
    currentUser: null, userRole: null, currentView: 'dashboard',
    selectedDate: new Date().toISOString().split('T')[0],
    data: { appointments: [], clients: [], services: [], products: [], expenses: [], employees: [], comandas: [] }
};

// UTILITÁRIOS
const Utils = {
    formatCurrency: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0),
    formatDate: (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-',
    debounce: (f, w) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), w); }; }
};

// NAVEGAÇÃO
const Navigation = {
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id)?.classList.add('active');
    },
    showView(id) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${id}-view`)?.classList.add('active');
        AppState.currentView = id;
        document.getElementById('page-title').textContent = { dashboard:'Dashboard', agenda:'Agenda', comandas:'Comandas', clientes:'Clientes', servicos:'Serviços', produtos:'Produtos', despesas:'Despesas', funcionarios:'Equipe', relatorios:'Relatórios', configuracoes:'Ajustes', mensagens:'Mensagens' }[id] || 'Estúdio';
        document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === id));
        this.loadDataForView(id);
    },
    loadDataForView(id) {
        const loaders = { dashboard: Dashboard.load, agenda: Agenda.load, comandas: Comandas.load, clientes: Clientes.load, servicos: Servicos.load, produtos: Produtos.load, despesas: Despesas.load, funcionarios: Funcionarios.load, relatorios: Relatorios.load };
        loaders[id]?.();
    },
    openModal(id) {
        document.getElementById('modal-overlay').classList.add('active');
        document.getElementById(id).classList.add('active');
    },
    closeModal(id) {
        document.getElementById('modal-overlay').classList.remove('active');
        document.getElementById(id).classList.remove('active');
    }
};

// AUTENTICAÇÃO
const Auth = {
    tempUser: null,
    init() {
        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const u = document.getElementById('username').value.trim().toLowerCase();
            const err = document.getElementById('login-error');
            try {
                let data = null;
                if(USE_SUPABASE) { const r = await supabaseClient.from('users').select('*').eq('username', u).single(); data = r.data; }
                if(!data) { err.textContent = 'Usuário não encontrado'; err.classList.remove('hidden'); return; }
                this.tempUser = data;
                Navigation.showScreen(data.first_login ? 'create-password-screen' : 'enter-password-screen');
                if(!data.first_login) document.getElementById('user-display-name').textContent = data.name;
            } catch(e) { err.textContent = 'Erro de conexão'; err.classList.remove('hidden'); }
        };

        document.getElementById('create-password-form').onsubmit = async (e) => {
            e.preventDefault();
            const p1 = document.getElementById('new-password').value;
            const p2 = document.getElementById('confirm-password').value;
            const err = document.getElementById('password-error');
            if(p1.length < 6 || p1 !== p2) { err.textContent = 'Senhas inválidas'; err.classList.remove('hidden'); return; }
            if(USE_SUPABASE) await supabaseClient.from('users').update({ password: p1, first_login: false }).eq('id', this.tempUser.id);
            this.tempUser.password = p1; this.tempUser.first_login = false;
            this.completeLogin(this.tempUser);
        };

        document.getElementById('enter-password-form').onsubmit = (e) => {
            e.preventDefault();
            const p = document.getElementById('current-password').value;
            const err = document.getElementById('password-login-error');
            if(p !== this.tempUser.password) { err.textContent = 'Senha incorreta'; err.classList.remove('hidden'); return; }
            this.completeLogin(this.tempUser);
        };

        document.getElementById('logout-btn').onclick = () => location.reload();
    },
    completeLogin(user) {
        AppState.currentUser = user; AppState.userRole = user.role;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('main-app').classList.remove('hidden');
        Data.loadAll().then(() => Navigation.showView('dashboard'));
    }
};

// DADOS
const Data = {
    async loadAll() {
        if(!USE_SUPABASE) return;
        const [svc, apt, cli, prod, exp, emp, com] = await Promise.all([
            supabaseClient.from('services').select('*').eq('active', true),
            supabaseClient.from('appointments').select('*, clients(name), services(name, price), users(name)').order('date', {ascending:true}),
            supabaseClient.from('clients').select('*'),
            supabaseClient.from('products').select('*'),
            supabaseClient.from('expenses').select('*'),
            supabaseClient.from('employees').select('*'),
            supabaseClient.from('comandas').select('*, clients(name)').eq('status', 'open')
        ]);
        AppState.data = { services: svc.data||[], appointments: apt.data||[], clients: cli.data||[], products: prod.data||[], expenses: exp.data||[], employees: emp.data||[], comandas: com.data||[] };
        this.populateSelects();
    },
    populateSelects() {
        const s = document.getElementById('ag-servico'); if(s) s.innerHTML = '<option value="">Selecione...</option>' + AppState.data.services.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
        const p = document.getElementById('ag-profissional'); const f = document.getElementById('professional-filter');
        const opts = AppState.data.employees.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
        if(p) p.innerHTML = '<option value="">Selecione...</option>' + opts;
        if(f) { f.innerHTML = '<option value="all">Todos</option>' + opts; f.classList.remove('hidden'); }
    }
};

// VIEWS RENDERERS
const Dashboard = {
    load() {
        const today = new Date().toISOString().split('T')[0];
        const appts = AppState.data.appointments.filter(a=>a.date===today);
        const rev = appts.reduce((s,a)=>s+(parseFloat(a.services?.price)||0),0);
        document.getElementById('today-revenue').textContent = Utils.formatCurrency(rev);
        document.getElementById('today-appointments').textContent = appts.length;
        document.getElementById('pending-count').textContent = appts.filter(a=>a.status==='pending').length;
        
        const list = document.getElementById('upcoming-appointments');
        const display = (AppState.userRole==='freelancer') ? appts.filter(a=>a.users?.name===AppState.currentUser.name) : appts;
        list.innerHTML = display.slice(0,5).map(a=>`
            <div class="list-item">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <div style="background:#fff0f3; padding:0.8rem; border-radius:12px; color:var(--primary); font-weight:700;">${a.time}</div>
                    <div>
                        <div class="item-title">${a.clients?.name}</div>
                        <div class="item-subtitle">${a.services?.name} • ${a.users?.name}</div>
                    </div>
                </div>
                <span class="badge badge-${a.status}">${a.status}</span>
            </div>
        `).join('') || '<p class="text-muted" style="text-align:center; padding:2rem;">Nenhum agendamento para hoje.</p>';
    }
};

const Agenda = {
    load() {
        const dt = document.getElementById('agenda-date');
        if(dt) { dt.value = AppState.selectedDate; dt.onchange = (e)=>{AppState.selectedDate=e.target.value; this.render();}; }
        document.getElementById('professional-filter').onchange = ()=>this.render();
        this.render();
    },
    render() {
        const c = document.getElementById('agenda-list');
        const d = document.getElementById('agenda-date').value;
        let a = AppState.data.appointments.filter(x=>x.date===d);
        if(AppState.userRole==='freelancer') a=a.filter(x=>x.users?.name===AppState.currentUser.name);
        else { const f=document.getElementById('professional-filter').value; if(f!=='all') { const e=AppState.data.employees.find(x=>x.id==f); if(e) a=a.filter(x=>x.users?.name===e.name); } }
        
        c.innerHTML = a.map(x=>`
            <div class="list-item">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <div style="background:#fff0f3; padding:0.8rem; border-radius:12px; color:var(--primary); font-weight:700;">${x.time}</div>
                    <div>
                        <div class="item-title">${x.clients?.name}</div>
                        <div class="item-subtitle">${x.services?.name} • ${x.users?.name}</div>
                    </div>
                </div>
                <span class="badge badge-${x.status}">${x.status}</span>
            </div>
        `).join('') || '<p class="text-muted" style="text-align:center; padding:2rem;">Sem agendamentos nesta data.</p>';
    }
};

const Comandas = {
    load() { this.render(); document.getElementById('comanda-search').oninput = Utils.debounce((e)=>this.render(e.target.value), 300); },
    render(f='') {
        const c = document.getElementById('comandas-list');
        let l = AppState.data.comandas;
        if(f) l=l.filter(x=>x.clients?.name.toLowerCase().includes(f.toLowerCase()));
        c.innerHTML = l.map(x=>`
            <div class="list-item">
                <div>
                    <div class="item-title">${x.clients?.name}</div>
                    <div class="item-subtitle">Aberta em: ${Utils.formatDate(x.open_date)}</div>
                </div>
                <div class="item-value">${Utils.formatCurrency(x.total)}</div>
            </div>
        `).join('') || '<p class="text-muted" style="text-align:center; padding:2rem;">Nenhuma comanda aberta.</p>';
    }
};

const Clientes = {
    load() { this.render(); document.getElementById('cliente-search').oninput = Utils.debounce((e)=>this.render(e.target.value), 300); },
    render(f='') {
        const c = document.getElementById('clientes-list');
        let l = AppState.data.clients;
        if(f) l=l.filter(x=>x.name.toLowerCase().includes(f.toLowerCase()) || x.whatsapp.includes(f));
        c.innerHTML = l.map(x=>`
            <div class="list-item" onclick="Clientes.detail(${x.id})" style="cursor:pointer;">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <div style="width:40px; height:40px; background:#eee; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; color:#999;">${x.name.charAt(0)}</div>
                    <div>
                        <div class="item-title">${x.name}</div>
                        <div class="item-subtitle">${x.whatsapp}</div>
                    </div>
                </div>
                <div class="item-value">${Utils.formatCurrency(x.total_spent)}</div>
            </div>
        `).join('') || '<p class="text-muted" style="text-align:center; padding:2rem;">Nenhum cliente encontrado.</p>';
    },
    detail(id) {
        const cl = AppState.data.clients.find(x=>x.id===id);
        if(cl) {
            document.getElementById('cliente-detail-name').textContent = cl.name;
            document.getElementById('cliente-history').innerHTML = `
                <div class="list-item"><div class="item-title">Histórico de Visitas</div></div>
                <div class="list-item"><div class="item-subtitle">Em breve: integração completa de histórico.</div></div>
            `;
            Navigation.openModal('cliente-detail-modal');
        }
    }
};

const Servicos = {
    load() {
        document.getElementById('servicos-list').innerHTML = AppState.data.services.map(s=>`
            <div class="list-item">
                <div><div class="item-title">${s.name}</div><div class="item-subtitle">${s.duration} min • Custo: ${Utils.formatCurrency(s.cost)}</div></div>
                <div class="item-value">${Utils.formatCurrency(s.price)}</div>
            </div>
        `).join('');
        const b = document.getElementById('add-servico-btn'); if(b) b.classList.toggle('hidden', AppState.userRole!=='owner');
    }
};

const Produtos = {
    load() {
        document.getElementById('produtos-list').innerHTML = AppState.data.products.map(p=>`
            <div class="list-item">
                <div><div class="item-title">${p.name}</div><div class="item-subtitle">Estoque: ${p.stock} un.</div></div>
                <div class="item-value">${Utils.formatCurrency(p.price)}</div>
            </div>
        `).join('');
        const b = document.getElementById('add-produto-btn'); if(b) b.classList.toggle('hidden', AppState.userRole!=='owner');
    }
};

const Despesas = {
    load() {
        document.getElementById('despesas-list').innerHTML = AppState.data.expenses.map(e=>`
            <div class="list-item">
                <div><div class="item-title">${e.description}</div><div class="item-subtitle">${e.category} • ${Utils.formatDate(e.date)}</div></div>
                <div class="item-value" style="color:#d32f2f">-${Utils.formatCurrency(e.value)}</div>
            </div>
        `).join('');
        const b = document.getElementById('add-despesa-btn'); if(b) b.classList.toggle('hidden', AppState.userRole!=='owner');
    }
};

const Funcionarios = {
    load() {
        document.getElementById('funcionarios-list').innerHTML = AppState.data.employees.map(e=>`
            <div class="list-item">
                <div><div class="item-title">${e.name}</div><div class="item-subtitle">${e.specialty}</div></div>
                <div class="item-value">${e.commission}%</div>
            </div>
        `).join('');
        const b = document.getElementById('add-funcionario-btn'); if(b) b.classList.toggle('hidden', AppState.userRole!=='owner');
    }
};

const Relatorios = {
    load() {
        document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>{
            document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
            document.querySelectorAll('.report-content').forEach(x=>x.classList.remove('active'));
            b.classList.add('active'); document.getElementById(`report-${b.dataset.tab}`)?.classList.add('active');
        });
        const rev = AppState.data.appointments.reduce((s,a)=>s+(parseFloat(a.services?.price)||0),0);
        const exp = AppState.data.expenses.reduce((s,e)=>s+e.value,0);
        document.getElementById('total-revenue').textContent = Utils.formatCurrency(rev);
        document.getElementById('total-expenses').textContent = Utils.formatCurrency(exp);
        document.getElementById('net-profit').textContent = Utils.formatCurrency(rev-exp);
        
        document.getElementById('top-clients-list').innerHTML = [...AppState.data.clients].sort((a,b)=>b.total_spent-a.total_spent).slice(0,10).map((c,i)=>`
            <div class="list-item">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <div style="width:30px; height:30px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700;">${i+1}</div>
                    <div class="item-title">${c.name}</div>
                </div>
                <div class="item-value">${Utils.formatCurrency(c.total_spent)}</div>
            </div>
        `).join('');
    }
};

// INICIALIZAÇÃO
const App = {
    init() {
        // Timer de segurança
        setTimeout(()=>{ if(document.getElementById('splash-screen').classList.contains('active')) Navigation.showScreen('login-screen'); }, 3000);
        
        Auth.init();
        
        // Nav Events
        document.querySelectorAll('.nav-item').forEach(i=>i.onclick=(e)=>{ e.preventDefault(); const v=i.dataset.view; v==='mais' ? Navigation.openModal('menu-modal') : Navigation.showView(v); });
        document.querySelectorAll('.menu-btn').forEach(i=>i.onclick=()=>{ Navigation.closeModal('menu-modal'); Navigation.showView(i.dataset.view); });
        document.getElementById('menu-btn').onclick = ()=>Navigation.openModal('menu-modal');
        document.getElementById('modal-overlay').onclick = ()=>{ document.getElementById('modal-overlay').classList.remove('active'); document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active')); };
        document.querySelectorAll('.modal-close').forEach(b=>b.onclick=()=>{ document.getElementById('modal-overlay').classList.remove('active'); document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active')); });

        // Form Agendamento
        const formAg = document.getElementById('agendamento-form');
        if(formAg) {
            formAg.onsubmit = async (e) => {
                e.preventDefault();
                if(!USE_SUPABASE) return alert('Supabase não configurado');
                const payload = {
                    client_id: 1, service_id: document.getElementById('ag-servico').value,
                    professional_id: AppState.userRole==='freelancer' ? AppState.currentUser.id : document.getElementById('ag-profissional').value,
                    date: document.getElementById('ag-data').value, time: document.getElementById('ag-hora').value, status: 'pending'
                };
                const {error} = await supabaseClient.from('appointments').insert(payload);
                if(error) alert('Erro: '+error.message);
                else { alert('Agendado!'); Navigation.closeModal('agendamento-modal'); Data.loadAll(); Navigation.showView('agenda'); }
            };
        }

        Navigation.showScreen('splash-screen');
        setTimeout(()=>Navigation.showScreen('login-screen'), 1500);
    }
};

document.addEventListener('DOMContentLoaded', ()=>App.init());
