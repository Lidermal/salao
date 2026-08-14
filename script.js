/** 
 * SISTEMA ESTÚDIO AMOR QUE CUIDA - VERSÃO 4.0 DEFINITIVA
 * (Splash, EAN Auto, Extrato Bancário, Anamnese e Login Corrigidos)
 */

const DB_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';

// Ignora o Storage do navegador para evitar o bloqueio do Tracking Prevention
const db = window.supabase.createClient(DB_URL, DB_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const App = { 
    user: null, 
    role: 'freelancer', 
    view: 'agenda', 
    currentDate: new Date(), 
    charts: {}, 
    settings: {},
    currentClientId: null // CORREÇÃO: Memória travada para o ID do Cliente na Anamnese
};

const U = {
    money: v => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v||0),
    iso: d => { const tzOffset = d.getTimezoneOffset() * 60000; return (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0]; },
    date: d => new Date(d).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})
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
        else this.toast('Utilize os botões na própria tela para cadastros.', 'error');
    }
};

const Auth = {
    init() { document.getElementById('login-form').onsubmit = e => { e.preventDefault(); this.login(); }; },
    async login() {
        const u = document.getElementById('username').value.trim(); 
        const p = document.getElementById('password').value;
        const btn = document.getElementById('btn-login'); btn.textContent = 'Aguarde...';
        
        try {
            // CORREÇÃO DE LOGIN: maybeSingle() impede que a API falhe feio se o usuário não existir
            const { data, error } = await db.from('users').select('*').eq('username', u).maybeSingle();
            
            if (error) throw new Error(`Falha no banco de dados: ${error.message}`);
            if (!data) throw new Error("Usuário não cadastrado no sistema.");
            if (data.password !== p) throw new Error("Senha incorreta.");
            
            App.user = data; 
            App.role = data.role;
            
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
    async success() {
        document.getElementById('auth-layer').classList.add('hidden'); 
        document.getElementById('system-layout').classList.remove('hidden');
        document.getElementById('header-user').textContent = App.user.name; 
        document.getElementById('header-avatar').textContent = App.user.name.substring(0,2).toUpperCase();
        document.body.classList.toggle('is-owner', App.role === 'owner');
        
        const { data: set } = await db.from('settings').select('*').single();
        if(set) { App.settings = set; document.getElementById('brand-name').textContent = set.studio_name; }
        
        Nav.init(); Nav.showView('agenda');
        
        db.channel('custom-all-channel').on('postgres_changes', { event: '*', schema: 'public' }, payload => {
            if(Render[App.view]) Render[App.view]();
        }).subscribe();
    },
    logout() { UI.confirm('Até logo! Deseja sair do sistema?', () => location.reload()); }
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
        
        const titles = { agenda:'Agenda', comandas:'Comandas', cobrancas:'Cobranças', clientes:'Clientes', anamnese:'Ficha de Avaliação', servicos:'Catálogo de Serviços', produtos:'Estoque & Preços', comissao:'Dashboard de Comissões', mensagens:'Mensagens Automáticas', despesas:'Gestão de Despesas', 'resumo-financeiro':'Fluxo de Caixa', performance:'Métricas e Resultados', configuracoes:'Ajustes do Sistema' };
        document.getElementById('page-title').textContent = titles[id] || 'Amor que Cuida';
        if(Render[id]) Render[id]();
    },
    toggleMenu() { document.getElementById('main-sidebar').classList.toggle('open'); document.getElementById('mobile-overlay').classList.toggle('hidden'); },
    closeMenu() { document.getElementById('main-sidebar').classList.remove('open'); document.getElementById('mobile-overlay').classList.add('hidden'); }
};

const Render = {
    async agenda() {
        this.buildCalendar();
        try {
            const { data, error } = await db.from('appointments').select('*, clients(name), services(name), users!user_id(name)').eq('date', U.iso(App.currentDate));
            if(error) throw error;
            const cont = document.getElementById('agenda-list');
            if(!data || !data.length) { cont.innerHTML = `<div class="card" style="text-align:center; padding:3rem"><p style="color:var(--muted)">Sua agenda está livre neste dia.</p></div>`; return; }
            cont.innerHTML = data.map(a => `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--primary)">
                <div><h4 style="font-size:1.2rem">${a.time} - ${a.clients?.name || 'Cliente'}</h4><p style="margin:5px 0; color:var(--muted)">${a.services?.name || '-'}</p><p style="font-size:0.8rem">Profissional: <b>${a.users?.name || '-'}</b></p></div>
                <div style="background:var(--primary-light); color:var(--primary-dark); padding:5px 12px; border-radius:20px; font-size:0.8rem; font-weight:bold">${a.status.toUpperCase()}</div>
            </div>`).join('');
        } catch (e) { UI.toast(`Erro na agenda: ${e.message}`, 'error'); }
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
        // CORREÇÃO: Trava o ID na memória do app para não perder ao abrir modais
        App.currentClientId = id; 
        document.getElementById('current-anamnese-client-id').value = id;
        document.getElementById('anamnese-title').textContent = `Ficha de: ${name}`;
        Nav.showView('anamnese'); Actions.loadAnamnese(id);
    },
    async cobrancas() {
        const { data } = await db.from('debts').select('*, clients(name)').gt('remaining_amount', 0);
        const cont = document.getElementById('cobrancas-list');
        if (!data || data.length === 0) { cont.innerHTML = "<p style='color:var(--muted)'>Nenhuma cobrança em aberto no momento.</p>"; return; }
        
        cont.innerHTML = data.map(d => `
            <div class="card" style="border-left:4px solid #d32f2f">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center">
                    <div>
                        <span style="font-size:0.75rem; color:white; background:var(--muted); padding:3px 8px; border-radius:10px; font-weight:bold">${d.comanda_ticket || 'MANUAL'}</span>
                        <h4 style="font-size:1.3rem; margin-top:8px">${d.clients?.name || 'Cliente'}</h4>
                    </div>
                    <div class="val" style="color:#d32f2f; font-size:1.8rem">${U.money(d.remaining_amount)}</div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" style="padding:0.8rem; font-size:0.9rem" onclick="Modals.open('debitar', '${d.id}', ${d.remaining_amount})"><i class="ph ph-check-circle"></i> Receber Pagamento</button>
                    ${App.role==='owner' ? `<button class="btn-secondary" style="padding:0.8rem; font-size:0.9rem" onclick="Modals.open('desconto', '${d.id}', ${d.remaining_amount})">Desconto %</button>` : ''}
                </div>
            </div>`).join('');
    },
    async servicos() {
        const { data } = await db.from('services').select('*').order('name');
        document.getElementById('servicos-list').innerHTML = data.map(s => `<div class="card"><h4 style="font-size:1.2rem; border-bottom:1px solid #eee; padding-bottom:10px">${s.name}</h4><div style="margin:10px 0; color:var(--muted)"><p>Comissão: <b style="color:var(--text)">${s.commission}%</b></p>${s.has_assistant?`<p>Auxiliar: <b style="color:var(--text)">${s.assistant_commission}%</b></p>`:''}</div><div class="val" style="font-size:1.5rem">${U.money(s.price)}</div></div>`).join('');
    },
    async produtos() {
        const { data } = await db.from('products').select('*').order('name');
        document.getElementById('produtos-list').innerHTML = data.map(p => `
            <div class="card" style="border-top: 4px solid ${p.stock <= p.min_stock ? '#d32f2f' : 'var(--primary)'}">
                <h4 style="font-size:1.1rem; margin-bottom:5px">${p.name}</h4>
                <p style="font-size:0.8rem; color:var(--muted)">EAN: ${p.barcode}</p>
                <div style="margin:10px 0; background:#f9f9f9; padding:10px; border-radius:8px; display:flex; justify-content:space-between">
                    <div><span style="font-size:0.7rem; color:var(--muted)">Preço Venda</span><p style="font-weight:bold">${U.money(p.price)}</p></div>
                    <div style="text-align:right"><span style="font-size:0.7rem; color:var(--muted)">Comissão</span><p style="font-weight:bold">${p.commission}%</p></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px">
                    <div><span style="font-size:0.8rem; color:var(--muted)">Estoque Atual</span><div class="val" style="font-size:1.4rem; color:${p.stock <= p.min_stock ? '#d32f2f' : 'var(--text)'}">${p.stock}</div></div>
                    <button class="btn-secondary" style="width:auto; padding:0.6rem 1.2rem" onclick="Modals.open('add_estoque', '${p.id}', '${p.stock}')">+ Repor</button>
                </div>
            </div>`).join('');
    },
    async comandas() {
        const { data } = await db.from('comandas').select('*, clients(name), users(name)').order('created_at', {ascending: false});
        document.getElementById('comandas-list').innerHTML = data.map(c => `
            <div class="card" style="border-left: 5px solid ${c.status === 'aberta' ? 'var(--primary)' : '#ccc'}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span style="font-size:0.8rem; color:var(--primary); font-weight:bold; letter-spacing:1px">${c.ticket || 'TKT-####'}</span>
                        <h4 style="font-size:1.2rem; margin-top:5px">${c.clients?.name || 'Desconhecido'}</h4>
                    </div>
                    <span style="font-size:0.7rem; font-weight:bold; padding: 4px 10px; border-radius:20px; background:${c.status === 'aberta' ? 'var(--primary-light)' : '#eee'}; color:${c.status === 'aberta' ? 'var(--primary-dark)' : 'var(--muted)'}">${c.status.toUpperCase()}</span>
                </div>
                <div class="val" style="font-size:1.8rem; margin:15px 0;">${U.money(c.total)}</div>
                <button class="btn-secondary" style="width:100%; padding:0.8rem; display:flex; align-items:center; justify-content:center; gap:8px" onclick="Modals.open('edit_comanda', '${c.id}')"><i class="ph ph-list-plus"></i> ${c.status === 'aberta' ? 'Lançar Itens e Fechar' : 'Visualizar Comanda'}</button>
            </div>`).join('');
    },
    async mensagens() {
        const { data } = await db.from('message_templates').select('*');
        document.getElementById('mensagens-list').innerHTML = data.map(m => `
            <div class="card"><h4 style="color:var(--primary); border-bottom:1px solid #eee; padding-bottom:10px">${m.title}</h4>
            <p style="margin:15px 0; font-style:italic; color:var(--muted)">"${m.content}"</p>
            <div style="display:flex; gap:10px">
                <button class="btn-secondary" style="flex:1" onclick="Modals.open('edit_mensagem', '${m.id}')"><i class="ph ph-pencil"></i> Editar</button>
                <button class="btn-secondary" style="flex:1; color:#d32f2f; background:#ffebee" onclick="Actions.deleteMensagem('${m.id}')"><i class="ph ph-trash"></i> Excluir</button>
            </div></div>`).join('');
    },
    
    async despesas() {
        const { data } = await db.from('despesas').select('*').order('date', {ascending: false});
        let totais = { 'Custos Fixos': 0, 'Custos Variáveis': 0, 'Pessoal/Pagamentos': 0 };
        data.forEach(d => { if(totais[d.category] !== undefined) totais[d.category] += d.amount; });
        
        document.getElementById('despesas-list').innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-bottom:20px">
                <div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #d32f2f"><p style="font-size:0.8rem">Custos Fixos</p><div class="val" style="color:#d32f2f; font-size:1.2rem">-${U.money(totais['Custos Fixos'])}</div></div>
                <div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #e65100"><p style="font-size:0.8rem">Variáveis / Produtos</p><div class="val" style="color:#e65100; font-size:1.2rem">-${U.money(totais['Custos Variáveis'])}</div></div>
                <div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #8e24aa"><p style="font-size:0.8rem">Pagamentos/Pessoal</p><div class="val" style="color:#8e24aa; font-size:1.2rem">-${U.money(totais['Pessoal/Pagamentos'])}</div></div>
            </div>` + 
            data.map(d => {
                const color = d.category === 'Custos Fixos' ? '#d32f2f' : (d.category === 'Custos Variáveis' ? '#e65100' : '#8e24aa');
                return `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid ${color}">
                    <div><h4>${d.description}</h4><p style="font-size:0.8rem; color:var(--muted)">${d.category} • ${U.date(d.date)}</p></div>
                    <div class="val" style="color:${color}">-${U.money(d.amount)}</div>
                </div>`;
            }).join('');
            
        if(App.charts.despesas) App.charts.despesas.destroy();
        App.charts.despesas = new Chart(document.getElementById('chart-despesas'), { 
            type: 'pie', 
            data: { labels: Object.keys(totais), datasets: [{ data: Object.values(totais), backgroundColor: ['#d32f2f', '#e65100', '#8e24aa'] }] }
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
                    if(!isOwner) html += `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:3px solid #2e7d32"><div><h4>${i.name}</h4><p style="font-size:0.8rem; color:var(--muted)">Ref: ${c.ticket||'-'} • Taxa: ${i.commission}%</p></div><div class="val" style="color:#2e7d32; font-size:1.3rem">+${U.money(v)}</div></div>`;
                }
            });
        });
        
        if(isOwner) {
            const sorted = Object.entries(rank).sort((a,b)=>b[1]-a[1]);
            html = `<div class="card" style="margin-bottom:20px; background:linear-gradient(135deg, var(--primary), var(--primary-dark)); color:white; padding:2rem; box-shadow:0 10px 20px rgba(183, 110, 121, 0.3)"><h3 style="color:white; font-weight:400; opacity:0.9">Total Estimado de Comissões a Pagar</h3><div class="val" style="color:white; font-size:3rem; margin-top:10px">${U.money(totalComissao)}</div></div>
            <h3 style="margin:20px 0 15px 0">Ranking de Comissionamento</h3><div class="data-grid">` + 
            sorted.map((s,i) => {
                let color = '#cd7f32'; if(i===0) color='#ffd700'; else if(i===1) color='#c0c0c0';
                return `<div class="card"><div style="display:flex; justify-content:space-between; align-items:center"><h4 style="font-size:1.1rem">${i+1}º ${s[0]}</h4><i class="ph ph-medal" style="color:${color}; font-size:2rem"></i></div><div class="val" style="margin-top:15px; font-size:1.8rem">${U.money(s[1])}</div></div>`;
            }).join('') + '</div>';
        } else {
            html = `<div class="card" style="margin-bottom:20px; background:var(--primary); color:white; padding:2rem"><h4 style="color:white; font-weight:400">Minha Comissão (Acumulado)</h4><div class="val" style="color:white; font-size:3rem; margin-top:10px">${U.money(totalComissao)}</div></div><div class="data-list">` + html + `</div>`;
        }
        document.getElementById('comissao-dashboard').innerHTML = html;
    },
    
    async 'resumo-financeiro'() {
        const [ {data:comand}, {data:desp} ] = await Promise.all([
            db.from('comandas').select('total, ticket, created_at').eq('status', 'fechada'), 
            db.from('despesas').select('description, amount, date')
        ]);
        
        const receita = comand.reduce((acc, c) => acc + c.total, 0); 
        const gasto = desp.reduce((acc, d) => acc + d.amount, 0); 
        const lucro = receita - gasto;
        
        document.getElementById('resumo-cards').innerHTML = `
            <div class="card" style="border-bottom:4px solid #2e7d32"><h4>Faturamento (Entradas)</h4><div class="val" style="color:#2e7d32; font-size:1.8rem; margin-top:10px">${U.money(receita)}</div></div>
            <div class="card" style="border-bottom:4px solid #d32f2f"><h4>Custo Operacional (Saídas)</h4><div class="val" style="color:#d32f2f; font-size:1.8rem; margin-top:10px">-${U.money(gasto)}</div></div>
            <div class="card" style="background:${lucro>=0?'#e8f5e9':'#ffebee'}; border:1px solid ${lucro>=0?'#c8e6c9':'#ffcdd2'}"><h4 style="color:${lucro>=0?'#2e7d32':'#d32f2f'}">Resultado Líquido</h4><div class="val" style="color:${lucro>=0?'#2e7d32':'#d32f2f'}; font-size:2.2rem; margin-top:10px">${U.money(lucro)}</div></div>`;
        
        let extrato = [];
        comand.forEach(c => { if(c.total>0) extrato.push({ type: 'in', desc: `Comanda ${c.ticket||'-'}`, val: c.total, date: new Date(c.created_at) }); });
        desp.forEach(d => { extrato.push({ type: 'out', desc: d.description, val: d.amount, date: new Date(d.date) }); });
        
        extrato.sort((a,b) => a.date - b.date);
        
        let saldoAtual = 0;
        extrato = extrato.map(item => {
            saldoAtual += item.type === 'in' ? item.val : -item.val;
            return { ...item, saldo: saldoAtual };
        });
        
        extrato.sort((a,b) => b.date - a.date);
        
        document.getElementById('extrato-list').innerHTML = extrato.length === 0 ? '<p style="text-align:center; padding:1rem; color:var(--muted)">Sem movimentações financeiras no período.</p>' :
            extrato.map(i => `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:15px 0;">
                <div style="flex:1">
                    <b style="color:${i.type==='in'?'#2e7d32':'#d32f2f'}; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px">${i.type==='in'?'Recebimento':'Pagamento'}</b>
                    <p style="margin-top:5px; font-weight:600; font-size:1.1rem">${i.desc}</p>
                    <span style="font-size:0.8rem; color:var(--muted)">${U.date(i.date)}</span>
                </div>
                <div style="text-align:right">
                    <span style="color:${i.type==='in'?'#2e7d32':'#d32f2f'}; font-weight:bold; font-size:1.3rem; display:block">${i.type==='in'?'+':'-'} ${U.money(i.val)}</span>
                    <span style="font-size:0.85rem; color:var(--muted); font-weight:bold">Saldo: ${U.money(i.saldo)}</span>
                </div>
            </div>`).join('');
    },
    async performance() {
        const [ {data}, {data:agendas} ] = await Promise.all([ db.from('comandas').select('*, users(name), items').eq('status', 'fechada'), db.from('appointments').select('*') ]);
        
        let rankFunc = {}; let rankServ = {}; let totalFaturamento = 0;
        
        data.forEach(c => { 
            totalFaturamento += c.total; 
            if(c.users) rankFunc[c.users.name] = (rankFunc[c.users.name]||0) + c.total; 
            if(c.items) {
                c.items.forEach(i => {
                    if(i.type === 'service') {
                        rankServ[i.name] = rankServ[i.name] || { qtd: 0, receita: 0 };
                        rankServ[i.name].qtd += 1;
                        rankServ[i.name].receita += i.price;
                    }
                });
            }
        });
        
        const tkMedio = data.length ? totalFaturamento / data.length : 0;
        const totalAgendas = agendas.length || 1;
        const concluidas = data.length;
        const ocupacao = Math.min(100, Math.round((concluidas / totalAgendas) * 100));
        
        document.getElementById('perf-kpis').innerHTML = `
            <div class="card" style="text-align:center; padding:2rem"><p style="font-weight:bold; color:var(--muted); margin-bottom:10px">Ticket Médio</p><div class="val" style="font-size:2rem">${U.money(tkMedio)}</div></div>
            <div class="card" style="text-align:center; padding:2rem"><p style="font-weight:bold; color:var(--muted); margin-bottom:10px">Conversão/Ocupação</p><div class="val" style="font-size:2rem; color:${ocupacao > 50 ? '#2e7d32' : '#d32f2f'}">${ocupacao}%</div></div>
            <div class="card" style="text-align:center; padding:2rem"><p style="font-weight:bold; color:var(--muted); margin-bottom:10px">Atendimentos Concluídos</p><div class="val" style="font-size:2rem; color:var(--text)">${concluidas}</div></div>`;
            
        const sortedFunc = Object.entries(rankFunc).sort((a,b)=>b[1]-a[1]);
        document.getElementById('performance-ranking').innerHTML = `<h3 style="grid-column: 1 / -1; margin-bottom:10px">Ranking por Faturamento</h3>` + 
            sortedFunc.map((s,i) => `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--primary)"><div><span style="font-size:0.8rem; font-weight:bold; color:var(--muted)">Posição ${i+1}</span><h4 style="font-size:1.2rem; margin-top:5px">${s[0]}</h4></div><div class="val" style="font-size:1.5rem">${U.money(s[1])}</div></div>`).join('');
            
        const sortedServ = Object.entries(rankServ).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0, 5);
        if(App.charts.perf) App.charts.perf.destroy();
        App.charts.perf = new Chart(document.getElementById('chart-performance'), { 
            type: 'bar', 
            data: { labels: sortedServ.map(s=>s[0]), datasets: [{ label: 'Top Serviços (Volume)', data: sortedServ.map(s=>s[1].qtd), backgroundColor: '#B76E79', borderRadius: 8 }] }
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
            html += `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--primary-dark);">Definir Nova Senha</h3>
                <p style="color: var(--muted); margin-top: 10px; line-height:1.4">Por motivos de segurança, altere a senha provisória para o seu acesso pessoal e exclusivo.</p>
            </div>
            <form onsubmit="Actions.updatePassword(event)">
                <div class="input-group"><label style="margin-bottom: 5px;">Digite a nova senha</label><input type="password" id="new-pass" required style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px;"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem; font-size:1.1rem">Salvar e Acessar</button>
            </form>`;
        } 
        else if(type === 'whatsapp') {
            const { data: templates } = await db.from('message_templates').select('*');
            const tOpts = templates.map(t => `<option value="${t.content}">${t.title}</option>`).join('');
            html += `<h3>Central de WhatsApp</h3>
            <div style="background:#f9f9f9; padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #eee">
                <p style="font-size: 0.85rem; color: var(--muted); margin-bottom: 8px; line-height:1.4"><i class="ph ph-info"></i> O redirecionamento abaixo levará o texto para o aplicativo no seu dispositivo.</p>
                <p style="font-size: 1rem;">Cliente Alvo: <b class="text-primary">${param2}</b></p>
                <p style="font-size: 0.9rem; color:var(--muted)">Número: ${param1}</p>
            </div>
            <div class="input-group"><label>Usar Modelo Automático</label><select onchange="document.getElementById('wpp-msg').value = this.value"><option value="">-- Escrever Mensagem Manualmente --</option>${tOpts}</select></div>
            <div class="input-group"><textarea id="wpp-msg" rows="5" placeholder="Digite o texto que será enviado..." required></textarea></div>
            <button class="btn-primary" style="background:#25D366; font-size:1.1rem; padding:1.2rem; display:flex; justify-content:center; gap:10px" onclick="Actions.sendWhatsApp('${param1}')"><i class="ph ph-whatsapp-logo" style="font-size:1.5rem"></i> Abrir Chat</button>`;
        }
        else if (type === 'edit_comanda') {
            const { data: comanda } = await db.from('comandas').select('*, clients(name)').eq('id', param1).single();
            const { data: servicos } = await db.from('services').select('*');
            const { data: produtos } = await db.from('products').select('*').gt('stock', 0);
            
            const isFechada = comanda.status === 'fechada';
            
            let htmlList = (comanda.items||[]).map((i, idx) => `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #eee">
                <div><span style="font-size:0.7rem; background:var(--bg); padding:3px 8px; border-radius:10px; margin-right:8px; border:1px solid var(--border); font-weight:bold">${i.type==='product'?'PROD':'SERV'}</span><span style="font-size:1.1rem">${i.name}</span></div>
                <div style="display:flex; align-items:center; gap:20px"><b style="font-size:1.2rem; color:var(--primary-dark)">${U.money(i.price)}</b> ${!isFechada ? `<button type="button" onclick="Actions.removeComandaItem('${comanda.id}', ${idx})" style="background:none; border:none; color:#d32f2f; cursor:pointer; font-size:1.2rem"><i class="ph ph-trash"></i></button>`:''}</div>
            </div>`).join('');
            
            html += `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--primary-dark);">Ticket de Atendimento: <span style="color:var(--primary)">${comanda.ticket || '-'}</span></h3>
                <p style="color: var(--muted); margin-top: 5px; font-size:1.1rem;">Cliente: <b style="color:var(--text)">${comanda.clients?.name}</b></p>
            </div>
            <div style="background: #fafafa; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <h4 style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; color:var(--muted)">Itens Lançados</h4>
                ${htmlList || '<p style="color:var(--muted); text-align:center; padding:1rem 0">Nenhum serviço ou produto lançado.</p>'} 
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px dashed #ccc; padding-top: 15px; margin-top: 15px;">
                    <span style="font-size: 1.2rem; font-weight: bold; color: var(--text);">Total Final</span>
                    <span style="font-size: 1.8rem; font-weight: bold; color: var(--primary-dark);">${U.money(comanda.total)}</span>
                </div>
            </div>`;
            
            if(!isFechada) {
                const sOpts = servicos.map(s => `<option value='{"id":"${s.id}","name":"${s.name}","price":${s.price},"commission":${s.commission},"type":"service"}'>${s.name} - ${U.money(s.price)}</option>`).join('');
                const pOpts = produtos.map(p => `<option value='{"id":"${p.id}","name":"${p.name}","price":${p.price},"commission":${p.commission},"type":"product"}'>${p.name} (Estoque: ${p.stock}) - ${U.money(p.price)}</option>`).join('');
                html += `
                <div style="display:flex; gap:10px; margin-bottom:20px; align-items: flex-end;">
                    <div class="input-group" style="margin:0; flex:1;">
                        <label style="margin-bottom: 5px;">Lançar Novo Item</label>
                        <select id="add-item-sel" style="padding:1.2rem; width:100%; border-radius:8px; border:1px solid var(--border);"><option value="">-- Buscar Serviço ou Produto --</option><optgroup label="Lista de Serviços">${sOpts}</optgroup><optgroup label="Produtos em Estoque">${pOpts}</optgroup></select>
                    </div>
                    <button type="button" class="btn-secondary" style="width:auto; padding:1.2rem 2rem; background:var(--primary-light); color:var(--primary)" onclick="Actions.addComandaItem('${comanda.id}')"><i class="ph ph-plus" style="font-size:1.3rem"></i> Lançar</button>
                </div>
                <button type="button" class="btn-primary" style="background:#2e7d32; padding:1.2rem; font-size:1.1rem; display:flex; justify-content:center; gap:10px; width: 100%;" onclick="Actions.closeComanda('${comanda.id}', '${comanda.client_id}', ${comanda.total}, '${comanda.ticket}')"><i class="ph ph-check-circle" style="font-size:1.5rem"></i> Fechar Comanda e Faturar</button>`;
            } else if (App.role === 'owner') {
                html += `<button type="button" class="btn-secondary" style="color:#d32f2f; padding:1.2rem; display:flex; justify-content:center; gap:10px; width:100%" onclick="Actions.reopenComanda('${comanda.id}')"><i class="ph ph-warning-circle" style="font-size:1.5rem"></i> Reabrir Comanda</button>`;
            }
        }
        else if(type === 'agendamento') {
            const [c, s, u] = await Promise.all([db.from('clients').select('id,name').order('name'), db.from('services').select('id,name,price,has_assistant'), db.from('users').select('id,name').neq('username', 'admin.teste')]);
            const sOpts = s.data.map(x => `<option value="${x.id}" data-aux="${x.has_assistant}">${x.name}</option>`).join('');
            html += `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--primary-dark);">Novo Agendamento</h3>
            </div>
            <form onsubmit="Actions.createAppointment(event)">
                <div class="input-group">
                    <label style="margin-bottom: 5px;">Selecione o Cliente</label>
                    <select id="fa-cli" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"><option value="">-- Buscar na lista --</option>${c.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select>
                </div>
                <div class="input-group">
                    <label style="margin-bottom: 5px;">Serviço Desejado</label>
                    <select id="fa-serv" required onchange="document.getElementById('aux-div').style.display = this.options[this.selectedIndex].dataset.aux==='true'?'block':'none'" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"><option value="">-- Escolha o serviço --</option>${sOpts}</select>
                </div>
                <div class="input-group">
                    <label style="margin-bottom: 5px;">Profissional</label>
                    <select id="fa-user" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"><option value="">-- Atendente Principal --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select>
                </div>
                <div class="input-group" id="aux-div" style="display:none">
                    <label style="margin-bottom: 5px;">Auxiliar (Opcional)</label>
                    <select id="fa-aux" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"><option value="">-- Selecione caso precise --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select>
                </div>
                <div style="display:flex; gap:10px; margin-bottom: 20px;">
                    <div style="flex:1">
                        <label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:5px; color:var(--text);">Data</label>
                        <input type="date" id="fa-date" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);">
                    </div>
                    <div style="flex:1">
                        <label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:5px; color:var(--text);">Horário</label>
                        <input type="time" id="fa-time" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);">
                    </div>
                </div>
                <button type="submit" class="btn-primary" style="padding:1.2rem; width:100%;">Confirmar e Bloquear Horário</button>
            </form>`;
        }
        else if(type === 'comanda') {
            const { data } = await db.from('clients').select('id, name').order('name');
            html += `<h3>Gerar Novo Ticket</h3><form onsubmit="Actions.createComanda(event)">
                <div class="input-group"><label>Cliente no Salão</label><select id="fcom-cli" required style="padding:1.2rem; border-radius:8px"><option value="">-- Buscar Cliente --</option>${data.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Abrir Comanda</button></form>`;
        }
        else if(type === 'servico') {
            html += `<h3>Cadastrar Serviço</h3><form onsubmit="Actions.createService(event)">
                <div class="input-group"><label>Nome</label><input type="text" id="fs-nome" required></div>
                <div style="display:flex; gap:10px;"><div class="input-group" style="flex:1"><label>Valor Final (R$)</label><input type="number" id="fs-valor" step="0.01" required></div><div class="input-group" style="flex:1"><label>Custo Fixo (R$)</label><input type="number" id="fs-custo" step="0.01" required></div></div>
                <div class="input-group"><label>Comissão do Profissional (%)</label><input type="number" id="fs-com" max="100" required></div>
                <div class="input-group" style="background:#f9f9f9; padding:15px; border-radius:12px"><label style="display:flex; align-items:center; gap:10px; cursor:pointer; margin:0"><input type="checkbox" id="fs-aux" onchange="document.getElementById('aux-com-div').style.display=this.checked?'block':'none'" style="width:20px; height:20px"> Com Auxiliar?</label></div>
                <div class="input-group" id="aux-com-div" style="display:none; margin-top:15px"><label>Comissão Auxiliar (%)</label><input type="number" id="fs-auxcom" max="100"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Salvar</button></form>`;
        }
        else if(type === 'produto') {
            html += `<h3>Novo Produto Automático</h3><form onsubmit="Actions.saveProduct(event)">
                <div class="input-group"><label>Cód. Barras (EAN) - Busca Nuvem</label><input type="text" id="fp-bar" oninput="Actions.fetchBarcode(this.value)" placeholder="Digite ou passe o leitor..." required></div>
                <div class="input-group"><label>Descrição do Produto</label><input type="text" id="fp-nome" readonly required placeholder="O sistema vai preencher isso..." style="background:#e9ecef; cursor:not-allowed; border: 1px dashed #ccc;"></div>
                <div style="display:flex; gap:10px; background:#f9f9f9; padding:15px; border-radius:12px; margin-bottom:15px">
                    <div class="input-group" style="margin:0"><label>Preço Venda (R$)</label><input type="number" id="fp-preco" step="0.01" required></div>
                    <div class="input-group" style="margin:0"><label>Comissão (%)</label><input type="number" id="fp-com" max="100" required></div>
                </div>
                <div style="display:flex; gap:10px;"><div class="input-group" style="flex:1"><label>Estoque Atual</label><input type="number" id="fp-qtd" required></div><div class="input-group" style="flex:1"><label>Alerta Mínimo</label><input type="number" id="fp-min" value="5" required></div></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Salvar Produto</button></form>`;
        }
        else if(type === 'add_estoque') {
            html += `<h3>Adicionar ao Estoque</h3><form onsubmit="Actions.updateStock(event, '${param1}', ${param2})">
                <div class="input-group"><label>Estoque Atual no Sistema: <b style="font-size:1.2rem; color:var(--primary)">${param2}</b></label><input type="number" id="fa-qtd" placeholder="Quantidade a somar" required min="1" style="padding:1.2rem; margin-top:10px; border-radius:8px"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Atualizar</button></form>`;
        }
        else if(type === 'despesa') {
            html += `<h3>Lançamento de Despesa/Custo</h3><form onsubmit="Actions.createDespesa(event)">
                <div class="input-group"><label>Descrição da Saída</label><input type="text" id="fd-desc" placeholder="Ex: Conta de Energia..." required></div>
                <div class="input-group"><label>Categoria do Gasto</label><select id="fd-cat" required style="padding:1.2rem; border-radius:8px"><option value="Custos Fixos">Custo Fixo (Aluguel, Água, Luz)</option><option value="Custos Variáveis">Custo Variável (Produtos)</option><option value="Pessoal/Pagamentos">Pessoal (Salários, Pró-Labore)</option></select></div>
                <div class="input-group"><label>Valor (R$)</label><input type="number" id="fd-val" step="0.01" required style="padding:1.2rem"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Registrar Saída</button></form>`;
        }
        else if(type === 'mensagem' || type === 'edit_mensagem') {
            let m = { title: '', content: '' };
            if (param1) { const { data } = await db.from('message_templates').select('*').eq('id', param1).single(); m = data; }
            html += `<h3>${param1 ? 'Editar Mensagem' : 'Novo Template Automático'}</h3><form onsubmit="Actions.saveMensagem(event, '${param1 || ''}')">
                <div class="input-group"><label>Título Interno</label><input type="text" id="fm-tit" value="${m.title}" required></div>
                <div class="input-group"><label>Corpo do Texto</label><textarea id="fm-txt" rows="5" required>${m.content}</textarea></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">${param1 ? 'Salvar Edição' : 'Criar Template'}</button></form>`;
        }
        else if(type === 'debitar' || type === 'desconto') {
            html += `<h3>${type==='debitar'?'Registrar Recebimento':'Aplicar Desconto'}</h3>
            <div style="background:#f9f9f9; padding:20px; border-radius:12px; margin-bottom:20px; border-left:5px solid #d32f2f">
                <p style="color:var(--muted); font-size:0.9rem; margin-bottom:5px">Pendente na Cobrança:</p>
                <b style="font-size:2rem; color:#d32f2f">${U.money(param2)}</b>
            </div>
            <form onsubmit="Actions.${type==='debitar'?'debitDebt':'discountDebt'}(event, '${param1}', ${param2})">
                <div class="input-group"><label>${type==='debitar'?'Valor Recebido (R$)':'Porcentagem do Desconto (%)'}</label><input type="number" id="f-val" step="0.01" required style="padding:1.2rem; font-size:1.2rem; border-radius:8px"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Confirmar</button></form>`;
        }
        else if(type === 'nova_anamnese') {
            html += `<h3>Ficha de Anamnese</h3><form onsubmit="Actions.saveAnamnese(event)">
            <div class="input-group"><label>Histórico Capilar</label><textarea id="fa-hist" rows="2" required></textarea></div>
            <div class="input-group"><label>Hábitos de Cuidado</label><textarea id="fa-hab" rows="2" required></textarea></div>
            <div class="input-group"><label>Objetivo da Cliente</label><textarea id="fa-obj" rows="2" required></textarea></div>
            <div class="input-group"><label>Diagnóstico Profissional</label><textarea id="fa-obs" rows="3" required></textarea></div>
            <button type="submit" class="btn-primary" style="padding:1.2rem">Salvar Prontuário</button></form>`;
        }
        else if(type === 'cliente') {
            html += `<h3>Novo Cliente</h3><form onsubmit="Actions.createClient(event)">
                <div class="input-group"><label>Nome Completo</label><input type="text" id="fc-nome" required style="padding:1.2rem; border-radius:8px"></div>
                <div class="input-group"><label>WhatsApp com DDD</label><input type="text" id="fc-fone" required style="padding:1.2rem; border-radius:8px"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Registrar</button></form>`;
        }
        html += `</div>`; cont.innerHTML = html; cont.classList.remove('hidden');
    },
    close() { document.getElementById('modal-container').classList.add('hidden'); }
};

const Actions = {
    async updatePassword(e) {
        e.preventDefault(); 
        const { error } = await db.from('users').update({ password: document.getElementById('new-pass').value, first_login: false }).eq('id', App.user.id);
        if(error) { UI.toast(`Erro ao atualizar senha: ${error.message}`, 'error'); return; }
        App.user.first_login = false; 
        Modals.close(); 
        UI.toast('Senha registrada com sucesso!'); 
        Auth.success(); 
    },
    async createClient(e) { e.preventDefault(); await db.from('clients').insert({ name: document.getElementById('fc-nome').value, phone: document.getElementById('fc-fone').value }); Modals.close(); UI.toast('Cliente adicionado!'); },
    
    async saveAnamnese(e) {
        e.preventDefault(); 
        
        // CORREÇÃO DA ANAMNESE: Puxa da memória travada. Se falhar, avisa na hora.
        const id = App.currentClientId;
        if (!id || id === 'undefined') {
            UI.toast('Erro interno: Cliente não identificado. Volte na tela de clientes e clique novamente.', 'error');
            return;
        }

        const payload = { client_id: id, history: document.getElementById('fa-hist').value, habits: document.getElementById('fa-hab').value, objectives: document.getElementById('fa-obj').value, notes: document.getElementById('fa-obs').value };
        const { error } = await db.from('anamnesis').insert(payload);
        if(error) { UI.toast(`Falha ao salvar: ${error.message}`, 'error'); return; }
        
        Modals.close(); UI.toast('Ficha clínica salva no histórico.'); this.loadAnamnese(id);
    },
    async loadAnamnese(id) {
        const { data } = await db.from('anamnesis').select('*').eq('client_id', id).order('created_at', {ascending: false});
        const div = document.getElementById('anamnese-history-list');
        if(!data || !data.length) { div.innerHTML = "<p style='color:var(--muted); text-align:center; padding:2rem'>Nenhum registro clínico encontrado para esta cliente.</p>"; return; }
        div.innerHTML = data.map(d => `<div class="card" style="border-left: 4px solid var(--primary); background:#fffafb"><h4 style="font-size:0.9rem; color:var(--muted); margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px"><i class="ph ph-calendar-blank"></i> Data: ${new Date(d.created_at).toLocaleDateString()}</h4><p style="margin-bottom:8px"><b>Histórico:</b> ${d.history}</p><p style="margin-bottom:8px"><b>Hábitos:</b> ${d.habits}</p><p style="margin-bottom:8px"><b>Objetivo:</b> ${d.objectives}</p><p style="padding:15px; background:white; border:1px solid #eee; border-radius:12px; margin-top:15px"><b style="color:var(--primary-dark)">Diagnóstico:</b><br>${d.notes}</p></div>`).join('');
    },

    async createAppointment(e) {
        e.preventDefault(); const auxId = document.getElementById('fa-aux').value;
        const { error } = await db.from('appointments').insert({ client_id: document.getElementById('fa-cli').value, service_id: document.getElementById('fa-serv').value, user_id: document.getElementById('fa-user').value, assistant_id: auxId || null, date: document.getElementById('fa-date').value, time: document.getElementById('fa-time').value });
        if(error) UI.toast(`Erro: ${error.message}`, 'error'); else { Modals.close(); UI.toast('Horário bloqueado com sucesso!'); }
    },

    async createComanda(e) {
        e.preventDefault(); 
        const { data } = await db.from('comandas').select('ticket').order('id', {ascending: false}).limit(1);
        let nxt = 1; if(data.length && data[0].ticket && data[0].ticket.includes('-')) { nxt = parseInt(data[0].ticket.split('-')[1]) + 1; }
        const tk = 'TKT-' + String(nxt).padStart(4, '0');
        await db.from('comandas').insert({ client_id: document.getElementById('fcom-cli').value, user_id: App.user.id, ticket: tk });
        Modals.close(); UI.toast(`Comanda ${tk} gerada!`);
    },
    async addComandaItem(id) {
        const val = document.getElementById('add-item-sel').value; if(!val) { UI.toast('Selecione algo da lista.', 'error'); return; }
        const item = JSON.parse(val); 
        
        if(item.type === 'product') {
            const { data: prod } = await db.from('products').select('stock').eq('id', item.id).single();
            if(prod.stock <= 0) return UI.toast('Este produto está sem estoque disponível.', 'error');
            await db.from('products').update({stock: prod.stock - 1}).eq('id', item.id);
        }
        
        const { data: comanda } = await db.from('comandas').select('items, total').eq('id', id).single();
        const items = comanda.items || []; items.push(item);
        await db.from('comandas').update({ items, total: comanda.total + item.price }).eq('id', id);
        
        Modals.close(); setTimeout(() => Modals.open('edit_comanda', id), 100);
    },
    async removeComandaItem(comandaId, itemIndex) {
        UI.confirm('Remover este lançamento da comanda?', async () => {
            const { data: comanda } = await db.from('comandas').select('items, total').eq('id', comandaId).single();
            const items = comanda.items || [];
            const item = items[itemIndex];
            
            if(item.type === 'product') { 
                const { data: prod } = await db.from('products').select('stock').eq('id', item.id).single();
                if(prod) await db.from('products').update({stock: prod.stock + 1}).eq('id', item.id);
            }
            
            items.splice(itemIndex, 1);
            await db.from('comandas').update({ items, total: Math.max(0, comanda.total - item.price) }).eq('id', comandaId);
            Modals.close(); setTimeout(() => Modals.open('edit_comanda', comandaId), 100); UI.toast('Item deletado.');
        });
    },
    async closeComanda(comandaId, clientId, total, ticketNum) {
        UI.confirm('Deseja fechar a comanda e enviar para Faturamento?', async () => {
            await db.from('comandas').update({ status: 'fechada' }).eq('id', comandaId);
            if(total > 0) { await db.from('debts').insert({ client_id: clientId, total_amount: total, remaining_amount: total, comanda_id: comandaId, comanda_ticket: ticketNum }); }
            Modals.close(); UI.toast('Comanda Faturada com Sucesso!');
        });
    },
    async reopenComanda(id) {
        UI.confirm('ALERTA: Reabrir a comanda exclui as dívidas e os valores lançados no Extrato Financeiro provenientes dela. Continuar?', async () => {
            await db.from('debts').delete().eq('comanda_id', id);
            await db.from('comandas').update({ status: 'aberta' }).eq('id', id);
            Modals.close(); UI.toast('Ação Desfeita! Comanda Reaberta.');
        });
    },

    async createService(e) {
        e.preventDefault(); const aux = document.getElementById('fs-aux').checked;
        await db.from('services').insert({ name: document.getElementById('fs-nome').value, price: document.getElementById('fs-valor').value, cost: document.getElementById('fs-custo').value, commission: document.getElementById('fs-com').value, has_assistant: aux, assistant_commission: aux ? document.getElementById('fs-auxcom').value : 0 });
        Modals.close(); UI.toast('Serviço adicionado ao catálogo!');
    },
    
    async fetchBarcode(val) {
        if(val.length >= 8) {
            const inputNome = document.getElementById('fp-nome');
            inputNome.value = "Buscando no servidor...";
            try {
                let res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${val}.json`);
                let json = await res.json();
                if(json.status === 1 && json.product.product_name) {
                    inputNome.value = json.product.product_name;
                    UI.toast('Produto encontrado!', 'success'); return;
                }
                
                res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${val}`);
                json = await res.json();
                if(json.items && json.items.length > 0) {
                    inputNome.value = json.items[0].title;
                    UI.toast('Produto encontrado!', 'success'); return;
                }
                throw new Error("Não encontrou");
            } catch(e) { 
                inputNome.value = ""; 
                inputNome.removeAttribute('readonly'); 
                inputNome.style.background = "#fff"; 
                inputNome.style.cursor = "text"; 
                inputNome.placeholder = "Não localizado na internet. Digite o nome...";
                UI.toast('Produto não listado online. Digite o nome.', 'warning');
            }
        }
    },
    async saveProduct(e) { e.preventDefault(); await db.from('products').insert({ barcode: document.getElementById('fp-bar').value, name: document.getElementById('fp-nome').value, price: document.getElementById('fp-preco').value, commission: document.getElementById('fp-com').value, stock: document.getElementById('fp-qtd').value, min_stock: document.getElementById('fp-min').value }); Modals.close(); UI.toast('Registro finalizado!'); },
    async updateStock(e, id, curStock) {
        e.preventDefault(); const v = parseInt(document.getElementById('fa-qtd').value);
        await db.from('products').update({stock: curStock + v}).eq('id', id); Modals.close(); UI.toast('Estoque atualizado!');
    },

    async saveMensagem(e, id) { 
        e.preventDefault(); 
        const payload = { title: document.getElementById('fm-tit').value, content: document.getElementById('fm-txt').value };
        if(id) await db.from('message_templates').update(payload).eq('id', id);
        else await db.from('message_templates').insert(payload);
        Modals.close(); UI.toast(id ? 'Template reescrito!' : 'Novo padrão salvo!'); 
    },
    async deleteMensagem(id) { UI.confirm('Deletar este modelo de mensagem permanentemente?', async () => { await db.from('message_templates').delete().eq('id', id); UI.toast('Modelo descartado.'); }); },

    async createDespesa(e) { e.preventDefault(); await db.from('despesas').insert({ description: document.getElementById('fd-desc').value, amount: document.getElementById('fd-val').value, category: document.getElementById('fd-cat').value }); Modals.close(); UI.toast('Saída registrada!'); },

    async debitDebt(e, id, max) { 
        e.preventDefault(); const v = parseFloat(document.getElementById('f-val').value); 
        const nV = Math.max(0, max - v);
        await db.from('debts').update({ remaining_amount: nV }).eq('id', id); 
        if (nV === 0) { await db.from('debts').delete().eq('id', id); }
        Modals.close(); UI.toast('Pagamento processado.'); 
    },
    async discountDebt(e, id, max) { e.preventDefault(); const perc = parseFloat(document.getElementById('f-val').value); await db.from('debts').update({ remaining_amount: Math.max(0, max - (max * perc / 100)) }).eq('id', id); Modals.close(); UI.toast('Desconto autorizado!'); },

    async saveSettings(e) {
        e.preventDefault(); const n = document.getElementById('cfg-name').value; const p = document.getElementById('cfg-phone').value;
        const payload = { studio_name: n, official_phone: p };
        if(App.settings.id) await db.from('settings').update(payload).eq('id', App.settings.id);
        else await db.from('settings').insert(payload);
        App.settings = {...App.settings, ...payload}; document.getElementById('brand-name').textContent = n;
        UI.toast('Preferências salvas!');
    },

    sendWhatsApp(phone) {
        const msg = document.getElementById('wpp-msg').value; if(!msg) return UI.toast('Escreva algo.', 'error');
        Modals.close();
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }
    }, 4000);
    Auth.init();
});
