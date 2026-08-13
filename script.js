/**
 * SISTEMA ESTÚDIO AMOR QUE CUIDA
 */

const DB_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';
const db = window.supabase.createClient(DB_URL, DB_KEY);

const App = {
    user: null, role: 'freelancer', view: 'agenda',
    currentDate: new Date()
};

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
        // Mapeia a tela atual para o modal correto
        if(v === 'agenda') Modals.open('agendamento');
        else if(v === 'comandas') Modals.open('comanda');
        else if(v === 'clientes') Modals.open('cliente');
        else if(v === 'servicos' && App.role === 'owner') Modals.open('servico');
        else if(v === 'produtos' && App.role === 'owner') Modals.open('produto');
        else if(v === 'cobrancas') Modals.open('cobranca');
        else this.toast('Use os botões na tela para gerenciar esta aba.', 'error');
    }
};

const Auth = {
    init() {
        setTimeout(() => {
            document.getElementById('splash-screen').classList.remove('active');
            document.getElementById('login-screen').classList.add('active');
        }, 1500);
        document.getElementById('login-form').onsubmit = (e) => { e.preventDefault(); this.login(); };
    },
    async login() {
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value;
        const btn = document.getElementById('btn-login');
        btn.textContent = 'Aguarde...';
        
        try {
            const { data, error } = await db.from('users').select('*').eq('username', u).single();
            if (error || !data || data.password !== p) throw new Error("Usuário ou senha incorretos");
            
            App.user = data; 
            App.role = data.role;
            
            // Trava de primeiro login
            if(data.first_login) {
                Modals.open('first_login');
                btn.textContent = 'Entrar';
                return; // Bloqueia o sucesso do login até mudar a senha
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
    },
    logout() { if(confirm('Sair do sistema?')) location.reload(); }
};

const Nav = {
    init() {
        document.querySelectorAll('.nav-link, .b-item').forEach(l => {
            l.onclick = (e) => {
                const targetView = l.dataset.view;
                if(!targetView) return;
                e.preventDefault();
                this.showView(targetView);
                this.closeMenu();
            };
        });
    },
    showView(id) {
        App.view = id;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${id}`).classList.add('active');
        document.querySelectorAll('.nav-link, .b-item').forEach(el => el.classList.toggle('active', el.dataset.view === id));
        
        const titles = { agenda:'Agenda', comandas:'Comandas', cobrancas:'Cobranças', clientes:'Clientes & Anamnese', servicos:'Serviços', produtos:'Estoque', comissao:'Comissão', funcionarios:'Funcionários' };
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
                <div class="val" style="font-size:1rem; margin-top:10px">Ver Anamnese</div>
            </div>`).join('');
    },

    async funcionarios() {
        // Busca funcionários mas esconde o admin.teste
        const { data } = await db.from('users').select('*').neq('username', 'admin.teste');
        const cont = document.getElementById('funcionarios-list');
        cont.innerHTML = data.map(u => `
            <div class="card">
                <h4>${u.name}</h4>
                <p>Usuário: ${u.username} • Cargo: ${u.role}</p>
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
                    <button class="btn-primary" style="padding:0.5rem; font-size:0.8rem" onclick="Modals.open('debitar', '${d.id}', ${d.remaining_amount})">Debitar</button>
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
                <p>Cód: ${p.barcode}</p>
                <div class="val" style="font-size:1rem">Estoque: ${p.stock} un.</div>
            </div>`;
        }).join('');
    },

    async comandas() {
        const { data } = await db.from('comandas').select('*, clients(name), users(name)').eq('status', 'aberta');
        document.getElementById('comandas-list').innerHTML = data.map(c => `
            <div class="card">
                <h4>Comanda - ${c.clients?.name}</h4>
                <p>Criado por: ${c.users?.name}</p>
                <div class="val">${U.money(c.total)}</div>
            </div>`).join('');
    }
};

const Modals = {
    // Agora o open é Async para buscar os dados de preenchimento ANTES de renderizar o HTML
    async open(type, param1=null, param2=null) {
        const cont = document.getElementById('modal-container');
        let html = `<div class="modal"><button class="modal-close" onclick="Modals.close()">&times;</button>`;
        
        if(type === 'first_login') {
            html += `<h3>Crie sua Nova Senha</h3><p>Este é seu primeiro acesso, mude a senha padrão.</p>
            <form onsubmit="Actions.updatePassword(event)">
                <div class="input-group"><input type="password" id="new-pass" required placeholder="Nova Senha"></div>
                <button type="submit" class="btn-primary">Salvar e Entrar</button>
            </form>`;
        } 
        else if(type === 'cliente') {
            html += `<h3>Novo Cliente</h3>
            <form onsubmit="Actions.createClient(event)">
                <div class="input-group"><label>Nome</label><input type="text" id="fc-nome" required></div>
                <div class="input-group"><label>WhatsApp</label><input type="text" id="fc-fone" required></div>
                <button type="submit" class="btn-primary">Salvar</button>
            </form>`;
        }
        else if(type === 'agendamento' || type === 'comanda') {
            // Busca dados simultaneamente para preencher os Selects
            const [clientsRes, servicesRes, usersRes] = await Promise.all([
                db.from('clients').select('id, name'),
                db.from('services').select('id, name, price'),
                db.from('users').select('id, name').neq('username', 'admin.teste')
            ]);
            
            const cOpts = (clientsRes.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            const sOpts = (servicesRes.data || []).map(s => `<option value="${s.id}">${s.name} - ${U.money(s.price)}</option>`).join('');
            const uOpts = (usersRes.data || []).map(u => `<option value="${u.id}">${u.name}</option>`).join('');

            if(type === 'agendamento') {
                html += `<h3>Novo Agendamento</h3>
                <form onsubmit="Actions.createAppointment(event)">
                    <div class="input-group"><label>Cliente</label><select id="fa-cli" required>${cOpts}</select></div>
                    <div class="input-group"><label>Serviço</label><select id="fa-serv" required>${sOpts}</select></div>
                    <div class="input-group"><label>Profissional</label><select id="fa-user" required>${uOpts}</select></div>
                    <div class="input-group"><label>Data</label><input type="date" id="fa-date" required></div>
                    <div class="input-group"><label>Hora</label><input type="time" id="fa-time" required></div>
                    <button type="submit" class="btn-primary">Agendar</button>
                </form>`;
            } else {
                html += `<h3>Nova Comanda</h3>
                <form onsubmit="Actions.createComanda(event)">
                    <div class="input-group"><label>Cliente</label><select id="fcom-cli" required>${cOpts}</select></div>
                    <button type="submit" class="btn-primary">Abrir Comanda</button>
                </form>`;
            }
        }
        else if(type === 'servico') {
            html += `<h3>Novo Serviço</h3>
            <form onsubmit="Actions.createService(event)">
                <div class="input-group"><label>Nome</label><input type="text" id="fs-nome" required></div>
                <div class="input-group"><label>Valor de Cobrança (R$)</label><input type="number" id="fs-valor" step="0.01" required></div>
                <div class="input-group"><label>Custo do Serviço (R$)</label><input type="number" id="fs-custo" step="0.01" required></div>
                <div class="input-group"><label>Comissão (%)</label><input type="number" id="fs-com" max="100" required></div>
                <button type="submit" class="btn-primary">Salvar Serviço</button>
            </form>`;
        }
        else if(type === 'produto') {
            html += `<h3>Novo Produto / Entrada</h3>
            <form onsubmit="Actions.saveProduct(event)">
                <div class="input-group"><label>Código de Barras</label><input type="text" id="fp-bar" required></div>
                <div class="input-group"><label>Nome</label><input type="text" id="fp-nome" required></div>
                <div class="input-group"><label>Qtd Estoque Inicial</label><input type="number" id="fp-qtd" required></div>
                <button type="submit" class="btn-primary">Salvar Produto</button>
            </form>`;
        }
        else if(type === 'debitar' || type === 'desconto') {
            html += `<h3>${type === 'debitar' ? 'Debitar' : 'Aplicar Desconto'}</h3><p>Dívida atual: ${U.money(param2)}</p>
            <form onsubmit="Actions.${type === 'debitar' ? 'debitDebt' : 'discountDebt'}(event, '${param1}', ${param2})">
                <div class="input-group"><label>${type === 'debitar' ? 'Valor Pago' : 'Porcentagem de Desconto (%)'}</label>
                <input type="number" id="f-val" step="0.01" required></div>
                <button type="submit" class="btn-primary">Confirmar</button>
            </form>`;
        }

        html += `</div>`;
        cont.innerHTML = html;
        cont.classList.remove('hidden');
    },
    close() { document.getElementById('modal-container').classList.add('hidden'); }
};

const Actions = {
    async updatePassword(e) {
        e.preventDefault();
        const p = document.getElementById('new-pass').value;
        const { error } = await db.from('users').update({ password: p, first_login: false }).eq('id', App.user.id);
        if(!error) { 
            App.user.first_login = false;
            Modals.close(); 
            UI.toast('Senha atualizada com sucesso!'); 
            Auth.success(); // Só agora acessa o sistema
        }
    },
    async createClient(e) {
        e.preventDefault();
        const { error } = await db.from('clients').insert({ name: document.getElementById('fc-nome').value, phone: document.getElementById('fc-fone').value });
        if(!error) { Modals.close(); UI.toast('Cliente salvo!'); Render.clientes(); }
    },
    async createAppointment(e) {
        e.preventDefault();
        const { error } = await db.from('appointments').insert({
            client_id: document.getElementById('fa-cli').value,
            service_id: document.getElementById('fa-serv').value,
            user_id: document.getElementById('fa-user').value,
            date: document.getElementById('fa-date').value,
            time: document.getElementById('fa-time').value
        });
        if(!error) { Modals.close(); UI.toast('Agendado!'); Render.agenda(); }
    },
    async createComanda(e) {
        e.preventDefault();
        const { error } = await db.from('comandas').insert({ client_id: document.getElementById('fcom-cli').value, user_id: App.user.id });
        if(!error) { Modals.close(); UI.toast('Comanda Aberta!'); Render.comandas(); }
    },
    async createService(e) {
        e.preventDefault();
        const { error } = await db.from('services').insert({
            name: document.getElementById('fs-nome').value, price: document.getElementById('fs-valor').value,
            cost: document.getElementById('fs-custo').value, commission: document.getElementById('fs-com').value
        });
        if(!error) { Modals.close(); UI.toast('Serviço criado!'); Render.servicos(); }
    },
    async saveProduct(e) {
        e.preventDefault();
        const { error } = await db.from('products').insert({
            barcode: document.getElementById('fp-bar').value, name: document.getElementById('fp-nome').value, stock: document.getElementById('fp-qtd').value
        });
        if(!error) { Modals.close(); UI.toast('Estoque atualizado!'); Render.produtos(); }
    },
    async debitDebt(e, id, max) {
        e.preventDefault();
        const v = parseFloat(document.getElementById('f-val').value);
        const { error } = await db.from('debts').update({ remaining_amount: max - v }).eq('id', id);
        if(!error) { Modals.close(); UI.toast('Debitado!'); Render.cobrancas(); }
    },
    async discountDebt(e, id, max) {
        e.preventDefault();
        const perc = parseFloat(document.getElementById('f-val').value);
        const { error } = await db.from('debts').update({ remaining_amount: max - (max * perc / 100) }).eq('id', id);
        if(!error) { Modals.close(); UI.toast('Desconto aplicado!'); Render.cobrancas(); }
    }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
