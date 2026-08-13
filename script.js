/** SISTEMA ESTÚDIO AMOR QUE CUIDA - V2 ROBUSTA **/

const DB_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';
const db = window.supabase.createClient(DB_URL, DB_KEY);

const App = { user: null, role: 'freelancer', view: 'agenda', currentDate: new Date(), charts: {} };

const U = {
    money: v => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v||0),
    date: d => d ? new Date(d).toLocaleDateString('pt-BR') : '-',
    iso: d => d.toISOString().split('T')[0],
    genTicket: () => 'COM-' + Math.floor(100000 + Math.random() * 900000)
};

const UI = {
    toast(msg, type='success') {
        const cont = document.getElementById('toast-container');
        const t = document.createElement('div'); t.className = `toast ${type}`;
        t.innerHTML = `<i class="ph ${type==='success'?'ph-check-circle':'ph-warning-circle'}"></i> ${msg}`;
        cont.appendChild(t); setTimeout(() => t.remove(), 4000);
    },
    handleFabClick() {
        const v = App.view;
        if(v === 'agenda') Modals.open('agendamento');
        else if(v === 'comandas') Modals.open('comanda');
        else if(v === 'clientes') Modals.open('cliente');
        else if(v === 'anamnese') Modals.open('nova_anamnese');
        else if(v === 'servicos' && App.role === 'owner') Modals.open('servico');
        else if(v === 'produtos' && App.role === 'owner') Modals.open('produto');
        else if(v === 'funcionarios' && App.role === 'owner') Modals.open('funcionario');
        else if(v === 'mensagens' && App.role === 'owner') Modals.open('mensagem');
        else if(v === 'despesas' && App.role === 'owner') Modals.open('despesa');
        else this.toast('Use os botões na tela para gerenciar esta aba.', 'error');
    }
};

const Auth = {
    init() {
        setTimeout(() => { document.getElementById('splash-screen').classList.remove('active'); document.getElementById('login-screen').classList.add('active'); }, 1500);
        document.getElementById('login-form').onsubmit = e => { e.preventDefault(); this.login(); };
    },
    async login() {
        const u = document.getElementById('username').value.trim(); const p = document.getElementById('password').value;
        const btn = document.getElementById('btn-login'); btn.textContent = 'Aguarde...';
        try {
            const { data, error } = await db.from('users').select('*').eq('username', u).single();
            if (error || !data || data.password !== p) throw new Error("Usuário ou senha incorretos.");
            App.user = data; App.role = data.role;
            if(data.first_login) { Modals.open('first_login'); btn.textContent = 'Entrar'; return; }
            this.success();
        } catch(e) { UI.toast(e.message, 'error'); btn.textContent = 'Entrar'; }
    },
    success() {
        document.getElementById('auth-layer').classList.add('hidden'); document.getElementById('system-layout').classList.remove('hidden');
        document.getElementById('header-user').textContent = App.user.name; document.getElementById('header-avatar').textContent = App.user.name.substring(0,2).toUpperCase();
        document.body.classList.toggle('is-owner', App.role === 'owner');
        Nav.init(); Nav.showView('agenda');
    },
    logout() { if(confirm('Deseja sair?')) location.reload(); }
};

const Nav = {
    init() {
        document.querySelectorAll('.nav-link, .b-item').forEach(link => {
            link.addEventListener('click', e => {
                const targetView = link.dataset.view; if(!targetView) return;
                e.preventDefault(); this.showView(targetView); this.closeMenu();
            });
        });
    },
    showView(id) {
        App.view = id;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${id}`).classList.add('active');
        document.querySelectorAll('.nav-link, .b-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll(`[data-view="${id}"]`).forEach(el => el.classList.add('active'));
        const titles = { agenda:'Agenda', comandas:'Comandas', cobrancas:'Cobranças', clientes:'Clientes', anamnese:'Anamnese', servicos:'Serviços', produtos:'Estoque', comissao:'Comissão', funcionarios:'Funcionários', despesas:'Despesas', mensagens:'Mensagens', 'resumo-financeiro':'Financeiro', performance:'Performance' };
        document.getElementById('page-title').textContent = titles[id] || 'Amor que Cuida';
        if(Render[id]) Render[id]();
    },
    toggleMenu() { document.getElementById('main-sidebar').classList.toggle('open'); document.getElementById('mobile-overlay').classList.toggle('hidden'); },
    closeMenu() { document.getElementById('main-sidebar').classList.remove('open'); document.getElementById('mobile-overlay').classList.add('hidden'); }
};

const Render = {
    async agenda() {
        this.buildCalendar();
        const { data } = await db.from('appointments').select('*, clients(name), services(name), users(name)').eq('date', U.iso(App.currentDate));
        const cont = document.getElementById('agenda-list');
        if(!data || !data.length) { cont.innerHTML = `<div class="card" style="text-align:center"><p>Nenhum agendamento hoje.</p></div>`; return; }
        cont.innerHTML = data.map(a => `<div class="card" style="display:flex; justify-content:space-between"><div><h4>${a.time} - ${a.clients?.name}</h4><p>${a.services?.name} • Prof: ${a.users?.name}</p></div><div class="val">${a.status}</div></div>`).join('');
    },
    buildCalendar() {
        const d = App.currentDate; document.getElementById('cal-month-year').textContent = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const start = new Date(d); start.setDate(d.getDate() - d.getDay());
        let html = ''; const days = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
        for(let i=0; i<7; i++) {
            const cur = new Date(start); cur.setDate(start.getDate() + i);
            const isSel = U.iso(cur) === U.iso(App.currentDate) ? 'active' : '';
            html += `<div class="cal-day ${isSel}" onclick="Render.selectDate('${U.iso(cur)}')"><span>${days[i]}</span><span>${cur.getDate()}</span></div>`;
        }
        document.getElementById('cal-days-row').innerHTML = html;
    },
    selectDate(iso) { App.currentDate = new Date(iso+'T12:00:00'); this.agenda(); },
    changeWeek(dir) { App.currentDate.setDate(App.currentDate.getDate() + (dir*7)); this.agenda(); },

    async clientes() {
        const { data } = await db.from('clients').select('*');
        document.getElementById('clientes-list').innerHTML = data.map(c => `
            <div class="card">
                <a href="#" class="wpp-btn" onclick="Modals.open('whatsapp', '${c.phone}', '${c.name}'); event.stopPropagation()"><i class="ph ph-whatsapp-logo"></i></a>
                <h4 style="color:var(--primary)">${c.name}</h4><p>${c.phone}</p>
                <button class="btn-secondary" style="margin-top:10px" onclick="Render.anamnese('${c.id}', '${c.name}')">Ver Anamnese</button>
            </div>`).join('');
    },
    anamnese(id, name) {
        document.getElementById('current-anamnese-client-id').value = id;
        document.getElementById('anamnese-title').textContent = `Anamnese: ${name}`;
        Nav.showView('anamnese'); Actions.loadAnamnese(id);
    },
    async funcionarios() {
        const { data } = await db.from('users').select('*').neq('username', 'admin.teste');
        document.getElementById('funcionarios-list').innerHTML = data.map(u => `<div class="card"><h4>${u.name}</h4><p>Login: ${u.username}<br>Função: ${u.role==='owner'?'Responsável':'Freelancer'}</p></div>`).join('');
    },
    async cobrancas() {
        const { data } = await db.from('debts').select('*, clients(name)').gt('remaining_amount', 0);
        document.getElementById('cobrancas-list').innerHTML = data.map(d => `
            <div class="card"><div style="display:flex; justify-content:space-between; margin-bottom:10px;"><h4>${d.clients?.name}</h4><div class="val" style="color:#d32f2f">${U.money(d.remaining_amount)}</div></div>
            <div style="display:flex; gap:10px;"><button class="btn-primary" style="padding:0.6rem" onclick="Modals.open('debitar', '${d.id}', ${d.remaining_amount})">Debitar</button>
            ${App.role==='owner' ? `<button class="btn-secondary" style="padding:0.6rem" onclick="Modals.open('desconto', '${d.id}', ${d.remaining_amount})">Desconto %</button>` : ''}
            <button class="btn-secondary" style="padding:0.6rem" onclick="Modals.open('detalhe_cobranca', '${d.comanda_id}')"><i class="ph ph-eye"></i> Ticket</button></div></div>`).join('');
    },
    async servicos() {
        const { data } = await db.from('services').select('*');
        document.getElementById('servicos-list').innerHTML = data.map(s => `<div class="card"><h4>${s.name}</h4><p>Comissão: ${s.commission}% ${s.has_assistant?`| Aux: ${s.assistant_commission}%`:''}</p><div class="val">${U.money(s.price)}</div></div>`).join('');
    },
    async produtos() {
        const { data } = await db.from('products').select('*');
        document.getElementById('produtos-list').innerHTML = data.map(p => `<div class="card"><h4>${p.name} ${p.stock<=p.min_stock?'<span style="color:red; font-size:0.8rem">BAIXO</span>':''}</h4><p>Cód: ${p.barcode}</p><div class="val" style="font-size:1rem">Estoque: ${p.stock} un.</div></div>`).join('');
    },
    async comandas() {
        const { data } = await db.from('comandas').select('*, clients(name), users(name)').order('created_at', {ascending: false});
        document.getElementById('comandas-list').innerHTML = data.map(c => `
            <div class="card" style="border-left: 5px solid ${c.status === 'aberta' ? 'var(--primary)' : '#ccc'}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4>${c.clients?.name}</h4><span style="font-size:0.7rem; font-weight:bold; padding: 4px 10px; border-radius:20px; background:${c.status === 'aberta' ? 'var(--primary-light)' : '#eee'}">${c.status.toUpperCase()}</span>
                </div>
                <p>Ticket: <b>${c.ticket}</b></p><div class="val">${U.money(c.total)}</div>
                <button class="btn-secondary" style="margin-top:15px; width:100%" onclick="Modals.open('edit_comanda', '${c.id}')">Gerenciar Comanda</button>
            </div>`).join('');
    },
    async mensagens() {
        const { data } = await db.from('message_templates').select('*');
        document.getElementById('mensagens-list').innerHTML = data.map(m => `<div class="card"><h4>${m.title}</h4><p>${m.content}</p></div>`).join('');
    },
    
    // DASHBOARDS & CHARTS
    async despesas() {
        const { data } = await db.from('despesas').select('*').order('date', {ascending: false});
        document.getElementById('despesas-list').innerHTML = data.map(d => `<div class="card" style="display:flex; justify-content:space-between"><div><h4>${d.description}</h4><p>${U.date(d.date)}</p></div><div class="val" style="color:#d32f2f">-${U.money(d.amount)}</div></div>`).join('');
        
        // Chart Config
        if(App.charts.despesas) App.charts.despesas.destroy();
        const ctx = document.getElementById('chart-despesas');
        App.charts.despesas = new Chart(ctx, { type: 'bar', data: { labels: data.slice(0,5).map(d=>d.description), datasets: [{ label: 'Últimas Despesas', data: data.slice(0,5).map(d=>d.amount), backgroundColor: '#d32f2f' }] }});
    },
    async comissao() {
        const isOwner = App.role === 'owner';
        let query = db.from('comandas').select('*, users(name)');
        if(!isOwner) query = query.eq('user_id', App.user.id);
        const { data } = await query;
        
        let html = ''; let totalComissao = 0;
        data.forEach(c => {
            if(!c.items) return;
            c.items.forEach(i => {
                const valor = (i.price * (i.commission||0)) / 100;
                totalComissao += valor;
                if(!isOwner) html += `<div class="card"><h4>${i.name}</h4><p>Ticket: ${c.ticket} • ${i.commission}%</p><div class="val" style="color:#2e7d32">+${U.money(valor)}</div></div>`;
            });
        });
        
        if(isOwner) html = `<div class="card"><h3 style="margin-bottom:10px">Total a Pagar (Geral)</h3><div class="val" style="font-size:2rem">${U.money(totalComissao)}</div><p>Para ver detalhes por funcionário, gere o PDF.</p></div>`;
        else html = `<div class="card" style="margin-bottom:15px; background:var(--primary); color:white"><h4 style="color:white">Minha Comissão</h4><div class="val" style="color:white; font-size:2rem">${U.money(totalComissao)}</div></div>` + html;
        
        document.getElementById('comissao-dashboard').innerHTML = html;
    },
    async 'resumo-financeiro'() {
        const { data: comandas } = await db.from('comandas').select('total').eq('status', 'fechada');
        const { data: despesas } = await db.from('despesas').select('amount');
        
        const receita = comandas.reduce((acc, c) => acc + c.total, 0);
        const gasto = despesas.reduce((acc, d) => acc + d.amount, 0);
        const lucro = receita - gasto;
        
        document.getElementById('resumo-cards').innerHTML = `
            <div class="card"><h4>Receitas</h4><div class="val" style="color:#2e7d32">${U.money(receita)}</div></div>
            <div class="card"><h4>Despesas</h4><div class="val" style="color:#d32f2f">-${U.money(gasto)}</div></div>
            <div class="card" style="background: ${lucro>=0?'#e8f5e9':'#ffebee'}"><h4>Lucro/Prejuízo</h4><div class="val">${U.money(lucro)}</div></div>`;
            
        if(App.charts.fin) App.charts.fin.destroy();
        App.charts.fin = new Chart(document.getElementById('chart-financeiro'), { type: 'doughnut', data: { labels: ['Receitas', 'Despesas'], datasets: [{ data: [receita, gasto], backgroundColor: ['#2e7d32', '#d32f2f'] }] }});
    },
    async performance() {
        const { data } = await db.from('comandas').select('*, users(name)');
        const rank = {}; data.forEach(c => { if(c.users) { rank[c.users.name] = (rank[c.users.name]||0) + c.total; } });
        const sorted = Object.entries(rank).sort((a,b)=>b[1]-a[1]);
        
        document.getElementById('performance-ranking').innerHTML = sorted.map((s,i) => `<div class="card"><h4>${i+1}º ${s[0]}</h4><div class="val">${U.money(s[1])}</div></div>`).join('');
        
        if(App.charts.perf) App.charts.perf.destroy();
        App.charts.perf = new Chart(document.getElementById('chart-performance'), { type: 'bar', data: { labels: sorted.map(s=>s[0]), datasets: [{ label: 'Faturamento por Profissional', data: sorted.map(s=>s[1]), backgroundColor: '#B76E79' }] }});
    }
};

const Modals = {
    async open(type, param1=null, param2=null) {
        const cont = document.getElementById('modal-container');
        let html = `<div class="modal"><button class="modal-close" onclick="Modals.close()"><i class="ph ph-x"></i></button>`;
        
        if(type === 'first_login') {
            html += `<h3>Crie sua Nova Senha</h3><form onsubmit="Actions.updatePassword(event)"><div class="input-group"><input type="password" id="new-pass" required placeholder="Nova Senha"></div><button type="submit" class="btn-primary">Salvar e Entrar</button></form>`;
        } 
        else if(type === 'whatsapp') {
            const { data: templates } = await db.from('message_templates').select('*');
            const tOpts = templates.map(t => `<option value="${t.content}">${t.title}</option>`).join('');
            html += `<h3>Chat WhatsApp</h3><p style="margin-bottom:1rem">Para: <b class="text-primary">${param2}</b> (${param1})</p>
            <div class="input-group"><label>Mensagens Prontas</label><select onchange="document.getElementById('wpp-msg').value = this.value"><option value="">-- Escolher --</option>${tOpts}</select></div>
            <div class="input-group"><textarea id="wpp-msg" rows="4" placeholder="Sua mensagem..."></textarea></div>
            <button class="btn-primary" style="background:#25D366;" onclick="Actions.sendWhatsApp('${param1}')">Enviar WhatsApp</button>`;
        }
        else if(type === 'nova_anamnese') {
            html += `<h3>Nova Avaliação</h3><form onsubmit="Actions.saveAnamnese(event, true)">
            <div class="input-group"><textarea id="m-fa-hist" placeholder="Histórico Capilar" required></textarea></div>
            <div class="input-group"><textarea id="m-fa-hab" placeholder="Hábitos" required></textarea></div>
            <div class="input-group"><textarea id="m-fa-obj" placeholder="Objetivos" required></textarea></div>
            <div class="input-group"><textarea id="m-fa-obs" placeholder="Observações" required></textarea></div>
            <button type="submit" class="btn-primary">Salvar Ficha</button></form>`;
        }
        else if (type === 'edit_comanda') {
            const { data: comanda } = await db.from('comandas').select('*, clients(name)').eq('id', param1).single();
            const { data: servicos } = await db.from('services').select('*');
            
            const isFechada = comanda.status === 'fechada';
            let htmlList = (comanda.items||[]).map(i => `<div style="display:flex; justify-content:space-between; padding:5px 0;"><span>${i.name}</span><b>${U.money(i.price)}</b></div>`).join('');
            
            html += `<h3>Ticket: ${comanda.ticket}</h3><p style="margin-bottom:15px">Cliente: <b>${comanda.clients?.name}</b></p>
            <div style="background:#fafafa; padding:15px; border-radius:12px; margin-bottom: 20px;">
                ${htmlList || '<p>Nenhum serviço/produto.</p>'} <h3 style="text-align:right; margin-top:10px; color:var(--primary-dark)">Total: ${U.money(comanda.total)}</h3>
            </div>`;
            
            if(!isFechada) {
                const sOpts = servicos.map(s => `<option value='{"id":"${s.id}","name":"${s.name}","price":${s.price},"commission":${s.commission}}'>${s.name} - ${U.money(s.price)}</option>`).join('');
                html += `<div class="input-group"><select id="add-item-sel"><option value="">-- Adicionar --</option>${sOpts}</select></div>
                <button class="btn-secondary" style="margin-bottom:10px" onclick="Actions.addComandaItem('${comanda.id}')">+ Adicionar Item</button>
                <button class="btn-primary" style="background:#2e7d32;" onclick="Actions.closeComanda('${comanda.id}', '${comanda.client_id}', ${comanda.total})">Fechar e Faturar</button>`;
            } else if (App.role === 'owner') {
                html += `<button class="btn-secondary" style="color:#d32f2f" onclick="Actions.reopenComanda('${comanda.id}')">Reabrir Comanda (Reverte Dívida)</button>`;
            }
        }
        else if(type === 'agendamento') {
            const [c, s, u] = await Promise.all([db.from('clients').select('id,name'), db.from('services').select('id,name,price,has_assistant'), db.from('users').select('id,name').neq('username', 'admin.teste')]);
            const sOpts = s.data.map(x => `<option value="${x.id}" data-aux="${x.has_assistant}">${x.name}</option>`).join('');
            html += `<h3>Novo Agendamento</h3><form onsubmit="Actions.createAppointment(event)">
                <div class="input-group"><select id="fa-cli" required><option value="">-- Cliente --</option>${c.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div class="input-group"><select id="fa-serv" required onchange="document.getElementById('aux-div').style.display = this.options[this.selectedIndex].dataset.aux==='true'?'block':'none'"><option value="">-- Serviço --</option>${sOpts}</select></div>
                <div class="input-group"><select id="fa-user" required><option value="">-- Profissional --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div class="input-group" id="aux-div" style="display:none"><select id="fa-aux"><option value="">-- Escolher Auxiliar --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div style="display:flex; gap:10px;"><input type="date" id="fa-date" class="input-group" style="flex:1" required><input type="time" id="fa-time" class="input-group" style="flex:1" required></div>
                <button type="submit" class="btn-primary">Agendar</button></form>`;
        }
        else if(type === 'comanda') {
            const { data } = await db.from('clients').select('id, name');
            html += `<h3>Nova Comanda</h3><form onsubmit="Actions.createComanda(event)">
                <div class="input-group"><select id="fcom-cli" required><option value="">-- Cliente no Salão --</option>${data.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <button type="submit" class="btn-primary">Abrir Comanda</button></form>`;
        }
        else if(type === 'cliente') {
            html += `<h3>Novo Cliente</h3><form onsubmit="Actions.createClient(event)"><div class="input-group"><input type="text" id="fc-nome" placeholder="Nome" required></div><div class="input-group"><input type="text" id="fc-fone" placeholder="WhatsApp" required></div><button type="submit" class="btn-primary">Salvar</button></form>`;
        }
        else if(type === 'servico') {
            html += `<h3>Novo Serviço</h3><form onsubmit="Actions.createService(event)">
                <div class="input-group"><input type="text" id="fs-nome" placeholder="Nome" required></div>
                <div style="display:flex; gap:10px;"><input type="number" id="fs-valor" placeholder="Valor Cobrado" step="0.01" class="input-group" required><input type="number" id="fs-custo" placeholder="Custo" step="0.01" class="input-group" required></div>
                <div class="input-group"><input type="number" id="fs-com" placeholder="Comissão %" max="100" required></div>
                <div class="input-group"><label><input type="checkbox" id="fs-aux" onchange="document.getElementById('aux-com-div').style.display=this.checked?'block':'none'"> Precisa de Auxiliar?</label></div>
                <div class="input-group" id="aux-com-div" style="display:none"><input type="number" id="fs-auxcom" placeholder="Comissão Auxiliar %" max="100"></div>
                <button type="submit" class="btn-primary">Salvar</button></form>`;
        }
        else if(type === 'produto') {
            html += `<h3>Novo Produto</h3><form onsubmit="Actions.saveProduct(event)">
                <div class="input-group"><input type="text" id="fp-bar" placeholder="Cód. Barras (Digite para buscar)" oninput="Actions.mockBarcode(this.value)" required></div>
                <div class="input-group"><input type="text" id="fp-nome" placeholder="Nome" required></div>
                <div style="display:flex; gap:10px;"><input type="number" id="fp-qtd" placeholder="Qtd" class="input-group" required><input type="number" id="fp-min" placeholder="Alerta Mín." value="5" class="input-group" required></div>
                <button type="submit" class="btn-primary">Salvar</button></form>`;
        }
        else if(type === 'funcionario') {
            html += `<h3>Novo Funcionário</h3><form onsubmit="Actions.createFuncionario(event)">
                <div class="input-group"><input type="text" id="ff-nome" placeholder="Nome Completo" required></div>
                <div class="input-group"><input type="text" id="ff-user" placeholder="Login de Acesso" required></div>
                <div class="input-group"><select id="ff-role"><option value="freelancer">Freelancer</option><option value="owner">Responsável (Admin)</option></select></div>
                <button type="submit" class="btn-primary">Salvar Usuário</button></form>`;
        }
        else if(type === 'mensagem') {
            html += `<h3>Nova Mensagem</h3><form onsubmit="Actions.createMensagem(event)">
                <div class="input-group"><input type="text" id="fm-tit" placeholder="Título" required></div>
                <div class="input-group"><textarea id="fm-txt" placeholder="Conteúdo" required></textarea></div>
                <button type="submit" class="btn-primary">Salvar Mensagem</button></form>`;
        }
        else if(type === 'despesa') {
            html += `<h3>Nova Despesa</h3><form onsubmit="Actions.createDespesa(event)">
                <div class="input-group"><input type="text" id="fd-desc" placeholder="Descrição" required></div>
                <div class="input-group"><input type="number" id="fd-val" placeholder="Valor R$" step="0.01" required></div>
                <button type="submit" class="btn-primary">Registrar Saída</button></form>`;
        }
        else if(type === 'debitar' || type === 'desconto') {
            html += `<h3>${type==='debitar'?'Debitar':'Desconto'}</h3><p>Dívida: ${U.money(param2)}</p>
            <form onsubmit="Actions.${type==='debitar'?'debitDebt':'discountDebt'}(event, '${param1}', ${param2})">
                <div class="input-group"><input type="number" id="f-val" step="0.01" required placeholder="${type==='debitar'?'Valor Recebido':'%'}"></div>
                <button type="submit" class="btn-primary">Confirmar</button></form>`;
        }
        else if (type === 'detalhe_cobranca') {
            if(param1 === 'null') { html += `<h3>Detalhes</h3><p>Cobrança manual sem comanda vinculada.</p>`; } 
            else {
                const { data: comanda } = await db.from('comandas').select('*').eq('id', param1).single();
                html += `<h3>Detalhes do Ticket: ${comanda?.ticket || 'N/A'}</h3><div style="background:#fafafa; padding:15px; border-radius:12px">${(comanda?.items||[]).map(i => `<p>${i.name} - <b>${U.money(i.price)}</b></p>`).join('')}</div>`;
            }
        }
        html += `</div>`; cont.innerHTML = html; cont.classList.remove('hidden');
    },
    close() { document.getElementById('modal-container').classList.add('hidden'); }
};

const Actions = {
    async updatePassword(e) {
        e.preventDefault(); const { error } = await db.from('users').update({ password: document.getElementById('new-pass').value, first_login: false }).eq('id', App.user.id);
        if(!error) { App.user.first_login = false; Modals.close(); UI.toast('Senha salva!'); Auth.success(); }
    },
    async createClient(e) {
        e.preventDefault(); const { error } = await db.from('clients').insert({ name: document.getElementById('fc-nome').value, phone: document.getElementById('fc-fone').value });
        if(!error) { Modals.close(); UI.toast('Cliente salvo!'); Render.clientes(); }
    },
    async saveAnamnese(e, isModal=false) {
        e.preventDefault();
        const id = isModal ? document.getElementById('current-anamnese-client-id').value : document.getElementById('fa-client-id').value;
        const payload = { client_id: id, history: document.getElementById(isModal?'m-fa-hist':'fa-hist').value, habits: document.getElementById(isModal?'m-fa-hab':'fa-hab').value, objectives: document.getElementById(isModal?'m-fa-obj':'fa-obj').value, notes: document.getElementById(isModal?'m-fa-obs':'fa-obs').value };
        const { error } = await db.from('anamnesis').insert(payload);
        if(!error) { UI.toast('Ficha salva!'); if(isModal) Modals.close(); this.loadAnamnese(id); }
    },
    async loadAnamnese(id) {
        const { data } = await db.from('anamnesis').select('*').eq('client_id', id).order('created_at', {ascending: false});
        const div = document.getElementById('anamnese-history-list');
        if(!data || !data.length) { div.innerHTML = "<p>Sem histórico.</p>"; return; }
        div.innerHTML = data.map(d => `<div class="card"><h4 style="font-size:0.9rem">Data: ${new Date(d.created_at).toLocaleDateString()}</h4><p><b>Hist:</b> ${d.history}</p><p><b>Obj:</b> ${d.objectives}</p></div>`).join('');
    },
    async createAppointment(e) {
        e.preventDefault();
        const auxId = document.getElementById('fa-aux').value;
        const { error } = await db.from('appointments').insert({ client_id: document.getElementById('fa-cli').value, service_id: document.getElementById('fa-serv').value, user_id: document.getElementById('fa-user').value, assistant_id: auxId || null, date: document.getElementById('fa-date').value, time: document.getElementById('fa-time').value });
        if(!error) { Modals.close(); UI.toast('Agendado!'); Render.agenda(); }
    },
    async createComanda(e) {
        e.preventDefault(); const { error } = await db.from('comandas').insert({ client_id: document.getElementById('fcom-cli').value, user_id: App.user.id, ticket: U.genTicket() });
        if(!error) { Modals.close(); UI.toast('Comanda Aberta!'); Render.comandas(); }
    },
    async addComandaItem(id) {
        const val = document.getElementById('add-item-sel').value; if(!val) return;
        const item = JSON.parse(val); const { data: comanda } = await db.from('comandas').select('items, total').eq('id', id).single();
        const items = comanda.items || []; items.push(item);
        await db.from('comandas').update({ items, total: comanda.total + item.price }).eq('id', id);
        Modals.open('edit_comanda', id); Render.comandas();
    },
    async closeComanda(comandaId, clientId, total) {
        if(!confirm('Fechar e faturar?')) return;
        await db.from('comandas').update({ status: 'fechada' }).eq('id', comandaId);
        if(total > 0) {
            const { data: debt } = await db.from('debts').select('*').eq('client_id', clientId).single();
            if(debt) await db.from('debts').update({ total_amount: debt.total_amount + total, remaining_amount: debt.remaining_amount + total }).eq('id', debt.id);
            else await db.from('debts').insert({ client_id: clientId, total_amount: total, remaining_amount: total, comanda_id: comandaId });
        }
        Modals.close(); UI.toast('Faturamento enviado para Cobranças.'); Render.comandas();
    },
    async reopenComanda(id) {
        // Lógica de Reversão de Dívida
        const { data: c } = await db.from('comandas').select('*').eq('id', id).single();
        if(c.total > 0) {
            const { data: d } = await db.from('debts').select('*').eq('client_id', c.client_id).single();
            if(d) {
                const nT = Math.max(0, d.total_amount - c.total); const nR = Math.max(0, d.remaining_amount - c.total);
                await db.from('debts').update({ total_amount: nT, remaining_amount: nR }).eq('id', d.id);
            }
        }
        await db.from('comandas').update({ status: 'aberta' }).eq('id', id);
        Modals.close(); UI.toast('Comanda reaberta e Dívida estornada!'); Render.comandas();
    },
    async createService(e) {
        e.preventDefault(); const aux = document.getElementById('fs-aux').checked;
        await db.from('services').insert({ name: document.getElementById('fs-nome').value, price: document.getElementById('fs-valor').value, cost: document.getElementById('fs-custo').value, commission: document.getElementById('fs-com').value, has_assistant: aux, assistant_commission: aux ? document.getElementById('fs-auxcom').value : 0 });
        Modals.close(); UI.toast('Serviço criado!'); Render.servicos();
    },
    mockBarcode(val) {
        if(val.length >= 6) { // Simula uma API de código de barras
            const db_mock = { '7891010': 'Shampoo LOréal Expert 300ml', '7892020': 'Máscara Hidratação Profunda' };
            if(db_mock[val]) document.getElementById('fp-nome').value = db_mock[val];
        }
    },
    async saveProduct(e) {
        e.preventDefault(); await db.from('products').insert({ barcode: document.getElementById('fp-bar').value, name: document.getElementById('fp-nome').value, stock: document.getElementById('fp-qtd').value, min_stock: document.getElementById('fp-min').value });
        Modals.close(); UI.toast('Estoque atualizado!'); Render.produtos();
    },
    async createFuncionario(e) {
        e.preventDefault(); await db.from('users').insert({ name: document.getElementById('ff-nome').value, username: document.getElementById('ff-user').value, role: document.getElementById('ff-role').value });
        Modals.close(); UI.toast('Usuário Criado! A senha padrão é 123456'); Render.funcionarios();
    },
    async createMensagem(e) {
        e.preventDefault(); await db.from('message_templates').insert({ title: document.getElementById('fm-tit').value, content: document.getElementById('fm-txt').value });
        Modals.close(); UI.toast('Template salvo!'); Render.mensagens();
    },
    async createDespesa(e) {
        e.preventDefault(); await db.from('despesas').insert({ description: document.getElementById('fd-desc').value, amount: document.getElementById('fd-val').value });
        Modals.close(); UI.toast('Despesa registrada!'); Render.despesas();
    },
    async debitDebt(e, id, max) {
        e.preventDefault(); const v = parseFloat(document.getElementById('f-val').value);
        await db.from('debts').update({ remaining_amount: Math.max(0, max - v) }).eq('id', id); Modals.close(); UI.toast('Abaixado!'); Render.cobrancas();
    },
    async discountDebt(e, id, max) {
        e.preventDefault(); const perc = parseFloat(document.getElementById('f-val').value);
        await db.from('debts').update({ remaining_amount: Math.max(0, max - (max * perc / 100)) }).eq('id', id); Modals.close(); UI.toast('Desconto aplicado!'); Render.cobrancas();
    },
    sendWhatsApp(phone) {
        const msg = document.getElementById('wpp-msg').value; if(!msg) return UI.toast('Digite a mensagem.', 'error');
        Modals.close();
        // Dispara a API oficial do WhatsApp Web preenchida com a mensagem
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        UI.toast(`Redirecionando para o WhatsApp...`);
    }
};

const Reports = {
    exportDespesas() { UI.toast('Gerando PDF...', 'success'); setTimeout(() => alert('PDF de Despesas Gerado! (Requer backend de impressão real)'), 1000); },
    exportComissao() { UI.toast('Gerando PDF de Comissão...', 'success'); },
    exportFinanceiro() { UI.toast('Gerando PDF do Fluxo de Caixa...', 'success'); }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
