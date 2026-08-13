/**
 * SISTEMA ESTÚDIO AMOR QUE CUIDA - VERSÃO CORRIGIDA DE VARIÁVEL
 * Previne erro "Identifier already declared" e travamento no Splash
 */

// --- MECANISMO DE SEGURANÇA (TIMER) ---
let safetyTimer = setTimeout(() => {
    console.warn('⚠️ TIMEOUT DE SEGURANÇA: Forçando saída da tela de Splash');
    const splash = document.getElementById('splash-screen');
    const login = document.getElementById('login-screen');
    if(splash) splash.classList.remove('active');
    if(login) login.classList.add('active');
}, 4000);

// --- CONFIGURAÇÃO SUPABASE (NOME DA VARIÁVEL ALTERADO PARA EVITAR CONFLITO) ---
const SUPABASE_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';

// Verifica se já existe para não crashar o script
let supabaseClient = null;
try {
    // Usa window.supabase (biblioteca global) para criar o client
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase inicializado com sucesso');
    } else {
        throw new Error('Biblioteca Supabase não encontrada');
    }
} catch (e) {
    console.error('❌ Erro crítico ao iniciar Supabase:', e);
}

// --- ESTADO GLOBAL ---
const App = { 
    user: null, 
    role: null, 
    view: 'dashboard', 
    data: { services:[], appointments:[], clients:[], products:[], expenses:[], employees:[], comandas:[] } 
};

// --- UTILITÁRIOS ---
const U = {
    money: v => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v||0),
    date: d => d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR') : '-',
    debounce: (f,w) => { let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>f(...a),w);} }
};

// --- NAVEGAÇÃO ---
const Nav = {
    showView(id) {
        clearTimeout(safetyTimer); // Cancela timer se navegar corretamente
        App.view = id;
        document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
        const target = document.getElementById(`view-${id}`);
        if(target) target.classList.add('active');
        
        const titles = {dashboard:'Dashboard', agenda:'Agenda', clientes:'Clientes', comandas:'Comandas', servicos:'Serviços', produtos:'Produtos', despesas:'Despesas', funcionarios:'Equipe', relatorios:'Relatórios'};
        const titleEl = document.getElementById('page-title');
        if(titleEl) titleEl.textContent = titles[id] || 'Sistema';
        
        document.querySelectorAll('.nav-link, .b-item').forEach(l => l.classList.toggle('active', l.dataset.view === id));
        Renderers[id]?.load();
    },
    openModal(id) {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById(id);
        if(overlay) overlay.classList.remove('hidden');
        if(modal) modal.classList.add('active');
    },
    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        if(overlay) overlay.classList.add('hidden');
        document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active'));
    }
};

// --- AUTENTICAÇÃO ---
const Auth = {
    tempUser: null,
    init() {
        // Transição garantida Splash -> Login
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            const login = document.getElementById('login-screen');
            if(splash) splash.classList.remove('active');
            if(login) login.classList.add('active');
            clearTimeout(safetyTimer);
        }, 1500);

        // Form Login
        const loginForm = document.getElementById('login-form');
        if(loginForm) {
            loginForm.onsubmit = async (e) => {
                e.preventDefault();
                const u = document.getElementById('username').value.trim().toLowerCase();
                const err = document.getElementById('login-error');
                
                try {
                    if(!supabaseClient) throw new Error('Supabase não conectado');
                    const {data, error} = await supabaseClient.from('users').select('*').eq('username', u).single();
                    
                    if(error || !data) { 
                        if(err) { err.textContent='Usuário não encontrado'; err.classList.remove('hidden'); }
                        return; 
                    }
                    
                    this.tempUser = data;
                    const createScreen = document.getElementById('create-pass-screen');
                    const enterScreen = document.getElementById('enter-pass-screen');
                    
                    if(data.first_login) {
                        if(createScreen) createScreen.classList.add('active');
                    } else {
                        const welcomeName = document.getElementById('welcome-name');
                        if(welcomeName) welcomeName.textContent = `Olá, ${data.name}`;
                        if(enterScreen) enterScreen.classList.add('active');
                    }
                } catch(e) {
                    console.error(e);
                    if(err) { err.textContent='Erro de conexão com servidor'; err.classList.remove('hidden'); }
                }
            };
        }

        // Form Criar Senha
        const createForm = document.getElementById('create-pass-form');
        if(createForm) {
            createForm.onsubmit = async (e) => {
                e.preventDefault();
                const p1 = document.getElementById('new-pass').value;
                const p2 = document.getElementById('conf-pass').value;
                const err = document.getElementById('create-error');
                
                if(p1.length<6 || p1!==p2) { 
                    if(err) { err.textContent='Senhas inválidas ou diferentes'; err.classList.remove('hidden'); }
                    return; 
                }
                
                await supabaseClient.from('users').update({password:p1, first_login:false}).eq('id', this.tempUser.id);
                this.tempUser.password = p1; 
                this.tempUser.first_login = false;
                this.loginSuccess(this.tempUser);
            };
        }

        // Form Entrar
        const enterForm = document.getElementById('enter-pass-form');
        if(enterForm) {
            enterForm.onsubmit = (e) => {
                e.preventDefault();
                const p = document.getElementById('curr-pass').value;
                const err = document.getElementById('pass-error');
                
                if(p !== this.tempUser.password) { 
                    if(err) { err.textContent='Senha incorreta'; err.classList.remove('hidden'); }
                    return; 
                }
                this.loginSuccess(this.tempUser);
            };
        }
    },
    
    loginSuccess(user) {
        clearTimeout(safetyTimer);
        App.user = user; 
        App.role = user.role;
        
        document.getElementById('auth-layer').classList.add('hidden');
        document.getElementById('system-layout').classList.remove('hidden');
        
        const headerUser = document.getElementById('header-user');
        if(headerUser) headerUser.textContent = user.name;
        
        if(user.role === 'owner') {
            document.querySelectorAll('.owner-only').forEach(el=>el.style.display='flex');
        }
        
        Data.loadAll().then(() => Nav.showView('dashboard'));
    },
    
    logout() { location.reload(); }
};

// --- DADOS ---
const Data = {
    async loadAll() {
        if(!supabaseClient) return;
        try {
            const tables = ['services','appointments','clients','products','expenses','employees','comandas'];
            const results = await Promise.all(tables.map(t => supabaseClient.from(t).select('*')));
            
            App.data.services = results[0].data || [];
            App.data.appointments = results[1].data || [];
            App.data.clients = results[2].data || [];
            App.data.products = results[3].data || [];
            App.data.expenses = results[4].data || [];
            App.data.employees = results[5].data || [];
            App.data.comandas = results[6].data || [];

            // Enriquecer agendamentos com nomes
            App.data.appointments = App.data.appointments.map(a => ({
                ...a,
                client_name: App.data.clients.find(c=>c.id===a.client_id)?.name || 'Cliente',
                service_name: App.data.services.find(s=>s.id===a.service_id)?.name || 'Serviço',
                service_price: App.data.services.find(s=>s.id===a.service_id)?.price || 0,
                prof_name: App.data.employees.find(e=>e.id===a.professional_id)?.name || 'Profissional'
            }));

            this.populateSelects();
        } catch(e) { console.error('Erro ao carregar dados:', e); }
    },
    
    populateSelects() {
        const s = document.getElementById('ag-service'); 
        if(s) s.innerHTML = '<option value="">Selecione...</option>' + App.data.services.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
        
        const p = document.getElementById('ag-prof'); 
        const f = document.getElementById('agenda-prof');
        const opts = App.data.employees.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
        
        if(p) p.innerHTML = '<option value="">Selecione...</option>' + opts;
        if(f) { f.innerHTML = '<option value="all">Todos</option>' + opts; f.classList.remove('hidden'); }
    }
};

// --- RENDERIZADORES ---
const Renderers = {
    dashboard() {
        const today = new Date().toISOString().split('T')[0];
        const appts = App.data.appointments.filter(a=>a.date===today);
        const rev = appts.reduce((s,a)=>s+a.service_price,0);
        
        const elRev = document.getElementById('dash-rev'); if(elRev) elRev.textContent = U.money(rev);
        const elApts = document.getElementById('dash-apts'); if(elApts) elApts.textContent = appts.length;
        const elPend = document.getElementById('dash-pend'); if(elPend) elPend.textContent = appts.filter(a=>a.status==='pending').length;
        
        const list = document.getElementById('dash-list');
        if(list) {
            const display = (App.role==='freelancer') ? appts.filter(a=>a.prof_name===App.user.name) : appts;
            list.innerHTML = display.slice(0,5).map(a=>`
                <div class="item">
                    <div><div class="item-title">${a.time} - ${a.client_name}</div><div class="item-sub">${a.service_name} • ${a.prof_name}</div></div>
                    <span class="badge" style="background:${a.status==='confirmed'?'#e8f5e9':'#fff3e0'}; color:${a.status==='confirmed'?'#2e7d32':'#ef6c00'}; padding:4px 10px; border-radius:20px; font-size:0.7rem; font-weight:700;">${a.status.toUpperCase()}</span>
                </div>
            `).join('') || '<p style="text-align:center; color:#999; padding:2rem;">Sem agendamentos hoje.</p>';
        }
    },
    agenda() {
        const dt = document.getElementById('agenda-date');
        if(dt) { 
            dt.value = App.selectedDate || new Date().toISOString().split('T')[0]; 
            dt.onchange=(e)=>{App.selectedDate=e.target.value; this.agendaRender();}; 
        }
        const profFilter = document.getElementById('agenda-prof');
        if(profFilter) profFilter.onchange = ()=>this.agendaRender();
        this.agendaRender();
    },
    agendaRender() {
        const d = document.getElementById('agenda-date')?.value;
        if(!d) return;
        let a = App.data.appointments.filter(x=>x.date===d);
        if(App.role==='freelancer') a=a.filter(x=>x.prof_name===App.user.name);
        else { 
            const f=document.getElementById('agenda-prof')?.value; 
            if(f && f!=='all') { 
                const e=App.data.employees.find(x=>x.id==f); 
                if(e) a=a.filter(x=>x.prof_name===e.name); 
            } 
        }
        
        const container = document.getElementById('agenda-list');
        if(container) {
            container.innerHTML = a.map(x=>`
                <div class="item">
                    <div><div class="item-title">${x.time} - ${x.client_name}</div><div class="item-sub">${x.service_name} • ${x.prof_name}</div></div>
                    <div class="item-val">${U.money(x.service_price)}</div>
                </div>
            `).join('') || '<p style="text-align:center; color:#999; padding:2rem;">Nenhum agendamento.</p>';
        }
    },
    clientes() {
        const s = document.getElementById('search-cliente');
        if(s) s.oninput = U.debounce((e)=>this.clientesRender(e.target.value), 300);
        this.clientesRender();
    },
    clientesRender(f='') {
        let l = App.data.clients;
        if(f) l=l.filter(x=>x.name.toLowerCase().includes(f.toLowerCase()));
        const container = document.getElementById('clientes-list');
        if(container) {
            container.innerHTML = l.map(x=>`
                <div class="item">
                    <div><div class="item-title">${x.name}</div><div class="item-sub">${x.whatsapp}</div></div>
                    <div class="item-val">${U.money(x.total_spent)}</div>
                </div>
            `).join('');
        }
    },
    comandas() {
        const s = document.getElementById('search-comanda');
        if(s) s.oninput = U.debounce((e)=>this.comandasRender(e.target.value), 300);
        this.comandasRender();
    },
    comandasRender(f='') {
        let l = App.data.comandas.filter(x=>x.status==='open');
        if(f) l=l.filter(x=>App.data.clients.find(c=>c.id===x.client_id)?.name.toLowerCase().includes(f.toLowerCase()));
        const container = document.getElementById('comandas-list');
        if(container) {
            container.innerHTML = l.map(x=>`
                <div class="item">
                    <div><div class="item-title">${App.data.clients.find(c=>c.id===x.client_id)?.name}</div><div class="item-sub">Aberta: ${U.date(x.open_date)}</div></div>
                    <div class="item-val">${U.money(x.total)}</div>
                </div>
            `).join('');
        }
    },
    servicos() {
        const container = document.getElementById('servicos-list');
        if(container) {
            container.innerHTML = App.data.services.map(s=>`
                <div class="item">
                    <div><div class="item-title">${s.name}</div><div class="item-sub">${s.duration}min • Custo: ${U.money(s.cost)}</div></div>
                    <div class="item-val">${U.money(s.price)}</div>
                </div>
            `).join('');
        }
    },
    produtos() {
        const container = document.getElementById('produtos-list');
        if(container) {
            container.innerHTML = App.data.products.map(p=>`
                <div class="item">
                    <div><div class="item-title">${p.name}</div><div class="item-sub">Estoque: ${p.stock} un.</div></div>
                    <div class="item-val">${U.money(p.price)}</div>
                </div>
            `).join('');
        }
    },
    despesas() {
        const container = document.getElementById('despesas-list');
        if(container) {
            container.innerHTML = App.data.expenses.map(e=>`
                <div class="item">
                    <div><div class="item-title">${e.description}</div><div class="item-sub">${e.category} • ${U.date(e.date)}</div></div>
                    <div class="item-val" style="color:#d32f2f">-${U.money(e.value)}</div>
                </div>
            `).join('');
        }
    },
    funcionarios() {
        const container = document.getElementById('funcionarios-list');
        if(container) {
            container.innerHTML = App.data.employees.map(e=>`
                <div class="item">
                    <div><div class="item-title">${e.name}</div><div class="item-sub">${e.specialty}</div></div>
                    <div class="item-val">${e.commission}%</div>
                </div>
            `).join('');
        }
    },
    relatorios() {
        document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>{
            document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
            b.classList.add('active');
            this.reportRender(b.dataset.tab);
        });
        this.reportRender('perf');
    },
    reportRender(type) {
        const c = document.getElementById('report-content');
        if(!c) return;
        
        if(type==='perf') {
            const rev = App.data.appointments.reduce((s,a)=>s+a.service_price,0);
            const exp = App.data.expenses.reduce((s,e)=>s+e.value,0);
            c.innerHTML = `
                <div class="stats-row" style="margin:0;">
                    <div class="stat-card"><div><h3>Receita Bruta</h3><p>${U.money(rev)}</p></div></div>
                    <div class="stat-card"><div><h3>Despesas</h3><p style="color:#d32f2f">${U.money(exp)}</p></div></div>
                    <div class="stat-card"><div><h3>Lucro Líquido</h3><p>${U.money(rev-exp)}</p></div></div>
                </div>
            `;
        } else if(type==='fin') {
            c.innerHTML = `<div class="list">${App.data.expenses.map(e=>`<div class="item"><div class="item-title">${e.description}</div><div class="item-val">-${U.money(e.value)}</div></div>`).join('')}</div>`;
        }
    }
};

// --- RELATÓRIOS PDF ---
const Reports = {
    generatePDF() {
        if(!window.jspdf) { alert('Biblioteca PDF não carregou'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(183, 110, 121);
        doc.text("Estúdio Amor que Cuida", 20, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Relatório: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
        
        let y = 50;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        
        const rev = App.data.appointments.reduce((s,a)=>s+a.service_price,0);
        const exp = App.data.expenses.reduce((s,e)=>s+e.value,0);
        
        doc.text("RESUMO FINANCEIRO", 20, y); y+=10;
        doc.text(`Receita Total: ${U.money(rev)}`, 25, y); y+=8;
        doc.text(`Despesas Totais: ${U.money(exp)}`, 25, y); y+=8;
        doc.setFont("helvetica", "bold");
        doc.text(`Lucro Líquido: ${U.money(rev-exp)}`, 25, y); y+=15;
        
        doc.setFont("helvetica", "normal");
        doc.text("TOP CLIENTES", 20, y); y+=10;
        
        [...App.data.clients].sort((a,b)=>b.total_spent-a.total_spent).slice(0,10).forEach((cl,i)=>{
            doc.text(`${i+1}. ${cl.name} - ${U.money(cl.total_spent)}`, 25, y); y+=7;
        });
        
        doc.save("relatorio-amor-que-cuida.pdf");
    }
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    
    // Setup Modais
    const overlay = document.getElementById('modal-overlay');
    if(overlay) overlay.onclick = Nav.closeModal;
    document.querySelectorAll('.btn-text').forEach(b=>b.onclick=Nav.closeModal);
    
    // Form Agendamento
    const formAg = document.getElementById('form-agendamento');
    if(formAg) {
        formAg.onsubmit = async (e) => {
            e.preventDefault();
            if(!supabaseClient) return alert('Supabase não conectado');
            
            const payload = {
                client_id: App.data.clients[0]?.id || null, 
                service_id: document.getElementById('ag-service').value,
                professional_id: App.role==='freelancer' ? App.user.id : document.getElementById('ag-prof').value,
                date: document.getElementById('ag-date').value,
                time: document.getElementById('ag-time').value,
                status: 'pending'
            };
            
            const {error} = await supabaseClient.from('appointments').insert(payload);
            if(error) alert('Erro: '+error.message);
            else { 
                alert('Agendado!'); 
                Nav.closeModal(); 
                Data.loadAll().then(()=>Nav.showView('agenda')); 
            }
        };
    }

    // Botão PDF
    const btnPdf = document.querySelector('[onclick="Reports.generatePDF()"]');
    if(btnPdf) btnPdf.onclick = Reports.generatePDF;
    
    // Navegação
    document.querySelectorAll('.nav-link, .b-item').forEach(i=>i.onclick=(e)=>{
        e.preventDefault(); 
        const v=i.dataset.view;
        if(v==='mais') Nav.openModal('menu-modal'); 
        else Nav.showView(v);
    });
});
