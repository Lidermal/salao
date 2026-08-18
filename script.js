/** 
 * SISTEMA ESTÚDIO AMOR QUE CUIDA
 * INTEGRAÇÃO COMPLETA + QUINZENAS + RELATÓRIOS + COBRANÇAS EXCLUSIVAS + NOTIFICAÇÕES
 */

const DB_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';

const db = window.supabase.createClient(DB_URL, DB_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const App = { 
    user: null, 
    role: 'freelancer', 
    view: 'agenda', 
    currentDate: new Date(), 
    charts: {}, 
    settings: {}
};

const U = {
    money: v => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v||0),
    iso: d => { const tzOffset = d.getTimezoneOffset() * 60000; return (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0]; },
    date: d => new Date(d).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}),

    fillTemplate(text, vars) {
        let out = text || '';
        Object.keys(vars || {}).forEach(k => {
            if (k.startsWith('_')) return;
            out = out.split(`{${k}}`).join(vars[k] ?? '');
        });
        return out;
    },
    
    getCurrentQuinzenaValue() {
        let curr = new Date();
        let m = String(curr.getMonth() + 1).padStart(2, '0');
        let y = curr.getFullYear();
        let q = curr.getDate() <= 15 ? 'Q1' : 'Q2';
        return `${y}-${m}-${q}`;
    },
    
    generateQuinzenasOptions() {
        let html = '';
        let curr = new Date();
        for(let i=0; i<8; i++) {
            let d = new Date(curr.getFullYear(), curr.getMonth() - Math.floor(i/2), 1);
            let m = String(d.getMonth() + 1).padStart(2, '0');
            let y = d.getFullYear();
            let mName = d.toLocaleString('pt-BR', {month:'long'});
            let q = (i % 2 === 0) ? 'Q2' : 'Q1';
            if(i === 0 && curr.getDate() <= 15) continue;
            let val = `${y}-${m}-${q}`;
            html += `<option value="${val}">${q === 'Q1' ? '1ª' : '2ª'} Quinzena (${mName}/${y})</option>`;
        }
        return html;
    },
    
    getQuinzenaDates(val) {
        if(!val) return { start: '1970-01-01T00:00:00Z', end: '2099-12-31T23:59:59Z' };
        const [y, m, q] = val.split('-');
        const lastDay = new Date(y, m, 0).getDate();
        if (q === 'Q1') return { start: `${y}-${m}-01T00:00:00Z`, end: `${y}-${m}-15T23:59:59Z` };
        return { start: `${y}-${m}-16T00:00:00Z`, end: `${y}-${m}-${lastDay}T23:59:59Z` };
    },
    initFilters() {
        const opts = this.generateQuinzenasOptions();
        document.querySelectorAll('.quinzena-select').forEach(sel => {
            sel.innerHTML = opts;
            sel.value = this.getCurrentQuinzenaValue(); 
        });
    },

    buildExtrato(comand, desp) {
        let groups = {};
        let ticketDate = {}; 
        let avulsos = []; 

        (comand || []).forEach(c => {
            if (c.total > 0) {
                const tk = c.ticket || `SEMTKT-${c.created_at}`;
                const dt = new Date(c.created_at);
                ticketDate[tk] = dt;
                groups[tk] = groups[tk] || {};
                groups[tk].date = dt;
                groups[tk].in = { type: 'in', desc: `Comanda Fechada ${c.ticket || '-'}`, val: c.total, date: dt };
            }
        });

        (desp || []).forEach(d => {
            const m = (d.description || '').match(/Ref:\s*(TKT-\d+)/);
            const tk = m ? m[1] : null;
            const dt = (tk && ticketDate[tk]) ? ticketDate[tk] : new Date(d.date);
            const item = { type: 'out', desc: d.description, val: d.amount, date: dt };
            if (tk) {
                groups[tk] = groups[tk] || { date: dt };
                if (d.category === 'Comissões' || /comiss/i.test(d.description || '')) groups[tk].comissao = item;
                else groups[tk].custo = item;
            } else {
                avulsos.push(item);
            }
        });

        let blocks = [];
        Object.keys(groups).forEach(tk => {
            const g = groups[tk]; const items = [];
            if (g.in) items.push(g.in);
            if (g.custo) items.push(g.custo);
            if (g.comissao) items.push(g.comissao);
            if (items.length) blocks.push({ sortDate: g.date, items });
        });
        avulsos.forEach(a => blocks.push({ sortDate: a.date, items: [a] }));

        blocks.sort((a, b) => a.sortDate - b.sortDate);
        let extrato = blocks.flatMap(b => b.items);

        let saldoAtual = 0, totalIn = 0, totalOut = 0;
        extrato = extrato.map(item => {
            if (item.type === 'in') totalIn += item.val; else totalOut += item.val;
            saldoAtual += item.type === 'in' ? item.val : -item.val;
            return { ...item, saldo: saldoAtual };
        });

        extrato.reverse();
        return { extrato, totalIn, totalOut };
    },

    orderDespesas(desp, comand) {
        let ticketDate = {};
        (comand || []).forEach(c => { if (c.ticket) ticketDate[c.ticket] = new Date(c.created_at); });

        let groups = {}; let avulsos = [];
        (desp || []).forEach(d => {
            const m = (d.description || '').match(/Ref:\s*(TKT-\d+)/);
            const tk = m ? m[1] : null;
            const dt = (tk && ticketDate[tk]) ? ticketDate[tk] : new Date(d.date);
            const displayItem = { ...d, date: dt }; 
            if (tk) {
                groups[tk] = groups[tk] || { date: dt };
                if (d.category === 'Comissões' || /comiss/i.test(d.description || '')) groups[tk].comissao = displayItem;
                else groups[tk].custo = displayItem;
            } else avulsos.push(displayItem);
        });
        let blocks = [];
        Object.keys(groups).forEach(tk => {
            const g = groups[tk]; const items = [];
            if (g.comissao) items.push(g.comissao);
            if (g.custo) items.push(g.custo);
            if (items.length) blocks.push({ sortDate: g.date, items });
        });
        avulsos.forEach(a => blocks.push({ sortDate: new Date(a.date), items: [a] }));
        blocks.sort((a, b) => b.sortDate - a.sortDate);
        return blocks.flatMap(b => b.items);
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
        document.getElementById('confirm-cancel').onclick = () => modal.classList.add('hidden');
        document.getElementById('confirm-ok').onclick = () => { modal.classList.add('hidden'); onConfirm(); };
    },
    handleFabClick() {
        const v = App.view;
        if(v === 'agenda') Modals.open('menu_agenda_mobile');
        else if(v === 'comandas') Modals.open('comanda');
        else if(v === 'clientes') Modals.open('cliente');
        else if(v === 'funcionarios' && App.role === 'owner') Modals.open('funcionario');
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
            const { data, error } = await db.from('users').select('*').ilike('username', u).maybeSingle();
            
            if (error) throw new Error(`Falha no sistema: ${error.message}`);
            if (!data) throw new Error("Usuário não encontrado.");
            if (data.active === false) throw new Error("Esta conta foi desativada. Procure a Administração.");
            if (data.password !== p) throw new Error("Senha incorreta.");
            
            App.user = data; 
            App.role = data.role;
            
            document.getElementById('login-form').reset();
            this.success();

            if(data.first_login || p === '123456') { 
                setTimeout(() => {
                    Modals.open('first_login'); 
                    const closeBtn = document.querySelector('#modal-container .modal-close');
                    if(closeBtn) closeBtn.style.display = 'none';
                }, 500);
            }
            
        } catch(e) { 
            UI.toast(e.message, 'error'); 
            btn.textContent = 'Entrar'; 
        }
    },
    async success() {
        document.getElementById('auth-layer').classList.add('hidden'); 
        document.getElementById('system-layout').classList.remove('hidden');
        document.getElementById('header-user').textContent = App.user.name.split(' ')[0]; 
        document.getElementById('header-avatar').textContent = App.user.name.substring(0,2).toUpperCase();
        document.body.classList.toggle('is-owner', App.role === 'owner');
        
        const { data: set } = await db.from('settings').select('*').single();
        if(set) { App.settings = set; document.getElementById('brand-name').textContent = set.studio_name; }
        
        U.initFilters();
        Nav.init(); Nav.showView('agenda');
        
        db.channel('custom-all-channel').on('postgres_changes', { event: '*', schema: 'public' }, payload => {
            if(Render[App.view]) Render[App.view]();
        }).subscribe();
    },
    logout() { 
        UI.confirm('Deseja realmente sair da sua conta?', () => {
            App.user = null;
            window.location.reload(true); 
        }); 
    }
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
        
        const titles = { agenda:'Agenda', comandas:'Comandas', cobrancas:'Cobranças', clientes:'Clientes', anamnese:'Ficha de Avaliação', 'perfil-cliente':'Perfil do Cliente', servicos:'Catálogo de Serviços', produtos:'Estoque & Preços', comissao:'Dashboard de Comissões', mensagens:'Mensagens Automáticas', despesas:'Gestão de Despesas', 'resumo-financeiro':'Fluxo de Caixa', performance:'Métricas e Resultados', configuracoes:'Ajustes do Sistema', funcionarios:'Equipe do Salão', relatorios:'Relatórios & Arquivos', notificacoes:'Notificações' };
        document.getElementById('page-title').textContent = titles[id] || 'Amor que Cuida';
        
        const detailViews = ['anamnese', 'perfil-cliente'];
        if(Render[id] && !detailViews.includes(id)) Render[id]();
    },
    toggleMenu() { document.getElementById('main-sidebar').classList.toggle('open'); document.getElementById('mobile-overlay').classList.toggle('hidden'); },
    closeMenu() { document.getElementById('main-sidebar').classList.remove('open'); document.getElementById('mobile-overlay').classList.add('hidden'); }
};

const Render = {
    async agenda() {
        this.buildCalendar();
        try {
            let query = db.from('appointments').select('*, clients(name, phone), services(name), users!user_id(name)').eq('date', U.iso(App.currentDate)).order('time', {ascending: true});
            if (App.role !== 'owner') query = query.eq('user_id', App.user.id);

            const { data, error } = await query;
            if(error) throw error;
            const cont = document.getElementById('agenda-list');
            if(!data || !data.length) { cont.innerHTML = `<div class="card" style="text-align:center; padding:3rem"><p style="color:var(--muted)">Sua agenda está livre neste dia.</p></div>`; return; }
            
            let groupedData = [];
            let lastBlock = null;

            data.forEach(a => {
                if (a.status === 'bloqueado') {
                    if (lastBlock && lastBlock.user_id === a.user_id && lastBlock.notes === a.notes) {
                        let [h, m] = a.time.split(':').map(Number);
                        m += 30; if(m >= 60) { h+=1; m-=60; }
                        lastBlock.endTimeDisplay = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                    } else {
                        let [h, m] = a.time.split(':').map(Number);
                        m += 30; if(m >= 60) { h+=1; m-=60; }
                        lastBlock = { ...a, isGroupedBlock: true, endTimeDisplay: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` };
                        groupedData.push(lastBlock);
                    }
                } else {
                    lastBlock = null;
                    groupedData.push(a);
                }
            });

            cont.innerHTML = groupedData.map(a => {
                const isBlocked = a.status === 'bloqueado';
                const isArrived = a.status === 'chegou';
                let statusColor = isBlocked ? '#616161' : (isArrived ? '#2e7d32' : 'var(--primary-dark)');
                let statusBg = isBlocked ? '#e0e0e0' : (isArrived ? '#e8f5e9' : 'var(--primary-light)');
                let borderColor = isBlocked ? '#9e9e9e' : (isArrived ? '#4caf50' : 'var(--primary)');
                
                const displayTime = isBlocked ? `${a.time.slice(0,5)} até ${a.endTimeDisplay}` : a.time.slice(0,5);
                const titleText = isBlocked ? 'Horário Bloqueado' : (a.clients?.name || 'Cliente');
                const reasonText = a.notes || 'Sem justificativa';
                
                return `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid ${borderColor}; background: ${isBlocked ? '#f5f5f5' : '#fff'};">
                    <div>
                        <h4 style="font-size:1.2rem; color: ${isBlocked ? 'var(--muted)' : 'var(--text)'}">${displayTime} - ${titleText}</h4>
                        ${isBlocked ? `<p style="margin:5px 0; color:var(--muted); font-style:italic;">Indisponível<br>Motivo: ${reasonText}</p>` : `<p style="margin:5px 0; color:var(--muted)">${a.services?.name || '-'}</p>`}
                        <p style="font-size:0.8rem">Profissional: <b>${a.users?.name || '-'}</b></p>
                        ${(!isBlocked && a.status === 'agendado') ? `
                            <button class="btn-primary" style="padding: 5px 15px; font-size: 0.8rem; margin-top: 10px; margin-right:8px; width: auto;" onclick="Actions.markAsArrived('${a.id}')"><i class="ph ph-check"></i> Marcar como Chegou</button>
                            <button class="btn-secondary" style="padding: 5px 15px; font-size: 0.8rem; margin-top: 10px; width: auto; background:#e8f5e9; color:#1b8a4a; border:1px solid #25D366" onclick="Actions.sendConfirmacao('${a.id}')"><i class="ph ph-whatsapp-logo"></i> Confirmar via WhatsApp</button>
                        ` : ''}
                    </div>
                    <div style="background:${statusBg}; color:${statusColor}; padding:5px 12px; border-radius:20px; font-size:0.8rem; font-weight:bold; text-align:center;">${a.status.toUpperCase()}</div>
                </div>`;
            }).join('');
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
        
        document.getElementById('clientes-list').innerHTML = data.map(c => {
            const safeName = c.name.replace(/'/g, "\\'").replace(/"/g, '&quot;'); 
            return `
            <div class="card">
                <a href="#" class="wpp-btn" onclick="Modals.open('whatsapp', '${c.phone}', '${safeName}'); event.stopPropagation()"><i class="ph ph-whatsapp-logo"></i></a>
                <h4 style="color:var(--primary); font-size:1.2rem; margin-bottom:10px">${c.name}</h4><p><i class="ph ph-phone"></i> ${c.phone}</p>
                <div style="display:flex; gap:10px; margin-top:15px; flex-wrap:wrap">
                    <button class="btn-secondary" style="flex:1; min-width:120px;" onclick="Render.perfilCliente('${c.id}', '${safeName}')"><i class="ph ph-user"></i> Perfil</button>
                    <button class="btn-secondary" style="flex:1; min-width:120px;" onclick="Render.anamnese('${c.id}', '${safeName}')"><i class="ph ph-file-text"></i> Ficha</button>
                    <button class="btn-secondary" style="width:100%; border:1px solid #ccc" onclick="Modals.open('edit_cliente', '${c.id}')"><i class="ph ph-pencil"></i> Editar Dados</button>
                </div>
            </div>`;
        }).join('');
    },
    anamnese(id, name) {
        document.getElementById('current-anamnese-client-id').value = id;
        document.getElementById('anamnese-title').textContent = `Ficha de: ${name}`;
        Nav.showView('anamnese'); 
        Actions.loadAnamnese(id);
    },
    async perfilCliente(id, name) {
        document.getElementById('current-perfil-client-id').value = id;
        document.getElementById('perfil-cliente-title').textContent = `Perfil: ${name}`;
        Nav.showView('perfil-cliente');
        
        const { data: comandas } = await db.from('comandas').select('*, users(name)').eq('client_id', id).eq('status', 'fechada').order('created_at', {ascending: false});

        const { data: anamneseRaw } = await db.from('anamnesis').select('notes, created_at, user_id').eq('client_id', id).order('created_at', {ascending: false}).limit(1);
        let anamnese = anamneseRaw;
        if (anamnese && anamnese.length && anamnese[0].user_id) {
            const { data: prof } = await db.from('users').select('name').eq('id', anamnese[0].user_id).maybeSingle();
            anamnese[0].users = { name: prof?.name || 'Não identificado' };
        }

        const { data: debts } = await db.from('debts').select('*').eq('client_id', id).gt('remaining_amount', 0).maybeSingle();
        
        const debitosDiv = document.getElementById('perfil-debitos-destaque');
        if (debts && debts.remaining_amount > 0) {
            debitosDiv.innerHTML = `<div class="card" style="background:#ffebee; border-left:5px solid #d32f2f; margin-bottom:10px;">
                <h4 style="color:#d32f2f; margin-bottom:5px;"><i class="ph ph-warning-circle"></i> Atenção: Cliente possui débitos ativos</h4>
                <p style="font-size:1.1rem">Valor Pendente: <b>${U.money(debts.remaining_amount)}</b></p>
                <p style="font-size:0.8rem; color:var(--muted); margin-top:5px">Ref. Tickets Unificados: ${debts.comanda_ticket}</p>
                <button class="btn-primary" style="margin-top:10px; background:#d32f2f; width:auto; padding:0.5rem 1rem" onclick="Nav.showView('cobrancas')">Ir para Cobranças</button>
            </div>`;
        } else { debitosDiv.innerHTML = ''; }

        const anamneseDiv = document.getElementById('perfil-anamnese-destaque');
        if(anamnese && anamnese.length > 0) {
            anamneseDiv.innerHTML = `<div class="card" style="background:#fffafb; border:1px solid var(--primary-light);"><h4 style="color:var(--primary-dark); margin-bottom:10px;"><i class="ph ph-file-text"></i> Diagnóstico da Última Avaliação</h4><p style="font-style:italic;">"${anamnese[0].notes}"</p><span style="font-size:0.75rem; color:var(--muted); display:block; margin-top:10px;">Anotado em: ${new Date(anamnese[0].created_at).toLocaleDateString()} por ${anamnese[0].users?.name || 'Não identificado'}</span></div>`;
        } else { anamneseDiv.innerHTML = ''; }

        document.getElementById('perfil-info').innerHTML = `<div class="card" style="border-left:4px solid var(--primary);"><h4 style="font-size:1.2rem;">Total de Visitas Concluídas: ${comandas.length}</h4></div>`;
        
        const list = document.getElementById('perfil-visitas-list');
        if(!comandas || comandas.length === 0) {
            list.innerHTML = "<p style='color:var(--muted); padding:2rem; text-align:center;'>Nenhum histórico de visita concluída.</p>"; return;
        }

        list.innerHTML = comandas.map(c => {
            const itens = (c.items||[]).map(i => i.name).join(', ');
            return `<div class="card" style="margin-bottom:10px;">
                <h4 style="color:var(--primary-dark); font-size:1.1rem; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                    <i class="ph ph-calendar"></i> ${new Date(c.created_at).toLocaleDateString()}
                </h4>
                <p style="margin-bottom:5px;"><b>Ticket Associado:</b> ${c.ticket || 'S/N'}</p>
                <p style="margin-bottom:5px;"><b>Profissional Responsável:</b> ${c.users?.name || 'Não informado'}</p>
                <p style="margin-bottom:5px;"><b>Serviços/Produtos Consumidos:</b> ${itens || 'Nenhum detalhe salvo'}</p>
                <p><b>Total Investido na Visita:</b> ${U.money(c.total)}</p>
            </div>`;
        }).join('');
    },

    async cobrancas() {
        const { data: debts, error } = await db.from('debts').select('*, clients(name)').gt('remaining_amount', 0).order('created_at', {ascending: false});
        const cont = document.getElementById('cobrancas-list');
        if(error) { cont.innerHTML = `<p style='color:#d32f2f'><i class="ph ph-warning-circle"></i> Erro ao carregar cobranças: ${error.message}</p>`; UI.toast(`Erro em Cobranças: ${error.message}`, 'error'); return; }
        if (!debts || debts.length === 0) { cont.innerHTML = "<p style='color:var(--muted)'>Nenhuma cobrança em aberto no momento.</p>"; return; }
        
        let htmlFinal = '';
        for (let d of debts) {
            const fTkt = `FAT-${d.id.substring(0,5).toUpperCase()}`; 
            const ticketsArr = d.comanda_ticket ? d.comanda_ticket.split(', ').map(t => t.trim()) : [];
            const { data: relatedComandas } = await db.from('comandas').select('items, created_at, ticket').in('ticket', ticketsArr);
            
            let htmlList = '';
            if(relatedComandas) {
                relatedComandas.forEach(rc => {
                    const dt = new Date(rc.created_at).toLocaleDateString();
                    if(rc.items) {
                        htmlList += `<div style="font-size:0.75rem; color:#666; margin-top:10px; border-bottom:1px dashed #ccc; padding-bottom:3px; font-family:sans-serif;">Comanda Origem: ${rc.ticket} (${dt})</div>`;
                        rc.items.forEach(i => {
                            htmlList += `<div style="display:flex; justify-content:space-between; padding:5px 0; font-size:0.95rem;"><span>${i.name}</span><b>${U.money(i.price)}</b></div>`;
                        });
                    }
                });
            }

            htmlFinal += `
            <div class="card" style="padding:0; overflow:hidden; border:1px solid #d32f2f;">
                <div style="background:#fffee6; padding:20px; font-family:'Courier New', Courier, monospace; color:#333; border-bottom:2px dashed #ccc;">
                    <h3 style="text-align:center; font-family:'Courier New', monospace; font-weight:bold; margin-bottom:5px; font-size:1.4rem; color:#d32f2f">FATURA DE COBRANÇA</h3>
                    <h4 style="text-align:center; margin-bottom:15px; font-size:1rem; color:#666">${fTkt}</h4>
                    <p style="margin-bottom:5px; border-bottom:1px solid #ddd; padding-bottom:10px;"><b>Cliente:</b> ${d.clients?.name}</p>
                    
                    <div style="padding:10px 0; margin-bottom:15px; max-height:200px; overflow-y:auto; border-bottom:1px dashed #999;">
                        ${htmlList || 'Nenhum detalhe de itens encontrado.'}
                    </div>
                    
                    <div style="font-size:0.85rem; color:#666; margin-bottom:10px; text-align:right;">Valor Original Consumido: ${U.money(d.total_amount)}</div>
                    <div style="display:flex; justify-content:space-between; font-size:1.4rem; font-weight:bold; color:#d32f2f; padding-top:10px">
                        <span>FALTA PAGAR:</span>
                        <span>${U.money(d.remaining_amount)}</span>
                    </div>
                </div>
                <div style="padding:15px; display:flex; gap:10px; background:#fff">
                    <button class="btn-primary" style="flex:1; background:#2e7d32;" onclick="Modals.open('debitar', '${d.id}', ${d.remaining_amount}, '${fTkt}')"><i class="ph ph-money"></i> Receber Pagamento</button>
                    ${App.role==='owner' ? `<button class="btn-secondary" style="width:auto;" onclick="Modals.open('desconto', '${d.id}', ${d.remaining_amount})"><i class="ph ph-percent"></i> Desc.</button>` : ''}
                </div>
            </div>`;
        }
        cont.innerHTML = htmlFinal;
    },

    async servicos() {
        const { data } = await db.from('services').select('*').order('name');
        document.getElementById('servicos-list').innerHTML = data.map(s => `<div class="card"><h4 style="font-size:1.2rem; border-bottom:1px solid #eee; padding-bottom:10px">${s.name}</h4><div style="margin:10px 0; color:var(--muted)"><p>Comissão: <b style="color:var(--text)">${s.commission}%</b></p>${s.has_assistant?`<p>Auxiliar: <b style="color:var(--text)">${s.assistant_commission}%</b></p>`:''}<p>Custo Fixo Lançado: <b style="color:#d32f2f">${U.money(s.cost)}</b></p></div><div class="val" style="font-size:1.5rem">${U.money(s.price)}</div></div>`).join('');
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
        let query = db.from('comandas').select('*, clients(name), users(name)').order('created_at', {ascending: false});
        
        const qFilter = document.getElementById('filter-comanda-quinzena')?.value;
        if (qFilter) {
            const range = U.getQuinzenaDates(qFilter);
            query = query.gte('created_at', range.start).lte('created_at', range.end);
        }

        const { data } = await query;
        document.getElementById('comandas-list').innerHTML = (!data || data.length === 0) ? '<p style="color:var(--muted)">Sem comandas para este período.</p>' : data.map(c => `
            <div class="card" style="border-left: 5px solid ${c.status === 'aberta' ? 'var(--primary)' : '#ccc'}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span style="font-size:0.8rem; color:var(--primary); font-weight:bold; letter-spacing:1px">${c.ticket || 'TKT-####'}</span>
                        <h4 style="font-size:1.2rem; margin-top:5px">${c.clients?.name || 'Desconhecido'}</h4>
                        <p style="font-size:0.8rem; color:var(--muted)">${new Date(c.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <span style="font-size:0.7rem; font-weight:bold; padding: 4px 10px; border-radius:20px; background:${c.status === 'aberta' ? 'var(--primary-light)' : '#eee'}; color:${c.status === 'aberta' ? 'var(--primary-dark)' : 'var(--muted)'}">${c.status.toUpperCase()}</span>
                </div>
                <div class="val" style="font-size:1.8rem; margin:15px 0;">${U.money(c.total)}</div>
                <button class="btn-secondary" style="width:100%; padding:0.8rem" onclick="Modals.open('edit_comanda', '${c.id}')"><i class="ph ph-list-plus"></i> ${c.status === 'aberta' ? 'Lançar Itens / Fechar' : 'Visualizar Ticket'}</button>
            </div>`).join('');
    },
    async mensagens() {
        const { data } = await db.from('message_templates').select('*');
        document.getElementById('mensagens-list').innerHTML = data.map(m => `
            <div class="card"><h4 style="color:var(--primary); border-bottom:1px solid #eee; padding-bottom:10px">${m.title}</h4>
            <p style="margin:15px 0; font-style:italic; color:var(--muted)">"${m.content}"</p>
            <p style="font-size:0.75rem; color:var(--muted); margin-bottom:10px"><i class="ph ph-magic-wand"></i> Placeholders disponíveis: {cliente}, {data}, {hora}, {profissional}, {servico}, {salao}</p>
            <div style="display:flex; gap:10px">
                <button class="btn-secondary" style="flex:1" onclick="Modals.open('edit_mensagem', '${m.id}')"><i class="ph ph-pencil"></i> Editar</button>
                <button class="btn-secondary" style="flex:1; color:#d32f2f; background:#ffebee" onclick="Actions.deleteMensagem('${m.id}')"><i class="ph ph-trash"></i> Excluir</button>
            </div></div>`).join('');
    },
    
    async funcionarios() {
        const { data } = await db.from('users').select('*').neq('username', 'admin.teste').order('name');
        document.getElementById('funcionarios-list').innerHTML = data.map(u => {
            const isActive = u.active !== false;
            return `
            <div class="card" style="border-left: 4px solid ${isActive ? 'var(--primary)' : '#999'}; opacity: ${isActive ? '1' : '0.6'}">
                <h4 style="font-size:1.2rem; margin-bottom:5px">${u.name}</h4>
                <p style="font-size:0.9rem; color:var(--muted)"><i class="ph ph-user"></i> Login: <b>${u.username}</b></p>
                <p style="font-size:0.8rem; margin-top:5px; padding:3px 8px; border-radius:10px; display:inline-block; background:${u.role==='owner'?'#ffebee':'#e8f5e9'}; color:${u.role==='owner'?'#d32f2f':'#2e7d32'}">${u.role.toUpperCase()}</p>
                ${!isActive ? `<p style="font-size:0.8rem; color:#d32f2f; margin-top:5px; font-weight:bold">CONTA DESATIVADA</p>` : ''}
                <div style="display:flex; gap:10px; margin-top:15px; flex-wrap:wrap">
                    <button class="btn-secondary" style="flex:1; min-width:120px;" onclick="Modals.open('edit_funcionario', '${u.id}')"><i class="ph ph-pencil"></i> Editar Perfil</button>
                    <button class="btn-secondary" style="flex:1; min-width:120px; ${isActive ? 'color:#d32f2f;' : 'color:#2e7d32;'}" onclick="Actions.toggleFuncionarioStatus('${u.id}', ${isActive})"><i class="ph ${isActive ? 'ph-prohibit' : 'ph-check-circle'}"></i> ${isActive ? 'Desativar' : 'Ativar'}</button>
                    <button class="btn-secondary" style="flex:1; min-width:120px; color:#d32f2f;" onclick="Actions.deleteFuncionario('${u.id}')"><i class="ph ph-trash"></i> Excluir</button>
                </div>
            </div>`;
        }).join('');
    },
    
    async despesas() {
        const range = U.getQuinzenaDates(U.getCurrentQuinzenaValue()); 
        const [ {data: rawData}, {data: comand} ] = await Promise.all([
            db.from('despesas').select('*').gte('date', range.start).lte('date', range.end),
            db.from('comandas').select('ticket, created_at').eq('status', 'fechada').gte('created_at', range.start).lte('created_at', range.end)
        ]);
        const data = U.orderDespesas(rawData, comand); 
        let totais = { 'Custos Fixos': 0, 'Comissões': 0, 'Pessoal/Pagamentos': 0, 'Custos Variáveis': 0 };
        data.forEach(d => { if(totais[d.category] !== undefined) totais[d.category] += d.amount; else totais['Custos Variáveis'] += d.amount; });
        
        document.getElementById('despesas-list').innerHTML = `
            <p style="color:var(--muted); font-size:0.9rem; margin-bottom:1.5rem"><i class="ph ph-info"></i> Registros de quinzenas anteriores foram arquivados em <b>Relatórios & Arquivos</b>.</p>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:20px">
                <div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #d32f2f"><p style="font-size:0.8rem">Custos Fixos</p><div class="val" style="color:#d32f2f; font-size:1.2rem">-${U.money(totais['Custos Fixos'])}</div></div>
                <div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #cd7f32"><p style="font-size:0.8rem">Comissões Autom.</p><div class="val" style="color:#cd7f32; font-size:1.2rem">-${U.money(totais['Comissões'])}</div></div>
                <div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #8e24aa"><p style="font-size:0.8rem">Pessoal/Equipe</p><div class="val" style="color:#8e24aa; font-size:1.2rem">-${U.money(totais['Pessoal/Pagamentos'])}</div></div>
                <div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #e65100"><p style="font-size:0.8rem">Variáveis/Insumos</p><div class="val" style="color:#e65100; font-size:1.2rem">-${U.money(totais['Custos Variáveis'])}</div></div>
            </div>` + 
            data.map(d => {
                let color = '#d32f2f';
                if(d.category === 'Comissões') color = '#cd7f32';
                else if(d.category === 'Pessoal/Pagamentos') color = '#8e24aa';
                else if(d.category === 'Custos Variáveis') color = '#e65100';

                return `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid ${color}">
                    <div><h4>${d.description}</h4><p style="font-size:0.8rem; color:var(--muted)">${d.category} • ${new Date(d.date).toLocaleString('pt-BR')}</p></div>
                    <div class="val" style="color:${color}">-${U.money(d.amount)}</div>
                </div>`;
            }).join('');
            
        if(App.charts.despesas) App.charts.despesas.destroy();
        App.charts.despesas = new Chart(document.getElementById('chart-despesas'), { 
            type: 'pie', 
            data: { labels: Object.keys(totais), datasets: [{ data: Object.values(totais), backgroundColor: ['#d32f2f', '#cd7f32', '#8e24aa', '#e65100'] }] }
        });
    },

    async comissao() {
        const isOwner = App.role === 'owner';
        let query = db.from('comandas').select('*, users(name)');
        
        const qFilter = document.getElementById('filter-comissao-quinzena')?.value || U.getCurrentQuinzenaValue();
        const range = U.getQuinzenaDates(qFilter);
        query = query.gte('created_at', range.start).lte('created_at', range.end);

        if(!isOwner) query = query.eq('user_id', App.user.id);
        const { data } = await query;
        
        let html = ''; let totalComissao = 0; let rank = {};
        data.forEach(c => {
            if(!c.items || c.status !== 'fechada') return; 
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
            html = `<div class="card" style="margin-bottom:20px; background:linear-gradient(135deg, var(--primary), var(--primary-dark)); color:white; padding:2rem; box-shadow:0 10px 20px rgba(183, 110, 121, 0.3)"><h3 style="color:white; font-weight:400; opacity:0.9">Total de Comissões Geradas na Quinzena</h3><div class="val" style="color:white; font-size:3rem; margin-top:10px">${U.money(totalComissao)}</div><p style="font-size:0.8rem; opacity:0.8; margin-top:10px">Verifique em Gestão de Custos o arquivamento automático.</p></div>
            <h3 style="margin:20px 0 15px 0">Ranking de Comissionamento</h3><div class="data-grid">` + 
            sorted.map((s,i) => {
                let color = '#cd7f32'; if(i===0) color='#ffd700'; else if(i===1) color='#c0c0c0';
                return `<div class="card"><div style="display:flex; justify-content:space-between; align-items:center"><h4 style="font-size:1.1rem">${i+1}º ${s[0]}</h4><i class="ph ph-medal" style="color:${color}; font-size:2rem"></i></div><div class="val" style="margin-top:15px; font-size:1.8rem">${U.money(s[1])}</div></div>`;
            }).join('') + '</div>';
        } else {
            html = `<div class="card" style="margin-bottom:20px; background:var(--primary); color:white; padding:2rem"><h4 style="color:white; font-weight:400">Minha Comissão</h4><div class="val" style="color:white; font-size:3rem; margin-top:10px">${U.money(totalComissao)}</div></div><div class="data-list">` + html + `</div>`;
        }
        document.getElementById('comissao-dashboard').innerHTML = html;
    },
    
    async 'resumo-financeiro'() {
        let qComand = db.from('comandas').select('total, ticket, created_at').eq('status', 'fechada');
        let qDesp = db.from('despesas').select('description, amount, date');
        
        const range = U.getQuinzenaDates(U.getCurrentQuinzenaValue()); 
        qComand = qComand.gte('created_at', range.start).lte('created_at', range.end);
        qDesp = qDesp.gte('date', range.start).lte('date', range.end);

        const [ {data:comand}, {data:desp} ] = await Promise.all([qComand, qDesp]);
        
        const receita = comand.reduce((acc, c) => acc + c.total, 0); 
        const gasto = desp.reduce((acc, d) => acc + d.amount, 0); 
        const lucro = receita - gasto;
        
        document.getElementById('resumo-cards').innerHTML = `
            <div class="card" style="border-bottom:4px solid #2e7d32"><h4>Faturamento (Entradas)</h4><div class="val" style="color:#2e7d32; font-size:1.8rem; margin-top:10px">${U.money(receita)}</div></div>
            <div class="card" style="border-bottom:4px solid #d32f2f"><h4>Custos Gerais (Saídas)</h4><div class="val" style="color:#d32f2f; font-size:1.8rem; margin-top:10px">-${U.money(gasto)}</div></div>
            <div class="card" style="background:${lucro>=0?'#e8f5e9':'#ffebee'}; border:1px solid ${lucro>=0?'#c8e6c9':'#ffcdd2'}"><h4 style="color:${lucro>=0?'#2e7d32':'#d32f2f'}">Resultado Líquido</h4><div class="val" style="color:${lucro>=0?'#2e7d32':'#d32f2f'}; font-size:2.2rem; margin-top:10px">${U.money(lucro)}</div></div>`;
        
        const { extrato } = U.buildExtrato(comand, desp);
        
        document.getElementById('extrato-list').innerHTML = extrato.length === 0 ? '<p style="text-align:center; padding:1rem; color:var(--muted)">Sem movimentações na quinzena atual.</p>' :
            extrato.map(i => `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:15px 0;">
                <div style="flex:1">
                    <b style="color:${i.type==='in'?'#2e7d32':'#d32f2f'}; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px">${i.type==='in'?'Recebimento':'Saída'}</b>
                    <p style="margin-top:5px; font-weight:600; font-size:1.1rem">${i.desc}</p>
                    <span style="font-size:0.8rem; color:var(--muted)">${i.date.toLocaleString('pt-BR')}</span>
                </div>
                <div style="text-align:right">
                    <span style="color:${i.type==='in'?'#2e7d32':'#d32f2f'}; font-weight:bold; font-size:1.3rem; display:block">${i.type==='in'?'+':'-'} ${U.money(i.val)}</span>
                    <span style="font-size:0.85rem; color:var(--muted); font-weight:bold">Saldo Contábil: ${U.money(i.saldo)}</span>
                </div>
            </div>`).join('');
    },

    async relatorios() {
        const qFilter = document.getElementById('filter-relatorios').value;
        const range = U.getQuinzenaDates(qFilter);
        
        let qComand = db.from('comandas').select('total, ticket, created_at').eq('status', 'fechada').gte('created_at', range.start).lte('created_at', range.end);
        let qDesp = db.from('despesas').select('*').gte('date', range.start).lte('date', range.end);
        
        const [ {data:comand}, {data:desp} ] = await Promise.all([qComand, qDesp]);

        let htmlDesp = '';
        if(desp.length === 0) { htmlDesp = '<p style="color:var(--muted); text-align:center;">Sem gastos registrados na quinzena.</p>'; }
        else {
            let despArr = U.orderDespesas(desp, comand);
            htmlDesp = despArr.map(d => `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px dashed #eee;"><div><b>${d.description}</b><br><span style="font-size:0.8rem; color:#888">${new Date(d.date).toLocaleString('pt-BR')} - ${d.category}</span></div><div style="color:#d32f2f; font-weight:bold">-${U.money(d.amount)}</div></div>`).join('');
        }
        document.getElementById('relatorio-despesas-conteudo').innerHTML = htmlDesp;
        window.currentDespesasData = desp;

        const { extrato, totalIn, totalOut } = U.buildExtrato(comand, desp);
        
        let htmlFluxo = '';
        if(extrato.length === 0) { htmlFluxo = '<p style="color:var(--muted); text-align:center;">Nenhuma movimentação financeira.</p>'; }
        else {
            htmlFluxo += `<div style="background:#f9f9f9; padding:15px; border-radius:8px; display:flex; justify-content:space-around; margin-bottom:15px;"><div>Entradas: <b style="color:#2e7d32">${U.money(totalIn)}</b></div><div>Saídas: <b style="color:#d32f2f">-${U.money(totalOut)}</b></div><div>Líquido: <b style="color:${(totalIn-totalOut)>=0?'#2e7d32':'#d32f2f'}">${U.money(totalIn-totalOut)}</b></div></div>`;
            htmlFluxo += extrato.map(i => `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px dashed #eee;"><div><b style="color:${i.type==='in'?'#2e7d32':'#d32f2f'}">${i.type==='in'?'[+]':'[-]'}</b> ${i.desc}<br><span style="font-size:0.8rem; color:#888">${i.date.toLocaleString('pt-BR')}</span></div><div style="text-align:right"><b>${U.money(i.val)}</b><br><span style="font-size:0.75rem; color:#666">Saldo: ${U.money(i.saldo)}</span></div></div>`).join('');
        }
        document.getElementById('relatorio-fluxo-conteudo').innerHTML = htmlFluxo;
        window.currentFluxoData = extrato; window.currentTotaisFluxo = { receita: totalIn, gasto: totalOut, lucro: totalIn - totalOut };
    },

    async performance() {
        const [ {data}, {data:agendas} ] = await Promise.all([ db.from('comandas').select('*, users(name), items').eq('status', 'fechada'), db.from('appointments').select('*') ]);
        let rankFunc = {}; let rankServ = {}; let totalFaturamento = 0;
        data.forEach(c => { 
            totalFaturamento += c.total; 
            if(c.users) rankFunc[c.users.name] = (rankFunc[c.users.name]||0) + c.total; 
            if(c.items) { c.items.forEach(i => { if(i.type === 'service') { rankServ[i.name] = rankServ[i.name] || { qtd: 0, receita: 0 }; rankServ[i.name].qtd += 1; rankServ[i.name].receita += i.price; } }); }
        });
        const tkMedio = data.length ? totalFaturamento / data.length : 0;
        const totalAgendas = agendas.length || 1;
        const concluidas = data.length;
        const ocupacao = Math.min(100, Math.round((concluidas / totalAgendas) * 100));
        
        document.getElementById('perf-kpis').innerHTML = `
            <div class="card" style="text-align:center; padding:2rem"><p style="font-weight:bold; color:var(--muted); margin-bottom:10px">Ticket Médio</p><div class="val" style="font-size:2rem">${U.money(tkMedio)}</div></div>
            <div class="card" style="text-align:center; padding:2rem"><p style="font-weight:bold; color:var(--muted); margin-bottom:10px">Ocupação</p><div class="val" style="font-size:2rem; color:${ocupacao > 50 ? '#2e7d32' : '#d32f2f'}">${ocupacao}%</div></div>
            <div class="card" style="text-align:center; padding:2rem"><p style="font-weight:bold; color:var(--muted); margin-bottom:10px">Total Concluídos</p><div class="val" style="font-size:2rem; color:var(--text)">${concluidas}</div></div>`;
            
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
    },

    async notificacoes() {
        const isOwner = App.role === 'owner';
        const todayIso = U.iso(new Date());
        const todayMD = todayIso.slice(5); 

        let qAgenda = db.from('appointments').select('*, clients(name, phone), services(name), users!user_id(name)').eq('date', todayIso).eq('status', 'agendado');
        if(!isOwner) qAgenda = qAgenda.eq('user_id', App.user.id);

        const qClientes = db.from('clients').select('id, name, phone, birth_date').not('birth_date', 'is', null);

        const tasks = [qAgenda, qClientes];
        if(isOwner) {
            tasks.push(db.from('products').select('stock, min_stock'));
            tasks.push(db.from('debts').select('remaining_amount').gt('remaining_amount', 0));
        }

        const results = await Promise.all(tasks);
        const agendaHoje = results[0].data || [];
        const clientes = results[1].data || [];
        const aniversariantesHoje = clientes.filter(c => c.birth_date && c.birth_date.slice(5) === todayMD);

        let estoqueBaixo = [], debitos = [], totalDebitos = 0;
        if(isOwner) {
            const produtos = results[2].data || [];
            estoqueBaixo = produtos.filter(p => p.stock <= p.min_stock);
            debitos = results[3].data || [];
            totalDebitos = debitos.reduce((acc, d) => acc + d.remaining_amount, 0);
        }

        let html = '';

        html += `<h3 style="margin-bottom:10px"><i class="ph ph-cake"></i> Aniversariantes de Hoje</h3>`;
        html += aniversariantesHoje.length === 0
            ? `<p style="color:var(--muted); margin-bottom:25px">Nenhum aniversário hoje.</p>`
            : aniversariantesHoje.map(c => `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--primary); margin-bottom:10px">
                <div><h4>${c.name}</h4><p style="font-size:0.8rem; color:var(--muted)">${c.phone || '-'}</p></div>
                <button class="btn-primary" style="width:auto; background:#25D366; padding:0.6rem 1.2rem" onclick="Actions.sendParabens('${c.id}')"><i class="ph ph-whatsapp-logo"></i> Parabenizar</button>
            </div>`).join('') + `<div style="margin-bottom:15px"></div>`;

        html += `<h3 style="margin-bottom:10px"><i class="ph ph-calendar-check"></i> Confirmações Pendentes Hoje</h3>`;
        html += agendaHoje.length === 0
            ? `<p style="color:var(--muted); margin-bottom:25px">Nenhum agendamento pendente de confirmação hoje.</p>`
            : agendaHoje.map(a => `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--primary); margin-bottom:10px">
                <div><h4>${a.time?.slice(0,5) || '-'} - ${a.clients?.name || '-'}</h4><p style="font-size:0.8rem; color:var(--muted)">${a.services?.name || '-'} • Profissional: ${a.users?.name || '-'}</p></div>
                <button class="btn-primary" style="width:auto; background:#25D366; padding:0.6rem 1.2rem" onclick="Actions.sendConfirmacao('${a.id}')"><i class="ph ph-whatsapp-logo"></i> Confirmar</button>
            </div>`).join('') + `<div style="margin-bottom:15px"></div>`;

        if(isOwner) {
            html += `<h3 style="margin-bottom:10px"><i class="ph ph-warning-circle"></i> Estoque Baixo</h3>`;
            html += estoqueBaixo.length === 0
                ? `<p style="color:var(--muted); margin-bottom:25px">Nenhum produto com estoque baixo.</p>`
                : `<div class="card" style="border-left:4px solid #d32f2f; margin-bottom:25px"><p>${estoqueBaixo.length} produto(s) precisam de reposição.</p><button class="btn-secondary" style="width:auto; margin-top:10px" onclick="Nav.showView('produtos')">Ver Estoque</button></div>`;

            html += `<h3 style="margin-bottom:10px"><i class="ph ph-money"></i> Cobranças em Aberto</h3>`;
            html += debitos.length === 0
                ? `<p style="color:var(--muted)">Nenhuma cobrança pendente.</p>`
                : `<div class="card" style="border-left:4px solid #d32f2f"><p>Total pendente: <b>${U.money(totalDebitos)}</b> em ${debitos.length} cliente(s).</p><button class="btn-secondary" style="width:auto; margin-top:10px" onclick="Nav.showView('cobrancas')">Ver Cobranças</button></div>`;
        }

        const cont = document.getElementById('notificacoes-list');
        if(cont) cont.innerHTML = html;
    }
};

const Modals = {
    async open(type, param1=null, param2=null, param3=null) {
        const cont = document.getElementById('modal-container');
        let html = `<div class="modal"><button class="modal-close" onclick="Modals.close()"><i class="ph ph-x"></i></button>`;
        
        if(type === 'menu_agenda_mobile') {
            html += `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--primary-dark);">O que deseja fazer?</h3>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn-primary" style="padding:1.2rem; font-size:1.1rem; justify-content:flex-start" onclick="Modals.open('agendamento')">
                    <i class="ph ph-calendar-plus" style="font-size:1.5rem; margin-right:10px;"></i> Agendar Cliente
                </button>
                <button class="btn-secondary" style="padding:1.2rem; font-size:1.1rem; border: 1px solid #d32f2f; color: #d32f2f; background: #ffebee; justify-content:flex-start" onclick="Modals.open('bloquear_agenda')">
                    <i class="ph ph-prohibit" style="font-size:1.5rem; margin-right:10px;"></i> Bloquear Horário
                </button>
            </div>`;
        }
        else if(type === 'first_login') {
            html += `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--primary-dark);">Definir Nova Senha</h3>
                <p style="color: var(--muted); margin-top: 10px; line-height:1.4">Por motivos de segurança, altere a senha provisória para o seu acesso pessoal e exclusivo.</p>
            </div>
            <form id="first-login-form" onsubmit="Actions.updatePassword(event)">
                <div class="input-group"><label style="margin-bottom: 5px;">Digite a nova senha</label><input type="password" id="new-pass" required style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px;"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem; font-size:1.1rem">Salvar e Acessar</button>
            </form>`;
        } 
        else if(type === 'whatsapp') {
            const { data: templates } = await db.from('message_templates').select('*');

            let vars = {};
            try { vars = param3 ? JSON.parse(param3) : {}; } catch(e) { vars = {}; }
            window.currentWppVars = vars;
            const hasVars = Object.keys(vars).length > 0;

            const tOpts = templates.map(t => `<option value="${t.id}">${t.title}</option>`).join('');
            html += `<h3>Central de WhatsApp</h3>
            <div style="background:#f9f9f9; padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #eee">
                <p style="font-size: 0.85rem; color: var(--muted); margin-bottom: 8px; line-height:1.4"><i class="ph ph-info"></i> O redirecionamento abaixo levará o texto para o aplicativo no seu dispositivo.</p>
                <p style="font-size: 1rem;">Cliente Alvo: <b class="text-primary">${param2}</b></p>
                <p style="font-size: 0.9rem; color:var(--muted)">Número: ${param1}</p>
                ${hasVars ? `<p style="font-size:0.75rem; color:var(--muted); margin-top:8px"><i class="ph ph-magic-wand"></i> Modelos com {cliente}, {data}, {hora}, {profissional}, {servico} ou {salao} são preenchidos automaticamente.</p>` : ''}
            </div>
            <div class="input-group"><label>Usar Modelo Automático</label><select id="wpp-template-sel" onchange="Actions.applyTemplate(this.value)"><option value="">-- Escrever Mensagem Manualmente --</option>${tOpts}</select></div>
            <div class="input-group"><textarea id="wpp-msg" rows="5" placeholder="Digite o texto que será enviado..." required></textarea></div>
            <button class="btn-primary" style="background:#25D366; font-size:1.1rem; padding:1.2rem;" onclick="Actions.sendWhatsApp('${param1}')"><i class="ph ph-whatsapp-logo" style="font-size:1.5rem"></i> Abrir Chat</button>`;
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
            
            html += `<div style="text-align: center; margin-bottom: 20px;">
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
                const sOpts = servicos.map(s => `<option value='{"id":"${s.id}","name":"${s.name}","price":${s.price},"cost":${s.cost || 0},"commission":${s.commission},"type":"service"}'>${s.name} - ${U.money(s.price)}</option>`).join('');
                const pOpts = produtos.map(p => `<option value='{"id":"${p.id}","name":"${p.name}","price":${p.price},"commission":${p.commission},"type":"product"}'>${p.name} (Estoque: ${p.stock}) - ${U.money(p.price)}</option>`).join('');
                html += `
                <div style="display:flex; gap:10px; margin-bottom:20px; align-items: flex-end; flex-wrap:wrap">
                    <div class="input-group" style="margin:0; flex:1; min-width:200px">
                        <label style="margin-bottom: 5px;">Lançar Novo Item</label>
                        <select id="add-item-sel" style="padding:1.2rem; width:100%; border-radius:8px; border:1px solid var(--border);"><option value="">-- Buscar Serviço ou Produto --</option><optgroup label="Lista de Serviços">${sOpts}</optgroup><optgroup label="Produtos em Estoque">${pOpts}</optgroup></select>
                    </div>
                    <button type="button" class="btn-secondary" style="width:auto; padding:1.2rem 2rem; background:var(--primary-light); color:var(--primary)" onclick="Actions.addComandaItem('${comanda.id}')"><i class="ph ph-plus" style="font-size:1.3rem"></i> Lançar</button>
                </div>
                <button type="button" class="btn-primary" style="background:#2e7d32; padding:1.2rem; font-size:1.1rem; width: 100%;" onclick="Actions.closeComanda('${comanda.id}', '${comanda.client_id}', ${comanda.total}, '${comanda.ticket}')"><i class="ph ph-check-circle" style="font-size:1.5rem"></i> Faturar Ticket e Lançar Custos</button>`;
            } else if (App.role === 'owner') {
                html += `<button type="button" class="btn-secondary" style="color:#d32f2f; padding:1.2rem; width:100%" onclick="Actions.reopenComanda('${comanda.id}')"><i class="ph ph-warning-circle" style="font-size:1.5rem"></i> Reabrir Comanda (Exclui Financeiro)</button>`;
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
                <div class="input-group"><label style="margin-bottom: 5px;">Cliente</label><select id="fa-cli" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"><option value="">-- Buscar na lista --</option>${c.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div class="input-group"><label style="margin-bottom: 5px;">Serviço Desejado</label><select id="fa-serv" required onchange="document.getElementById('aux-div').style.display = this.options[this.selectedIndex].dataset.aux==='true'?'block':'none'" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"><option value="">-- Escolha o serviço --</option>${sOpts}</select></div>
                <div class="input-group"><label style="margin-bottom: 5px;">Profissional</label><select id="fa-user" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"><option value="">-- Atendente Principal --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div class="input-group" id="aux-div" style="display:none"><label style="margin-bottom: 5px;">Auxiliar (Opcional)</label><select id="fa-aux" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"><option value="">-- Selecione caso precise --</option>${u.data.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div>
                <div style="display:flex; gap:10px; margin-bottom: 20px;">
                    <div style="flex:1"><label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:5px;">Data</label><input type="date" id="fa-date" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"></div>
                    <div style="flex:1"><label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:5px;">Horário</label><input type="time" id="fa-time" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"></div>
                </div>
                <button type="submit" class="btn-primary" style="padding:1.2rem; width:100%;">Confirmar Horário</button>
            </form>`;
        }
        else if(type === 'bloquear_agenda') {
            html += `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #d32f2f;">Bloquear Horário</h3>
            </div>
            <form onsubmit="Actions.blockAppointment(event)">
                <div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 20px;">
                    <div><label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:5px;">Data do Bloqueio</label><input type="date" id="fb-date" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"></div>
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1"><label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:5px;">Hora de Início</label><input type="time" id="fb-time" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"></div>
                        <div style="flex:1"><label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:5px;">Hora de Término</label><input type="time" id="fb-end" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);"></div>
                    </div>
                    <div><label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:5px;">Motivo / Justificativa</label><textarea id="fb-motivo" required placeholder="Ex: Manutenção, Médico..." style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border);" rows="2"></textarea></div>
                </div>
                <button type="submit" class="btn-primary" style="padding:1.2rem; width:100%; background: #d32f2f;">Confirmar Bloqueio</button>
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
            html += `<h3>Novo Produto</h3><form onsubmit="Actions.saveProduct(event)">
                <div class="input-group"><label>Cód. Barras (Passe leitor ou digite)</label><div style="display:flex; gap:5px"><input type="text" id="fp-bar" required style="flex:1"><button type="button" class="btn-secondary" style="width:auto" onclick="Actions.fetchBarcode(document.getElementById('fp-bar').value)"><i class="ph ph-magnifying-glass"></i> Buscar</button></div></div>
                <div class="input-group"><label>Descrição do Produto</label><input type="text" id="fp-nome" required placeholder="Digite ou aguarde a busca..."></div>
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
            html += `<h3>Lançamento de Despesa/Custo Manual</h3><form onsubmit="Actions.createDespesa(event)">
                <div class="input-group"><label>Descrição da Saída</label><input type="text" id="fd-desc" placeholder="Ex: Conta de Energia, Reposição..." required></div>
                <div class="input-group"><label>Categoria do Gasto</label><select id="fd-cat" required style="padding:1.2rem; border-radius:8px"><option value="Custos Fixos">Custo Fixo (Aluguel, Água, Luz, etc)</option><option value="Custos Variáveis">Custo Variável (Produtos e Insumos)</option><option value="Pessoal/Pagamentos">Pessoal (Salários, Pró-Labore, Limpeza)</option></select></div>
                <div class="input-group"><label>Valor (R$)</label><input type="number" id="fd-val" step="0.01" required style="padding:1.2rem"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Registrar Saída</button></form>`;
        }
        else if(type === 'mensagem' || type === 'edit_mensagem') {
            let m = { title: '', content: '' };
            if (param1) { const { data } = await db.from('message_templates').select('*').eq('id', param1).single(); m = data; }
            html += `<h3>${param1 ? 'Editar Mensagem' : 'Novo Template Automático'}</h3><form onsubmit="Actions.saveMensagem(event, '${param1 || ''}')">
                <div class="input-group"><label>Título Interno</label><input type="text" id="fm-tit" value="${m.title}" required></div>
                <div class="input-group"><label>Corpo do Texto</label><textarea id="fm-txt" rows="5" required>${m.content}</textarea><p style="font-size:0.75rem; color:var(--muted); margin-top:8px"><i class="ph ph-magic-wand"></i> Use {cliente}, {data}, {hora}, {profissional}, {servico} ou {salao} para personalizar. Ex: "Olá {cliente}! Seu horário está confirmado para {data} às {hora} com {profissional}."</p></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">${param1 ? 'Salvar Edição' : 'Criar Template'}</button></form>`;
        }
        else if(type === 'debitar' || type === 'desconto') {
            html += `<h3>${type==='debitar'?'Registrar Recebimento':'Aplicar Desconto'}</h3>
            <div style="background:#f9f9f9; padding:20px; border-radius:12px; margin-bottom:20px; border-left:5px solid #d32f2f">
                <p style="color:var(--muted); font-size:0.9rem; margin-bottom:5px">Ref: ${param3 || 'Pendente no Recibo'}</p>
                <b style="font-size:2rem; color:#d32f2f">${U.money(param2)}</b>
            </div>
            <form onsubmit="Actions.${type==='debitar'?'debitDebt':'discountDebt'}(event, '${param1}', ${param2})">
                <div class="input-group"><label>${type==='debitar'?'Valor Informado pelo Cliente (R$)':'Porcentagem do Desconto (%)'}</label><input type="number" id="f-val" step="0.01" required style="padding:1.2rem; font-size:1.2rem; border-radius:8px"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Confirmar</button></form>`;
        }
        else if(type === 'nova_anamnese') {
            html += `<h3>Ficha de Anamnese</h3><form onsubmit="Actions.saveAnamnese(event, '${param1}')">
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
                <div class="input-group"><label>Data de Nascimento (opcional, para mensagem de aniversário)</label><input type="date" id="fc-nasc" style="padding:1.2rem; border-radius:8px"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Registrar</button></form>`;
        }
        else if(type === 'edit_cliente') {
            const { data: c } = await db.from('clients').select('*').eq('id', param1).single();
            html += `<h3>Editar Cliente</h3><form onsubmit="Actions.updateClient(event, '${c.id}')">
                <div class="input-group"><label>Nome</label><input type="text" id="fce-nome" value="${c.name}" required style="padding:1.2rem; border-radius:8px"></div>
                <div class="input-group"><label>Telefone</label><input type="text" id="fce-fone" value="${c.phone}" required style="padding:1.2rem; border-radius:8px"></div>
                <div class="input-group"><label>Data de Nascimento (opcional, para mensagem de aniversário)</label><input type="date" id="fce-nasc" value="${c.birth_date || ''}" style="padding:1.2rem; border-radius:8px"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Salvar Alterações</button></form>`;
        }
        else if(type === 'funcionario' || type === 'edit_funcionario') {
            let f = { name: '', role: 'freelancer', active: true };
            if(param1) { const { data } = await db.from('users').select('*').eq('id', param1).single(); f = data; }
            
            html += `<h3>${param1 ? 'Editar Colaborador' : 'Novo Colaborador'}</h3><form onsubmit="Actions.saveFuncionario(event, '${param1 || ''}')">
                <div class="input-group"><label>Nome Completo</label><input type="text" id="ff-nome" value="${f.name}" required style="padding:1.2rem; border-radius:8px"></div>
                <div class="input-group"><label>Nível de Acesso</label><select id="ff-role" required style="padding:1.2rem; border-radius:8px"><option value="freelancer" ${f.role==='freelancer'?'selected':''}>Freelancer (Colaborador)</option><option value="owner" ${f.role==='owner'?'selected':''}>Proprietário (Acesso Total)</option></select></div>
                ${param1 ? `
                    <div class="input-group" style="background:#f9f9f9; padding:15px; border-radius:12px">
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; margin:0"><input type="checkbox" id="ff-ativo" ${f.active !== false ? 'checked' : ''} style="width:20px; height:20px"> Conta Ativa e Permitida Logar</label>
                    </div>
                    <button type="button" class="btn-secondary" style="margin-bottom:15px; border:1px solid var(--primary); color:var(--primary)" onclick="Actions.resetFuncionarioPassword('${param1}')"><i class="ph ph-key"></i> Redefinir Senha para 123456</button>
                ` : ''}
                <button type="submit" class="btn-primary" style="padding:1.2rem">${param1 ? 'Salvar Edição' : 'Gerar Acesso'}</button></form>`;
        }
        
        html += `</div>`; cont.innerHTML = html; cont.classList.remove('hidden');

        if(type === 'whatsapp' && window.currentWppVars && window.currentWppVars._kind) {
            const { data: templates } = await db.from('message_templates').select('*');
            const pattern = window.currentWppVars._kind === 'aniversario' ? /anivers/i : /confirma/i;
            const autoT = (templates || []).find(t => pattern.test(t.title));
            if(autoT) {
                const sel = document.getElementById('wpp-template-sel');
                if(sel) { sel.value = autoT.id; Actions.applyTemplate(autoT.id); }
            }
        }
    },
    close() { document.getElementById('modal-container').classList.add('hidden'); }
};

const Actions = {
    exportPDF(viewType, quinzenaStr) {
        if(!window.jspdf) return UI.toast('Carregando PDF. Tente novamente em instantes.', 'warning');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(183, 110, 121);
        doc.text("ESTÚDIO AMOR QUE CUIDA", 105, 20, null, null, "center");
        doc.setFontSize(12); doc.setTextColor(50, 50, 50);
        
        if (viewType === 'despesas') {
            doc.text(`Relatório de Despesas e Custos Gerais`, 105, 30, null, null, "center");
            const qTxt = document.getElementById('filter-relatorios').options[document.getElementById('filter-relatorios').selectedIndex].text;
            doc.text(`Período: ${qTxt}`, 105, 38, null, null, "center");
            
            if(!window.currentDespesasData || window.currentDespesasData.length === 0) return UI.toast('Sem dados no momento.', 'warning');
            
            const rows = window.currentDespesasData.map(d => [ new Date(d.date).toLocaleString('pt-BR'), d.category, d.description, U.money(d.amount) ]);
            doc.autoTable({ startY: 45, head: [['Data', 'Categoria', 'Descrição', 'Valor (R$)']], body: rows, theme: 'striped', headStyles: { fillColor: [183, 110, 121] } });
            doc.save(`AQC_Despesas_${quinzenaStr}.pdf`);
            UI.toast('Relatório de Despesas Gerado!');
            
        } else if (viewType === 'fluxo') {
            doc.text(`Relatório de Fluxo de Caixa (Extrato Bancário)`, 105, 30, null, null, "center");
            const qTxt = document.getElementById('filter-relatorios').options[document.getElementById('filter-relatorios').selectedIndex].text;
            doc.text(`Período: ${qTxt}`, 105, 38, null, null, "center");
            
            if(!window.currentFluxoData || window.currentFluxoData.length === 0) return UI.toast('Sem dados.', 'warning');
            
            const r = window.currentTotaisFluxo;
            doc.setFontSize(10);
            doc.text(`Entradas: ${U.money(r.receita)}   |   Saídas: ${U.money(r.gasto)}   |   Líquido: ${U.money(r.lucro)}`, 105, 45, null, null, "center");

            const rows = window.currentFluxoData.map(d => [ d.date.toLocaleString('pt-BR'), d.type === 'in' ? 'Entrada' : 'Saída', d.desc, U.money(d.val), U.money(d.saldo) ]);
            doc.autoTable({ startY: 55, head: [['Data', 'Tipo', 'Descrição', 'Movimentação', 'Saldo Contábil']], body: rows, theme: 'striped', headStyles: { fillColor: [183, 110, 121] } });
            doc.save(`AQC_Fluxo_Caixa_${quinzenaStr}.pdf`);
            UI.toast('Relatório de Fluxo Gerado!');
        }
    },

    async updatePassword(e) {
        e.preventDefault(); 
        const newPass = document.getElementById('new-pass').value;
        if(newPass.length < 3) return UI.toast('Senha muito curta.', 'error');
        const { error } = await db.from('users').update({ password: newPass, first_login: false }).eq('id', App.user.id);
        if(error) { UI.toast(`Erro: ${error.message}`, 'error'); return; }
        App.user.first_login = false; Modals.close(); UI.toast('Senha salva com sucesso!'); 
    },

    applyTemplate(templateId) {
        const box = document.getElementById('wpp-msg');
        if(!box) return;
        if(!templateId) { box.value = ''; return; }
        db.from('message_templates').select('content').eq('id', templateId).single().then(({ data }) => {
            if(!data) return;
            box.value = U.fillTemplate(data.content, window.currentWppVars || {});
        });
    },

    async sendConfirmacao(appId) {
        const { data: a, error } = await db.from('appointments').select('*, clients(name, phone), services(name), users!user_id(name)').eq('id', appId).single();
        if(error || !a) { UI.toast('Erro ao buscar agendamento.', 'error'); return; }
        if(!a.clients?.phone) { UI.toast('Este cliente não possui telefone cadastrado.', 'error'); return; }
        const vars = {
            cliente: a.clients?.name || '',
            data: new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR'),
            hora: (a.time || '').slice(0,5),
            profissional: a.users?.name || '',
            servico: a.services?.name || '',
            salao: App.settings.studio_name || 'Amor que Cuida',
            _kind: 'confirmacao'
        };
        Modals.open('whatsapp', a.clients.phone, a.clients.name, JSON.stringify(vars));
    },

    async sendParabens(clientId) {
        const { data: c, error } = await db.from('clients').select('name, phone').eq('id', clientId).single();
        if(error || !c) { UI.toast('Cliente não encontrado.', 'error'); return; }
        if(!c.phone) { UI.toast('Este cliente não possui telefone cadastrado.', 'error'); return; }
        const vars = { cliente: c.name, salao: App.settings.studio_name || 'Amor que Cuida', _kind: 'aniversario' };
        Modals.open('whatsapp', c.phone, c.name, JSON.stringify(vars));
    },
    
    async createClient(e) {
        e.preventDefault();
        const nasc = document.getElementById('fc-nasc').value;
        const { error } = await db.from('clients').insert({
            name: document.getElementById('fc-nome').value,
            phone: document.getElementById('fc-fone').value,
            birth_date: nasc || null
        });
        if (error) {
            console.error('Erro ao criar cliente:', error);
            UI.toast(`Erro ao salvar cliente: ${error.message}`, 'error');
            return;
        }
        Modals.close(); UI.toast('Cliente adicionado!'); Render.clientes();
    },
    async updateClient(e, id) {
        e.preventDefault();
        const nasc = document.getElementById('fce-nasc').value;
        const { error } = await db.from('clients').update({
            name: document.getElementById('fce-nome').value,
            phone: document.getElementById('fce-fone').value,
            birth_date: nasc || null
        }).eq('id', id);
        if (error) {
            console.error('Erro ao atualizar cliente:', error);
            UI.toast(`Erro ao salvar alterações: ${error.message}`, 'error');
            return;
        }
        Modals.close(); UI.toast('Cliente alterado!'); Render.clientes();
    },
    
    async saveAnamnese(e, idCliente) {
        e.preventDefault(); 
        if (!idCliente || idCliente === 'undefined') { UI.toast('Erro de ID. Volte e clique na Ficha novamente.', 'error'); return; }

        const payload = { 
            client_id: idCliente, 
            user_id: App.user.id, 
            history: document.getElementById('fa-hist').value, 
            habits: document.getElementById('fa-hab').value, 
            objectives: document.getElementById('fa-obj').value, 
            notes: document.getElementById('fa-obs').value 
        };
        const { error } = await db.from('anamnesis').insert(payload);
        if(error) { UI.toast(`Erro: ${error.message}`, 'error'); return; }
        
        Modals.close(); UI.toast('Ficha clínica registrada!'); this.loadAnamnese(idCliente);
    },
    async loadAnamnese(id) {
        const div = document.getElementById('anamnese-history-list');
        if(!id || id === 'undefined') { div.innerHTML = "<p style='color:#d32f2f; text-align:center; padding:2rem'>ID do cliente não identificado. Volte e clique em Ficha novamente.</p>"; return; }

        const { data, error } = await db.from('anamnesis').select('*').eq('client_id', id).order('created_at', {ascending: false});
        if(error) { div.innerHTML = `<p style='color:#d32f2f; text-align:center; padding:2rem'>Erro ao carregar histórico: ${error.message}</p>`; return; }
        if(!data || !data.length) { div.innerHTML = "<p style='color:var(--muted); text-align:center; padding:2rem'>Nenhum registro clínico para este cliente.</p>"; return; }

        const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
        let namesMap = {};
        if(userIds.length) {
            const { data: profs } = await db.from('users').select('id,name').in('id', userIds);
            (profs || []).forEach(p => namesMap[p.id] = p.name);
        }

        div.innerHTML = data.map(d => `<div class="card" style="border-left: 4px solid var(--primary); background:#fffafb"><h4 style="font-size:0.9rem; color:var(--muted); margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px"><i class="ph ph-calendar-blank"></i> ${new Date(d.created_at).toLocaleString('pt-BR')} &nbsp;•&nbsp; <i class="ph ph-user"></i> Prof: ${namesMap[d.user_id] || 'Sistema'}</h4><p style="margin-bottom:8px"><b>Histórico:</b> ${d.history}</p><p style="margin-bottom:8px"><b>Hábitos:</b> ${d.habits}</p><p style="margin-bottom:8px"><b>Objetivo:</b> ${d.objectives}</p><p style="padding:15px; background:white; border:1px solid #eee; border-radius:12px; margin-top:15px"><b style="color:var(--primary-dark)">Diagnóstico:</b><br>${d.notes}</p></div>`).join('');
    },

    async saveFuncionario(e, id) {
        e.preventDefault();
        const nome = document.getElementById('ff-nome').value;
        const role = document.getElementById('ff-role').value;
        const username = nome.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
        
        if(id) {
            const ativo = document.getElementById('ff-ativo').checked;
            await db.from('users').update({ name: nome, role: role, active: ativo }).eq('id', id);
            Modals.close(); UI.toast('Colaborador atualizado!'); Render.funcionarios();
        } else {
            const { error } = await db.from('users').insert({ name: nome, username: username, password: '123456', role: role, first_login: true, active: true });
            if(error) return UI.toast('Erro ao criar usuário.', 'error');
            UI.confirm(`Colaborador criado!\nUsuário: ${username}\nSenha Temp: 123456`, () => { Modals.close(); Render.funcionarios(); });
        }
    },
    async resetFuncionarioPassword(id) {
        await db.from('users').update({ password: '123456', first_login: true }).eq('id', id);
        Modals.close(); UI.toast('Senha redefinida para 123456. O usuário será forçado a trocar no próximo login.'); Render.funcionarios();
    },
    async deleteFuncionario(id) {
        UI.confirm('Deletar colaborador permanentemente?', async () => { await db.from('users').delete().eq('id', id); UI.toast('Conta excluída.'); Render.funcionarios(); });
    },
    async toggleFuncionarioStatus(id, isCurrentlyActive) {
        const novoStatus = !isCurrentlyActive;
        const acaoTexto = novoStatus ? 'ativar' : 'desativar';
        UI.confirm(`Deseja realmente ${acaoTexto} este colaborador?`, async () => {
            const { error } = await db.from('users').update({ active: novoStatus }).eq('id', id);
            if(error) { UI.toast(`Erro: ${error.message}`, 'error'); return; }
            UI.toast(novoStatus ? 'Colaborador ativado!' : 'Colaborador desativado!');
            Render.funcionarios();
        });
    },

    async createAppointment(e) {
        e.preventDefault(); const auxId = document.getElementById('fa-aux').value;
        await db.from('appointments').insert({ client_id: document.getElementById('fa-cli').value, service_id: document.getElementById('fa-serv').value, user_id: document.getElementById('fa-user').value, assistant_id: auxId || null, date: document.getElementById('fa-date').value, time: document.getElementById('fa-time').value, status: 'agendado' });
        Modals.close(); UI.toast('Horário salvo!'); Render.agenda(); 
    },
    async blockAppointment(e) {
        e.preventDefault();
        const date = document.getElementById('fb-date').value; 
        const start = document.getElementById('fb-time').value; 
        const end = document.getElementById('fb-end').value; 
        const motivo = document.getElementById('fb-motivo').value;

        if (start >= end) return UI.toast('A hora de término deve ser maior que o início.', 'error');

        // 1. Verifica se já existe agendamento no meio desse horário
        const { data: existing, error: errCheck } = await db.from('appointments')
            .select('time')
            .eq('date', date)
            .gte('time', start)
            .lt('time', end)
            .neq('status', 'cancelado'); // Ignora os cancelados

        if (errCheck) return UI.toast(`Falha ao checar agenda: ${errCheck.message}`, 'error');
        if (existing && existing.length > 0) return UI.toast('Conflito: Já existe cliente ou bloqueio neste horário.', 'error');

        // 2. Calcula os blocos de forma matemática (segura para Mobile/iOS, sem bugar a hora)
        let [startH, startM] = start.split(':').map(Number);
        let [endH, endM] = end.split(':').map(Number);
        
        let currentMin = (startH * 60) + startM;
        let finalMin = (endH * 60) + endM;
        
        const inserts = [];

        while(currentMin < finalMin) { 
            let h = Math.floor(currentMin / 60);
            let m = currentMin % 60;
            // Formata sempre para o padrão de banco de dados (ex: 09:30, 14:00)
            let timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            inserts.push({ 
                user_id: App.user.id, 
                date: date, 
                time: timeStr, 
                status: 'bloqueado', 
                notes: motivo 
            }); 
            
            currentMin += 30; // Avança de 30 em 30 minutos
        }

        // 3. Salva no banco e escuta se deu algum erro de tabela
        const { error: insertError } = await db.from('appointments').insert(inserts);
        
        if (insertError) {
            console.error("Erro Supabase:", insertError);
            return UI.toast(`Erro ao salvar no banco: ${insertError.message}`, 'error');
        }

        // 4. Sucesso!
        Modals.close(); 
        UI.toast('Horário bloqueado com sucesso!', 'success'); 
        Render.agenda(); 
    },
    async markAsArrived(appId) { await db.from('appointments').update({ status: 'chegou' }).eq('id', appId); UI.toast('Cliente chegou!'); Render.agenda(); },

    async createComanda(e) {
        e.preventDefault(); 
        const { data, error } = await db.from('comandas').select('ticket');
        if(error) return UI.toast(`Erro ao gerar comanda: ${error.message}`, 'error');
        let maxNum = 0;
        (data || []).forEach(c => {
            if (c.ticket) {
                const n = parseInt(c.ticket.split('-')[1], 10);
                if (!isNaN(n) && n > maxNum) maxNum = n;
            }
        });
        const tk = 'TKT-' + String(maxNum + 1).padStart(4, '0');
        await db.from('comandas').insert({ client_id: document.getElementById('fcom-cli').value, user_id: App.user.id, ticket: tk });
        Modals.close(); UI.toast(`Comanda ${tk} gerada!`); Render.comandas();
    },
    async addComandaItem(id) {
        const val = document.getElementById('add-item-sel').value; if(!val) return UI.toast('Selecione algo.', 'error');
        const item = JSON.parse(val); 
        if(item.type === 'product') {
            const { data: prod } = await db.from('products').select('stock').eq('id', item.id).single();
            if(prod.stock <= 0) return UI.toast('Sem estoque.', 'error');
            await db.from('products').update({stock: prod.stock - 1}).eq('id', item.id);
        }
        const { data: comanda } = await db.from('comandas').select('items, total').eq('id', id).single();
        const items = comanda.items || []; items.push(item);
        await db.from('comandas').update({ items, total: comanda.total + item.price }).eq('id', id);
        Modals.close(); setTimeout(() => Modals.open('edit_comanda', id), 100);
    },
    async removeComandaItem(comandaId, itemIndex) {
        UI.confirm('Remover lançamento?', async () => {
            const { data: comanda } = await db.from('comandas').select('items, total').eq('id', comandaId).single();
            const items = comanda.items || []; const item = items[itemIndex];
            if(item.type === 'product') { 
                const { data: prod } = await db.from('products').select('stock').eq('id', item.id).single();
                if(prod) await db.from('products').update({stock: prod.stock + 1}).eq('id', item.id);
            }
            items.splice(itemIndex, 1);
            await db.from('comandas').update({ items, total: Math.max(0, comanda.total - item.price) }).eq('id', comandaId);
            Modals.close(); setTimeout(() => Modals.open('edit_comanda', comandaId), 100); UI.toast('Deletado.');
        });
    },
    
    async closeComanda(comandaId, clientId, total, ticketNum) {
        UI.confirm('Deseja faturar e processar os custos na quinzena atual?', async () => {
            const { data: comanda } = await db.from('comandas').select('items, users(name)').eq('id', comandaId).single();
            let totalCustoFixo = 0; let totalComissao = 0;
            if(comanda.items) {
                comanda.items.forEach(item => {
                    if (item.type === 'service') {
                        if (item.cost) totalCustoFixo += parseFloat(item.cost);
                        if (item.commission) totalComissao += (item.price * item.commission) / 100;
                    } else if (item.type === 'product' && item.commission) {
                        totalComissao += (item.price * item.commission) / 100;
                    }
                });
            }
            const dataHoraExata = new Date().toISOString();
            await db.from('comandas').update({ status: 'fechada', created_at: dataHoraExata }).eq('id', comandaId);
            
            if(total > 0) { 
                const { data: existingDebt, error: errFind } = await db.from('debts').select('*').eq('client_id', clientId).gt('remaining_amount', 0).maybeSingle();
                if(errFind) UI.toast(`Erro ao consultar cobrança: ${errFind.message}`, 'error');
                
                if (existingDebt) {
                    const { error: errUp } = await db.from('debts').update({ total_amount: existingDebt.total_amount + total, remaining_amount: existingDebt.remaining_amount + total, comanda_ticket: existingDebt.comanda_ticket + ', ' + ticketNum, created_at: dataHoraExata }).eq('id', existingDebt.id);
                    if(errUp) UI.toast(`Erro ao atualizar cobrança: ${errUp.message}`, 'error');
                } else {
                    const { error: errIns } = await db.from('debts').insert({ client_id: clientId, total_amount: total, remaining_amount: total, comanda_ticket: ticketNum, created_at: dataHoraExata }); 
                    if(errIns) UI.toast(`Erro ao gerar cobrança: ${errIns.message}`, 'error');
                }
            }
            if(totalCustoFixo > 0) await db.from('despesas').insert({ description: `Custo Fixo Serviço - Ref: ${ticketNum}`, amount: totalCustoFixo, category: 'Custos Fixos', date: dataHoraExata });
            if(totalComissao > 0) await db.from('despesas').insert({ description: `Comissão Automática (${comanda.users?.name}) - Ref: ${ticketNum}`, amount: totalComissao, category: 'Comissões', date: dataHoraExata });
            Modals.close(); UI.toast('Ticket Fechado e Integrado!'); Render.comandas(); Render.cobrancas();
        });
    },
    
    async reopenComanda(id) {
        UI.confirm('ALERTA: Reabrir exclui os custos automáticos e recibos deste ticket. Continuar?', async () => {
            const { data: comanda } = await db.from('comandas').select('ticket, total').eq('id', id).single();
            if(comanda && comanda.ticket) {
                await db.from('despesas').delete().like('description', `%Ref: ${comanda.ticket}%`);
                const { data: existingDebt } = await db.from('debts').select('*').like('comanda_ticket', `%${comanda.ticket}%`).maybeSingle();
                if(existingDebt) {
                    let remainingTkts = existingDebt.comanda_ticket.split(', ').map(t=>t.trim()).filter(t => t !== comanda.ticket).join(', ');
                    if(remainingTkts === '') await db.from('debts').delete().eq('id', existingDebt.id);
                    else await db.from('debts').update({ total_amount: Math.max(0, existingDebt.total_amount - comanda.total), remaining_amount: Math.max(0, existingDebt.remaining_amount - comanda.total), comanda_ticket: remainingTkts }).eq('id', existingDebt.id);
                }
            }
            await db.from('comandas').update({ status: 'aberta' }).eq('id', id);
            Modals.close(); UI.toast('Comanda Reaberta!'); Render.comandas();
        });
    },

    async createService(e) {
        e.preventDefault(); const aux = document.getElementById('fs-aux').checked;
        await db.from('services').insert({ name: document.getElementById('fs-nome').value, price: document.getElementById('fs-valor').value, cost: document.getElementById('fs-custo').value, commission: document.getElementById('fs-com').value, has_assistant: aux, assistant_commission: aux ? document.getElementById('fs-auxcom').value : 0 }); Modals.close(); UI.toast('Serviço adicionado!'); Render.servicos();
    },
    
    async fetchBarcode(val) {
        val = (val || '').trim().replace(/\D/g, '');
        if(val.length < 8) return UI.toast('Digite um código de barras válido (mínimo 8 dígitos).', 'warning');

        const inputNome = document.getElementById('fp-nome');
        inputNome.value = "Buscando nas bases online...";
        inputNome.disabled = true;

        const corsProxy = u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;

        const bases = [
            { url: `https://world.openbeautyfacts.org/api/v2/product/${val}.json`, tipo: 'off' },
            { url: `https://world.openproductsfacts.org/api/v2/product/${val}.json`, tipo: 'off' },
            { url: `https://world.openfoodfacts.org/api/v2/product/${val}.json`, tipo: 'off' },
            { url: `https://api.produto.xyz/v1/gtin/${val}`, tipo: 'pxyz' },
            { url: corsProxy(`https://api.produto.xyz/v1/gtin/${val}`), tipo: 'pxyz' },
            { url: `https://api.upcitemdb.com/prod/trial/lookup?upc=${val}`, tipo: 'upc' },
        ];

        for (const base of bases) {
            try {
                const res = await fetch(base.url);
                if(!res.ok) { console.warn('[fetchBarcode] base retornou erro HTTP', res.status, base.url); continue; }
                const json = await res.json();

                if (base.tipo === 'pxyz' && json.Product && json.Product.name) {
                    inputNome.value = json.Product.name; inputNome.disabled = false;
                    UI.toast('Produto encontrado!', 'success'); return;
                } else if (base.tipo === 'off' && json.status === 1 && json.product) {
                    const nome = [json.product.product_name, json.product.brands].filter(Boolean).join(' - ');
                    if (nome) {
                        inputNome.value = nome; inputNome.disabled = false;
                        UI.toast('Produto encontrado!', 'success'); return;
                    }
                } else if (base.tipo === 'upc' && json.items && json.items.length > 0) {
                    inputNome.value = json.items[0].title; inputNome.disabled = false;
                    UI.toast('Produto encontrado!', 'success'); return;
                }
            } catch(e) { console.warn('[fetchBarcode] falha ao consultar', base.url, e.message); }
        }

        inputNome.value = ""; 
        inputNome.disabled = false;
        inputNome.placeholder = "Não encontrado online. Digite o nome aqui...";
        UI.toast('Não localizado nas bases gratuitas. Digite o nome manualmente.', 'warning');
    },
    async saveProduct(e) { e.preventDefault(); await db.from('products').insert({ barcode: document.getElementById('fp-bar').value, name: document.getElementById('fp-nome').value, price: document.getElementById('fp-preco').value, commission: document.getElementById('fp-com').value, stock: document.getElementById('fp-qtd').value, min_stock: document.getElementById('fp-min').value }); Modals.close(); UI.toast('Produto salvo!'); Render.produtos(); },
    async updateStock(e, id, curStock) { e.preventDefault(); const v = parseInt(document.getElementById('fa-qtd').value); await db.from('products').update({stock: curStock + v}).eq('id', id); Modals.close(); UI.toast('Estoque atualizado!'); Render.produtos(); },

    async saveMensagem(e, id) { e.preventDefault(); const payload = { title: document.getElementById('fm-tit').value, content: document.getElementById('fm-txt').value }; if(id) await db.from('message_templates').update(payload).eq('id', id); else await db.from('message_templates').insert(payload); Modals.close(); UI.toast('Template salvo!'); Render.mensagens(); },
    async deleteMensagem(id) { UI.confirm('Deletar permanentemente?', async () => { await db.from('message_templates').delete().eq('id', id); UI.toast('Descartado.'); Render.mensagens(); }); },

    async createDespesa(e) { e.preventDefault(); await db.from('despesas').insert({ description: document.getElementById('fd-desc').value, amount: document.getElementById('fd-val').value, category: document.getElementById('fd-cat').value, date: new Date().toISOString() }); Modals.close(); UI.toast('Saída registrada!'); Render.despesas(); },

    async debitDebt(e, id, max) { 
        e.preventDefault(); const v = parseFloat(document.getElementById('f-val').value); 
        const nV = Math.max(0, max - v);
        await db.from('debts').update({ remaining_amount: nV }).eq('id', id); 
        if (nV === 0) await db.from('debts').delete().eq('id', id); 
        Modals.close(); UI.toast(`Baixa processada.`); Render.cobrancas();
    },
    async discountDebt(e, id, max) { 
        e.preventDefault(); const perc = parseFloat(document.getElementById('f-val').value); 
        await db.from('debts').update({ remaining_amount: Math.max(0, max - (max * perc / 100)) }).eq('id', id); 
        Modals.close(); UI.toast(`Desconto autorizado!`); Render.cobrancas();
    },

    async saveSettings(e) {
        e.preventDefault(); const n = document.getElementById('cfg-name').value; const p = document.getElementById('cfg-phone').value;
        const payload = { studio_name: n, official_phone: p };
        if(App.settings.id) await db.from('settings').update(payload).eq('id', App.settings.id);
        else await db.from('settings').insert(payload);
        App.settings = {...App.settings, ...payload}; document.getElementById('brand-name').textContent = n; UI.toast('Preferências salvas!');
    },

    sendWhatsApp(phone) {
        const msg = document.getElementById('wpp-msg').value; if(!msg) return UI.toast('Escreva algo.', 'error');
        Modals.close();
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { const splash = document.getElementById('splash-screen'); if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 500); } }, 4000);
    Auth.init();
});
