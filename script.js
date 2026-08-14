/** 
 * SISTEMA ESTÚDIO AMOR QUE CUIDA - VERSÃO DEFINITIVA FULL
 * Integração Realtime, APIs Externas e Dashboards Avançados
 */

const DB_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';
const db = window.supabase.createClient(DB_URL, DB_KEY);

const App = { user: null, role: 'freelancer', view: 'agenda', currentDate: new Date(), charts: {}, settings: {} };

const U = {
    money: v => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v||0),
    iso: d => { 
        const tzOffset = d.getTimezoneOffset() * 60000;
        return (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0];
    }
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
        const modal = document.getElementById('custom-confirm'); 
        modal.classList.remove('hidden');
        modal.style.zIndex = "999999"; // Correção: Garante que fique na frente de todas as telas
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
        else this.toast('Utilize os painéis na tela para adicionar itens aqui.', 'error');
    }
};

const Auth = {
    init() { document.getElementById('login-form').onsubmit = e => { e.preventDefault(); this.login(); }; },
    async login() {
        const u = document.getElementById('username').value.trim(); 
        const p = document.getElementById('password').value;
        const btn = document.getElementById('btn-login'); btn.textContent = 'Aguarde...';
        try {
            const { data, error } = await db.from('users').select('*').eq('username', u).single();
            if (error || !data) throw new Error("Usuário não encontrado.");
            if (data.password !== p) throw new Error("Senha incorreta.");
            
            App.user = data; App.role = data.role;
            
            if(data.first_login) { 
                Modals.open('first_login'); 
                btn.textContent = 'Entrar'; 
                return; 
            }
            this.success();
        } catch(e) { UI.toast(e.message, 'error'); btn.textContent = 'Entrar'; }
    },
    async success() {
        document.getElementById('auth-layer').classList.add('hidden'); 
        document.getElementById('system-layout').classList.remove('hidden');
        document.getElementById('header-user').textContent = App.user.name; 
        document.getElementById('header-avatar').textContent = App.user.name.substring(0,2).toUpperCase();
        document.body.classList.toggle('is-owner', App.role === 'owner');
        
        const { data: set } = await db.from('settings').select('*').single();
        if(set) { App.settings = set; document.getElementById('brand-name').textContent = set.studio_name; }
        
        Nav.init(); Nav.showView('agenda');
        
        // Sincronismo Realtime
        db.channel('custom-all-channel')
          .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
              if(Render[App.view]) Render[App.view]();
              UI.toast('Sistema atualizado.', 'success');
          }).subscribe();
    },
    logout() { UI.confirm('Até logo! Deseja realmente sair do sistema?', () => location.reload()); }
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
        
        const titles = { agenda:'Agenda', comandas:'Comandas', cobrancas:'Cobranças', clientes:'Clientes', anamnese:'Anamnese', servicos:'Serviços', produtos:'Estoque e Vendas', comissao:'Comissionamento', mensagens:'Mensagens Automáticas', despesas:'Gestão de Despesas', 'resumo-financeiro':'Fluxo de Caixa', performance:'Métricas e Resultados', configuracoes:'Ajustes do Sistema' };
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
        if(!data || !data.length) { cont.innerHTML = `<div class="card" style="text-align:center; padding:3rem"><p style="color:var(--muted)">Sua agenda está livre neste dia.</p></div>`; return; }
        cont.innerHTML = data.map(a => `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--primary)">
            <div><h4 style="font-size:1.2rem">${a.time} - ${a.clients?.name}</h4><p style="margin:5px 0">${a.services?.name}</p><p style="font-size:0.8rem">Prof: <b>${a.users?.name}</b></p></div>
            <div style="background:var(--primary-light); color:var(--primary-dark); padding:5px 12px; border-radius:20px; font-size:0.8rem; font-weight:bold">${a.status.toUpperCase()}</div>
        </div>`).join('');
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
        const { data } = await db.from('clients').select('*').order('name');
        document.getElementById('clientes-list').innerHTML = data.map(c => `
            <div class="card">
                <a href="#" class="wpp-btn" onclick="Modals.open('whatsapp', '${c.phone}', '${c.name}'); event.stopPropagation()"><i class="ph ph-whatsapp-logo"></i></a>
                <h4 style="color:var(--primary); font-size:1.2rem; margin-bottom:10px">${c.name}</h4><p><i class="ph ph-phone"></i> ${c.phone}</p>
                <button class="btn-secondary" style="margin-top:15px; width:100%" onclick="Render.anamnese('${c.id}', '${c.name}')"><i class="ph ph-file-text"></i> Histórico / Anamnese</button>
            </div>`).join('');
    },
    anamnese(id, name) {
        document.getElementById('current-anamnese-client-id').value = id;
        document.getElementById('anamnese-title').textContent = `Ficha: ${name}`;
        Nav.showView('anamnese'); Actions.loadAnamnese(id);
    },
    async cobrancas() {
        const { data } = await db.from('debts').select('*, clients(name)').gt('remaining_amount', 0);
        if(!data.length) { document.getElementById('cobrancas-list').innerHTML = "<p>Nenhuma cobrança pendente.</p>"; return; }
        
        document.getElementById('cobrancas-list').innerHTML = data.map(d => `
            <div class="card"><div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <div><p style="font-size:0.75rem; color:var(--muted); font-weight:bold; letter-spacing:1px">REF: ${d.comanda_ticket || 'MANUAL'}</p><h4 style="font-size:1.3rem">${d.clients?.name || 'Cliente Removido'}</h4></div>
                <div class="val" style="color:#d32f2f; font-size:1.5rem">${U.money(d.remaining_amount)}</div>
            </div>
            <div style="display:flex; gap:10px;"><button class="btn-primary" style="padding:0.8rem; font-size:0.9rem" onclick="Modals.open('debitar', '${d.id}', ${d.remaining_amount})">Receber Pagamento</button>
            ${App.role==='owner' ? `<button class="btn-secondary" style="padding:0.8rem; font-size:0.9rem" onclick="Modals.open('desconto', '${d.id}', ${d.remaining_amount})">Desconto %</button>` : ''}
            </div></div>`).join('');
    },
    async servicos() {
        const { data } = await db.from('services').select('*').order('name');
        document.getElementById('servicos-list').innerHTML = data.map(s => `<div class="card"><h4 style="font-size:1.2rem; border-bottom:1px solid #eee; padding-bottom:10px">${s.name}</h4><div style="margin:10px 0"><p>Comissão: <b>${s.commission}%</b></p>${s.has_assistant?`<p>Auxiliar: <b>${s.assistant_commission}%</b></p>`:''}</div><div class="val" style="font-size:1.5rem">${U.money(s.price)}</div></div>`).join('');
    },
    async produtos() {
        const { data } = await db.from('products').select('*').order('name');
        document.getElementById('produtos-list').innerHTML = data.map(p => `
            <div class="card" style="border-top: 4px solid ${p.stock <= p.min_stock ? '#d32f2f' : 'var(--primary)'}">
                <h4 style="font-size:1.1rem; margin-bottom:5px">${p.name}</h4>
                <p style="font-size:0.8rem">EAN: ${p.barcode}</p>
                <div style="margin:10px 0; background:#f9f9f9; padding:10px; border-radius:8px">
                    <p>Preço Venda: <b>${U.money(p.price)}</b></p>
                    <p>Comissão Venda: <b>${p.commission}%</b></p>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px">
                    <div class="val" style="font-size:1.2rem; color:${p.stock <= p.min_stock ? '#d32f2f' : 'var(--text)'}">Estoque: ${p.stock} un.</div>
                    <button class="btn-secondary" style="width:auto; padding:0.6rem 1rem" onclick="Modals.open('add_estoque', '${p.id}', '${p.stock}')">+ Repor</button>
                </div>
            </div>`).join('');
    },
    async comandas() {
        const { data } = await db.from('comandas').select('*, clients(name), users(name)').order('created_at', {ascending: false});
        document.getElementById('comandas-list').innerHTML = data.map(c => `
            <div class="card" style="border-left: 5px solid ${c.status === 'aberta' ? 'var(--primary)' : '#ccc'}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div><span style="font-size:0.75rem; color:var(--muted); font-weight:bold; letter-spacing:1px">${c.ticket || 'TKT-0000'}</span><h4 style="font-size:1.2rem; margin-top:5px">${c.clients?.name}</h4></div>
                    <span style="font-size:0.7rem; font-weight:bold; padding: 4px 10px; border-radius:20px; background:${c.status === 'aberta' ? 'var(--primary-light)' : '#eee'}">${c.status.toUpperCase()}</span>
                </div>
                <div class="val" style="font-size:1.6rem; margin:15px 0;">${U.money(c.total)}</div>
                <button class="btn-secondary" style="width:100%; padding:0.8rem" onclick="Modals.open('edit_comanda', '${c.id}')"><i class="ph ph-list-plus"></i> Abrir Ticket</button>
            </div>`).join('');
    },
    async mensagens() {
        const { data } = await db.from('message_templates').select('*');
        document.getElementById('mensagens-list').innerHTML = data.map(m => `
            <div class="card"><h4 style="color:var(--primary); border-bottom:1px solid #eee; padding-bottom:10px">${m.title}</h4>
            <p style="margin:15px 0; font-style:italic">"${m.content}"</p>
            <div style="display:flex; gap:10px">
                <button class="btn-secondary" style="flex:1" onclick="Modals.open('edit_mensagem', '${m.id}')"><i class="ph ph-pencil"></i></button>
                <button class="btn-secondary" style="flex:1; color:#d32f2f; background:#ffebee" onclick="Actions.deleteMensagem('${m.id}')"><i class="ph ph-trash"></i></button>
            </div></div>`).join('');
    },
    
    // DASHBOARDS E INTELIGÊNCIA MELHORADOS
    async despesas() {
        const { data } = await db.from('despesas').select('*').order('date', {ascending: false});
        
        let totalFixo = 0; let totalVar = 0;
        data.forEach(d => { if(d.category === 'Fixo') totalFixo += d.amount; else totalVar += d.amount; });
        
        document.getElementById('despesas-list').innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px">
                <div class="card" style="padding:1rem; text-align:center"><p style="font-size:0.8rem">Custos Fixos</p><div class="val" style="color:#d32f2f; font-size:1.2rem">-${U.money(totalFixo)}</div></div>
                <div class="card" style="padding:1rem; text-align:center"><p style="font-size:0.8rem">Variáveis / Insumos</p><div class="val" style="color:#e65100; font-size:1.2rem">-${U.money(totalVar)}</div></div>
            </div>` + 
            data.map(d => `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:3px solid ${d.category==='Fixo'?'#d32f2f':'#e65100'}">
                <div><h4>${d.description}</h4><p style="font-size:0.8rem">${d.category} • Data: ${U.date(d.date)}</p></div>
                <div class="val" style="color:#d32f2f">-${U.money(d.amount)}</div>
            </div>`).join('');
            
        if(App.charts.despesas) App.charts.despesas.destroy();
        App.charts.despesas = new Chart(document.getElementById('chart-despesas'), { 
            type: 'doughnut', 
            data: { labels: ['Custos Fixos', 'Custos Variáveis'], datasets: [{ data: [totalFixo, totalVar], backgroundColor: ['#d32f2f', '#e65100'] }] }
        });
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
                    if(c.users) rank[c.users.name] = (rank[c.users.name]||0) + v;
                    if(!isOwner) html += `<div class="card" style="display:flex; justify-content:space-between; align-items:center"><div><h4>${i.name}</h4><p>TKT: ${c.ticket||'-'} • Taxa: ${i.commission}%</p></div><div class="val" style="color:#2e7d32">+${U.money(v)}</div></div>`;
                }
            });
        });
        
        if(isOwner) {
            const sorted = Object.entries(rank).sort((a,b)=>b[1]-a[1]);
            html = `<div class="card" style="margin-bottom:15px; background:var(--primary); color:white; padding:2rem"><h3 style="color:white; opacity:0.9">Total Estimado p/ Pagamento</h3><div class="val" style="color:white; font-size:2.5rem">${U.money(totalComissao)}</div></div>
            <h3 style="margin:20px 0 10px 0">Detalhamento por Profissional</h3><div class="data-grid">` + 
            sorted.map((s,i) => `<div class="card"><div style="display:flex; justify-content:space-between; align-items:center"><h4 style="font-size:1.1rem">${i+1}º ${s[0]}</h4><i class="ph ph-medal" style="color:${i===0?'#ffd700':(i===1?'#c0c0c0':'#cd7f32')}; font-size:1.5rem"></i></div><div class="val" style="margin-top:10px; font-size:1.5rem">${U.money(s[1])}</div></div>`).join('') + '</div>';
        } else {
            html = `<div class="card" style="margin-bottom:15px; background:var(--primary); color:white"><h4 style="color:white">Minhas Comissões (Acumulado)</h4><div class="val" style="color:white; font-size:2.5rem">${U.money(totalComissao)}</div></div><div class="data-list">` + html + `</div>`;
        }
        document.getElementById('comissao-dashboard').innerHTML = html;
    },
    async 'resumo-financeiro'() {
        const [ {data:comand}, {data:desp} ] = await Promise.all([db.from('comandas').select('total, ticket').eq('status', 'fechada'), db.from('despesas').select('description, amount, date')]);
        const receita = comand.reduce((acc, c) => acc + c.total, 0); 
        const gasto = desp.reduce((acc, d) => acc + d.amount, 0); 
        const lucro = receita - gasto;
        
        document.getElementById('resumo-cards').innerHTML = `
            <div class="card" style="border-bottom:4px solid #2e7d32"><h4>Entradas (Bruto)</h4><div class="val" style="color:#2e7d32">${U.money(receita)}</div></div>
            <div class="card" style="border-bottom:4px solid #d32f2f"><h4>Saídas (Custos)</h4><div class="val" style="color:#d32f2f">-${U.money(gasto)}</div></div>
            <div class="card" style="background:${lucro>=0?'#e8f5e9':'#ffebee'}; border:1px solid ${lucro>=0?'#c8e6c9':'#ffcdd2'}"><h4 style="color:${lucro>=0?'#2e7d32':'#d32f2f'}">${lucro>=0?'LUCRO LÍQUIDO':'PREJUÍZO'}</h4><div class="val" style="color:${lucro>=0?'#2e7d32':'#d32f2f'}; font-size:1.8rem">${U.money(lucro)}</div></div>`;
        
        // Tabela Extrato
        let extratoHtml = '';
        comand.forEach(c => { if(c.total>0) extratoHtml += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:12px 0;"><div><b style="color:#2e7d32">Receita</b><p style="font-size:0.8rem; color:var(--muted)">Comanda ${c.ticket||'-'}</p></div><span style="color:#2e7d32; font-weight:bold; font-size:1.1rem">+${U.money(c.total)}</span></div>`; });
        desp.forEach(d => { extratoHtml += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:12px 0;"><div><b style="color:#d32f2f">Despesa</b><p style="font-size:0.8rem; color:var(--muted)">${d.description} (${U.date(d.date)})</p></div><span style="color:#d32f2f; font-weight:bold; font-size:1.1rem">-${U.money(d.amount)}</span></div>`; });
        
        document.getElementById('extrato-list').innerHTML = extratoHtml || '<p style="text-align:center; padding:1rem; color:var(--muted)">Nenhuma movimentação registrada.</p>';
    },
    async performance() {
        const { data } = await db.from('comandas').select('*, users(name), items').eq('status', 'fechada');
        
        let rankFunc = {}; let rankServ = {}; let totalFaturamento = 0;
        
        data.forEach(c => { 
            totalFaturamento += c.total; 
            if(c.users) rankFunc[c.users.name] = (rankFunc[c.users.name]||0) + c.total; 
            
            if(c.items) {
                c.items.forEach(i => {
                    rankServ[i.name] = rankServ[i.name] || { qtd: 0, receita: 0 };
                    rankServ[i.name].qtd += 1;
                    rankServ[i.name].receita += i.price;
                });
            }
        });
        
        const tkMedio = data.length ? totalFaturamento / data.length : 0;
        
        document.getElementById('perf-kpis').innerHTML = `
            <div class="card" style="text-align:center"><h4>Ticket Médio</h4><div class="val" style="font-size:1.8rem">${U.money(tkMedio)}</div></div>
            <div class="card" style="text-align:center"><h4>Atendimentos Concluídos</h4><div class="val" style="font-size:1.8rem; color:var(--text)">${data.length}</div></div>`;
            
        const sortedFunc = Object.entries(rankFunc).sort((a,b)=>b[1]-a[1]);
        document.getElementById('performance-ranking').innerHTML = `<h3 style="grid-column: 1 / -1; margin-bottom:5px">Faturamento por Equipe</h3>` + 
            sortedFunc.map((s,i) => `<div class="card"><h4>${i+1}º ${s[0]}</h4><div class="val">${U.money(s[1])}</div></div>`).join('');
            
        const sortedServ = Object.entries(rankServ).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0, 5); // Top 5
        
        if(App.charts.perf) App.charts.perf.destroy();
        App.charts.perf = new Chart(document.getElementById('chart-performance'), { 
            type: 'bar', 
            data: { labels: sortedServ.map(s=>s[0]), datasets: [{ label: 'Top 5 Serviços Mais Realizados (Qtd)', data: sortedServ.map(s=>s[1].qtd), backgroundColor: '#B76E79', borderRadius: 8 }] },
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
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
            html += `<h3>Crie sua Nova Senha</h3><p style="color:var(--muted); margin-bottom:1.5rem">Mude a senha padrão de fábrica para uma pessoal.</p>
            <form onsubmit="Actions.updatePassword(event)"><div class="input-group"><input type="password" id="new-pass" required placeholder="Nova Senha Segura"></div><button type="submit" class="btn-primary">Salvar e Entrar</button></form>`;
        } 
        else if(type === 'whatsapp') {
            const { data: templates } = await db.from('message_templates').select('*');
            const tOpts = templates.map(t => `<option value="${t.content}">${t.title}</option>`).join('');
            html += `<h3>Envio de WhatsApp</h3>
            <div style="background:#f9f9f9; padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid #eee">
                <p style="font-size: 0.8rem; color: var(--muted); margin-bottom: 5px;"><i class="ph ph-info"></i> O sistema preparará a mensagem para o número oficial configurado: <b style="color:var(--text)">${App.settings.official_phone || 'N/A'}</b>.</p>
                <p style="font-size: 0.95rem;">Cliente: <b class="text-primary">${param2}</b></p>
            </div>
            <div class="input-group"><label>Modelos Automáticos</label><select onchange="document.getElementById('wpp-msg').value = this.value"><option value="">-- Personalizado --</option>${tOpts}</select></div>
            <div class="input-group"><textarea id="wpp-msg" rows="5" placeholder="Digite aqui o que deseja enviar..." required></textarea></div>
            <button class="btn-primary" style="background:#25D366; font-size:1.1rem" onclick="Actions.sendWhatsApp('${param1}')"><i class="ph ph-whatsapp-logo"></i> Abrir WhatsApp</button>`;
        }
        else if (type === 'edit_comanda') {
            const { data: comanda } = await db.from('comandas').select('*, clients(name)').eq('id', param1).single();
            const { data: servicos } = await db.from('services').select('*');
            const { data: produtos } = await db.from('products').select('*').gt('stock', 0);
            
            const isFechada = comanda.status === 'fechada';
            let htmlList = (comanda.items||[]).map((i, idx) => `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee">
                <div><span style="font-size:0.7rem; background:#eee; padding:3px 6px; border-radius:10px; margin-right:5px">${i.type==='product'?'PROD':'SERV'}</span><span>${i.name}</span></div>
                <div style="display:flex; align-items:center; gap:15px"><b style="font-size:1.1rem">${U.money(i.price)}</b> ${!isFechada ? `<button onclick="Actions.removeComandaItem('${comanda.id}', ${idx})" style="background:none; border:none; color:#d32f2f; cursor:pointer"><i class="ph ph-trash"></i></button>`:''}</div>
            </div>`).join('');
            
            html += `<h3 style="margin-bottom:0">Ticket: <span style="color:var(--primary)">${comanda.ticket || '-'}</span></h3>
            <p style="margin-bottom:15px; font-size:1.1rem">Cliente: <b>${comanda.clients?.name}</b></p>
            <div style="background:#fafafa; padding:15px; border-radius:12px; margin-bottom: 20px; border:1px solid #e0e0e0">
                ${htmlList || '<p style="color:var(--muted); text-align:center; padding:1rem 0">Nenhum item lançado na comanda.</p>'} 
                <h3 style="text-align:right; margin-top:15px; color:var(--primary-dark); font-size:1.5rem">Total: ${U.money(comanda.total)}</h3>
            </div>`;
            
            if(!isFechada) {
                const sOpts = servicos.map(s => `<option value='{"id":"${s.id}","name":"${s.name}","price":${s.price},"commission":${s.commission},"type":"service"}'>${s.name} - ${U.money(s.price)}</option>`).join('');
                const pOpts = produtos.map(p => `<option value='{"id":"${p.id}","name":"${p.name}","price":${p.price},"commission":${p.commission},"type":"product"}'>[ESTOQUE] ${p.name} - ${U.money(p.price)}</option>`).join('');
                html += `
                <div style="display:flex; gap:10px; margin-bottom:20px">
                    <select id="add-item-sel" class="input-group" style="margin:0; flex:1"><option value="">-- Lançar Serviço ou Produto --</option><optgroup label="Serviços">${sOpts}</optgroup><optgroup label="Produtos em Estoque">${pOpts}</optgroup></select>
                    <button class="btn-secondary" style="width:auto; padding:0 1.5rem; background:var(--primary-light); color:var(--primary)" onclick="Actions.addComandaItem('${comanda.id}')"><i class="ph ph-plus"></i></button>
                </div>
                <button class="btn-primary" style="background:#2e7d32; padding:1.2rem; font-size:1.1rem" onclick="Actions.closeComanda('${comanda.id}', '${comanda.client_id}', ${comanda.total}, '${comanda.ticket}')"><i class="ph ph-check-circle"></i> Fechar Comanda e Faturar</button>`;
            } else if (App.role === 'owner') {
                html += `<button class="btn-secondary" style="color:#d32f2f; padding:1.2rem" onclick="Actions.reopenComanda('${comanda.id}')"><i class="ph ph-warning-circle"></i> Reabrir Comanda (Aviso: Reverte cobranças e estornos)</button>`;
            }
        }
        else if(type === 'agendamento') {
            const [c, s, u] = await Promise.all([db.from('clients').select('id,name').order('name'), db.from('services').select('id,name,price,has_assistant'), db.from('users').select('id,name').neq('username', 'admin.teste')]);
            const sOpts = s.data.map(x => `<option value="${x.id}" data-aux="${x.has_assistant}">${x.name}</option>`).join('');
            html += `<h3>Novo Agendamento</h3><form onsubmit="Actions.createAppointment(event)">
                <div class="input-group"><select id="fa-cli" required><option value="">-- Buscar Cliente --</option>${c.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div class="input-group"><select id="fa-serv" required onchange="document.getElementById('aux-div').style.display = this.options[this.selectedIndex].dataset.aux==='true'?'block':'none'"><option value="">-- Serviço Principal --</option>${sOpts}</select></div>
                <div class="input-group"><select id="fa-user" required><option value="">-- Profissional --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div class="input-group" id="aux-div" style="display:none"><select id="fa-aux"><option value="">-- Auxiliar (Requisitado) --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div style="display:flex; gap:10px;"><input type="date" id="fa-date" class="input-group" style="flex:1" required><input type="time" id="fa-time" class="input-group" style="flex:1" required></div>
                <button type="submit" class="btn-primary">Confirmar Horário</button></form>`;
        }
        else if(type === 'comanda') {
            const { data } = await db.from('clients').select('id, name').order('name');
            html += `<h3>Gerar Nova Comanda</h3><form onsubmit="Actions.createComanda(event)">
                <div class="input-group"><select id="fcom-cli" required><option value="">-- Selecione o Cliente no Salão --</option>${data.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <button type="submit" class="btn-primary">Criar Ticket</button></form>`;
        }
        else if(type === 'servico') {
            html += `<h3>Cadastrar Serviço</h3><form onsubmit="Actions.createService(event)">
                <div class="input-group"><label>Nome do Serviço</label><input type="text" id="fs-nome" required></div>
                <div style="display:flex; gap:10px;"><div class="input-group" style="flex:1"><label>Valor Final Cliente (R$)</label><input type="number" id="fs-valor" step="0.01" required></div><div class="input-group" style="flex:1"><label>Custo/Insumo Base (R$)</label><input type="number" id="fs-custo" step="0.01" required></div></div>
                <div class="input-group"><label>Comissão do Profissional (%)</label><input type="number" id="fs-com" max="100" required></div>
                <div class="input-group"><label style="display:flex; align-items:center; gap:10px; cursor:pointer"><input type="checkbox" id="fs-aux" onchange="document.getElementById('aux-com-div').style.display=this.checked?'block':'none'" style="width:20px; height:20px"> Permite Auxiliar (Repasse)</label></div>
                <div class="input-group" id="aux-com-div" style="display:none"><label>Comissão do Auxiliar (%)</label><input type="number" id="fs-auxcom" max="100"></div>
                <button type="submit" class="btn-primary">Salvar no Catálogo</button></form>`;
        }
        else if(type === 'produto') {
            html += `<h3>Novo Produto</h3><form onsubmit="Actions.saveProduct(event)">
                <div class="input-group"><label>Cód. Barras (EAN) - Busca Automática Nuvem</label><input type="text" id="fp-bar" oninput="Actions.fetchBarcode(this.value)" required></div>
                <div class="input-group"><label>Descrição do Produto</label><input type="text" id="fp-nome" required></div>
                <div style="display:flex; gap:10px;"><div class="input-group" style="flex:1"><label>Preço de Venda (R$)</label><input type="number" id="fp-preco" step="0.01" required></div><div class="input-group" style="flex:1"><label>Comissão Venda (%)</label><input type="number" id="fp-com" max="100" required></div></div>
                <div style="display:flex; gap:10px;"><div class="input-group" style="flex:1"><label>Estoque Inicial</label><input type="number" id="fp-qtd" required></div><div class="input-group" style="flex:1"><label>Alerta Mínimo</label><input type="number" id="fp-min" value="5" required></div></div>
                <button type="submit" class="btn-primary">Salvar Produto</button></form>`;
        }
        else if(type === 'add_estoque') {
            html += `<h3>Atualizar Estoque</h3><form onsubmit="Actions.updateStock(event, '${param1}', ${param2})">
                <div class="input-group"><label>Estoque Atual no Sistema: ${param2}</label><input type="number" id="fa-qtd" placeholder="Novas unidades (Soma)" required min="1"></div>
                <button type="submit" class="btn-primary">Salvar Atualização</button></form>`;
        }
        else if(type === 'despesa') {
            html += `<h3>Lançar Despesa / Custo</h3><form onsubmit="Actions.createDespesa(event)">
                <div class="input-group"><label>Descrição da Saída</label><input type="text" id="fd-desc" placeholder="Ex: Conta de Energia, Reposição..." required></div>
                <div class="input-group"><label>Categoria</label><select id="fd-cat" required><option value="Fixo">Custo Fixo (Aluguel, Luz)</option><option value="Variavel">Custo Variável (Produtos, Insumos)</option></select></div>
                <div class="input-group"><label>Valor Total (R$)</label><input type="number" id="fd-val" step="0.01" required></div>
                <button type="submit" class="btn-primary">Registrar Saída Financeira</button></form>`;
        }
        else if(type === 'mensagem' || type === 'edit_mensagem') {
            let m = { title: '', content: '' };
            if (param1) { const { data } = await db.from('message_templates').select('*').eq('id', param1).single(); m = data; }
            html += `<h3>${param1 ? 'Editar Mensagem' : 'Novo Template de Mensagem'}</h3><form onsubmit="Actions.saveMensagem(event, '${param1 || ''}')">
                <div class="input-group"><label>Título Interno</label><input type="text" id="fm-tit" value="${m.title}" required></div>
                <div class="input-group"><label>Corpo do Texto</label><textarea id="fm-txt" rows="5" required>${m.content}</textarea></div>
                <button type="submit" class="btn-primary">${param1 ? 'Salvar Edição' : 'Criar Template'}</button></form>`;
        }
        else if(type === 'debitar' || type === 'desconto') {
            html += `<h3>${type==='debitar'?'Baixar Recebimento':'Aplicar Desconto Especial'}</h3><p style="margin-bottom:15px; font-size:1.1rem">Total Pendente: <b>${U.money(param2)}</b></p>
            <form onsubmit="Actions.${type==='debitar'?'debitDebt':'discountDebt'}(event, '${param1}', ${param2})">
                <div class="input-group"><label>${type==='debitar'?'Valor Recebido Agora (R$)':'Porcentagem do Desconto (%)'}</label><input type="number" id="f-val" step="0.01" required></div>
                <button type="submit" class="btn-primary">Confirmar Transação</button></form>`;
        }
        else if(type === 'nova_anamnese') {
            html += `<h3>Ficha de Anamnese</h3><form onsubmit="Actions.saveAnamnese(event)">
            <div class="input-group"><label>Histórico Capilar (Químicas, Alergias)</label><textarea id="fa-hist" rows="2" required></textarea></div>
            <div class="input-group"><label>Hábitos de Cuidado (Shampoo, Chapinha, etc.)</label><textarea id="fa-hab" rows="2" required></textarea></div>
            <div class="input-group"><label>Expectativa/Objetivo da Cliente</label><textarea id="fa-obj" rows="2" required></textarea></div>
            <div class="input-group"><label>Parecer do Profissional (Diagnóstico)</label><textarea id="fa-obs" rows="3" required></textarea></div>
            <button type="submit" class="btn-primary">Registrar no Prontuário</button></form>`;
        }
        else if(type === 'cliente') {
            html += `<h3>Cadastro de Cliente</h3><form onsubmit="Actions.createClient(event)"><div class="input-group"><label>Nome Completo</label><input type="text" id="fc-nome" required></div><div class="input-group"><label>Número do WhatsApp com DDD</label><input type="text" id="fc-fone" placeholder="Ex: 86999999999" required></div><button type="submit" class="btn-primary">Salvar Perfil</button></form>`;
        }
        html += `</div>`; cont.innerHTML = html; cont.classList.remove('hidden');
    },
    close() { document.getElementById('modal-container').classList.add('hidden'); }
};

const Actions = {
    async updatePassword(e) {
        e.preventDefault(); const { error } = await db.from('users').update({ password: document.getElementById('new-pass').value, first_login: false }).eq('id', App.user.id);
        if(!error) { App.user.first_login = false; Modals.close(); UI.toast('Senha registrada com sucesso!'); Auth.success(); }
    },
    async createClient(e) { e.preventDefault(); await db.from('clients').insert({ name: document.getElementById('fc-nome').value, phone: document.getElementById('fc-fone').value }); Modals.close(); UI.toast('Cliente salvo!'); },
    
    async saveAnamnese(e) {
        e.preventDefault(); const id = document.getElementById('current-anamnese-client-id').value;
        await db.from('anamnesis').insert({ client_id: id, history: document.getElementById('fa-hist').value, habits: document.getElementById('fa-hab').value, objectives: document.getElementById('fa-obj').value, notes: document.getElementById('fa-obs').value });
        Modals.close(); UI.toast('Avaliação salva no sistema.'); this.loadAnamnese(id);
    },
    async loadAnamnese(id) {
        const { data } = await db.from('anamnesis').select('*').eq('client_id', id).order('created_at', {ascending: false});
        const div = document.getElementById('anamnese-history-list');
        if(!data || !data.length) { div.innerHTML = "<p style='color:var(--muted)'>Nenhum registro encontrado para esta cliente.</p>"; return; }
        div.innerHTML = data.map(d => `<div class="card" style="border-left: 3px solid var(--primary)"><h4 style="font-size:0.9rem; color:var(--muted); margin-bottom:10px">Data: ${new Date(d.created_at).toLocaleDateString()}</h4><p style="margin-bottom:5px"><b>Histórico:</b> ${d.history}</p><p style="margin-bottom:5px"><b>Hábitos:</b> ${d.habits}</p><p style="margin-bottom:5px"><b>Objetivo:</b> ${d.objectives}</p><p style="padding:10px; background:#f9f9f9; border-radius:8px"><b>Diagnóstico:</b> ${d.notes}</p></div>`).join('');
    },

    async createAppointment(e) {
        e.preventDefault(); const auxId = document.getElementById('fa-aux').value;
        await db.from('appointments').insert({ client_id: document.getElementById('fa-cli').value, service_id: document.getElementById('fa-serv').value, user_id: document.getElementById('fa-user').value, assistant_id: auxId || null, date: document.getElementById('fa-date').value, time: document.getElementById('fa-time').value });
        Modals.close(); UI.toast('Agendamento Confirmado!');
    },

    async createComanda(e) {
        e.preventDefault(); 
        const { data } = await db.from('comandas').select('ticket').order('id', {ascending: false}).limit(1);
        let nxt = 1; if(data.length && data[0].ticket && data[0].ticket.includes('-')) { nxt = parseInt(data[0].ticket.split('-')[1]) + 1; }
        const tk = 'TKT-' + String(nxt).padStart(4, '0');
        await db.from('comandas').insert({ client_id: document.getElementById('fcom-cli').value, user_id: App.user.id, ticket: tk });
        Modals.close(); UI.toast(`Comanda ${tk} Gerada com Sucesso!`);
    },
    async addComandaItem(id) {
        const val = document.getElementById('add-item-sel').value; if(!val) return;
        const item = JSON.parse(val); 
        const { data: comanda } = await db.from('comandas').select('items, total').eq('id', id).single();
        const items = comanda.items || []; items.push(item);
        
        if(item.type === 'product') {
            const { data: prod } = await db.from('products').select('stock').eq('id', item.id).single();
            await db.from('products').update({stock: Math.max(0, prod.stock - 1)}).eq('id', item.id);
        }
        
        await db.from('comandas').update({ items, total: comanda.total + item.price }).eq('id', id);
        Modals.open('edit_comanda', id);
    },
    async removeComandaItem(comandaId, itemIndex) {
        UI.confirm('Remover este item da comanda?', async () => {
            const { data: comanda } = await db.from('comandas').select('items, total').eq('id', comandaId).single();
            const items = comanda.items || [];
            const item = items[itemIndex];
            if(item.type === 'product') { // Devolve para o estoque
                const { data: prod } = await db.from('products').select('stock').eq('id', item.id).single();
                if(prod) await db.from('products').update({stock: prod.stock + 1}).eq('id', item.id);
            }
            items.splice(itemIndex, 1);
            await db.from('comandas').update({ items, total: Math.max(0, comanda.total - item.price) }).eq('id', comandaId);
            Modals.open('edit_comanda', comandaId); UI.toast('Item removido.');
        });
    },
    async closeComanda(comandaId, clientId, total, ticketNum) {
        UI.confirm('Atenção: Ao fechar a comanda, o valor total será faturado para as cobranças e entrará no fluxo de caixa bruto do estúdio. Deseja prosseguir?', async () => {
            await db.from('comandas').update({ status: 'fechada' }).eq('id', comandaId);
            if(total > 0) {
                await db.from('debts').insert({ client_id: clientId, total_amount: total, remaining_amount: total, comanda_id: comandaId, comanda_ticket: ticketNum });
            }
            Modals.close(); UI.toast('Atendimento Encerrado e Faturado!');
        });
    },
    async reopenComanda(id) {
        UI.confirm('ALERTA: Reabrir a comanda irá deletar a dívida do cliente associada a ela e os dados no relatório financeiro. Prosseguir?', async () => {
            await db.from('debts').delete().eq('comanda_id', id);
            await db.from('comandas').update({ status: 'aberta' }).eq('id', id);
            Modals.close(); UI.toast('Comanda Reaberta. Fluxo revertido.');
        });
    },

    async createService(e) {
        e.preventDefault(); const aux = document.getElementById('fs-aux').checked;
        await db.from('services').insert({ name: document.getElementById('fs-nome').value, price: document.getElementById('fs-valor').value, cost: document.getElementById('fs-custo').value, commission: document.getElementById('fs-com').value, has_assistant: aux, assistant_commission: aux ? document.getElementById('fs-auxcom').value : 0 });
        Modals.close(); UI.toast('Serviço Inserido no Catálogo!');
    },
    
    // Automação EAN / Cód. Barras via OpenFoodFacts
    async fetchBarcode(val) {
        if(val.length >= 8) {
            try {
                const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${val}.json`);
                const json = await res.json();
                if(json.status === 1 && json.product.product_name) {
                    document.getElementById('fp-nome').value = json.product.product_name;
                    UI.toast('Produto reconhecido via API global.', 'success');
                }
            } catch(e) { console.log('API EAN Erro', e); }
        }
    },
    async saveProduct(e) { e.preventDefault(); await db.from('products').insert({ barcode: document.getElementById('fp-bar').value, name: document.getElementById('fp-nome').value, price: document.getElementById('fp-preco').value, commission: document.getElementById('fp-com').value, stock: document.getElementById('fp-qtd').value, min_stock: document.getElementById('fp-min').value }); Modals.close(); UI.toast('Produto cadastrado com sucesso!'); },
    async updateStock(e, id, curStock) {
        e.preventDefault(); const v = parseInt(document.getElementById('fa-qtd').value);
        await db.from('products').update({stock: curStock + v}).eq('id', id); Modals.close(); UI.toast('Inventário Atualizado!');
    },

    async saveMensagem(e, id) { 
        e.preventDefault(); 
        const payload = { title: document.getElementById('fm-tit').value, content: document.getElementById('fm-txt').value };
        if(id) await db.from('message_templates').update(payload).eq('id', id);
        else await db.from('message_templates').insert(payload);
        Modals.close(); UI.toast(id ? 'Template Editado!' : 'Template Criado!'); 
    },
    async deleteMensagem(id) { UI.confirm('Confirma exclusão permanente deste template?', async () => { await db.from('message_templates').delete().eq('id', id); UI.toast('Template Removido.'); }); },

    async createDespesa(e) { e.preventDefault(); await db.from('despesas').insert({ description: document.getElementById('fd-desc').value, amount: document.getElementById('fd-val').value, category: document.getElementById('fd-cat').value }); Modals.close(); UI.toast('Saída financeira processada!'); },

    async debitDebt(e, id, max) { e.preventDefault(); const v = parseFloat(document.getElementById('f-val').value); await db.from('debts').update({ remaining_amount: Math.max(0, max - v) }).eq('id', id); Modals.close(); UI.toast('Valor Recebido!'); },
    async discountDebt(e, id, max) { e.preventDefault(); const perc = parseFloat(document.getElementById('f-val').value); await db.from('debts').update({ remaining_amount: Math.max(0, max - (max * perc / 100)) }).eq('id', id); Modals.close(); UI.toast('Desconto autorizado!'); },

    async saveSettings(e) {
        e.preventDefault(); const n = document.getElementById('cfg-name').value; const p = document.getElementById('cfg-phone').value;
        const payload = { studio_name: n, official_phone: p };
        if(App.settings.id) await db.from('settings').update(payload).eq('id', App.settings.id);
        else await db.from('settings').insert(payload);
        App.settings = {...App.settings, ...payload}; document.getElementById('brand-name').textContent = n;
        UI.toast('Sistema reconfigurado!');
    },

    sendWhatsApp(phone) {
        const msg = document.getElementById('wpp-msg').value; if(!msg) return UI.toast('Preencha a mensagem para enviar.', 'error');
        Modals.close();
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
