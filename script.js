const DB_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';
const db = window.supabase.createClient(DB_URL, DB_KEY);

const App = { user: null, role: 'freelancer', view: 'agenda', currentDate: new Date(), charts: {}, settings: {} };

const U = {
    money: v => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v||0),
    iso: d => { const nd = new Date(d); return nd.getFullYear()+'-'+String(nd.getMonth()+1).padStart(2,'0')+'-'+String(nd.getDate()).padStart(2,'0'); }
};

const UI = {
    toast(msg, type='success') {
        const cont = document.getElementById('toast-container');
        const t = document.createElement('div'); t.className = `toast ${type}`;
        t.innerHTML = `<i class="ph ${type==='success'?'ph-check-circle':'ph-warning-circle'}"></i> ${msg}`;
        cont.appendChild(t); setTimeout(() => t.remove(), 4000);
    },
    confirm(msg, onConfirm) {
        document.getElementById('confirm-msg').textContent = msg;
        const modal = document.getElementById('custom-confirm'); modal.classList.remove('hidden');
        document.getElementById('confirm-cancel').onclick = () => modal.classList.add('hidden');
        document.getElementById('confirm-ok').onclick = () => { modal.classList.add('hidden'); onConfirm(); };
    },
    handleFabClick() {
        const v = App.view;
        if(v === 'agenda') Modals.open('agendamento');
        else if(v === 'comandas') Modals.open('comanda');
        else if(v === 'clientes') Modals.open('cliente');
        else if(v === 'servicos' && App.role === 'owner') Modals.open('servico');
        else if(v === 'produtos' && App.role === 'owner') Modals.open('produto');
        else if(v === 'mensagens' && App.role === 'owner') Modals.open('mensagem');
        else if(v === 'despesas' && App.role === 'owner') Modals.open('despesa');
        else this.toast('Use os painéis da tela para esta seção.', 'error');
    }
};

const Auth = {
    init() { document.getElementById('login-form').onsubmit = e => { e.preventDefault(); this.login(); }; },
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
    async success() {
        document.getElementById('auth-layer').classList.add('hidden'); document.getElementById('system-layout').classList.remove('hidden');
        document.getElementById('header-user').textContent = App.user.name; document.getElementById('header-avatar').textContent = App.user.name.substring(0,2).toUpperCase();
        document.body.classList.toggle('is-owner', App.role === 'owner');
        
        // Load Settings
        const { data: set } = await db.from('settings').select('*').single();
        if(set) { App.settings = set; document.getElementById('brand-name').textContent = set.studio_name; }
        
        Nav.init(); Nav.showView('agenda');
        
        // Ativar Realtime Global
        db.channel('custom-all-channel')
          .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
              if(Render[App.view]) Render[App.view](); // Atualiza a tela atual se algo mudar no banco
          }).subscribe();
    },
    logout() { UI.confirm('Deseja realmente sair do sistema?', () => location.reload()); }
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
        const titles = { agenda:'Agenda', comandas:'Comandas', cobrancas:'Cobranças', clientes:'Clientes', anamnese:'Anamnese', servicos:'Serviços', produtos:'Estoque', comissao:'Comissão', mensagens:'Mensagens Prontas', despesas:'Despesas', 'resumo-financeiro':'Financeiro', performance:'Performance', configuracoes:'Configurações' };
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
        if(!data || !data.length) { cont.innerHTML = `<div class="card" style="text-align:center"><p>Nenhum agendamento cadastrado para este dia.</p></div>`; return; }
        cont.innerHTML = data.map(a => `<div class="card" style="display:flex; justify-content:space-between"><div><h4>${a.time} - ${a.clients?.name}</h4><p>${a.services?.name} • Profissional: ${a.users?.name}</p></div><div class="val" style="font-size:0.8rem; background:#eee; padding:5px; border-radius:10px">${a.status}</div></div>`).join('');
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
    async cobrancas() {
        const { data } = await db.from('debts').select('*, clients(name)').gt('remaining_amount', 0);
        document.getElementById('cobrancas-list').innerHTML = data.map(d => `
            <div class="card"><div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div><p style="font-size:0.7rem; color:var(--muted)">Ticket Ref: ${d.comanda_ticket || 'Manual'}</p><h4>${d.clients?.name}</h4></div>
                <div class="val" style="color:#d32f2f">${U.money(d.remaining_amount)}</div>
            </div>
            <div style="display:flex; gap:10px;"><button class="btn-primary" style="padding:0.6rem" onclick="Modals.open('debitar', '${d.id}', ${d.remaining_amount})">Debitar</button>
            ${App.role==='owner' ? `<button class="btn-secondary" style="padding:0.6rem" onclick="Modals.open('desconto', '${d.id}', ${d.remaining_amount})">Desconto %</button>` : ''}
            </div></div>`).join('');
    },
    async servicos() {
        const { data } = await db.from('services').select('*');
        document.getElementById('servicos-list').innerHTML = data.map(s => `<div class="card"><h4>${s.name}</h4><p>Comissão: ${s.commission}% ${s.has_assistant?`| Auxiliar: ${s.assistant_commission}%`:''}</p><div class="val">${U.money(s.price)}</div></div>`).join('');
    },
    async produtos() {
        const { data } = await db.from('products').select('*');
        document.getElementById('produtos-list').innerHTML = data.map(p => `<div class="card"><h4>${p.name} ${p.stock<=p.min_stock?'<span style="color:red; font-size:0.8rem">ESTOQUE BAIXO</span>':''}</h4><p>Cód: ${p.barcode}</p><div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px"><div class="val" style="font-size:1rem">Estoque: ${p.stock} un.</div><button class="btn-secondary" style="width:auto; padding:0.5rem 1rem" onclick="Modals.open('add_estoque', '${p.id}', '${p.stock}')">+ Qtd</button></div></div>`).join('');
    },
    async comandas() {
        const { data } = await db.from('comandas').select('*, clients(name), users(name)').order('created_at', {ascending: false});
        document.getElementById('comandas-list').innerHTML = data.map(c => `
            <div class="card" style="border-left: 5px solid ${c.status === 'aberta' ? 'var(--primary)' : '#ccc'}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4>${c.clients?.name}</h4><span style="font-size:0.7rem; font-weight:bold; padding: 4px 10px; border-radius:20px; background:${c.status === 'aberta' ? 'var(--primary-light)' : '#eee'}">${c.status.toUpperCase()}</span>
                </div>
                <p>TKT: <b>${c.ticket || '-'}</b></p><div class="val">${U.money(c.total)}</div>
                <button class="btn-secondary" style="margin-top:15px;" onclick="Modals.open('edit_comanda', '${c.id}')">Ver/Editar Itens</button>
            </div>`).join('');
    },
    async mensagens() {
        const { data } = await db.from('message_templates').select('*');
        document.getElementById('mensagens-list').innerHTML = data.map(m => `<div class="card"><h4>${m.title}</h4><p>${m.content}</p><button class="btn-secondary" style="margin-top:10px; color:#d32f2f" onclick="Actions.deleteMensagem('${m.id}')">Excluir</button></div>`).join('');
    },
    
    // DASHBOARDS E INTELIGÊNCIA
    async despesas() {
        const { data } = await db.from('despesas').select('*').order('date', {ascending: false});
        document.getElementById('despesas-list').innerHTML = data.map(d => `<div class="card" style="display:flex; justify-content:space-between"><div><h4>${d.description}</h4><p>${d.category} • ${d.date}</p></div><div class="val" style="color:#d32f2f">-${U.money(d.amount)}</div></div>`).join('');
        if(App.charts.despesas) App.charts.despesas.destroy();
        const ctx = document.getElementById('chart-despesas');
        App.charts.despesas = new Chart(ctx, { type: 'bar', data: { labels: data.slice(0,5).map(d=>d.description), datasets: [{ label: 'Últimas Despesas', data: data.slice(0,5).map(d=>d.amount), backgroundColor: '#d32f2f' }] }});
    },
    async comissao() {
        const isOwner = App.role === 'owner';
        let query = db.from('comandas').select('*, users(name)');
        if(!isOwner) query = query.eq('user_id', App.user.id);
        const { data } = await query;
        
        let html = ''; let totalComissao = 0; let rank = {};
        data.forEach(c => {
            if(!c.items) return;
            c.items.forEach(i => {
                if(i.commission) {
                    const v = (i.price * i.commission) / 100;
                    totalComissao += v;
                    rank[c.users.name] = (rank[c.users.name]||0) + v;
                    if(!isOwner) html += `<div class="card"><h4>${i.name}</h4><p>TKT: ${c.ticket} • Calc: ${i.commission}%</p><div class="val" style="color:#2e7d32">+${U.money(v)}</div></div>`;
                }
            });
        });
        
        if(isOwner) {
            const sorted = Object.entries(rank).sort((a,b)=>b[1]-a[1]);
            html = `<div class="card" style="margin-bottom:15px; background:var(--primary); color:white"><h3 style="color:white">Total Geral de Comissões a Pagar</h3><div class="val" style="color:white; font-size:2rem">${U.money(totalComissao)}</div></div>
            <h3>Ranking de Comissionamento</h3><div class="data-grid" style="margin-top:10px">` + sorted.map((s,i) => `<div class="card"><h4>${i+1}º ${s[0]}</h4><div class="val">${U.money(s[1])}</div></div>`).join('') + '</div>';
        } else {
            html = `<div class="card" style="margin-bottom:15px; background:var(--primary); color:white"><h4 style="color:white">Meus Ganhos (Comissão)</h4><div class="val" style="color:white; font-size:2rem">${U.money(totalComissao)}</div></div><div class="data-list">` + html + `</div>`;
        }
        document.getElementById('comissao-dashboard').innerHTML = html;
    },
    async 'resumo-financeiro'() {
        const [ {data:comand}, {data:desp} ] = await Promise.all([db.from('comandas').select('total').eq('status', 'fechada'), db.from('despesas').select('description, amount')]);
        const receita = comand.reduce((acc, c) => acc + c.total, 0); const gasto = desp.reduce((acc, d) => acc + d.amount, 0); const lucro = receita - gasto;
        
        document.getElementById('resumo-cards').innerHTML = `
            <div class="card"><h4>Entradas Brutas</h4><div class="val" style="color:#2e7d32">${U.money(receita)}</div></div>
            <div class="card"><h4>Saídas/Custos</h4><div class="val" style="color:#d32f2f">-${U.money(gasto)}</div></div>
            ${lucro > 0 ? `<div class="card" style="background:#e8f5e9"><h4 style="color:#2e7d32">LUCRO</h4><div class="val" style="color:#2e7d32">${U.money(lucro)}</div></div>` : `<div class="card" style="background:#ffebee"><h4 style="color:#d32f2f">PREJUÍZO</h4><div class="val" style="color:#d32f2f">${U.money(lucro)}</div></div>`}`;
        
        document.getElementById('extrato-list').innerHTML = `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:10px 0;"><span style="color:#2e7d32; font-weight:bold">Vendas de Comandas</span><span style="color:#2e7d32; font-weight:bold">+${U.money(receita)}</span></div>` + desp.map(d => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:10px 0;"><span>${d.description}</span><span style="color:#d32f2f">-${U.money(d.amount)}</span></div>`).join('');
    },
    async performance() {
        const { data } = await db.from('comandas').select('*, users(name)').eq('status', 'fechada');
        const rank = {}; let ticketTotal = 0;
        data.forEach(c => { ticketTotal += c.total; if(c.users) rank[c.users.name] = (rank[c.users.name]||0) + c.total; });
        const tkMedio = data.length ? ticketTotal / data.length : 0;
        
        document.getElementById('perf-kpis').innerHTML = `<div class="card"><h4>Ticket Médio por Cliente</h4><div class="val">${U.money(tkMedio)}</div></div><div class="card"><h4>Comandas Fechadas</h4><div class="val">${data.length}</div></div>`;
        const sorted = Object.entries(rank).sort((a,b)=>b[1]-a[1]);
        document.getElementById('performance-ranking').innerHTML = sorted.map((s,i) => `<div class="card"><h4>${i+1}º ${s[0]}</h4><div class="val">${U.money(s[1])}</div></div>`).join('');
        
        if(App.charts.perf) App.charts.perf.destroy();
        App.charts.perf = new Chart(document.getElementById('chart-performance'), { type: 'bar', data: { labels: sorted.map(s=>s[0]), datasets: [{ label: 'Faturamento por Profissional', data: sorted.map(s=>s[1]), backgroundColor: '#B76E79' }] }});
    },
    configuracoes() {
        document.getElementById('cfg-name').value = App.settings.studio_name || '';
        document.getElementById('cfg-phone').value = App.settings.official_phone || '';
    }
};

const Modals = {
    async open(type, param1=null, param2=null) {
        const cont = document.getElementById('modal-container');
        let html = `<div class="modal"><button class="modal-close" onclick="Modals.close()"><i class="ph ph-x"></i></button>`;
        
        if(type === 'first_login') {
            html += `<h3>Crie sua Nova Senha</h3><p style="color:var(--muted); margin-bottom:1.5rem">Mude a senha padrão de fábrica para uma pessoal e intransferível.</p>
            <form onsubmit="Actions.updatePassword(event)"><div class="input-group"><input type="password" id="new-pass" required placeholder="Nova Senha"></div><button type="submit" class="btn-primary">Salvar Senha e Entrar</button></form>`;
        } 
        else if(type === 'whatsapp') {
            const { data: templates } = await db.from('message_templates').select('*');
            const tOpts = templates.map(t => `<option value="${t.content}">${t.title}</option>`).join('');
            html += `<h3>Nova Mensagem WhatsApp</h3>
            <div style="background:#f9f9f9; padding:15px; border-radius:12px; margin-bottom:15px;">
                <p style="font-size: 0.8rem; color: var(--muted); margin-bottom: 5px;">A mensagem será encaminhada para o WhatsApp vinculado ao número oficial do estúdio: <b style="color:var(--text)">${App.settings.official_phone || 'Não Configurado'}</b>.</p>
                <p style="font-size: 0.95rem;">Destinatário: <b class="text-primary">${param2}</b></p>
            </div>
            <div class="input-group"><label>Modelos Prontos</label><select onchange="document.getElementById('wpp-msg').value = this.value"><option value="">-- Escolher --</option>${tOpts}</select></div>
            <div class="input-group"><textarea id="wpp-msg" rows="4" placeholder="Sua mensagem..." required></textarea></div>
            <button class="btn-primary" style="background:#25D366;" onclick="Actions.sendWhatsApp('${param1}')">Gerar Envio no WhatsApp Web</button>`;
        }
        else if (type === 'edit_comanda') {
            const { data: comanda } = await db.from('comandas').select('*, clients(name)').eq('id', param1).single();
            const { data: servicos } = await db.from('services').select('*');
            const { data: produtos } = await db.from('products').select('*').gt('stock', 0);
            
            const isFechada = comanda.status === 'fechada';
            let htmlList = (comanda.items||[]).map(i => `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee"><span>${i.name}</span><b>${U.money(i.price)}</b></div>`).join('');
            
            html += `<h3>Ticket: ${comanda.ticket}</h3><p style="margin-bottom:15px">Cliente: <b>${comanda.clients?.name}</b></p>
            <div style="background:#fafafa; padding:15px; border-radius:12px; margin-bottom: 20px;">
                ${htmlList || '<p style="color:var(--muted)">Comanda Vazia.</p>'} 
                <h3 style="text-align:right; margin-top:10px; color:var(--primary-dark)">Total: ${U.money(comanda.total)}</h3>
            </div>`;
            
            if(!isFechada) {
                const sOpts = servicos.map(s => `<option value='{"id":"${s.id}","name":"${s.name}","price":${s.price},"commission":${s.commission},"type":"service"}'>SERVIÇO: ${s.name} - ${U.money(s.price)}</option>`).join('');
                const pOpts = produtos.map(p => `<option value='{"id":"${p.id}","name":"${p.name}","price":0,"type":"product"}'>PRODUTO (Uso): ${p.name} (Estq: ${p.stock})</option>`).join('');
                html += `<div class="input-group"><select id="add-item-sel"><option value="">-- Adicionar --</option>${sOpts}${pOpts}</select></div>
                <button class="btn-secondary" style="margin-bottom:15px" onclick="Actions.addComandaItem('${comanda.id}')">+ Lançar Item</button>
                <button class="btn-primary" style="background:#2e7d32;" onclick="Actions.closeComanda('${comanda.id}', '${comanda.client_id}', ${comanda.total}, '${comanda.ticket}')">Fechar Comanda e Faturar</button>`;
            } else if (App.role === 'owner') {
                html += `<button class="btn-secondary" style="color:#d32f2f" onclick="Actions.reopenComanda('${comanda.id}')">Reabrir Comanda (Reverte Dívida/Extrato)</button>`;
            }
        }
        else if(type === 'agendamento') {
            const [c, s, u] = await Promise.all([db.from('clients').select('id,name'), db.from('services').select('id,name,price,has_assistant'), db.from('users').select('id,name').neq('username', 'admin.teste')]);
            const sOpts = s.data.map(x => `<option value="${x.id}" data-aux="${x.has_assistant}">${x.name}</option>`).join('');
            html += `<h3>Novo Agendamento</h3><form onsubmit="Actions.createAppointment(event)">
                <div class="input-group"><select id="fa-cli" required><option value="">-- Cliente --</option>${c.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div class="input-group"><select id="fa-serv" required onchange="document.getElementById('aux-div').style.display = this.options[this.selectedIndex].dataset.aux==='true'?'block':'none'"><option value="">-- Serviço --</option>${sOpts}</select></div>
                <div class="input-group"><select id="fa-user" required><option value="">-- Profissional Principal --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div class="input-group" id="aux-div" style="display:none"><select id="fa-aux"><option value="">-- Auxiliar (Se necessário) --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div style="display:flex; gap:10px;"><input type="date" id="fa-date" class="input-group" style="flex:1" required><input type="time" id="fa-time" class="input-group" style="flex:1" required></div>
                <button type="submit" class="btn-primary">Agendar</button></form>`;
        }
        else if(type === 'comanda') {
            const { data } = await db.from('clients').select('id, name');
            html += `<h3>Abrir Nova Comanda</h3><form onsubmit="Actions.createComanda(event)">
                <div class="input-group"><select id="fcom-cli" required><option value="">-- Buscar Cliente --</option>${data.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <button type="submit" class="btn-primary">Gerar Ticket/Comanda</button></form>`;
        }
        else if(type === 'servico') {
            html += `<h3>Cadastrar Serviço</h3><form onsubmit="Actions.createService(event)">
                <div class="input-group"><input type="text" id="fs-nome" placeholder="Nome" required></div>
                <div style="display:flex; gap:10px;"><input type="number" id="fs-valor" placeholder="Valor Final" step="0.01" class="input-group" required><input type="number" id="fs-custo" placeholder="Custo de Insumo" step="0.01" class="input-group" required></div>
                <div class="input-group"><input type="number" id="fs-com" placeholder="Comissão Prof. Principal (%)" max="100" required></div>
                <div class="input-group"><label><input type="checkbox" id="fs-aux" onchange="document.getElementById('aux-com-div').style.display=this.checked?'block':'none'"> Há Auxiliar para este Serviço?</label></div>
                <div class="input-group" id="aux-com-div" style="display:none"><input type="number" id="fs-auxcom" placeholder="Comissão do Auxiliar (%)" max="100"></div>
                <button type="submit" class="btn-primary">Salvar no Catálogo</button></form>`;
        }
        else if(type === 'produto') {
            html += `<h3>Novo Produto</h3><form onsubmit="Actions.saveProduct(event)">
                <div class="input-group"><label>Cód. Barras (Digite para buscar infos automaticamente)</label><input type="text" id="fp-bar" oninput="Actions.fetchBarcode(this.value)" required></div>
                <div class="input-group"><input type="text" id="fp-nome" placeholder="Nome do Produto" required></div>
                <div style="display:flex; gap:10px;"><input type="number" id="fp-qtd" placeholder="Qtd Estoque" class="input-group" required><input type="number" id="fp-min" placeholder="Alerta Mínimo" value="5" class="input-group" required></div>
                <button type="submit" class="btn-primary">Salvar</button></form>`;
        }
        else if(type === 'add_estoque') {
            html += `<h3>Adicionar ao Estoque</h3><form onsubmit="Actions.updateStock(event, '${param1}', ${param2})">
                <div class="input-group"><label>Estoque Atual: ${param2}</label><input type="number" id="fa-qtd" placeholder="Quantidade a somar" required min="1"></div>
                <button type="submit" class="btn-primary">Atualizar</button></form>`;
        }
        else if(type === 'despesa') {
            html += `<h3>Registrar Despesa</h3><form onsubmit="Actions.createDespesa(event)">
                <div class="input-group"><input type="text" id="fd-desc" placeholder="Descrição (Ex: Luz, Água, Produtos)" required></div>
                <div class="input-group"><select id="fd-cat" required><option value="Fixo">Custo Fixo</option><option value="Variavel">Custo Variável / Insumo</option></select></div>
                <div class="input-group"><input type="number" id="fd-val" placeholder="Valor R$" step="0.01" required></div>
                <button type="submit" class="btn-primary">Salvar e Abater do Caixa</button></form>`;
        }
        else if(type === 'mensagem') {
            html += `<h3>Novo Template de Mensagem</h3><form onsubmit="Actions.createMensagem(event)">
                <div class="input-group"><input type="text" id="fm-tit" placeholder="Título Breve" required></div>
                <div class="input-group"><textarea id="fm-txt" placeholder="Texto da mensagem" rows="4" required></textarea></div>
                <button type="submit" class="btn-primary">Salvar Template</button></form>`;
        }
        else if(type === 'debitar' || type === 'desconto') {
            html += `<h3>${type==='debitar'?'Debitar Valor Recebido':'Dar Desconto'}</h3><p>Restante da Dívida: ${U.money(param2)}</p>
            <form onsubmit="Actions.${type==='debitar'?'debitDebt':'discountDebt'}(event, '${param1}', ${param2})">
                <div class="input-group"><input type="number" id="f-val" step="0.01" required placeholder="${type==='debitar'?'Valor Pago em R$':'Desconto em %'}"></div>
                <button type="submit" class="btn-primary">Confirmar Transação</button></form>`;
        }
        else if(type === 'nova_anamnese') {
            html += `<h3>Nova Avaliação</h3><form onsubmit="Actions.saveAnamnese(event)">
            <div class="input-group"><textarea id="fa-hist" placeholder="Histórico Capilar (Ex: Química anterior)" required></textarea></div>
            <div class="input-group"><textarea id="fa-hab" placeholder="Hábitos (Shampoo, Frequência, Secador)" required></textarea></div>
            <div class="input-group"><textarea id="fa-obj" placeholder="Objetivos da cliente" required></textarea></div>
            <div class="input-group"><textarea id="fa-obs" placeholder="Análise e Diagnóstico do Fio" required></textarea></div>
            <button type="submit" class="btn-primary">Salvar no Histórico</button></form>`;
        }
        else if(type === 'cliente') {
            html += `<h3>Novo Cliente</h3><form onsubmit="Actions.createClient(event)"><div class="input-group"><input type="text" id="fc-nome" placeholder="Nome Completo" required></div><div class="input-group"><input type="text" id="fc-fone" placeholder="WhatsApp (Somente números)" required></div><button type="submit" class="btn-primary">Salvar e Prosseguir</button></form>`;
        }
        html += `</div>`; cont.innerHTML = html; cont.classList.remove('hidden');
    },
    close() { document.getElementById('modal-container').classList.add('hidden'); }
};

const Actions = {
    async updatePassword(e) {
        e.preventDefault(); const { error } = await db.from('users').update({ password: document.getElementById('new-pass').value, first_login: false }).eq('id', App.user.id);
        if(!error) { App.user.first_login = false; Modals.close(); UI.toast('Senha registrada!'); Auth.success(); }
    },
    async createClient(e) { e.preventDefault(); await db.from('clients').insert({ name: document.getElementById('fc-nome').value, phone: document.getElementById('fc-fone').value }); Modals.close(); UI.toast('Cliente salvo!'); },
    
    async saveAnamnese(e) {
        e.preventDefault(); const id = document.getElementById('current-anamnese-client-id').value;
        await db.from('anamnesis').insert({ client_id: id, history: document.getElementById('fa-hist').value, habits: document.getElementById('fa-hab').value, objectives: document.getElementById('fa-obj').value, notes: document.getElementById('fa-obs').value });
        UI.toast('Avaliação arquivada!'); Modals.close(); this.loadAnamnese(id);
    },
    async loadAnamnese(id) {
        const { data } = await db.from('anamnesis').select('*').eq('client_id', id).order('created_at', {ascending: false});
        const div = document.getElementById('anamnese-history-list');
        if(!data || !data.length) { div.innerHTML = "<p>Sem histórico clínico prévio.</p>"; return; }
        div.innerHTML = data.map(d => `<div class="card"><h4 style="font-size:0.9rem">Data da Avaliação: ${new Date(d.created_at).toLocaleDateString()}</h4><p><b>Histórico:</b> ${d.history}</p><p><b>Hábitos:</b> ${d.habits}</p><p><b>Objetivo:</b> ${d.objectives}</p><p><b>Diagnóstico:</b> ${d.notes}</p></div>`).join('');
    },

    async createAppointment(e) {
        e.preventDefault(); const auxId = document.getElementById('fa-aux').value;
        await db.from('appointments').insert({ client_id: document.getElementById('fa-cli').value, service_id: document.getElementById('fa-serv').value, user_id: document.getElementById('fa-user').value, assistant_id: auxId || null, date: document.getElementById('fa-date').value, time: document.getElementById('fa-time').value });
        Modals.close(); UI.toast('Horário Agendado!');
    },

    // A Mágica da Comanda e Dívida
    async createComanda(e) {
        e.preventDefault(); const { data } = await db.from('comandas').select('ticket').order('id', {ascending: false}).limit(1);
        let nxt = 1; if(data.length && data[0].ticket) { nxt = parseInt(data[0].ticket.split('-')[1]) + 1; }
        const tk = 'TKT-' + String(nxt).padStart(4, '0');
        await db.from('comandas').insert({ client_id: document.getElementById('fcom-cli').value, user_id: App.user.id, ticket: tk });
        Modals.close(); UI.toast(`Comanda ${tk} Aberta!`);
    },
    async addComandaItem(id) {
        const val = document.getElementById('add-item-sel').value; if(!val) return;
        const item = JSON.parse(val); const { data: comanda } = await db.from('comandas').select('items, total').eq('id', id).single();
        const items = comanda.items || []; items.push(item);
        
        // Se for Produto, reduz do estoque imediatamente
        if(item.type === 'product') {
            const { data: prod } = await db.from('products').select('stock').eq('id', item.id).single();
            await db.from('products').update({stock: Math.max(0, prod.stock - 1)}).eq('id', item.id);
        }
        
        await db.from('comandas').update({ items, total: comanda.total + item.price }).eq('id', id);
        Modals.open('edit_comanda', id); UI.toast('Lançado na comanda!');
    },
    async closeComanda(comandaId, clientId, total, ticketNum) {
        UI.confirm('Faturar esta comanda e fechar o atendimento?', async () => {
            await db.from('comandas').update({ status: 'fechada' }).eq('id', comandaId);
            if(total > 0) {
                // Ao fechar com valor, lança débito atrelado a este Ticket
                await db.from('debts').insert({ client_id: clientId, total_amount: total, remaining_amount: total, comanda_id: comandaId, comanda_ticket: ticketNum });
            }
            Modals.close(); UI.toast(`Comanda Faturada e lançada em Cobranças.`);
        });
    },
    async reopenComanda(id) {
        UI.confirm('Isso vai reabrir a comanda e excluir a dívida pendente. Continuar?', async () => {
            // Exclui a dívida ligada a esta comanda, pois ela não está mais fechada
            await db.from('debts').delete().eq('comanda_id', id);
            await db.from('comandas').update({ status: 'aberta' }).eq('id', id);
            Modals.close(); UI.toast('Comanda Reaberta e Dívida Anulada!');
        });
    },

    async createService(e) {
        e.preventDefault(); const aux = document.getElementById('fs-aux').checked;
        await db.from('services').insert({ name: document.getElementById('fs-nome').value, price: document.getElementById('fs-valor').value, cost: document.getElementById('fs-custo').value, commission: document.getElementById('fs-com').value, has_assistant: aux, assistant_commission: aux ? document.getElementById('fs-auxcom').value : 0 });
        Modals.close(); UI.toast('Catálogo Atualizado!');
    },
    
    // Integração Pública Código de Barras (OpenFoodFacts - Free API Example)
    async fetchBarcode(val) {
        if(val.length >= 8) {
            try {
                const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${val}.json`);
                const json = await res.json();
                if(json.status === 1 && json.product.product_name) {
                    document.getElementById('fp-nome').value = json.product.product_name;
                    UI.toast('Informações do produto encontradas na nuvem!');
                }
            } catch(e) { /* silent fail on free API */ }
        }
    },
    async saveProduct(e) { e.preventDefault(); await db.from('products').insert({ barcode: document.getElementById('fp-bar').value, name: document.getElementById('fp-nome').value, stock: document.getElementById('fp-qtd').value, min_stock: document.getElementById('fp-min').value }); Modals.close(); UI.toast('Produto estocado!'); },
    async updateStock(e, id, curStock) {
        e.preventDefault(); const v = parseInt(document.getElementById('fa-qtd').value);
        await db.from('products').update({stock: curStock + v}).eq('id', id); Modals.close(); UI.toast('Estoque Reposto!');
    },

    async createMensagem(e) { e.preventDefault(); await db.from('message_templates').insert({ title: document.getElementById('fm-tit').value, content: document.getElementById('fm-txt').value }); Modals.close(); UI.toast('Template salvo!'); },
    async deleteMensagem(id) { UI.confirm('Excluir este template?', async () => { await db.from('message_templates').delete().eq('id', id); UI.toast('Template Excluído!'); }); },

    async createDespesa(e) { e.preventDefault(); await db.from('despesas').insert({ description: document.getElementById('fd-desc').value, amount: document.getElementById('fd-val').value, category: document.getElementById('fd-cat').value }); Modals.close(); UI.toast('Saída financeira registrada!'); },

    async debitDebt(e, id, max) { e.preventDefault(); const v = parseFloat(document.getElementById('f-val').value); await db.from('debts').update({ remaining_amount: Math.max(0, max - v) }).eq('id', id); Modals.close(); UI.toast('Pagamento Recebido e Abatido!'); },
    async discountDebt(e, id, max) { e.preventDefault(); const perc = parseFloat(document.getElementById('f-val').value); await db.from('debts').update({ remaining_amount: Math.max(0, max - (max * perc / 100)) }).eq('id', id); Modals.close(); UI.toast('Desconto concedido!'); },

    async saveSettings(e) {
        e.preventDefault(); const n = document.getElementById('cfg-name').value; const p = document.getElementById('cfg-phone').value;
        const payload = { studio_name: n, official_phone: p };
        if(App.settings.id) await db.from('settings').update(payload).eq('id', App.settings.id);
        else await db.from('settings').insert(payload);
        App.settings.studio_name = n; App.settings.official_phone = p; document.getElementById('brand-name').textContent = n;
        UI.toast('Configurações Salvas no Banco de Dados!');
    },

    sendWhatsApp(phone) {
        const msg = document.getElementById('wpp-msg').value; if(!msg) return UI.toast('Digite a mensagem.', 'error');
        Modals.close();
        const cleanPhone = phone.replace(/\D/g, '');
        // A API de Client URL direciona o cliente no dispositivo usando o App / Web do WhatsApp.
        window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
