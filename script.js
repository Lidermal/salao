/**
 * SISTEMA ESTÚDIO AMOR QUE CUIDA - REALTIME & DB INTEGRATION
 */

// 1. SUPABASE CONNECTION
const DB_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';
const db = window.supabase.createClient(DB_URL, DB_KEY);

// 2. GLOBAL STATE
const App = {
    user: null, role: 'freelancer', view: 'agenda',
    currentDate: new Date(),
    data: {} // Cache de dados
};

// 3. UTILS & UI
const U = {
    money: v => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v||0),
    date: d => d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR') : '-',
    iso: d => d.toISOString().split('T')[0]
};

const UI = {
    toast(msg, type='success') {
        const cont = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<i class="ph ${type==='success'?'ph-check-circle':'ph-warning-circle'}"></i> ${msg}`;
        cont.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    },
    handleFabClick() {
        const v = App.view;
        if(v === 'agenda') Modals.open('agendamento');
        else if(v === 'comandas') Modals.open('comanda');
        else if(v === 'clientes') Modals.open('cliente');
        else if(v === 'servicos' && App.role==='owner') Modals.open('servico');
        else if(v === 'produtos' && App.role==='owner') Modals.open('produto');
        else if(v === 'cobrancas') Modals.open('cobranca');
        else this.toast('Ação não configurada para esta aba.', 'error');
    }
};

// 4. AUTHENTICATION & INITIALIZATION
const Auth = {
    init() {
        setTimeout(() => {
            document.getElementById('splash-screen').classList.remove('active');
            document.getElementById('login-screen').classList.add('active');
        }, 1500);
        document.getElementById('login-form').onsubmit = (e) => { e.preventDefault(); this.login(); };
    },
    async login() {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        const btn = document.getElementById('btn-login');
        btn.textContent = 'Aguarde...';
        
        try {
            const { data, error } = await db.from('users').select('*').eq('username', u).single();
            if (error || !data || data.password !== p) throw new Error("Credenciais inválidas");
            
            App.user = data; App.role = data.role;
            
            if(data.first_login) {
                Modals.open('first_login');
                btn.textContent = 'Entrar';
                return;
            }
            this.success();
        } catch(e) {
            UI.toast(e.message, 'error');
            btn.textContent = 'Entrar';
        }
    },
    success() {
        document.getElementById('auth-layer').classList.add('hidden');
        document.getElementById('system-layout').classList.remove('hidden');
        document.getElementById('header-user').textContent = App.user.name;
        document.getElementById('header-avatar').textContent = App.user.name.substring(0,2).toUpperCase();
        document.body.classList.toggle('is-owner', App.role === 'owner');
        Nav.init();
        Nav.showView('agenda');
        Render.notificacoes(true); // Registra log de entrada
    },
    logout() { if(confirm('Sair do sistema?')) location.reload(); }
};

// 5. NAVIGATION
const Nav = {
    init() {
        document.querySelectorAll('.nav-link, .b-item').forEach(l => {
            l.onclick = (e) => {
                if(!l.dataset.view) return;
                e.preventDefault();
                this.showView(l.dataset.view);
                this.closeMenu();
            };
        });
    },
    showView(id) {
        App.view = id;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${id}`).classList.add('active');
        document.querySelectorAll('.nav-link, .b-item').forEach(el => el.classList.toggle('active', el.dataset.view === id));
        
        const titles = { agenda:'Agenda', comandas:'Comandas', cobrancas:'Cobranças', clientes:'Clientes & Anamnese', servicos:'Serviços', produtos:'Estoque', comissao:'Comissão' };
        document.getElementById('page-title').textContent = titles[id] || 'Amor que Cuida';
        if(Render[id]) Render[id]();
    },
    toggleMenu() {
        document.getElementById('main-sidebar').classList.toggle('open');
        document.getElementById('mobile-overlay').classList.toggle('hidden');
    },
    closeMenu() {
        document.getElementById('main-sidebar').classList.remove('open');
        document.getElementById('mobile-overlay').classList.add('hidden');
    }
};

// 6. RENDERERS (VIEWS & DATA)
const Render = {
    async agenda() {
        this.buildCalendar();
        const dateStr = U.iso(App.currentDate);
        const { data: agendamentos } = await db.from('appointments').select('*, clients(name), services(name), users(name)').eq('date', dateStr);
        
        const cont = document.getElementById('agenda-list');
        if(!agendamentos || !agendamentos.length) {
            cont.innerHTML = `<div class="card" style="text-align:center"><p>Nenhum agendamento.</p></div>`; return;
        }
        
        cont.innerHTML = agendamentos.map(a => `
            <div class="card" style="display:flex; justify-content:space-between">
                <div><h4>${a.time} - ${a.clients?.name||'Cliente'}</h4><p>${a.services?.name||'Serviço'} • ${a.users?.name||'Profissional'}</p></div>
                <div class="val">${a.status}</div>
            </div>`).join('');
    },
    
    buildCalendar() {
        const d = App.currentDate;
        document.getElementById('cal-month-year').textContent = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        
        // Pega inicio da semana (Domingo)
        const start = new Date(d); start.setDate(d.getDate() - d.getDay());
        let html = '';
        const days = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
        
        for(let i=0; i<7; i++) {
            const cur = new Date(start); cur.setDate(start.getDate() + i);
            const isSelected = U.iso(cur) === U.iso(App.currentDate) ? 'active' : '';
            html += `<div class="cal-day ${isSelected}" onclick="Render.selectDate('${U.iso(cur)}')">
                <span>${days[i]}</span><span>${cur.getDate()}</span>
            </div>`;
        }
        document.getElementById('cal-days-row').innerHTML = html;
    },
    selectDate(isoDate) { App.currentDate = new Date(isoDate+'T12:00:00'); this.agenda(); },
    changeWeek(dir) { App.currentDate.setDate(App.currentDate.getDate() + (dir*7)); this.agenda(); },

    async clientes() {
        const { data } = await db.from('clients').select('*');
        const cont = document.getElementById('clientes-list');
        cont.innerHTML = data.map(c => `
            <div class="card">
                <a href="https://wa.me/55${c.phone.replace(/\D/g,'')}" target="_blank" class="wpp-btn" onclick="event.stopPropagation()"><i class="ph ph-whatsapp-logo"></i></a>
                <h4 onclick="Modals.open('anamnese', '${c.id}', '${c.name}')" style="cursor:pointer; color:var(--primary)">${c.name}</h4>
                <p>${c.phone}</p>
                <div class="val" style="font-size:1rem; margin-top:10px">Ver Anamnese / Histórico</div>
            </div>`).join('');
    },

    async cobrancas() {
        const { data } = await db.from('debts').select('*, clients(name)').gt('remaining_amount', 0);
        const cont = document.getElementById('cobrancas-list');
        cont.innerHTML = data.map(d => `
            <div class="card">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <h4>${d.clients?.name}</h4><div class="val" style="color:#d32f2f">${U.money(d.remaining_amount)}</div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" style="padding:0.5rem; font-size:0.8rem" onclick="Modals.open('debitar', '${d.id}', ${d.remaining_amount})">Debitar Pagamento</button>
                    ${App.role==='owner' ? `<button class="btn-secondary" style="padding:0.5rem; font-size:0.8rem" onclick="Modals.open('desconto', '${d.id}', ${d.remaining_amount})">Dar Desconto %</button>` : ''}
                </div>
            </div>`).join('');
    },

    async servicos() {
        const { data } = await db.from('services').select('*');
        document.getElementById('servicos-list').innerHTML = data.map(s => `
            <div class="card">
                <h4>${s.name}</h4>
                <p>Custo: ${U.money(s.cost)} • Profissional: ${s.commission}%</p>
                ${s.has_assistant ? `<p>Auxiliar: ${s.assistant_commission}%</p>` : ''}
                <div class="val">${U.money(s.price)}</div>
            </div>`).join('');
    },

    async produtos() {
        const { data } = await db.from('products').select('*');
        document.getElementById('produtos-list').innerHTML = data.map(p => {
            const alert = p.stock <= p.min_stock ? '<span style="color:red; font-size:0.8rem; font-weight:bold">ALERTA ESTOQUE</span>' : '';
            return `<div class="card">
                <h4>${p.name} <br>${alert}</h4>
                <p>${p.brand} • Cód: ${p.barcode}</p>
                <div class="val" style="font-size:1rem">Estoque: ${p.stock} un.</div>
            </div>`;
        }).join('');
    },

    async comissao() {
        // Visão do Colaborador: Histórico dele
        let query = db.from('appointments').select('*, services(name, price, commission)').eq('status', 'concluído');
        if(App.role !== 'owner') query = query.eq('user_id', App.user.id);
        
        const { data } = await query;
        let html = `<h3>Minhas Comissões (Mês Atual)</h3><div class="data-list" style="margin-top:1rem">`;
        let total = 0;
        
        data.forEach(a => {
            const v = (a.services.price * a.services.commission) / 100;
            total += v;
            html += `<div class="card">
                <h4>${a.services.name}</h4><p>${U.date(a.date)} • Calculo: ${a.services.commission}% de ${U.money(a.services.price)}</p>
                <div class="val" style="color:#2e7d32">+ ${U.money(v)}</div>
            </div>`;
        });
        html += `</div><div class="card" style="margin-top:1rem; background:var(--primary); color:white">
            <h4 style="color:white">Total a Receber</h4><div class="val" style="color:white">${U.money(total)}</div>
        </div>`;
        
        document.getElementById('comissao-content').innerHTML = html;
    },

    async notificacoes(isLogin = false) {
        if(isLogin) {
            await db.from('notifications').insert({ message: `${App.user.name} acessou o sistema.`, read: false });
        }
    }
};

// 7. MODALS & FORMS
const Modals = {
    open(type, param1=null, param2=null) {
        const cont = document.getElementById('modal-container');
        cont.classList.remove('hidden');
        let html = `<div class="modal"><button class="modal-close" onclick="Modals.close()">&times;</button>`;
        
        if(type === 'first_login') {
            html += `<h3>Crie sua Nova Senha</h3><p>Este é seu primeiro acesso.</p>
            <form onsubmit="Actions.updatePassword(event)">
                <div class="input-group"><input type="password" id="new-pass" required placeholder="Nova Senha"></div>
                <button type="submit" class="btn-primary">Salvar e Entrar</button>
            </form>`;
        } 
        else if(type === 'servico') {
            html += `<h3>Novo Serviço</h3>
            <form onsubmit="Actions.createService(event)">
                <div class="input-group"><label>Nome</label><input type="text" id="fs-nome" required></div>
                <div class="input-group"><label>Valor de Cobrança</label><input type="number" id="fs-valor" step="0.01" required></div>
                <div class="input-group"><label>Custo do Serviço (R$)</label><input type="number" id="fs-custo" step="0.01" required></div>
                <div class="input-group"><label>Comissão do Profissional (%)</label><input type="number" id="fs-com" max="100" required></div>
                <div class="input-group"><label><input type="checkbox" id="fs-aux" onchange="document.getElementById('aux-div').style.display=this.checked?'block':'none'"> Precisa de Auxiliar?</label></div>
                <div class="input-group" id="aux-div" style="display:none"><label>Comissão do Auxiliar (%)</label><input type="number" id="fs-auxcom" max="100"></div>
                <button type="submit" class="btn-primary">Salvar Serviço</button>
            </form>`;
        }
        else if(type === 'anamnese') {
            html += `<h3>Anamnese - ${param2}</h3>
            <form onsubmit="Actions.saveAnamnese(event, '${param1}')">
                <div class="input-group"><label>Histórico Capilar (Químicas, Alergias)</label><textarea id="fa-hist" rows="3"></textarea></div>
                <div class="input-group"><label>Hábitos (Shampoo, Frequência, Secador)</label><textarea id="fa-hab" rows="2"></textarea></div>
                <div class="input-group"><label>Objetivo da Cliente</label><textarea id="fa-obj" rows="2"></textarea></div>
                <div class="input-group"><label>Observações Profissionais</label><textarea id="fa-obs" rows="2"></textarea></div>
                <button type="submit" class="btn-primary">Salvar Ficha</button>
            </form>
            <div id="anamnese-history" style="margin-top:1.5rem"><i>Carregando histórico...</i></div>`;
            Actions.loadAnamnese(param1); // Async load
        }
        else if(type === 'debitar') {
            html += `<h3>Debitar Pagamento</h3><p>Dívida atual: ${U.money(param2)}</p>
            <form onsubmit="Actions.debitDebt(event, '${param1}', ${param2})">
                <div class="input-group"><label>Valor Pago Agora</label><input type="number" id="fd-val" step="0.01" max="${param2}" required></div>
                <button type="submit" class="btn-primary">Confirmar Pagamento</button>
            </form>`;
        }
        else if(type === 'desconto') {
            html += `<h3>Aplicar Desconto</h3><p>Dívida atual: ${U.money(param2)}</p>
            <form onsubmit="Actions.discountDebt(event, '${param1}', ${param2})">
                <div class="input-group"><label>Porcentagem de Desconto (%)</label><input type="number" id="fd-desc" max="100" oninput="document.getElementById('desc-res').innerText = 'Novo total: R$ ' + (${param2} - (${param2} * this.value / 100)).toFixed(2)" required></div>
                <p id="desc-res" style="font-weight:bold; color:var(--primary); margin-bottom:1rem"></p>
                <button type="submit" class="btn-primary">Aplicar Desconto e Salvar</button>
            </form>`;
        }
        else if(type === 'produto') {
            html += `<h3>Novo Produto / Entrada</h3>
            <form onsubmit="Actions.saveProduct(event)">
                <div class="input-group"><label>Código de Barras</label><input type="text" id="fp-bar" placeholder="Use leitor ou digite" autofocus required></div>
                <div class="input-group"><label>Nome</label><input type="text" id="fp-nome" required></div>
                <div class="input-group"><label>Qtd Estoque Inicial</label><input type="number" id="fp-qtd" required></div>
                <div class="input-group"><label>Estoque Mínimo (Alerta)</label><input type="number" id="fp-min" value="5" required></div>
                <button type="submit" class="btn-primary">Salvar Produto</button>
            </form>`;
        }

        html += `</div>`;
        cont.innerHTML = html;
    },
    close() { document.getElementById('modal-container').classList.add('hidden'); }
};

// 8. ACTIONS / CRUD TO DB
const Actions = {
    async updatePassword(e) {
        e.preventDefault();
        const p = document.getElementById('new-pass').value;
        const { error } = await db.from('users').update({ password: p, first_login: false }).eq('id', App.user.id);
        if(!error) { Modals.close(); UI.toast('Senha atualizada!'); Auth.success(); }
    },
    async createService(e) {
        e.preventDefault();
        const aux = document.getElementById('fs-aux').checked;
        const payload = {
            name: document.getElementById('fs-nome').value,
            price: document.getElementById('fs-valor').value,
            cost: document.getElementById('fs-custo').value,
            commission: document.getElementById('fs-com').value,
            has_assistant: aux,
            assistant_commission: aux ? document.getElementById('fs-auxcom').value : 0
        };
        const { error } = await db.from('services').insert(payload);
        if(!error) { Modals.close(); UI.toast('Serviço criado!'); Render.servicos(); }
    },
    async saveAnamnese(e, clientId) {
        e.preventDefault();
        const payload = {
            client_id: clientId,
            history: document.getElementById('fa-hist').value,
            habits: document.getElementById('fa-hab').value,
            objectives: document.getElementById('fa-obj').value,
            notes: document.getElementById('fa-obs').value
        };
        const { error } = await db.from('anamnesis').insert(payload);
        if(!error) { Modals.close(); UI.toast('Anamnese salva!'); }
    },
    async loadAnamnese(clientId) {
        const { data } = await db.from('anamnesis').select('*').eq('client_id', clientId).order('created_at', {ascending: false});
        const div = document.getElementById('anamnese-history');
        if(!data || !data.length) { div.innerHTML = "<i>Sem registros.</i>"; return; }
        div.innerHTML = data.map(d => `<div style="background:#eee; padding:10px; border-radius:10px; margin-bottom:10px; font-size:0.8rem">
            <b>Data:</b> ${U.date(d.created_at)}<br>
            <b>Histórico:</b> ${d.history}<br><b>Objetivo:</b> ${d.objectives}
        </div>`).join('');
    },
    async debitDebt(e, id, max) {
        e.preventDefault();
        const v = parseFloat(document.getElementById('fd-val').value);
        const newTotal = max - v;
        const { error } = await db.from('debts').update({ remaining_amount: newTotal }).eq('id', id);
        if(!error) { 
            await db.from('notifications').insert({message: `Pagamento recebido de dívida: ${U.money(v)}`, read:false});
            Modals.close(); UI.toast('Pagamento debitado!'); Render.cobrancas(); 
        }
    },
    async discountDebt(e, id, max) {
        e.preventDefault();
        const perc = parseFloat(document.getElementById('fd-desc').value);
        const newTotal = max - (max * perc / 100);
        const { error } = await db.from('debts').update({ remaining_amount: newTotal }).eq('id', id);
        if(!error) { Modals.close(); UI.toast('Desconto aplicado!'); Render.cobrancas(); }
    },
    async saveProduct(e) {
        e.preventDefault();
        const payload = {
            barcode: document.getElementById('fp-bar').value,
            name: document.getElementById('fp-nome').value,
            stock: document.getElementById('fp-qtd').value,
            min_stock: document.getElementById('fp-min').value
        };
        const { error } = await db.from('products').insert(payload);
        if(!error) { Modals.close(); UI.toast('Produto em estoque!'); Render.produtos(); }
    }
};

// BOOT
document.addEventListener('DOMContentLoaded', () => Auth.init());
