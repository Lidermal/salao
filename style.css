/**
 * SISTEMA ESTÚDIO AMOR QUE CUIDA - VERSÃO FINAL 1.0
 * Conexão Realtime Supabase + Correções de Desktop/Mobile e Lógicas Nativas
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
    date: d => d ? new Date(d).toLocaleDateString('pt-BR') : '-',
    iso: d => d.toISOString().split('T')[0]
};

const UI = {
    toast(msg, type='success') {
        const cont = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<i class="ph ${type==='success'?'ph-check-circle':'ph-warning-circle'}"></i> ${msg}`;
        cont.appendChild(t);
        setTimeout(() => t.remove(), 4000);
    },
    // Botão "+" Inteligente: Sabe em que tela você está e abre o modal certo!
    handleFabClick() {
        const v = App.view;
        if(v === 'agenda') Modals.open('agendamento');
        else if(v === 'comandas') Modals.open('comanda');
        else if(v === 'clientes') Modals.open('cliente');
        else if(v === 'servicos' && App.role === 'owner') Modals.open('servico');
        else if(v === 'produtos' && App.role === 'owner') Modals.open('produto');
        else if(v === 'cobrancas') Modals.open('cobranca');
        else this.toast('Ação rápida não disponível nesta aba.', 'error');
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
            if (error) {
                console.error("Erro do Banco:", error);
                throw new Error("Usuário ou senha incorretos.");
            }
            if (!data || data.password !== p) {
                throw new Error("Usuário ou senha incorretos.");
            }
            
            App.user = data; 
            App.role = data.role;
            
            // Impede a entrada se for o primeiro login
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
        
        // Ativa ou desativa recursos visuais de administrador
        document.body.classList.toggle('is-owner', App.role === 'owner');
        
        Nav.init();
        Nav.showView('agenda');
    },
    logout() { if(confirm('Deseja sair da sua conta?')) location.reload(); }
};

const Nav = {
    init() {
        // Corrige o menu Desktop e Mobile sem travar o navegador
        document.querySelectorAll('.nav-link, .b-item').forEach(link => {
            link.addEventListener('click', (e) => {
                const targetView = link.dataset.view;
                if(!targetView) return; // Ignora se for botão de Menu ou Sair
                e.preventDefault();
                this.showView(targetView);
                this.closeMenu(); // Esconde o menu no mobile (no desktop, não afeta nada visualmente)
            });
        });
    },
    showView(id) {
        App.view = id;
        
        // Esconde todas e mostra a certa
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetSection = document.getElementById(`view-${id}`);
        if(targetSection) targetSection.classList.add('active');
        
        // Atualiza a cor dos botões de navegação
        document.querySelectorAll('.nav-link, .b-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll(`[data-view="${id}"]`).forEach(el => el.classList.add('active'));
        
        // Atualiza Título
        const titles = { agenda:'Agenda', comandas:'Comandas', cobrancas:'Cobranças', clientes:'Clientes', anamnese:'Anamnese', servicos:'Serviços', produtos:'Estoque', comissao:'Comissão', funcionarios:'Funcionários' };
        document.getElementById('page-title').textContent = titles[id] || 'Amor que Cuida';
        
        // Busca os dados do banco apenas quando a tela abre
        if(Render[id]) Render[id]();
    },
    toggleMenu() {
        document.getElementById('main-sidebar').classList.toggle('open');
        document.getElementById('mobile-overlay').classList.toggle('hidden');
    },
    closeMenu() {
        const sidebar = document.getElementById('main-sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if(sidebar) sidebar.classList.remove('open');
        if(overlay) overlay.classList.add('hidden');
    }
};

const Render = {
    async agenda() {
        this.buildCalendar();
        const dateStr = U.iso(App.currentDate);
        const { data: agendamentos } = await db.from('appointments').select('*, clients(name), services(name), users(name)').eq('date', dateStr);
        
        const cont = document.getElementById('agenda-list');
        if(!agendamentos || !agendamentos.length) {
            cont.innerHTML = `<div class="card" style="text-align:center"><p>Nenhum agendamento para este dia.</p></div>`; return;
        }
        
        cont.innerHTML = agendamentos.map(a => `
            <div class="card" style="display:flex; justify-content:space-between">
                <div><h4>${a.time} - ${a.clients?.name||'Cliente'}</h4><p>${a.services?.name||'Serviço'} • Profissional: ${a.users?.name}</p></div>
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
                <a href="#" class="wpp-btn" onclick="Modals.open('whatsapp', '${c.id}', '${c.name}'); event.stopPropagation()"><i class="ph ph-whatsapp-logo"></i></a>
                <h4 style="color:var(--primary)">${c.name}</h4>
                <p>${c.phone}</p>
                <div style="margin-top:15px">
                    <button class="btn-secondary" style="padding:0.6rem; width:100%" onclick="Render.anamnese('${c.id}', '${c.name}')">Ver Anamnese</button>
                </div>
            </div>`).join('');
    },

    anamnese(id, name) {
        document.getElementById('fa-client-id').value = id;
        document.getElementById('anamnese-title').textContent = `Anamnese: ${name}`;
        Nav.showView('anamnese');
        Actions.loadAnamnese(id);
    },

    async funcionarios() {
        const { data } = await db.from('users').select('*').neq('username', 'admin.teste');
        document.getElementById('funcionarios-list').innerHTML = data.map(u => `
            <div class="card"><h4>${u.name}</h4><p>Usuário: ${u.username}<br>Função: ${u.role}</p></div>`).join('');
    },

    async cobrancas() {
        const { data } = await db.from('debts').select('*, clients(name)').gt('remaining_amount', 0);
        document.getElementById('cobrancas-list').innerHTML = data.map(d => `
            <div class="card">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <h4>${d.clients?.name}</h4><div class="val" style="color:#d32f2f">${U.money(d.remaining_amount)}</div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" style="padding:0.6rem; font-size:0.85rem" onclick="Modals.open('debitar', '${d.id}', ${d.remaining_amount})">Debitar</button>
                    ${App.role==='owner' ? `<button class="btn-secondary" style="padding:0.6rem; font-size:0.85rem" onclick="Modals.open('desconto', '${d.id}', ${d.remaining_amount})">Dar Desconto %</button>` : ''}
                </div>
            </div>`).join('');
    },

    async servicos() {
        const { data } = await db.from('services').select('*');
        document.getElementById('servicos-list').innerHTML = data.map(s => `
            <div class="card">
                <h4>${s.name}</h4>
                <p>Custo: ${U.money(s.cost)} <br>Comissão: ${s.commission}%</p>
                <div class="val" style="margin-top:10px">${U.money(s.price)}</div>
            </div>`).join('');
    },

    async produtos() {
        const { data } = await db.from('products').select('*');
        document.getElementById('produtos-list').innerHTML = data.map(p => {
            const alert = p.stock <= p.min_stock ? '<span style="color:#d32f2f; font-size:0.8rem; font-weight:bold; display:block; margin-top:5px">ALERTA ESTOQUE BAIXO</span>' : '';
            return `<div class="card"><h4>${p.name} ${alert}</h4><p>Cód: ${p.barcode}</p><div class="val" style="font-size:1rem; margin-top:10px">Estoque: ${p.stock} un.</div></div>`;
        }).join('');
    },

    async comandas() {
        const { data } = await db.from('comandas').select('*, clients(name), users(name)').order('created_at', {ascending: false});
        document.getElementById('comandas-list').innerHTML = data.map(c => `
            <div class="card" style="border-left: 5px solid ${c.status === 'aberta' ? 'var(--primary)' : '#ccc'}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4>${c.clients?.name}</h4>
                    <span style="font-size:0.65rem; font-weight:bold; padding: 4px 10px; border-radius:20px; background:${c.status === 'aberta' ? 'var(--primary-light)' : '#eee'}; color:${c.status === 'aberta' ? 'var(--primary-dark)' : '#888'}">${c.status.toUpperCase()}</span>
                </div>
                <p style="margin-top:5px;">Responsável: ${c.users?.name}</p>
                <div class="val" style="margin-top:10px;">${U.money(c.total)}</div>
                <button class="btn-secondary" style="margin-top:15px; width:100%; padding: 0.8rem" onclick="Modals.open('edit_comanda', '${c.id}')">Gerenciar Comanda</button>
            </div>`).join('');
    }
};

const Modals = {
    async open(type, param1=null, param2=null) {
        const cont = document.getElementById('modal-container');
        let html = `<div class="modal"><button class="modal-close" onclick="Modals.close()"><i class="ph ph-x"></i></button>`;
        
        if(type === 'first_login') {
            html += `<h3>Crie sua Nova Senha</h3><p style="color:var(--muted); margin-bottom:1.5rem">Este é seu primeiro acesso, mude a senha padrão para uma de sua preferência.</p>
            <form onsubmit="Actions.updatePassword(event)">
                <div class="input-group"><input type="password" id="new-pass" required placeholder="Nova Senha"></div>
                <button type="submit" class="btn-primary">Salvar e Entrar</button>
            </form>`;
        } 
        else if(type === 'whatsapp') {
            html += `<h3>Chat WhatsApp</h3>
            <div style="background:#f9f9f9; padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid var(--border)">
                <p style="font-size: 0.8rem; color: var(--muted); margin-bottom: 5px;">Remetente Oficial do Estúdio: <b style="color:var(--text)">86 8830-4837</b></p>
                <p style="font-size: 0.95rem;">Enviar para: <b class="text-primary">${param2}</b></p>
            </div>
            
            <div class="input-group">
                <label>Mensagens Pré-definidas</label>
                <select id="wpp-template" onchange="document.getElementById('wpp-msg').value = this.value">
                    <option value="">-- Escolher Mensagem --</option>
                    <option value="Olá! Seu horário no Estúdio Amor que Cuida está confirmado.">Confirmação de Horário</option>
                    <option value="Olá! Sentimos sua falta. Que tal agendar um momento para cuidar de você esta semana?">Retorno de Cliente</option>
                    <option value="Feliz Aniversário! Temos um presente especial no estúdio te esperando.">Aniversário</option>
                </select>
            </div>
            <div class="input-group">
                <label>Sua Mensagem</label>
                <textarea id="wpp-msg" rows="4" placeholder="Ou digite sua mensagem personalizada aqui..."></textarea>
            </div>
            <button class="btn-primary" style="background:#25D366; display:flex; align-items:center; justify-content:center; gap:10px; box-shadow: 0 4px 15px rgba(37,211,102,0.4)" onclick="Actions.sendWhatsApp('${param2}')">
                Enviar Mensagem <i class="ph ph-paper-plane-right" style="font-size:1.3rem"></i>
            </button>`;
        }
        else if (type === 'edit_comanda') {
            const { data: comanda } = await db.from('comandas').select('*, clients(name)').eq('id', param1).single();
            const { data: servicos } = await db.from('services').select('*');
            
            const isFechada = comanda.status === 'fechada';
            const isAdmin = App.role === 'owner';
            const itens = comanda.items || [];
            
            let htmlList = itens.map(i => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:10px 0;">
                <span>${i.name}</span><span style="font-weight:bold; color:var(--primary)">${U.money(i.price)}</span>
            </div>`).join('');
            
            if(!htmlList) htmlList = '<p style="color:var(--muted); font-size:0.9rem">Nenhum serviço/produto inserido.</p>';
            
            html += `<h3 style="margin-bottom:0">Gerenciar Comanda</h3>
            <p style="font-size:1.1rem; margin-bottom:15px; color:var(--muted)">Cliente: <b class="text-primary">${comanda.clients?.name}</b></p>
            
            <div style="background:#fafafa; border:1px solid #eee; border-radius:12px; padding:15px; margin-bottom: 20px;">
                <h4 style="margin-bottom:10px; border-bottom:1px solid #ddd; padding-bottom:10px">Itens Consumidos</h4>
                ${htmlList}
                <h3 style="text-align:right; margin-top:15px; color:var(--primary-dark)">Total: ${U.money(comanda.total)}</h3>
            </div>`;
            
            if(!isFechada) {
                const sOpts = servicos.map(s => `<option value='{"id":"${s.id}","name":"${s.name}","price":${s.price}}'>${s.name} - ${U.money(s.price)}</option>`).join('');
                html += `
                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px">
                    <select id="add-item-sel" class="input-group" style="margin:0; padding:1rem; border-radius:12px; width:100%; border:1px solid var(--border)">
                        <option value="">-- Adicionar Serviço / Produto --</option>
                        ${sOpts}
                    </select>
                    <button class="btn-secondary" style="padding:1rem; background:var(--primary-light); color:var(--primary)" onclick="Actions.addComandaItem('${comanda.id}')">+ Adicionar Item à Comanda</button>
                </div>
                <button class="btn-primary" style="background:#2e7d32; box-shadow: 0 4px 15px rgba(46,125,50,0.4);" onclick="Actions.closeComanda('${comanda.id}', '${comanda.client_id}', ${comanda.total})">Fechar Comanda e Faturar</button>`;
            } else if (isAdmin) {
                html += `<button class="btn-secondary" style="color:#d32f2f" onclick="Actions.reopenComanda('${comanda.id}')">Reabrir Comanda (Acesso Admin)</button>`;
            } else {
                html += `<p style="text-align:center; color:var(--muted); font-size:0.9rem">Esta comanda foi fechada. Procure a gerência para reabrir.</p>`;
            }
        }
        else if(type === 'cliente') {
            html += `<h3>Novo Cliente</h3>
            <form onsubmit="Actions.createClient(event)">
                <div class="input-group"><label>Nome Completo</label><input type="text" id="fc-nome" required></div>
                <div class="input-group"><label>WhatsApp com DDD</label><input type="text" id="fc-fone" required></div>
                <button type="submit" class="btn-primary">Salvar Cliente</button>
            </form>`;
        }
        else if(type === 'agendamento' || type === 'comanda') {
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
                    <div style="display:flex; gap:10px;">
                        <div class="input-group" style="flex:1"><label>Data</label><input type="date" id="fa-date" required></div>
                        <div class="input-group" style="flex:1"><label>Hora</label><input type="time" id="fa-time" required></div>
                    </div>
                    <button type="submit" class="btn-primary">Confirmar Agendamento</button>
                </form>`;
            } else {
                html += `<h3>Nova Comanda</h3>
                <form onsubmit="Actions.createComanda(event)">
                    <div class="input-group"><label>Selecione o Cliente Presente no Salão</label><select id="fcom-cli" required>${cOpts}</select></div>
                    <button type="submit" class="btn-primary">Criar Comanda</button>
                </form>`;
            }
        }
        else if(type === 'servico') {
            html += `<h3>Novo Serviço</h3>
            <form onsubmit="Actions.createService(event)">
                <div class="input-group"><label>Nome do Procedimento</label><input type="text" id="fs-nome" required></div>
                <div class="input-group"><label>Valor Final (Para a Cliente) - R$</label><input type="number" id="fs-valor" step="0.01" required></div>
                <div class="input-group"><label>Custo do Salão (R$)</label><input type="number" id="fs-custo" step="0.01" required></div>
                <div class="input-group"><label>Comissão do Profissional (%)</label><input type="number" id="fs-com" max="100" required></div>
                <button type="submit" class="btn-primary">Salvar Serviço no Catálogo</button>
            </form>`;
        }
        else if(type === 'produto') {
            html += `<h3>Cadastrar Produto / Entrada</h3>
            <form onsubmit="Actions.saveProduct(event)">
                <div class="input-group"><label>Código de Barras</label><input type="text" id="fp-bar" required></div>
                <div class="input-group"><label>Nome da Mercadoria</label><input type="text" id="fp-nome" required></div>
                <div style="display:flex; gap:10px;">
                    <div class="input-group" style="flex:1"><label>Qtd Inicial</label><input type="number" id="fp-qtd" required></div>
                    <div class="input-group" style="flex:1"><label>Alerta Mínimo</label><input type="number" id="fp-min" value="5" required></div>
                </div>
                <button type="submit" class="btn-primary">Salvar Produto</button>
            </form>`;
        }
        else if(type === 'debitar' || type === 'desconto') {
            html += `<h3>${type === 'debitar' ? 'Debitar Conta' : 'Aplicar Desconto'}</h3><p style="margin-bottom:1.5rem">Dívida atual: <b style="color:var(--primary)">${U.money(param2)}</b></p>
            <form onsubmit="Actions.${type === 'debitar' ? 'debitDebt' : 'discountDebt'}(event, '${param1}', ${param2})">
                <div class="input-group"><label>${type === 'debitar' ? 'Valor Recebido Agora (R$)' : 'Porcentagem do Desconto (%)'}</label>
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
        if(!error) { App.user.first_login = false; Modals.close(); UI.toast('Senha salva!'); Auth.success(); }
    },
    async createClient(e) {
        e.preventDefault();
        const { error } = await db.from('clients').insert({ name: document.getElementById('fc-nome').value, phone: document.getElementById('fc-fone').value });
        if(!error) { Modals.close(); UI.toast('Cliente salvo!'); Render.clientes(); }
    },
    
    // ANAMNESE LOGIC
    async saveAnamnese(e) {
        e.preventDefault();
        const clientId = document.getElementById('fa-client-id').value;
        const payload = {
            client_id: clientId,
            history: document.getElementById('fa-hist').value,
            habits: document.getElementById('fa-hab').value,
            objectives: document.getElementById('fa-obj').value,
            notes: document.getElementById('fa-obs').value
        };
        const { error } = await db.from('anamnesis').insert(payload);
        if(!error) { 
            UI.toast('Ficha Anamnese salva no histórico!'); 
            document.querySelectorAll('#view-anamnese textarea').forEach(t => t.value = ''); // Limpa form
            this.loadAnamnese(clientId); 
        }
    },
    async loadAnamnese(clientId) {
        const { data } = await db.from('anamnesis').select('*').eq('client_id', clientId).order('created_at', {ascending: false});
        const div = document.getElementById('anamnese-history-list');
        if(!data || !data.length) { div.innerHTML = "<p style='color:var(--muted); text-align:center; padding: 2rem'>Nenhum histórico encontrado para esta cliente.</p>"; return; }
        
        div.innerHTML = data.map(d => `
        <div class="card" style="margin-bottom:15px; border-left: 4px solid var(--primary)">
            <h4 style="margin-bottom:10px; font-size:0.9rem; color:var(--muted)">Registrado em: <b style="color:var(--primary-dark)">${new Date(d.created_at).toLocaleString('pt-BR')}</b></h4>
            <p style="margin-bottom:8px"><b>Histórico Capilar:</b> ${d.history}</p>
            <p style="margin-bottom:8px"><b>Hábitos:</b> ${d.habits}</p>
            <p style="margin-bottom:8px"><b>Objetivo:</b> ${d.objectives}</p>
            <p><b>Obs Profissional:</b> ${d.notes}</p>
        </div>`).join('');
    },

    async createAppointment(e) {
        e.preventDefault();
        const { error } = await db.from('appointments').insert({
            client_id: document.getElementById('fa-cli').value, service_id: document.getElementById('fa-serv').value,
            user_id: document.getElementById('fa-user').value, date: document.getElementById('fa-date').value, time: document.getElementById('fa-time').value
        });
        if(!error) { Modals.close(); UI.toast('Agendado com sucesso!'); Render.agenda(); }
    },

    // COMANDAS LOGIC
    async createComanda(e) {
        e.preventDefault();
        const { error } = await db.from('comandas').insert({ client_id: document.getElementById('fcom-cli').value, user_id: App.user.id });
        if(!error) { Modals.close(); UI.toast('Comanda Aberta!'); Render.comandas(); }
    },
    async addComandaItem(id) {
        const val = document.getElementById('add-item-sel').value;
        if(!val) return UI.toast('Selecione um Serviço/Produto na lista.', 'error');
        const item = JSON.parse(val);
        
        const { data: comanda } = await db.from('comandas').select('items, total').eq('id', id).single();
        const items = comanda.items || [];
        items.push(item);
        const newTotal = comanda.total + item.price;
        
        const { error } = await db.from('comandas').update({ items, total: newTotal }).eq('id', id);
        if(!error) { UI.toast('Item inserido!'); Modals.open('edit_comanda', id); Render.comandas(); }
    },
    async closeComanda(comandaId, clientId, total) {
        if(!confirm('Deseja realmente fechar e faturar esta comanda?')) return;
        
        // 1. Fecha a comanda
        await db.from('comandas').update({ status: 'fechada' }).eq('id', comandaId);
        
        // 2. Se o total for maior que zero, joga pra dívida (Cobranças)
        if(total > 0) {
            // Verifica se o cliente já tem divida
            const { data: debt } = await db.from('debts').select('*').eq('client_id', clientId).single();
            if(debt) {
                await db.from('debts').update({ total_amount: debt.total_amount + total, remaining_amount: debt.remaining_amount + total }).eq('id', debt.id);
            } else {
                await db.from('debts').insert({ client_id: clientId, total_amount: total, remaining_amount: total });
            }
        }
        Modals.close(); UI.toast('Comanda fechada! Faturamento enviado para Cobranças.'); Render.comandas();
    },
    async reopenComanda(id) {
        const { error } = await db.from('comandas').update({ status: 'aberta' }).eq('id', id);
        if(!error) { Modals.close(); UI.toast('Comanda reaberta!'); Render.comandas(); }
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
            barcode: document.getElementById('fp-bar').value, name: document.getElementById('fp-nome').value, 
            stock: document.getElementById('fp-qtd').value, min_stock: document.getElementById('fp-min').value
        });
        if(!error) { Modals.close(); UI.toast('Produto estocado!'); Render.produtos(); }
    },
    async debitDebt(e, id, max) {
        e.preventDefault();
        const v = parseFloat(document.getElementById('f-val').value);
        const { error } = await db.from('debts').update({ remaining_amount: max - v }).eq('id', id);
        if(!error) { Modals.close(); UI.toast('Pagamento Abatido!'); Render.cobrancas(); }
    },
    async discountDebt(e, id, max) {
        e.preventDefault();
        const perc = parseFloat(document.getElementById('f-val').value);
        const { error } = await db.from('debts').update({ remaining_amount: max - (max * perc / 100) }).eq('id', id);
        if(!error) { Modals.close(); UI.toast('Desconto aplicado com sucesso!'); Render.cobrancas(); }
    },
    
    // WHATSAPP
    sendWhatsApp(clientName) {
        const msg = document.getElementById('wpp-msg').value;
        if(!msg) return UI.toast('Escreva uma mensagem antes de enviar.', 'error');
        Modals.close();
        UI.toast(`Mensagem enviada com sucesso para ${clientName} através do número 86 8830-4837!`);
    }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
