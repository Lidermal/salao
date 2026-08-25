/** * SISTEMA ESTÚDIO AMOR QUE CUIDA
 */

const DB_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';

const db = window.supabase.createClient(DB_URL, DB_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const App = { 
    user: null, 
    role: 'colaborador', 
    view: 'agenda', 
    currentDate: new Date(), 
    calendarMonth: new Date(),
    charts: {}, 
    settings: {},
    avatars: {}, 
    inflowCategories: ['Pix', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito'],
    filters: { relatorios: null, comissoes: null }
};

const U = {
    money: v => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v||0),
    iso: d => { const tzOffset = d.getTimezoneOffset() * 60000; return (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0]; },
    
    date: d => {
        if(!d) return '';
        let dateObj = new Date(d);
        if(d.length === 10) dateObj = new Date(d + 'T12:00:00'); 
        return dateObj.toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
    },

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
        let html = ''; let curr = new Date();
        for(let i=0; i<8; i++) {
            let d = new Date(curr.getFullYear(), curr.getMonth() - Math.floor(i/2), 1);
            let m = String(d.getMonth() + 1).padStart(2, '0');
            let y = d.getFullYear();
            let mName = d.toLocaleString('pt-BR', {month:'long'});
            let q = (i % 2 === 0) ? 'Q2' : 'Q1';
            if(i === 0 && curr.getDate() <= 15) continue;
            html += `<option value="${y}-${m}-${q}">${q === 'Q1' ? '1ª' : '2ª'} Quinzena (${mName}/${y})</option>`;
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

    buildExtrato(desp) {
        let extrato = [];
        let totalIn = 0, totalOut = 0;

        (desp || []).forEach(d => {
            const isIncome = App.inflowCategories.includes(d.category);
            const valNum = Number(d.amount) || 0;
            const item = { type: isIncome ? 'in' : 'out', desc: d.description, val: valNum, date: new Date(d.date), category: d.category };
            if(isIncome) totalIn += valNum; else totalOut += valNum;
            extrato.push(item);
        });

        extrato.sort((a, b) => a.date - b.date);
        let saldoAtual = 0;
        extrato = extrato.map(item => {
            saldoAtual += item.type === 'in' ? item.val : -item.val;
            return { ...item, saldo: saldoAtual };
        });
        extrato.reverse();
        return { extrato, totalIn, totalOut };
    },

    formatDesc: (text) => {
        if(text.includes('| Cliente:')) {
            const parts = text.split('| Cliente:');
            return `${parts[0].trim()}<br><span style="font-size:0.85rem; color:var(--muted); font-weight:normal; margin-top:3px; display:inline-block"><i class="ph ph-user"></i> Cliente: ${parts[1].trim()}</span>`;
        }
        return text;
    },

    initFilters() {
        const opts = this.generateQuinzenasOptions();
        ['filter-comanda-quinzena', 'filter-comissao-quinzena', 'filter-relatorios'].forEach(id => {
            const el = document.getElementById(id);
            if(el) { el.innerHTML = opts; el.value = this.getCurrentQuinzenaValue(); }
        });
    }
};

const CustomSelect = {
    render(id, placeholder, optionsHtml, onChangeGlobalName = '', initialValue = '') {
        return `
        <div class="aqc-custom-select" id="wrapper-${id}" onclick="event.stopPropagation()">
            <div class="aqc-select-trigger" onclick="CustomSelect.toggle('${id}')">
                <span id="label-${id}">${placeholder}</span>
                <i class="ph ph-caret-down"></i>
            </div>
            <div class="aqc-select-menu" id="menu-${id}" style="display:none;">
                <div class="aqc-select-search-box">
                    <input type="text" placeholder="Buscar..." onkeyup="CustomSelect.filter('${id}', this.value)">
                </div>
                <ul class="aqc-select-options" id="options-${id}">
                    ${optionsHtml}
                </ul>
            </div>
            <input type="hidden" id="${id}" value="${initialValue}" required onchange="${onChangeGlobalName ? onChangeGlobalName + '(this.value)' : ''}">
        </div>`;
    },
    toggle(id) {
        const menu = document.getElementById(`menu-${id}`);
        const wrapper = document.getElementById(`wrapper-${id}`);
        const isOpening = menu.style.display === 'none' || menu.style.display === '';

        document.querySelectorAll('.aqc-select-menu').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.aqc-custom-select').forEach(el => {
            el.style.zIndex = '1';
            if(el.parentElement) el.parentElement.style.zIndex = '';
        });

        if (isOpening) {
            menu.style.display = 'flex';
            wrapper.style.zIndex = '999999';
            if(wrapper.parentElement) { wrapper.parentElement.style.position = 'relative'; wrapper.parentElement.style.zIndex = '999999'; }

            const rect = wrapper.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            
            if (spaceBelow < 280) { 
                menu.style.top = 'auto'; menu.style.bottom = 'calc(100% + 5px)'; menu.style.boxShadow = '0 -10px 30px rgba(0,0,0,0.25)';
            } else {
                menu.style.top = 'calc(100% + 5px)'; menu.style.bottom = 'auto'; menu.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
            }
            const input = menu.querySelector('input');
            if(input) { input.value = ''; CustomSelect.filter(id, ''); input.focus(); }
        }
    },
    filter(id, term) {
        term = term.toLowerCase();
        const opts = document.getElementById(`options-${id}`).querySelectorAll('li');
        opts.forEach(opt => {
            if (opt.classList.contains('optgroup-label')) return;
            const text = opt.innerText.toLowerCase();
            opt.style.display = text.includes(term) ? 'block' : 'none';
        });
    },
    select(id, val, text) {
        document.getElementById(`label-${id}`).innerText = text;
        const input = document.getElementById(id);
        if(val.includes('%7B')) val = decodeURIComponent(val); 
        input.value = val;
        input.dispatchEvent(new Event('change'));
        document.getElementById(`menu-${id}`).style.display = 'none';
        
        const wrapper = document.getElementById(`wrapper-${id}`);
        wrapper.style.zIndex = '1'; if(wrapper.parentElement) wrapper.parentElement.style.zIndex = '';
    },
    closeAll() {
        document.querySelectorAll('.aqc-select-menu').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.aqc-custom-select').forEach(el => {
            el.style.zIndex = '1'; if(el.parentElement) el.parentElement.style.zIndex = '';
        });
    }
};

document.addEventListener('click', CustomSelect.closeAll);
window.handleNewClient = function(val) { const div = document.getElementById('fa-new-cli-div'); if(div) div.style.display = val === 'NEW' ? 'block' : 'none'; };
window.handleNewClientComanda = function(val) { const div = document.getElementById('fcom-new-cli-div'); if(div) div.style.display = val === 'NEW' ? 'block' : 'none'; };

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
        if(v === 'agenda') Modals.open('agendamento'); else if(v === 'comandas') Modals.open('comanda');
        else if(v === 'clientes') Modals.open('cliente'); else if(v === 'funcionarios' && App.role === 'owner') Modals.open('funcionario');
        else if(v === 'servicos' && App.role === 'owner') Modals.open('servico'); else if(v === 'produtos' && App.role === 'owner') Modals.open('produto');
        else if(v === 'mensagens' && App.role === 'owner') Modals.open('mensagem'); else if(v === 'despesas' && App.role === 'owner') Modals.open('despesa');
        else this.toast('Utilize os botões na tela para cadastros rápidos.', 'error');
    }
};

const Tour = {
    allSteps: [
        { role: 'all', view: 'agenda', target: '#btn-novo-agendamento-tour', mobileTarget: '.fab-button', title: '1. Agenda Inteligente', text: 'Aqui você visualiza e gerencia horários. Clique aqui para agendar um cliente, gerar um encaixe ou bloquear a agenda.' },
        { role: 'all', view: 'comandas', target: '#btn-nova-comanda-tour', mobileTarget: '.fab-button', title: '2. Abertura de Comandas', text: 'O cliente chegou? Abra uma comanda, adicione os serviços/produtos e vincule o profissional que realizou o atendimento.' },
        { role: 'all', view: 'cobrancas', target: '#tab-pendentes-tour', mobileTarget: '#tab-pendentes-tour', title: '3. Cobranças e Recebimentos', text: 'Comandas fechadas geram faturas. Aqui você dá baixa no pagamento misturando Pix, Cartão, Dinheiro e aplicando descontos.' },
        { role: 'all', view: 'clientes', center: true, title: '4. Gestão de Clientes', text: 'Veja o histórico de visitas, crie Registros de Observações personalizadas e mande mensagens no WhatsApp.' },
        { role: 'owner', view: 'servicos', center: true, title: '5. Catálogo de Serviços', text: 'Cadastre serviços definindo a duração na agenda, preço, custo fixo retido pelo salão e a comissão padrão do profissional.' },
        { role: 'owner', view: 'produtos', center: true, title: '6. Estoque de Produtos', text: 'Controle produtos para venda. O sistema alerta quando o estoque está baixo e calcula a comissão por venda automaticamente.' },
        { role: 'all', view: 'comissao', center: true, title: '7. Fechamento de Comissões', text: 'Painel automático. Profissionais vêem apenas seus próprios ganhos na quinzena. O gestor visualiza o Ranking geral do salão.' },
        { role: 'owner', view: 'mensagens', center: true, title: '8. Mensagens Automáticas', text: 'Crie templates para o WhatsApp com variáveis como {cliente}, {data}, {hora}. Ótimo para lembretes e confirmações.' },
        { role: 'owner', view: 'despesas', center: true, title: '9. Gestão de Despesas', text: 'Os custos das comandas vêm pra cá automaticamente. Lembre-se de lançar manualmente gastos como aluguel, luz e vales.' },
        { role: 'owner', view: 'resumo-financeiro', center: true, title: '10. Fluxo de Caixa Líquido', text: 'O coração financeiro do estúdio. Faturamento menos saídas, lucro líquido real e o extrato exato de toda a movimentação.' },
        { role: 'owner', view: 'performance', center: true, title: '11. Performance e KPIs', text: 'Indicadores do negócio: Ticket Médio, Taxa de Ocupação da agenda e os serviços que mais dão lucro (Curva ABC).' },
        { role: 'owner', view: 'funcionarios', center: true, title: '12. Equipe do Salão', text: 'Cadastre novos colaboradores, defina níveis de acesso (Gestor ou Atendente), resete senhas ou bloqueie usuários antigos.' },
        { role: 'owner', view: 'relatorios', target: '#filter-relatorios', mobileTarget: '#filter-relatorios', title: '13. Relatórios e PDF', text: 'Selecione a quinzena desejada e gere relatórios em PDF do Fluxo de Caixa ou Despesas para enviar ao contador.' },
        { role: 'owner', view: 'configuracoes', target: '#cfg-name', mobileTarget: '#cfg-name', title: '14. Ajustes do Sistema', text: 'Configure o Nome Oficial do estúdio. Isso altera a logo do sistema e a assinatura das mensagens enviadas pelo WhatsApp.' }
    ],
    steps: [], current: 0,
    start() {
        if (App.role === 'owner') { this.steps = [...this.allSteps]; } else { this.steps = this.allSteps.filter(s => s.role === 'all'); }
        this.steps.forEach((s, index) => { s.title = s.title.replace(/^\d+\./, `${index + 1}.`); });
        this.current = 0; document.getElementById('tour-overlay').classList.remove('hidden');
        if(window.innerWidth > 900) { document.getElementById('main-sidebar').classList.add('open'); } else { Nav.closeMenu(); }
        this.showStep();
    },
    showStep() {
        if(this.current >= this.steps.length) return this.skip();
        const s = this.steps[this.current]; Nav.showView(s.view);
        if(window.innerWidth <= 900) Nav.closeMenu();
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
        setTimeout(() => {
            const isMobile = window.innerWidth <= 900;
            document.getElementById('tour-title').textContent = s.title; document.getElementById('tour-desc').textContent = s.text;
            document.getElementById('tour-dots').innerHTML = this.steps.map((_, i) => `<span style="height:8px; width:8px; border-radius:50%; background:${i===this.current?'var(--primary)':'#ccc'}"></span>`).join('');
            document.getElementById('tour-next-btn').innerHTML = this.current === this.steps.length - 1 ? 'Concluir <i class="ph ph-check"></i>' : 'Próximo <i class="ph ph-arrow-right"></i>';
            if (s.center) return this.centerDialog();
            let targetSelector = isMobile && s.mobileTarget ? s.mobileTarget : s.target;
            let targetEl = document.querySelector(targetSelector);
            if(targetEl && targetEl.offsetParent === null && s.target) targetEl = document.querySelector(s.target);
            if(targetEl && targetEl.offsetParent !== null) {
                const rect = targetEl.getBoundingClientRect();
                if (rect.height > window.innerHeight * 0.6 || rect.width > window.innerWidth * 0.9) { this.centerDialog(); } 
                else { targetEl.classList.add('tour-highlight'); this.positionDialog(targetEl, isMobile); }
            } else { this.centerDialog(); }
        }, 400);
    },
    positionDialog(targetEl, isMobile) {
        const dialog = document.getElementById('tour-dialog'); dialog.style.transform = 'none'; dialog.style.bottom = 'auto'; 
        const rect = targetEl.getBoundingClientRect(); let top = rect.bottom + 15; let left = rect.left;
        if (isMobile) {
            dialog.style.width = 'calc(100% - 40px)'; left = 20;
            if (rect.bottom > window.innerHeight - 100 || top + dialog.offsetHeight > window.innerHeight) { top = rect.top - dialog.offsetHeight - 15; }
        } else {
            dialog.style.width = '350px';
            if (left + 350 > window.innerWidth) { left = window.innerWidth - 370; }
            if (top + dialog.offsetHeight > window.innerHeight) { top = rect.top - dialog.offsetHeight - 15; }
        }
        if (top < 20) top = 20; dialog.style.top = `${top}px`; dialog.style.left = `${left}px`;
    },
    centerDialog() {
        const dialog = document.getElementById('tour-dialog'); dialog.style.top = '50%'; dialog.style.left = '50%'; dialog.style.bottom = 'auto';
        dialog.style.transform = 'translate(-50%, -50%)'; dialog.style.width = window.innerWidth <= 900 ? 'calc(100% - 40px)' : '350px';
    },
    next() { this.current++; this.showStep(); },
    skip() {
        document.getElementById('tour-overlay').classList.add('hidden'); document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
        document.getElementById('tour-dialog').style.transform = 'none'; localStorage.setItem('aqc_tour_done', 'true');
    }
};

const Auth = {
    init() { document.getElementById('login-form').onsubmit = e => { e.preventDefault(); this.login(); }; },
    async login() {
        const u = document.getElementById('username').value.trim(); const p = document.getElementById('password').value;
        const btn = document.getElementById('btn-login'); btn.textContent = 'Aguarde...';
        try {
            const { data, error } = await db.from('users').select('*').ilike('username', u).maybeSingle();
            if (error) throw new Error(`Falha no sistema: ${error.message}`); if (!data) throw new Error("Usuário não encontrado.");
            if (data.active === false || data.is_deleted === true) throw new Error("Conta desativada ou excluída. Procure a Administração.");
            if (data.password !== p) throw new Error("Senha incorreta.");
            App.user = data; App.role = (data.role === 'freelancer' || data.role === 'colaborador') ? 'colaborador' : 'owner';
            document.getElementById('login-form').reset(); this.success();
            if(data.first_login || p === '123456') { setTimeout(() => { Modals.open('first_login'); }, 500); } 
            else if (!localStorage.getItem('aqc_tour_done')) { setTimeout(() => { Tour.start(); }, 1000); }
        } catch(e) { UI.toast(e.message, 'error'); btn.textContent = 'Entrar'; }
    },
    async fetchAllAvatars() {
        try { const { data: avData } = await db.from('user_avatars').select('*'); if(avData) { avData.forEach(av => { App.avatars[av.user_id] = av.avatar_base64; }); } } catch (e) { console.log('Tabela user_avatars ignorada.'); }
    },
    async success() {
        document.getElementById('auth-layer').classList.add('hidden'); document.getElementById('system-layout').classList.remove('hidden'); document.body.classList.toggle('is-owner', App.role === 'owner');
        const { data: set } = await db.from('settings').select('*').single();
        if(set) { App.settings = set; document.getElementById('brand-name').textContent = set.studio_name; }
        App.avatars = {}; await this.fetchAllAvatars(); this.updateHeaderAvatar();
        U.initFilters(); Nav.init(); Render.showMonthView(); 
        
        db.channel('custom-all-channel').on('postgres_changes', { event: '*', schema: 'public' }, payload => {
            if(payload.table === 'user_avatars') { this.fetchAllAvatars().then(() => { this.updateHeaderAvatar(); if(App.view === 'agenda' && !document.getElementById('agenda-day-view').classList.contains('hidden')) Render.agendaDay(); }); }
            else if(App.view === 'agenda') { if(!document.getElementById('agenda-day-view').classList.contains('hidden')) Render.agendaDay(); else Render.buildMonthCalendar(); } 
            else if(Render[App.view]) { Render[App.view](); }
        }).subscribe();
    },
    updateHeaderAvatar() {
        document.getElementById('header-user').textContent = App.user.name.split(' ')[0]; const av = document.getElementById('header-avatar');
        if(App.avatars[App.user.id]) { av.innerHTML = ''; av.style.backgroundImage = `url(${App.avatars[App.user.id]})`; av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center'; av.style.color = 'transparent'; } 
        else { av.innerHTML = App.user.name.substring(0,2).toUpperCase(); av.style.backgroundImage = 'none'; av.style.color = 'white'; }
    },
    logout() { UI.confirm('Deseja realmente sair da sua conta?', () => { window.location.reload(true); }); }
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
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); document.getElementById(`view-${id}`).classList.add('active');
        document.querySelectorAll('.nav-link, .b-item').forEach(el => el.classList.remove('active')); document.querySelectorAll(`[data-view="${id}"]`).forEach(el => el.classList.add('active'));
        const titles = { perfil: 'Meu Perfil', agenda:'Agenda', comandas:'Comandas', cobrancas:'Cobranças', clientes:'Clientes', observacoes:'Histórico de Observações', 'perfil-cliente':'Perfil do Cliente', servicos:'Catálogo de Serviços', produtos:'Estoque & Preços', comissao:'Dashboard de Comissões', mensagens:'Mensagens Automáticas', despesas:'Gestão de Despesas', 'resumo-financeiro':'Fluxo de Caixa', performance:'Métricas e Resultados', configuracoes:'Ajustes do Sistema', funcionarios:'Equipe do Salão', relatorios:'Relatórios & Arquivos' };
        document.getElementById('page-title').textContent = titles[id] || 'Amor que Cuida';
        if (id === 'agenda') { Render.showMonthView(); } 
        else if (id === 'perfil') {
            document.getElementById('perfil-nome').textContent = App.user.name; document.getElementById('perfil-role').textContent = App.role === 'owner' ? 'Gestor / Proprietário' : 'Colaborador';
            const preview = document.getElementById('perfil-foto-preview');
            if(App.avatars[App.user.id]) { preview.innerHTML = ''; preview.style.backgroundImage = `url(${App.avatars[App.user.id]})`; preview.style.backgroundSize = 'cover'; preview.style.backgroundPosition = 'center'; } 
            else { preview.innerHTML = App.user.name.substring(0,2).toUpperCase(); preview.style.backgroundImage = 'none'; }
        } else {
            const detailViews = ['observacoes', 'perfil-cliente'];
            if(Render[id] && !detailViews.includes(id)) { if(id === 'cobrancas') Render.cobrancas('pendentes'); else Render[id](); }
        }
    },
    toggleMenu() { document.getElementById('main-sidebar').classList.toggle('open'); document.getElementById('mobile-overlay').classList.toggle('hidden'); },
    closeMenu() { document.getElementById('main-sidebar').classList.remove('open'); document.getElementById('mobile-overlay').classList.add('hidden'); }
};

const Render = {
    showMonthView() {
        document.getElementById('agenda-day-view').classList.add('hidden'); document.getElementById('agenda-month-view').classList.remove('hidden');
        document.getElementById('btn-voltar-mes').classList.add('hidden'); document.getElementById('day-view-title').classList.add('hidden');
        this.buildMonthCalendar();
    },
    changeMonth(dir) { App.calendarMonth.setMonth(App.calendarMonth.getMonth() + dir); this.buildMonthCalendar(); },

    async buildMonthCalendar() {
        const year = App.calendarMonth.getFullYear(); const month = App.calendarMonth.getMonth();
        document.getElementById('cal-month-year').textContent = App.calendarMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0);
        const startDate = U.iso(firstDay); const endDate = U.iso(lastDay);
        
        let monthApps = [];
        try {
            let query = db.from('appointments').select('date, status').gte('date', startDate).lte('date', endDate).neq('status', 'cancelado');
            if(App.role !== 'owner') query = query.eq('user_id', App.user.id);
            const { data } = await query; if(data) monthApps = data;
        } catch(e) {}

        const grid = document.getElementById('cal-grid'); let html = ''; const weekDays = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
        weekDays.forEach(d => { html += `<div class="cal-grid-header">${d}</div>`; });
        for (let i = 0; i < firstDay.getDay(); i++) { html += `<div class="cal-day empty"></div>`; }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const currentIso = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`; const isToday = currentIso === U.iso(new Date());
            const dayApps = monthApps.filter(a => a.date === currentIso); let indicators = '';
            if(dayApps.length > 0) {
                if(dayApps.some(a => ['agendado','chegou'].includes(a.status))) indicators += '<span class="dot agendado"></span>';
                if(dayApps.some(a => a.status === 'bloqueado')) indicators += '<span class="dot bloqueado"></span>';
            } else { indicators = '<span class="dot livre"></span>'; }
            html += `<div class="cal-day num ${isToday ? 'today' : ''}" onclick="Render.selectDate('${currentIso}')"><span class="day-num">${i}</span><div class="cal-dots">${indicators}</div></div>`;
        }
        grid.innerHTML = html;
    },

    selectDate(iso) { 
        App.currentDate = new Date(iso+'T12:00:00'); 
        document.getElementById('agenda-month-view').classList.add('hidden'); document.getElementById('agenda-day-view').classList.remove('hidden');
        document.getElementById('btn-voltar-mes').classList.remove('hidden'); document.getElementById('day-view-title').classList.remove('hidden');
        this.agendaDay(); 
    },

    async agendaDay() {
        this.buildWeekStrip(); 
        try {
            const dateStr = U.iso(App.currentDate);
            let query = db.from('appointments').select('*, clients(name, phone), services(name, duration), users!user_id(name)').eq('date', dateStr).neq('status', 'cancelado').order('time', {ascending: true});
            if (App.role !== 'owner') query = query.eq('user_id', App.user.id);
            const { data: agData, error: errAg } = await query; if(errAg) throw errAg;

            let uQuery = db.from('users').select('id, name, schedule, phone').neq('username', 'admin.teste').eq('active', true).neq('is_deleted', true).order('name');
            if(App.role !== 'owner') uQuery = uQuery.eq('id', App.user.id);
            let { data: usersData } = await uQuery;

            if(usersData) {
                const currentDayOfWeek = App.currentDate.getDay();
                usersData.forEach(u => {
                    if(!u.schedule) { u.isOffDay = false; return; }
                    const dayConf = u.schedule[String(currentDayOfWeek)];
                    u.isOffDay = dayConf ? dayConf.active === false : false;
                });
            }

            const cont = document.getElementById('agenda-list');
            if(!usersData || usersData.length === 0) { 
                cont.innerHTML = `<div class="card" style="text-align:center; padding:4rem 1rem"><i class="ph ph-calendar-x" style="font-size:3rem; color:var(--muted); margin-bottom:10px;"></i><p style="color:var(--muted); font-size:1.1rem">Nenhum profissional cadastrado.</p></div>`; 
                return; 
            }

            const isDesktop = window.innerWidth > 900; const pixelsPerMin = isDesktop ? 1 : 1.3; const slotHeight = isDesktop ? 60 : 78; const horaInicio = 7; const horaFim = 21;
            let html = `<div class="timeline-wrapper" style="overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; border: 1px solid var(--border); border-radius: 8px;"><div class="timeline-header" style="display: flex; min-width: max-content; border-bottom: 1px solid var(--border);"><div class="time-col" style="position: sticky; left: 0; z-index: 20; background: var(--surface); border:none; min-width: 60px; box-shadow: 2px 0 5px rgba(0,0,0,0.05);"></div>`;
            usersData.forEach(u => { 
                let bgImage = (App.avatars && App.avatars[u.id]) ? `background-image: url(${App.avatars[u.id]}); background-size: cover; background-position: center; color: transparent;` : ''; let init = bgImage ? '' : u.name.substring(0,2).toUpperCase();
                html += `<div class="prof-col-header" style="display:flex; flex-direction:column; align-items:center; gap:5px; padding: 15px 10px; min-width: 140px; flex: 1; border-right: 1px solid var(--border); opacity: ${u.isOffDay ? '0.6' : '1'};"><div style="width: 45px; height: 45px; border-radius: 50%; background-color: ${u.isOffDay ? '#ccc' : 'var(--primary)'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight:bold; border: 2px solid ${u.isOffDay ? '#aaa' : 'var(--primary-light)'}; ${bgImage}">${init}</div><span style="font-size:0.95rem; font-weight: bold; margin-bottom:5px; color: ${u.isOffDay ? 'var(--muted)' : 'var(--text)'}; text-align:center">${u.name.split(' ')[0]} ${u.isOffDay ? '<br><span style="font-size:0.7rem; color:var(--primary)">(Folga)</span>' : ''}</span></div>`; 
            });
            html += `</div><div class="timeline-body" style="display: flex; min-width: max-content; position: relative;"><div class="time-col" style="position: sticky; left: 0; z-index: 10; background: var(--surface); min-width: 60px; box-shadow: 2px 0 5px rgba(0,0,0,0.05);">`;
            for(let i=horaInicio; i<=horaFim; i++) { html += `<div class="time-slot" style="height:${slotHeight}px; min-height:${slotHeight}px; display:flex; justify-content:center; padding-top:8px; color:var(--muted); font-size:0.8rem; border-bottom: 1px solid var(--border);"><span>${String(i).padStart(2,'0')}:00</span></div>`; }
            html += `</div><div class="tracks-container" style="display: flex; flex: 1;">`;
            usersData.forEach(u => {
                let trackBg = u.isOffDay ? 'background-color: rgba(216, 27, 96, 0.08);' : '';
                html += `<div class="prof-track" style="position: relative; min-width: 140px; flex: 1; border-right: 1px solid var(--border); ${trackBg}">`;
                for(let i=horaInicio; i<=horaFim; i++) { 
                    const tm = String(i).padStart(2,'0') + ':00'; 
                    const onclickAction = u.isOffDay ? `Modals.open('menu_indisponivel', '${u.id}', '${u.name.replace(/'/g, "\\'")}', '${u.phone || ''}')` : `Modals.open('menu_agenda_mobile', '${u.id}', '${tm}', '${dateStr}')`;
                    html += `<div class="track-line" style="height:${slotHeight}px; min-height:${slotHeight}px; border-bottom: 1px dashed var(--border); cursor:pointer;" onclick="${onclickAction}"></div>`; 
                }
                const userApps = (agData || []).filter(a => a.user_id === u.id);
                userApps.forEach(a => {
                    const [sh, sm] = (a.time||'00:00').split(':').map(Number); let endStr, originalNotes = a.notes || '';
                    if (a.status === 'bloqueado' && originalNotes.includes('BLOQUEIO_ATE:')) { const parts = originalNotes.split('|'); endStr = parts[0].replace('BLOQUEIO_ATE:', '').trim(); a.notes = parts.slice(1).filter(p => !p.includes('ADMIN_BLOCK')).join(' | ').trim(); } 
                    else { let durationMins = (a.services && a.services.duration) ? a.services.duration : 60; let mF = sm + durationMins; let hF = sh + Math.floor(mF/60); endStr = `${String(hF).padStart(2,'0')}:${String(mF%60).padStart(2,'0')}`; }
                    const [eh, em] = endStr.split(':').map(Number); const startMins = (sh * 60 + sm) - (horaInicio * 60); let blockDuration = (eh * 60 + em) - (sh * 60 + sm); if (blockDuration <= 0) blockDuration = 60;
                    const top = startMins * pixelsPerMin; const height = blockDuration * pixelsPerMin; const isBlocked = a.status === 'bloqueado'; const isEncaixe = a.is_encaixe; const isCompact = blockDuration <= 45; 
                    let bg = isBlocked ? '#f0f0f0' : '#ffe3e8'; let color = isBlocked ? '#616161' : '#880e4f'; let border = isBlocked ? '#9e9e9e' : '#d81b60'; if(a.status === 'chegou') { bg = '#dcedc8'; border = '#689f38'; color = '#33691e'; }
                    const wppBtn = (!isBlocked && a.status === 'agendado') ? `<button onclick="event.stopPropagation(); Actions.sendConfirmacao('${a.id}')"><i class="ph ph-whatsapp-logo"></i></button>` : '';
                    const chkBtn = (!isBlocked && a.status === 'agendado') ? `<button onclick="event.stopPropagation(); Actions.markAsArrived('${a.id}')"><i class="ph ph-check"></i></button>` : '';
                    let extraStyle = isEncaixe ? 'width: 80%; left: 10%; z-index: 10; box-shadow: -4px 4px 15px rgba(0,0,0,0.15); border-left-width: 6px;' : 'width: 96%; left: 2%;';
                    html += `<div class="agenda-card ${isCompact ? 'compact' : ''}" style="position: absolute; top:${top}px; height:${height}px; background:${bg}; border-left:4px solid ${border}; color:${color}; border-radius: 6px; padding: 6px; overflow: hidden; font-size: 0.85rem; cursor: pointer; transition: 0.2s; ${extraStyle}" onclick="Modals.open('detalhes_agendamento', '${a.id}')">
                        <div class="ac-time" style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 2px;">${a.time.slice(0,5)} - ${endStr.slice(0,5)}</div><div class="ac-title" style="font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="ph ${isBlocked ? 'ph-prohibit' : 'ph-user'}"></i> ${isBlocked ? 'Bloqueado' : (a.clients?.name || 'Cliente')}</div><div class="ac-sub" style="font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${!isBlocked ? (a.services?.name || '') : (a.notes || '')}</div><div class="ac-actions" style="position: absolute; right: 5px; top: 5px; display: flex; gap: 5px;">${chkBtn} ${wppBtn}</div></div>`;
                }); html += `</div>`;
            }); html += `</div></div></div>`; cont.innerHTML = html;
        } catch (e) { UI.toast(`Erro na agenda: ${e.message}`, 'error'); }
    },

    buildWeekStrip() {
        const d = App.currentDate; let strTitle = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('day-view-title').textContent = strTitle.charAt(0).toUpperCase() + strTitle.slice(1);
        const start = new Date(d); start.setDate(d.getDate() - 3); let html = ''; const days = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
        for(let i=0; i<7; i++) { const cur = new Date(start); cur.setDate(start.getDate() + i); const isoCur = U.iso(cur); const isSel = isoCur === U.iso(App.currentDate) ? 'active' : ''; html += `<div class="cal-day ${isSel}" onclick="Render.selectDate('${isoCur}')"><span>${days[cur.getDay()]}</span><span>${cur.getDate()}</span></div>`; }
        document.getElementById('cal-days-row').innerHTML = html;
    },

    async clientes() { const { data } = await db.from('clients').select('*').order('name'); window.allClientes = data || []; this.renderClientesList(window.allClientes); },
    renderClientesList(data) {
        document.getElementById('clientes-list').innerHTML = data.map(c => {
            const safeName = c.name.replace(/'/g, "\\'").replace(/"/g, '&quot;'); 
            return `<div class="card cliente-card"><a href="#" class="wpp-btn" onclick="Modals.open('whatsapp', '${c.phone}', '${safeName}', JSON.stringify({cliente:'${safeName}', data_aniversario:'${c.birth_date ? new Date(c.birth_date).toLocaleDateString() : ''}'})); event.stopPropagation()"><i class="ph ph-whatsapp-logo"></i></a><h4 style="color:var(--primary); font-size:1.2rem; margin-bottom:10px">${c.name}</h4><p><i class="ph ph-phone"></i> ${c.phone}</p><p style="font-size:0.8rem; color:var(--muted); margin-top:5px"><i class="ph ph-cake"></i> ${c.birth_date ? new Date(c.birth_date).toLocaleDateString('pt-BR') : 'Não cadastrado'}</p><div style="display:flex; gap:10px; margin-top:15px; flex-wrap:wrap"><button class="btn-secondary" style="flex:1; min-width:120px;" onclick="Render.perfilCliente('${c.id}', '${safeName}')"><i class="ph ph-user"></i> Perfil</button><button class="btn-secondary" style="flex:1; min-width:120px;" onclick="Render.observacoes('${c.id}', '${safeName}')"><i class="ph ph-file-text"></i> Observações</button><button class="btn-secondary" style="width:100%; border:1px solid #ccc" onclick="Modals.open('edit_cliente', '${c.id}')"><i class="ph ph-pencil"></i> Editar Dados</button></div></div>`;
        }).join('');
    },
    filterClientes(term) { term = term.toLowerCase(); const filtered = (window.allClientes || []).filter(c => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term))); this.renderClientesList(filtered); },
    
    observacoes(id, name) {
        document.getElementById('current-observacao-client-id').value = id;
        if (name) {
            window.currentObsClientName = name;
            document.getElementById('observacao-title').textContent = `Observações de: ${name}`;
        } else if (window.currentObsClientName) {
            document.getElementById('observacao-title').textContent = `Observações de: ${window.currentObsClientName}`;
        }
        Nav.showView('observacoes'); 
        Actions.loadObservacoes(id); 
    },
    
    async perfilCliente(id, name) {
        document.getElementById('current-perfil-client-id').value = id; document.getElementById('perfil-cliente-title').textContent = `Perfil: ${name}`; Nav.showView('perfil-cliente');
        const { data: comandas } = await db.from('comandas').select('*, users!comandas_professional_id_fkey(name)').eq('client_id', id).eq('status', 'fechada').order('created_at', {ascending: false});
        const { data: debts } = await db.from('debts').select('*').eq('client_id', id).gt('remaining_amount', 0).maybeSingle();
        const debitosDiv = document.getElementById('perfil-debitos-destaque');
        if (debts && debts.remaining_amount > 0) { debitosDiv.innerHTML = `<div class="card" style="background:#ffebee; border-left:5px solid #d32f2f; margin-bottom:10px;"><h4 style="color:#d32f2f; margin-bottom:5px;"><i class="ph ph-warning-circle"></i> Atenção: Cliente possui débitos ativos</h4><p style="font-size:1.1rem">Valor Pendente: <b>${U.money(debts.remaining_amount)}</b></p><button class="btn-primary" style="margin-top:10px; background:#d32f2f; width:auto; padding:0.5rem 1rem" onclick="Nav.showView('cobrancas')">Ir para Cobranças</button></div>`; } else { debitosDiv.innerHTML = ''; }
        document.getElementById('perfil-info').innerHTML = `<div class="card" style="border-left:4px solid var(--primary);"><h4 style="font-size:1.2rem;">Total de Visitas Concluídas: ${comandas.length}</h4></div>`;
        const list = document.getElementById('perfil-visitas-list'); if(!comandas || comandas.length === 0) { list.innerHTML = "<p style='color:var(--muted); padding:2rem; text-align:center;'>Nenhum histórico.</p>"; return; }
        list.innerHTML = comandas.map(c => { const itens = (c.items||[]).map(i => i.name).join(', '); return `<div class="card" style="margin-bottom:10px;"><h4 style="color:var(--primary-dark); font-size:1.1rem; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;"><i class="ph ph-calendar"></i> ${U.date(c.created_at)}</h4><p style="margin-bottom:5px;"><b>Ticket Associado:</b> ${c.ticket || 'S/N'}</p><p style="margin-bottom:5px;"><b>Profissional que Abriu:</b> ${c.users?.name || 'Não informado'}</p><p style="margin-bottom:5px;"><b>Serviços/Produtos:</b> ${itens || 'Nenhum detalhe salvo'}</p><p><b>Total Investido:</b> ${U.money(c.total)}</p></div>`; }).join('');
    },

    async cobrancas(tab = 'pendentes') {
        document.getElementById('tab-pendentes-tour').classList.toggle('active-tab', tab === 'pendentes'); document.getElementById('tab-pendentes-tour').style.border = tab === 'pendentes' ? 'none' : '1px solid transparent';
        document.getElementById('tab-pagos').classList.toggle('active-tab', tab === 'pagos'); document.getElementById('tab-pagos').style.border = tab === 'pagos' ? 'none' : '1px solid transparent';
        let query = db.from('debts').select('*, clients(name)').order('created_at', {ascending: false});
        if(tab === 'pendentes') query = query.gt('remaining_amount', 0); else query = query.eq('remaining_amount', 0);
        const { data: debts, error } = await query; const cont = document.getElementById('cobrancas-list');
        if(error) return cont.innerHTML = `<p style='color:#d32f2f'><i class="ph ph-warning-circle"></i> Erro: ${error.message}</p>`; if (!debts || debts.length === 0) return cont.innerHTML = `<p style='color:var(--muted)'>Nenhum registro ${tab === 'pendentes'?'em aberto':'pago'}.</p>`;
        let htmlFinal = '';
        for (let d of debts) {
            const fTkt = `FAT-${d.id.substring(0,5).toUpperCase()}`; const ticketsArr = d.comanda_ticket ? d.comanda_ticket.split(', ').map(t => t.trim()) : [];
            const { data: relatedComandas } = await db.from('comandas').select('items, created_at, ticket').in('ticket', ticketsArr);
            let htmlList = ''; let profsEnvolvidos = [];
            if(relatedComandas) {
                relatedComandas.forEach(rc => {
                    const dt = U.date(rc.created_at);
                    if(rc.items) {
                        htmlList += `<div style="font-size:0.75rem; color:#666; margin-top:10px; border-bottom:1px dashed #ccc; padding-bottom:3px;">Comanda Origem: ${rc.ticket} (${dt})</div>`;
                        rc.items.forEach(i => { if(i.prof_name && !profsEnvolvidos.includes(i.prof_name)) profsEnvolvidos.push(i.prof_name); htmlList += `<div style="display:flex; justify-content:space-between; padding:5px 0; font-size:0.95rem;"><span>${i.name}</span><b>${U.money(i.price)}</b></div>`; });
                    }
                });
            }
            let badgesPagamento = '';
            if(tab === 'pagos' && d.payment_details) {
                const pd = typeof d.payment_details === 'string' ? JSON.parse(d.payment_details) : d.payment_details; badgesPagamento += `<div style="margin-top:10px; padding-top:10px; border-top:1px solid #eee; display:flex; gap:5px; flex-wrap:wrap">`;
                if(pd.pix) badgesPagamento += `<span style="background:#e0f2f1; color:#00695c; padding:3px 8px; border-radius:8px; font-size:0.8rem">Pix: ${U.money(pd.pix)}</span>`; if(pd.dinheiro) badgesPagamento += `<span style="background:#e8f5e9; color:#2e7d32; padding:3px 8px; border-radius:8px; font-size:0.8rem">Dinheiro: ${U.money(pd.dinheiro)}</span>`;
                if(pd.credito) badgesPagamento += `<span style="background:#fff3e0; color:#e65100; padding:3px 8px; border-radius:8px; font-size:0.8rem">Crédito: ${U.money(pd.credito)}</span>`; if(pd.debito) badgesPagamento += `<span style="background:#e3f2fd; color:#1565c0; padding:3px 8px; border-radius:8px; font-size:0.8rem">Débito: ${U.money(pd.debito)}</span>`;
                if(pd.desconto) badgesPagamento += `<span style="background:#ffebee; color:#d32f2f; padding:3px 8px; border-radius:8px; font-size:0.8rem">Desconto: ${pd.desconto}%</span>`; badgesPagamento += `</div>`;
            }
            htmlFinal += `<div class="card" style="padding:0; overflow:hidden; border:1px solid ${tab==='pendentes'?'#d32f2f':'#2e7d32'};"><div style="background:${tab==='pendentes'?'#fffee6':'#f1f8e9'}; padding:20px; font-family:'Courier New', Courier, monospace; color:#333; border-bottom:2px dashed #ccc;"><h3 style="text-align:center; font-family:'Courier New', monospace; font-weight:bold; margin-bottom:5px; font-size:1.4rem; color:${tab==='pendentes'?'#d32f2f':'#2e7d32'}">${tab==='pendentes'?'FATURA DE COBRANÇA':'RECIBO DE PAGAMENTO'}</h3><h4 style="text-align:center; margin-bottom:15px; font-size:1rem; color:#666">${fTkt}</h4><p style="margin-bottom:5px; border-bottom:1px solid #ddd; padding-bottom:10px;"><b>Cliente:</b> ${d.clients?.name}</p><p style="margin-bottom:5px; font-size:0.85rem"><b>Profissionais:</b> ${profsEnvolvidos.join(', ') || 'N/A'}</p><div style="padding:10px 0; margin-bottom:15px; max-height:200px; overflow-y:auto; border-bottom:1px dashed #999;">${htmlList || 'Nenhum detalhe de itens encontrado.'}</div><div style="font-size:0.85rem; color:#666; margin-bottom:10px; text-align:right;">Total Bruto Consumido: ${U.money(d.total_amount)}</div><div style="display:flex; justify-content:space-between; font-size:1.4rem; font-weight:bold; color:${tab==='pendentes'?'#d32f2f':'#2e7d32'}; padding-top:10px"><span>${tab==='pendentes'?'FALTA PAGAR:':'PAGO COM SUCESSO'}</span><span>${tab==='pendentes'? U.money(d.remaining_amount) : ''}</span></div>${badgesPagamento}</div>${tab === 'pendentes' ? `<div style="padding:15px; display:flex; gap:10px; background:#fff"><button class="btn-primary" style="flex:1; background:#2e7d32;" onclick="Modals.open('debitar', '${d.id}', ${d.remaining_amount}, '${fTkt}')"><i class="ph ph-money"></i> Receber Pagamento</button><button class="btn-secondary" style="width:auto;" onclick="Modals.open('desconto', '${d.id}', ${d.remaining_amount})"><i class="ph ph-percent"></i> Desc.</button></div>` : ''}</div>`;
        }
        cont.innerHTML = htmlFinal;
    },

    async servicos() { const { data } = await db.from('services').select('*').order('name'); window.allServicos = data || []; this.renderServicosList(window.allServicos); },
    renderServicosList(data) {
        const cont = document.getElementById('servicos-list'); if(!data || data.length === 0) { cont.innerHTML = '<p style="color:var(--muted); padding: 1rem;">Nenhum serviço encontrado.</p>'; return; }
        cont.innerHTML = data.map(s => `<div class="card"><div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px"><h4 style="font-size:1.2rem;">${s.name} <span style="font-size:0.8rem; font-weight:normal; color:#888;">(${s.duration || 60}min)</span></h4><div><button onclick="Modals.open('edit_servico', '${s.id}')" style="background:none; border:none; cursor:pointer; color:var(--primary); font-size:1.2rem; margin-right:5px"><i class="ph ph-pencil"></i></button><button onclick="Actions.deleteService('${s.id}')" style="background:none; border:none; cursor:pointer; color:#d32f2f; font-size:1.2rem"><i class="ph ph-trash"></i></button></div></div><div style="margin:10px 0; color:var(--muted)"><p>Comissão Pro: <b style="color:var(--text)">${s.commission}%</b></p>${s.has_assistant?`<p>Auxiliar: <b style="color:var(--text)">${s.assistant_commission}%</b></p>`:''}<p>Custo Fixo Retido: <b style="color:#d32f2f">${s.cost || 0}%</b></p></div><div class="val" style="font-size:1.5rem">${U.money(s.price)}</div></div>`).join('');
    },
    filterServicos(term) { term = term.toLowerCase(); const filtered = (window.allServicos || []).filter(s => s.name.toLowerCase().includes(term)); this.renderServicosList(filtered); },
    
    async produtos() {
        const { data } = await db.from('products').select('*').order('name'); window.allProdutos = data || [];
        document.getElementById('produtos-list').innerHTML = `<div class="card" style="margin-bottom:20px; padding: 10px;"><div class="input-group" style="margin:0;"><input type="text" placeholder="Buscar produto pelo nome..." onkeyup="Render.filterProdutos(this.value)" style="padding:1rem; border-radius:8px; border:1px solid var(--border); font-size: 1rem;"></div></div><div id="produtos-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px;"></div>`;
        this.renderProdutosList(window.allProdutos);
    },
    renderProdutosList(data) {
        const grid = document.getElementById('produtos-grid'); if(!grid) return; if(data.length === 0) { grid.innerHTML = '<p style="color:var(--muted); padding: 1rem;">Nenhum produto encontrado.</p>'; return; }
        grid.innerHTML = data.map(p => `<div class="card" style="border-top: 4px solid ${p.stock <= p.min_stock ? '#d32f2f' : 'var(--primary)'}"><h4 style="font-size:1.1rem; margin-bottom:5px">${p.name}</h4><div style="margin:10px 0; background:#f9f9f9; padding:10px; border-radius:8px; display:flex; justify-content:space-between"><div><span style="font-size:0.7rem; color:var(--muted)">Preço Venda</span><p style="font-weight:bold">${U.money(p.price)}</p></div><div style="text-align:right"><span style="font-size:0.7rem; color:var(--muted)">Comissão</span><p style="font-weight:bold">${p.commission}%</p></div></div><div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px"><div><span style="font-size:0.8rem; color:var(--muted)">Estoque Atual</span><div class="val" style="font-size:1.4rem; color:${p.stock <= p.min_stock ? '#d32f2f' : 'var(--text)'}">${p.stock}</div></div><button class="btn-secondary" style="width:auto; padding:0.6rem 1.2rem" onclick="Modals.open('add_estoque', '${p.id}', '${p.stock}')">+ Repor</button></div></div>`).join('');
    },
    filterProdutos(term) { term = term.toLowerCase(); const filtered = (window.allProdutos || []).filter(p => p.name.toLowerCase().includes(term)); this.renderProdutosList(filtered); },
    
    async comandas() {
        let query = db.from('comandas').select('*, clients(name)').order('created_at', {ascending: false});
        const qFilter = document.getElementById('filter-comanda-quinzena')?.value; if (qFilter) { const range = U.getQuinzenaDates(qFilter); query = query.gte('created_at', range.start).lte('created_at', range.end); }
        const { data } = await query;
        document.getElementById('comandas-list').innerHTML = (!data || data.length === 0) ? '<p style="color:var(--muted)">Sem comandas para este período.</p>' : data.map(c => `<div class="card" style="border-left: 5px solid ${c.status === 'aberta' ? 'var(--primary)' : '#ccc'}"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><span style="font-size:0.8rem; color:var(--primary); font-weight:bold; letter-spacing:1px">${c.ticket || 'TKT-####'}</span><h4 style="font-size:1.2rem; margin-top:5px">${c.clients?.name || 'Desconhecido'}</h4><p style="font-size:0.8rem; color:var(--muted)"><i class="ph ph-list-bullets"></i> Itens Lançados: ${(c.items||[]).length}</p></div><span style="font-size:0.7rem; font-weight:bold; padding: 4px 10px; border-radius:20px; background:${c.status === 'aberta' ? 'var(--primary-light)' : '#eee'}; color:${c.status === 'aberta' ? 'var(--primary-dark)' : 'var(--muted)'}">${c.status.toUpperCase()}</span></div><div class="val" style="font-size:1.8rem; margin:15px 0;">${U.money(c.total)}</div><button class="btn-secondary" style="width:100%; padding:0.8rem" onclick="Modals.open('edit_comanda', '${c.id}')"><i class="ph ph-list-plus"></i> ${c.status === 'aberta' ? 'Lançar Itens / Fechar' : 'Visualizar Ticket'}</button></div>`).join('');
    },

    async mensagens() {
        const { data } = await db.from('message_templates').select('*');
        document.getElementById('mensagens-list').innerHTML = data.map(m => `<div class="card"><h4 style="color:var(--primary); border-bottom:1px solid #eee; padding-bottom:10px">${m.title}</h4><p style="margin:15px 0; font-style:italic; color:var(--muted)">"${m.content}"</p><div style="display:flex; gap:10px"><button class="btn-secondary" style="flex:1" onclick="Modals.open('edit_mensagem', '${m.id}')"><i class="ph ph-pencil"></i> Editar</button><button class="btn-secondary" style="flex:1; color:#d32f2f; background:#ffebee" onclick="Actions.deleteMensagem('${m.id}')"><i class="ph ph-trash"></i> Excluir</button></div></div>`).join('');
    },
    
    async funcionarios() {
        const { data } = await db.from('users').select('*').neq('username', 'admin.teste').neq('is_deleted', true).order('name');
        document.getElementById('funcionarios-list').innerHTML = data.map(u => {
            const isActive = u.active !== false; return `<div class="card" style="border-left: 4px solid ${isActive ? 'var(--primary)' : '#999'}; opacity: ${isActive ? '1' : '0.6'}"><h4 style="font-size:1.2rem; margin-bottom:5px">${u.name}</h4><p style="font-size:0.9rem; color:var(--muted)"><i class="ph ph-user"></i> Login: <b>${u.username}</b></p><p style="font-size:0.8rem; margin-top:5px; padding:3px 8px; border-radius:10px; display:inline-block; background:${u.role==='owner'?'#ffebee':'#e8f5e9'}; color:${u.role==='owner'?'#d32f2f':'#2e7d32'}">${u.role.toUpperCase()}</p>${!isActive ? `<p style="font-size:0.8rem; color:#d32f2f; margin-top:5px; font-weight:bold">CONTA DESATIVADA</p>` : ''}<div style="display:flex; gap:10px; margin-top:15px; flex-wrap:wrap"><button class="btn-secondary" style="flex:1; min-width:120px;" onclick="Modals.open('edit_funcionario', '${u.id}')"><i class="ph ph-pencil"></i> Editar Perfil</button><button class="btn-secondary" style="flex:1; min-width:120px; ${isActive ? 'color:#d32f2f;' : 'color:#2e7d32;'}" onclick="Actions.toggleFuncionarioStatus('${u.id}', ${isActive})"><i class="ph ${isActive ? 'ph-prohibit' : 'ph-check-circle'}"></i> ${isActive ? 'Desativar' : 'Ativar'}</button><button class="btn-secondary" style="flex:1; min-width:120px; color:#d32f2f;" onclick="Actions.deleteFuncionario('${u.id}')"><i class="ph ph-trash"></i> Excluir</button></div></div>`;
        }).join('');
    },
    
    async despesas() {
        const range = U.getQuinzenaDates(U.getCurrentQuinzenaValue()); const { data } = await db.from('despesas').select('*').gte('date', range.start).lte('date', range.end);
        let totais = { 'Custos Fixos': 0, 'Comissões': 0, 'Pessoal/Pagamentos': 0, 'Custos Variáveis': 0 }; let despesasOnly = [];
        data.forEach(d => { if(!App.inflowCategories.includes(d.category)) { despesasOnly.push(d); if(totais[d.category] !== undefined) totais[d.category] += d.amount; else totais['Custos Variáveis'] += d.amount; } });
        despesasOnly.sort((a,b) => new Date(b.date) - new Date(a.date));
        document.getElementById('despesas-list').innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:20px"><div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #d32f2f"><p style="font-size:0.8rem">Custos Fixos (Retido)</p><div class="val" style="color:#d32f2f; font-size:1.2rem">-${U.money(totais['Custos Fixos'])}</div></div><div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #cd7f32"><p style="font-size:0.8rem">Comissões Autom.</p><div class="val" style="color:#cd7f32; font-size:1.2rem">-${U.money(totais['Comissões'])}</div></div><div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #8e24aa"><p style="font-size:0.8rem">Pessoal/Equipe</p><div class="val" style="color:#8e24aa; font-size:1.2rem">-${U.money(totais['Pessoal/Pagamentos'])}</div></div><div class="card" style="padding:1rem; text-align:center; border-bottom:3px solid #e65100"><p style="font-size:0.8rem">Variáveis/Insumos</p><div class="val" style="color:#e65100; font-size:1.2rem">-${U.money(totais['Custos Variáveis'])}</div></div></div>` + 
            despesasOnly.map(d => { let color = '#d32f2f'; if(d.category === 'Comissões') color = '#cd7f32'; else if(d.category === 'Pessoal/Pagamentos') color = '#8e24aa'; else if(d.category === 'Custos Variáveis') color = '#e65100'; return `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid ${color}"><div><h4>${d.description}</h4><p style="font-size:0.8rem; color:var(--muted)">${d.category} • ${U.date(d.date)}</p></div><div class="val" style="color:${color}">-${U.money(d.amount)}</div></div>`; }).join('');
        if(App.charts.despesas) App.charts.despesas.destroy(); App.charts.despesas = new Chart(document.getElementById('chart-despesas'), { type: 'pie', data: { labels: Object.keys(totais), datasets: [{ data: Object.values(totais), backgroundColor: ['#d32f2f', '#cd7f32', '#8e24aa', '#e65100'] }] }});
    },

    async comissao() {
        const isOwner = App.role === 'owner';
        
        const dashContainer = document.getElementById('comissao-dashboard-tour');
        if(dashContainer) {
            let fDiv = document.getElementById('custom-filter-com-div');
            if(!fDiv) {
                fDiv = document.createElement('div'); fDiv.id = 'custom-filter-com-div';
                fDiv.style = "margin-bottom:15px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;";
                fDiv.innerHTML = `<button class="btn-secondary" style="width:auto; border:1px solid var(--primary); color:var(--primary)" onclick="Modals.open('filtro_comissoes')"><i class="ph ph-funnel"></i> Período Personalizado</button>
                                  <button id="btn-clear-com" class="btn-secondary hidden" style="width:auto; color:#d32f2f; border:1px solid #d32f2f;" onclick="Actions.clearFilterComissoes()"><i class="ph ph-x"></i> Limpar Filtro</button>
                                  <div id="com-filter-info" style="font-size:0.9rem; color:var(--primary-dark); font-weight:bold; width: 100%;"></div>`;
                dashContainer.parentNode.insertBefore(fDiv, dashContainer);
            }
            const btnClear = document.getElementById('btn-clear-com'); const infoDiv = document.getElementById('com-filter-info'); const defaultSel = document.getElementById('filter-comissao-quinzena');
            
            if(App.filters.comissoes) {
                btnClear.classList.remove('hidden'); if(defaultSel) defaultSel.style.display = 'none';
                let f = App.filters.comissoes;
                infoDiv.innerHTML = `<i class="ph ph-funnel"></i> Filtrando de: ${U.date(f.start + 'T00:00:00').slice(0,10)} até ${U.date(f.end + 'T00:00:00').slice(0,10)} ${f.prof_name ? `| Colaborador(a): ${f.prof_name}` : ''}`;
            } else {
                btnClear.classList.add('hidden'); infoDiv.innerHTML = ''; if(defaultSel) defaultSel.style.display = 'block';
            }
        }

        let query = db.from('comandas').select('*');
        
        if (App.filters.comissoes) {
            let f = App.filters.comissoes;
            query = query.gte('created_at', f.start + 'T00:00:00Z').lte('created_at', f.end + 'T23:59:59Z').eq('status', 'fechada');
        } else {
            const qFilter = document.getElementById('filter-comissao-quinzena')?.value || U.getCurrentQuinzenaValue();
            const range = U.getQuinzenaDates(qFilter);
            query = query.gte('created_at', range.start).lte('created_at', range.end).eq('status', 'fechada');
        }

        const { data } = await query;
        let htmlCards = ''; let totalComissao = 0; let rank = {};
        
        data.forEach(c => {
            if(!c.items) return; 
            c.items.forEach(i => {
                let showCard = false;

                if (isOwner) {
                    if (App.filters.comissoes && App.filters.comissoes.prof_id) {
                        if (i.prof_id !== App.filters.comissoes.prof_id) return;
                        showCard = true; 
                    }
                } else {
                    if (i.prof_id !== App.user.id) return;
                    showCard = true;
                }

                if(i.commission) {
                    const v = (i.price * i.commission) / 100; totalComissao += v;
                    if(i.prof_name) rank[i.prof_name] = (rank[i.prof_name]||0) + v;
                    
                    if (showCard) {
                        htmlCards += `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:3px solid #2e7d32; margin-bottom:10px;"><div><h4>${i.name}</h4><p style="font-size:0.8rem; color:var(--muted)"><i class="ph ph-calendar"></i> ${U.date(c.created_at).slice(0,10)} • Ref: ${c.ticket||'-'} • Taxa: ${i.commission}%</p></div><div class="val" style="color:#2e7d32; font-size:1.3rem">+${U.money(v)}</div></div>`;
                    }
                }
            });
        });
        
        let finalHtml = '';
        if(isOwner) {
            const sorted = Object.entries(rank).sort((a,b)=>b[1]-a[1]);
            let profFilterActive = (App.filters.comissoes && App.filters.comissoes.prof_id);
            let titleTotal = profFilterActive ? `Total de Comissão de ${App.filters.comissoes.prof_name}` : `Total de Comissões Geradas`;

            finalHtml = `<div class="card" style="margin-bottom:20px; background:linear-gradient(135deg, var(--primary), var(--primary-dark)); color:white; padding:2rem; box-shadow:0 10px 20px rgba(183, 110, 121, 0.3)"><h3 style="color:white; font-weight:400; opacity:0.9">${titleTotal}</h3><div class="val" style="color:white; font-size:3rem; margin-top:10px">${U.money(totalComissao)}</div></div>`;
            
            if (profFilterActive) {
                 finalHtml += `<h3 style="margin:20px 0 15px 0">Detalhamento dos Serviços</h3><div class="data-list">${htmlCards || '<p style="color:var(--muted)">Nenhum registro encontrado para este período.</p>'}</div>`;
            } else {
                finalHtml += `<h3 style="margin:20px 0 15px 0">Ranking de Comissionamento</h3><div class="data-grid">` + 
                sorted.map((s,i) => {
                    let color = '#cd7f32'; if(i===0) color='#ffd700'; else if(i===1) color='#c0c0c0';
                    return `<div class="card"><div style="display:flex; justify-content:space-between; align-items:center"><h4 style="font-size:1.1rem">${i+1}º ${s[0]}</h4><i class="ph ph-medal" style="color:${color}; font-size:2rem"></i></div><div class="val" style="margin-top:15px; font-size:1.8rem">${U.money(s[1])}</div></div>`;
                }).join('') + '</div>';
            }
        } else {
            finalHtml = `<div class="card" style="margin-bottom:20px; background:var(--primary); color:white; padding:2rem"><h4 style="color:white; font-weight:400">Minha Comissão Total</h4><div class="val" style="color:white; font-size:3rem; margin-top:10px">${U.money(totalComissao)}</div></div><div class="data-list">${htmlCards || '<p style="color:var(--muted)">Nenhum registro encontrado para este período.</p>'}</div>`;
        }
        if(dashContainer) dashContainer.innerHTML = finalHtml;
    },
    
    async 'resumo-financeiro'() {
        const rc = document.getElementById('resumo-cards');
        if(rc && !document.getElementById('btn-add-receita-wrapper')) {
            let w = document.createElement('div'); w.id = 'btn-add-receita-wrapper';
            w.style = "margin-bottom:15px; display:flex; justify-content: flex-end;";
            w.innerHTML = `<button class="btn-primary" style="background:#2e7d32; width:auto;" onclick="Modals.open('nova_receita')"><i class="ph ph-plus-circle"></i> Lançar Receita/Entrada Manual</button>`;
            rc.parentNode.insertBefore(w, rc);
        }

        const range = U.getQuinzenaDates(U.getCurrentQuinzenaValue()); 
        const { data: desp } = await db.from('despesas').select('*').gte('date', range.start).lte('date', range.end);
        
        const { extrato, totalIn, totalOut } = U.buildExtrato(desp);
        const lucro = totalIn - totalOut;
        
        rc.innerHTML = `<div class="card" style="border-bottom:4px solid #2e7d32"><h4>Faturamento (Pago)</h4><div class="val" style="color:#2e7d32; font-size:1.8rem; margin-top:10px">${U.money(totalIn)}</div></div><div class="card" style="border-bottom:4px solid #d32f2f"><h4>Custos & Comissões (Saídas)</h4><div class="val" style="color:#d32f2f; font-size:1.8rem; margin-top:10px">-${U.money(totalOut)}</div></div><div class="card" style="background:${lucro>=0?'#e8f5e9':'#ffebee'}; border:1px solid ${lucro>=0?'#c8e6c9':'#ffcdd2'}"><h4 style="color:${lucro>=0?'#2e7d32':'#d32f2f'}">Resultado Líquido</h4><div class="val" style="color:${lucro>=0?'#2e7d32':'#d32f2f'}; font-size:2.2rem; margin-top:10px">${U.money(lucro)}</div></div>`;
        
        let subDash = { 'Pix':0, 'Dinheiro':0, 'Cartão Crédito':0, 'Cartão Débito':0 };
        desp.forEach(d => { if(subDash[d.category] !== undefined) subDash[d.category] += Number(d.amount)||0; }); 
        
        document.getElementById('resumo-pagamentos-cards').innerHTML = `<div class="card" style="text-align:center"><i class="ph ph-qr-code" style="font-size:2rem; color:#00695c"></i><p style="margin-top:5px; font-weight:bold; color:var(--muted)">Pix</p><div class="val" style="font-size:1.2rem; color:#00695c">${U.money(subDash['Pix'])}</div></div><div class="card" style="text-align:center"><i class="ph ph-money" style="font-size:2rem; color:#2e7d32"></i><p style="margin-top:5px; font-weight:bold; color:var(--muted)">Dinheiro</p><div class="val" style="font-size:1.2rem; color:#2e7d32">${U.money(subDash['Dinheiro'])}</div></div><div class="card" style="text-align:center"><i class="ph ph-credit-card" style="font-size:2rem; color:#e65100"></i><p style="margin-top:5px; font-weight:bold; color:var(--muted)">Crédito</p><div class="val" style="font-size:1.2rem; color:#e65100">${U.money(subDash['Cartão Crédito'])}</div></div><div class="card" style="text-align:center"><i class="ph ph-credit-card" style="font-size:2rem; color:#1565c0"></i><p style="margin-top:5px; font-weight:bold; color:var(--muted)">Débito</p><div class="val" style="font-size:1.2rem; color:#1565c0">${U.money(subDash['Cartão Débito'])}</div></div>`;
        document.getElementById('extrato-list').innerHTML = extrato.length === 0 ? '<p style="text-align:center; padding:1rem; color:var(--muted)">Sem movimentações na quinzena.</p>' :
            extrato.map(i => `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:15px 0;"><div style="flex:1"><b style="color:${i.type==='in'?'#2e7d32':'#d32f2f'}; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px">${i.type==='in'?'Recebimento':'Saída'} - ${i.category}</b><p style="margin-top:5px; font-weight:600; font-size:1.1rem">${U.formatDesc(i.desc)}</p><span style="font-size:0.8rem; color:var(--muted); display:inline-block; margin-top:5px;"><i class="ph ph-clock"></i> ${U.date(i.date)}</span></div><div style="text-align:right"><span style="color:${i.type==='in'?'#2e7d32':'#d32f2f'}; font-weight:bold; font-size:1.3rem; display:block">${i.type==='in'?'+':'-'} ${U.money(i.val)}</span><span style="font-size:0.85rem; color:var(--muted); font-weight:bold">Caixa: ${U.money(i.saldo)}</span></div></div>`).join('');
    },

    async relatorios() {
        const relContainer = document.getElementById('relatorio-despesas-conteudo');
        if(relContainer) {
            let fDiv = document.getElementById('custom-filter-rel-div');
            if(!fDiv) {
                fDiv = document.createElement('div'); fDiv.id = 'custom-filter-rel-div';
                fDiv.style = "margin-bottom:15px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;";
                fDiv.innerHTML = `<button class="btn-secondary" style="width:auto; border:1px solid var(--primary); color:var(--primary)" onclick="Modals.open('filtro_relatorios')"><i class="ph ph-funnel"></i> Filtro Avançado (Período)</button>
                                  <button id="btn-clear-rel" class="btn-secondary hidden" style="width:auto; color:#d32f2f; border:1px solid #d32f2f;" onclick="Actions.clearFilterRelatorios()"><i class="ph ph-x"></i> Limpar Filtro</button>
                                  <div id="rel-filter-info" style="font-size:0.9rem; color:var(--primary-dark); font-weight:bold; width:100%;"></div>`;
                relContainer.parentNode.insertBefore(fDiv, relContainer);
            }
            const btnClear = document.getElementById('btn-clear-rel'); const infoDiv = document.getElementById('rel-filter-info'); const defaultSel = document.getElementById('filter-relatorios');
            
            if(App.filters.relatorios) {
                btnClear.classList.remove('hidden'); if(defaultSel) defaultSel.style.display = 'none';
                let f = App.filters.relatorios;
                infoDiv.innerHTML = `<i class="ph ph-funnel"></i> Filtrando de: ${U.date(f.start + 'T00:00:00').slice(0,10)} até ${U.date(f.end + 'T00:00:00').slice(0,10)} | Exibindo: ${f.tipo} ${f.prof_name ? `(${f.prof_name})` : ''}`;
            } else {
                btnClear.classList.add('hidden'); infoDiv.innerHTML = ''; if(defaultSel) defaultSel.style.display = 'block';
            }
        }

        let desp = [];
        if (App.filters.relatorios) {
            let f = App.filters.relatorios;
            let query = db.from('despesas').select('*').gte('date', f.start + 'T00:00:00Z').lte('date', f.end + 'T23:59:59Z');
            
            if (f.tipo === 'Custos Fixos') query = query.eq('category', 'Custos Fixos');
            else if (f.tipo === 'Comissões') query = query.eq('category', 'Comissões');
            else if (f.tipo === 'Receitas') query = query.in('category', App.inflowCategories);
            
            const { data } = await query.order('date', {ascending: false});
            desp = data || [];
            
            if (f.tipo === 'Comissões' && f.prof_name) {
                desp = desp.filter(d => d.description.includes(`Comissão ${f.prof_name}:`));
            }
        } else {
            const qFilter = document.getElementById('filter-relatorios').value;
            const range = U.getQuinzenaDates(qFilter);
            const { data } = await db.from('despesas').select('*').gte('date', range.start).lte('date', range.end).order('date', {ascending: false});
            desp = data || [];
        }

        const { extrato, totalIn, totalOut } = U.buildExtrato(desp);
        
        let isReceitaFilter = App.filters.relatorios?.tipo === 'Receitas';
        let targetList = isReceitaFilter 
            ? desp.filter(d => App.inflowCategories.includes(d.category)) 
            : desp.filter(d => !App.inflowCategories.includes(d.category));

        let htmlDesp = '';
        if(targetList.length === 0) { 
            let msgText = isReceitaFilter ? 'Nenhuma entrada/receita encontrada nesse período.' : 'Sem gastos registrados para este filtro.';
            htmlDesp = `<p style="color:var(--muted); text-align:center;">${msgText}</p>`; 
        } else { 
            htmlDesp = targetList.map(d => `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px dashed #eee;"><div><b>${U.formatDesc(d.description)}</b><br><span style="font-size:0.8rem; color:#888"><i class="ph ph-clock"></i> ${U.date(d.date)}</span></div><div style="color:${isReceitaFilter ? '#2e7d32' : '#d32f2f'}; font-weight:bold">${isReceitaFilter ? '+' : '-'}${U.money(d.amount)}</div></div>`).join(''); 
        }
        
        if(relContainer) relContainer.innerHTML = htmlDesp;
        
        window.currentDespesasData = targetList;
        window.currentRelatorioTipo = isReceitaFilter ? 'Receitas' : 'Despesas';

        let htmlFluxo = '';
        if(extrato.length === 0) { htmlFluxo = '<p style="color:var(--muted); text-align:center;">Nenhuma movimentação para este filtro.</p>'; }
        else {
            htmlFluxo += `<div style="background:#f9f9f9; padding:15px; border-radius:8px; display:flex; justify-content:space-around; margin-bottom:15px;"><div>Entradas: <b style="color:#2e7d32">${U.money(totalIn)}</b></div><div>Saídas: <b style="color:#d32f2f">-${U.money(totalOut)}</b></div><div>Líquido: <b style="color:${(totalIn-totalOut)>=0?'#2e7d32':'#d32f2f'}">${U.money(totalIn-totalOut)}</b></div></div>`;
            htmlFluxo += extrato.map(i => `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px dashed #eee;"><div><b style="color:${i.type==='in'?'#2e7d32':'#d32f2f'}">${i.type==='in'?'[+]':'[-]'}</b> ${U.formatDesc(i.desc)}<br><span style="font-size:0.8rem; color:#888; display:inline-block; margin-top:5px;"><i class="ph ph-clock"></i> ${U.date(i.date)}</span></div><div style="text-align:right"><b>${U.money(i.val)}</b><br><span style="font-size:0.75rem; color:#666">Caixa: ${U.money(i.saldo)}</span></div></div>`).join('');
        }
        const fluxoContainer = document.getElementById('relatorio-fluxo-conteudo');
        if(fluxoContainer) fluxoContainer.innerHTML = htmlFluxo;
        window.currentFluxoData = extrato; window.currentTotaisFluxo = { receita: totalIn, gasto: totalOut, lucro: totalIn - totalOut };
    },

    async performance() {
        const [ {data}, {data:agendas} ] = await Promise.all([ db.from('comandas').select('*, items').eq('status', 'fechada'), db.from('appointments').select('*') ]);
        let rankFunc = {}; let rankServ = {}; let totalFaturamento = 0;
        data.forEach(c => { 
            totalFaturamento += c.total; 
            if(c.items) { 
                c.items.forEach(i => { 
                    if(i.prof_name) rankFunc[i.prof_name] = (rankFunc[i.prof_name]||0) + i.price;
                    if(i.type === 'service') { rankServ[i.name] = rankServ[i.name] || { qtd: 0, receita: 0 }; rankServ[i.name].qtd += 1; rankServ[i.name].receita += i.price; } 
                }); 
            }
        });
        const tkMedio = data.length ? totalFaturamento / data.length : 0; const totalAgendas = agendas.length || 1; const ocupacao = Math.min(100, Math.round((data.length / totalAgendas) * 100));
        
        document.getElementById('perf-kpis').innerHTML = `
            <div class="card" style="text-align:center; padding:2rem"><p style="font-weight:bold; color:var(--muted); margin-bottom:10px">Ticket Médio (Bruto)</p><div class="val" style="font-size:2rem">${U.money(tkMedio)}</div></div>
            <div class="card" style="text-align:center; padding:2rem"><p style="font-weight:bold; color:var(--muted); margin-bottom:10px">Ocupação</p><div class="val" style="font-size:2rem; color:${ocupacao > 50 ? '#2e7d32' : '#d32f2f'}">${ocupacao}%</div></div>
            <div class="card" style="text-align:center; padding:2rem"><p style="font-weight:bold; color:var(--muted); margin-bottom:10px">Total Concluídos</p><div class="val" style="font-size:2rem; color:var(--text)">${data.length}</div></div>`;
            
        const sortedFunc = Object.entries(rankFunc).sort((a,b)=>b[1]-a[1]);
        document.getElementById('performance-ranking').innerHTML = `<h3 style="grid-column: 1 / -1; margin-bottom:10px">Ranking (Bruto Gerado por Profissional)</h3>` + 
            sortedFunc.map((s,i) => `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--primary)"><div><span style="font-size:0.8rem; font-weight:bold; color:var(--muted)">Posição ${i+1}</span><h4 style="font-size:1.2rem; margin-top:5px">${s[0]}</h4></div><div class="val" style="font-size:1.5rem">${U.money(s[1])}</div></div>`).join('');
            
        const sortedServ = Object.entries(rankServ).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0, 5);
        if(App.charts.perf) App.charts.perf.destroy();
        App.charts.perf = new Chart(document.getElementById('chart-performance'), { type: 'bar', data: { labels: sortedServ.map(s=>s[0]), datasets: [{ label: 'Top Serviços (Volume)', data: sortedServ.map(s=>s[1].qtd), backgroundColor: '#B76E79', borderRadius: 8 }] } });
    },
    configuracoes() {
        document.getElementById('cfg-name').value = App.settings.studio_name || '';
        document.getElementById('cfg-phone').value = App.settings.official_phone || '';
    }
};

const Modals = {
    async open(type, param1=null, param2=null, param3=null) {
        const cont = document.getElementById('modal-container');
        let html = `<div class="modal"><button class="modal-close" onclick="Modals.close()"><i class="ph ph-x"></i></button>`;
        
        if(type === 'detalhes_agendamento') {
            const { data: a, error } = await db.from('appointments').select('*, clients(name, phone), services(name, price, duration), users!user_id(name)').eq('id', param1).single();
            if(error || !a) return UI.toast('Erro ao carregar detalhes.', 'error');
            const isBlocked = a.status === 'bloqueado';
            
            if (isBlocked) {
                let isAdminBlock = a.notes && a.notes.includes('ADMIN_BLOCK');
                let endStr = ''; 
                let motivo = a.notes || '';
                
                if (motivo.includes('BLOQUEIO_ATE:')) {
                    const parts = motivo.split('|');
                    endStr = parts[0].replace('BLOQUEIO_ATE:', '').trim(); 
                    motivo = parts.slice(1).filter(p => !p.includes('ADMIN_BLOCK')).join(' | ').trim();
                }

                let removerBtnHtml = '';
                if (isAdminBlock && App.role !== 'owner') {
                    removerBtnHtml = `<p style="color: #d32f2f; text-align:center; font-weight:bold; margin-top:10px;"><i class="ph ph-lock"></i> Bloqueio Administrativo (Apenas gestor pode remover)</p>`;
                } else {
                    removerBtnHtml = `<button class="btn-primary" style="background:#d32f2f; padding:1.2rem; width:100%" onclick="Actions.deleteAppointment('${a.id}')"><i class="ph ph-trash"></i> Remover Bloqueio</button>`;
                }

                html += `<div style="text-align: center; margin-bottom: 20px;"><h3 style="margin: 0; color: #d32f2f;"><i class="ph ph-prohibit"></i> Horário Bloqueado</h3></div>
                <div style="background: #fafafa; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <p style="margin-bottom:8px"><strong>Data:</strong> ${new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    <p style="margin-bottom:8px"><strong>Horário:</strong> ${a.time.slice(0,5)} até ${endStr}</p>
                    <p><strong>Motivo:</strong> ${motivo}</p>
                </div>${removerBtnHtml}`;
            } else {
                let dur = a.services?.duration || 60; const [sh, sm] = (a.time||'00:00').split(':').map(Number);
                let endStr = `${String(sh + Math.floor((sm + dur)/60)).padStart(2,'0')}:${String((sm + dur)%60).padStart(2,'0')}`;
                
                html += `<div style="text-align: center; margin-bottom: 20px;"><h3 style="margin: 0; color: var(--primary-dark);">Detalhes do Agendamento</h3><span style="font-size:0.8rem; font-weight:bold; padding: 4px 10px; border-radius:20px; background:${a.status === 'chegou' ? '#dcedc8' : 'var(--primary-light)'}; color:${a.status === 'chegou' ? '#33691e' : 'var(--primary-dark)'}; display:inline-block; margin-top:10px;">${a.status.toUpperCase()}</span></div>
                <div style="background: #fafafa; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 20px; display:flex; flex-direction:column; gap:10px;">
                    <p><strong><i class="ph ph-user"></i> Cliente:</strong> ${a.clients?.name}</p>
                    <p><strong><i class="ph ph-phone"></i> Fone:</strong> ${a.clients?.phone || 'N/A'} ${a.clients?.phone ? `<button onclick="Actions.sendConfirmacao('${a.id}')" style="background:var(--primary-light); border:none; padding:4px 8px; border-radius:6px; color:#25D366; cursor:pointer; margin-left:10px;"><i class="ph ph-whatsapp-logo"></i> Abrir</button>` : ''}</p>
                    <p><strong><i class="ph ph-sparkle"></i> Serviço:</strong> ${a.services?.name}</p>
                    <p><strong><i class="ph ph-identification-badge"></i> Profissional:</strong> ${a.users?.name}</p>
                    <div style="background:#fff; border:1px solid #eee; padding:10px; border-radius:8px; margin-top:5px;">
                        <p style="margin-bottom:5px;"><strong><i class="ph ph-calendar"></i> Data:</strong> ${new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                        <p style="margin-bottom:5px;"><strong><i class="ph ph-clock"></i> Horário:</strong> ${a.time.slice(0,5)} às ${endStr}</p>
                        <p style="margin-top:5px; border-top:1px dashed #ccc; padding-top:5px;"><strong><i class="ph ph-user-plus"></i> Agendado por:</strong> ${a.created_by_name || 'Desconhecido'}</p>
                    </div>
                    ${a.is_encaixe ? `<p style="color:#e65100; font-weight:bold; background:#fff3e0; padding:10px; border-radius:8px; text-align:center;"><i class="ph ph-warning"></i> Encaixe Forçado</p>` : ''}
                </div><div style="display:flex; flex-direction:column; gap:10px;">
                    ${a.status === 'agendado' ? `<button class="btn-primary" style="background:#2e7d32; padding:1.2rem; width:100%" onclick="Actions.markAsArrived('${a.id}')"><i class="ph ph-check"></i> Cliente Chegou</button>` : ''}
                    <button class="btn-secondary" style="color:#d32f2f; border:1px solid #d32f2f; padding:1.2rem; width:100%" onclick="Actions.cancelAppointment('${a.id}')"><i class="ph ph-x"></i> Cancelar</button>
                </div>`;
            }
        }
        else if(type === 'menu_agenda_mobile') {
            html += `<div style="text-align: center; margin-bottom: 20px;"><h3 style="margin: 0; color: var(--primary-dark);">O que deseja fazer?</h3></div><div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn-primary" style="padding:1.2rem; font-size:1.1rem; justify-content:flex-start" onclick="Modals.open('agendamento', '${param1}', '${param2}', '${param3}')"><i class="ph ph-calendar-plus" style="font-size:1.5rem; margin-right:10px;"></i> Agendar Cliente</button>
                <button class="btn-secondary" style="padding:1.2rem; font-size:1.1rem; border: 1px solid #d32f2f; color: #d32f2f; background: #ffebee; justify-content:flex-start" onclick="Modals.open('bloquear_agenda', '${param1}', '${param2}', '${param3}')"><i class="ph ph-prohibit" style="font-size:1.5rem; margin-right:10px;"></i> Bloquear Horário</button>
            </div>`;
        }
        else if(type === 'menu_indisponivel') {
            const isMeOrOwner = App.user.id === param1 || App.role === 'owner';
            const firstName = param2.split(' ')[0];
            
            html += `<div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #d32f2f;"><i class="ph ph-calendar-x"></i> Profissional de Folga</h3>
                <p style="color:var(--muted); margin-top:5px;">${firstName} não está escalado(a) para trabalhar neste dia da semana.</p>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn-primary" style="padding:1.2rem; font-size:1.1rem; justify-content:center; background:#25D366; color:white; border:none" onclick="Actions.consultarDisponibilidade('${param3}', '${firstName}')">
                    <i class="ph ph-whatsapp-logo" style="font-size:1.5rem; margin-right:10px;"></i> Consultar Disponibilidade
                </button>
                ${isMeOrOwner ? `
                <button class="btn-secondary" style="padding:1.2rem; font-size:1.1rem; border: 1px solid var(--primary); color: var(--primary); justify-content:center; margin-top:10px;" onclick="Actions.liberarDia('${param1}')">
                    <i class="ph ph-lock-key-open" style="font-size:1.5rem; margin-right:10px;"></i> Liberar Minha Agenda Hoje
                </button>
                ` : ''}
            </div>`;
        }
        else if(type === 'first_login') {
            html += `<div style="text-align: center; margin-bottom: 20px;"><h3 style="margin: 0; color: var(--primary-dark);">Definir Nova Senha</h3></div><form onsubmit="Actions.updatePassword(event)">
                <div class="input-group"><label>Digite a nova senha</label><input type="password" id="new-pass" required></div><button type="submit" class="btn-primary" style="padding:1.2rem">Salvar e Acessar</button></form>`;
        } 
        else if(type === 'whatsapp') {
            const { data: templates } = await db.from('message_templates').select('*');
            let vars = {}; try { vars = param3 ? JSON.parse(param3) : {}; } catch(e) {}
            window.currentWppVars = vars;
            const tOpts = templates.map(t => `<option value="${t.id}">${t.title}</option>`).join('');
            html += `<h3>Central de WhatsApp</h3><div style="background:#f9f9f9; padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #eee">
                <p style="font-size: 1rem;">Cliente Alvo: <b class="text-primary">${param2}</b></p><p style="font-size: 0.9rem; color:var(--muted)">Número: ${param1}</p></div>
            <div class="input-group"><label>Usar Modelo Automático</label><select id="wpp-template-sel" onchange="Actions.applyTemplate(this.value)"><option value="">-- Escrever Manualmente --</option>${tOpts}</select></div>
            <div class="input-group"><textarea id="wpp-msg" rows="5" placeholder="Digite aqui 😉..." required></textarea></div>
            <button class="btn-primary" style="background:#25D366; padding:1.2rem;" onclick="Actions.sendWhatsApp('${param1}')"><i class="ph ph-whatsapp-logo" style="font-size:1.5rem"></i> Abrir Chat</button>`;
        }
        else if (type === 'edit_comanda') {
            const { data: comanda } = await db.from('comandas').select('*, clients(name)').eq('id', param1).single();
            const { data: servicos } = await db.from('services').select('*').order('name');
            const { data: produtos } = await db.from('products').select('*').gt('stock', 0).order('name');
            const { data: profs } = await db.from('users').select('id,name').neq('username', 'admin.teste').neq('is_deleted', true).eq('active', true).order('name');
            const isFechada = comanda.status === 'fechada';
            
            let htmlList = (comanda.items||[]).map((i, idx) => `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #eee">
                <div>
                    <span style="font-size:0.7rem; background:var(--bg); padding:3px 8px; border-radius:10px; margin-right:8px; border:1px solid var(--border); font-weight:bold">${i.type==='product'?'PROD':'SERV'}</span>
                    <span style="font-size:1.1rem">${i.name}</span>
                    <span style="font-size:0.85rem; color:var(--muted); display:block; margin-top:4px;"><i class="ph ph-identification-badge"></i> Profissional: ${i.prof_name || 'Não informado'}</span>
                </div>
                <div style="display:flex; align-items:center; gap:5px"><b style="font-size:1.2rem; color:var(--primary-dark); margin-right:5px;">${U.money(i.price)}</b> 
                ${!isFechada ? `
                    <button type="button" onclick="Actions.editComandaItemPrice('${comanda.id}', ${idx})" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:1.2rem"><i class="ph ph-pencil"></i></button>
                    <button type="button" onclick="Actions.removeComandaItem('${comanda.id}', ${idx})" style="background:none; border:none; color:#d32f2f; cursor:pointer; font-size:1.2rem"><i class="ph ph-trash"></i></button>
                `:''}</div>
            </div>`).join('');
            
            let delBtnHtml = (App.role === 'owner' && !isFechada) ? `<button class="btn-secondary" style="width:auto; padding:0.5rem 0.8rem; color:#d32f2f; border:1px solid #d32f2f; margin-right: 40px;" onclick="Actions.deleteComanda('${comanda.id}')"><i class="ph ph-trash"></i> Deletar</button>` : '';

            html += `<div style="text-align: left; margin-bottom: 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin: 0; color: var(--primary-dark);">Ticket: <span style="color:var(--primary)">${comanda.ticket || '-'}</span></h3> 
                    ${delBtnHtml}
                </div>
                <p style="color: var(--muted); margin-top: 5px; font-size:1.1rem;">Cliente: <b style="color:var(--text)">${comanda.clients?.name}</b></p>
            </div>
            <div style="background: #fafafa; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <h4 style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; color:var(--muted)">Itens Lançados</h4>
                ${htmlList || '<p style="color:var(--muted); text-align:center; padding:1rem 0">Nenhum serviço/produto.</p>'} 
                <div style="display: flex; justify-content: space-between; border-top: 2px dashed #ccc; padding-top: 15px; margin-top: 15px;"><span style="font-size: 1.2rem; font-weight: bold;">Total Final</span><span style="font-size: 1.8rem; font-weight: bold; color: var(--primary-dark);">${U.money(comanda.total)}</span></div>
            </div>`;
            
            if(!isFechada) {
                const sOpts = servicos.map(s => {
                    const val = encodeURIComponent(JSON.stringify({id: s.id, name: s.name, price: s.price, cost: s.cost || 0, commission: s.commission, type: 'service'}));
                    return `<li onclick="CustomSelect.select('add-item-sel', '${val}', '${s.name.replace(/'/g, "\\'")} - ${U.money(s.price)}')">${s.name} - ${U.money(s.price)}</li>`;
                }).join('');
                
                const pOpts = produtos.map(p => {
                    const val = encodeURIComponent(JSON.stringify({id: p.id, name: p.name, price: p.price, commission: p.commission, type: 'product'}));
                    return `<li onclick="CustomSelect.select('add-item-sel', '${val}', '${p.name.replace(/'/g, "\\'")} (Est. ${p.stock}) - ${U.money(p.price)}')">${p.name} (Est. ${p.stock}) - ${U.money(p.price)}</li>`;
                }).join('');
                
                const optionsItemHtml = `<li class="optgroup-label">Serviços</li>${sOpts}<li class="optgroup-label">Produtos</li>${pOpts}`;
                
                const profOpts = profs.map(x=>`<li onclick="CustomSelect.select('add-item-prof', '${x.id}|${x.name}', '${x.name.replace(/'/g, "\\'")}')">${x.name}</li>`).join('');
                
                html += `<div style="display:flex; gap:10px; margin-bottom:20px; align-items: flex-end; flex-wrap:wrap;">
                    <div class="input-group" style="margin:0; flex:1; min-width:200px;">
                        <label>Adicionar Item</label>
                        ${CustomSelect.render('add-item-sel', '-- Buscar Serviço/Prod --', optionsItemHtml)}
                    </div>
                    <div class="input-group" style="margin:0; flex:1; min-width:150px;">
                        <label>Feito por:</label>
                        ${CustomSelect.render('add-item-prof', '-- Profissional --', profOpts)}
                    </div>
                    <button type="button" class="btn-secondary" style="width:auto; padding:1.2rem;" onclick="Actions.addComandaItem('${comanda.id}')"><i class="ph ph-plus"></i></button>
                </div>
                <button type="button" id="btn-fechar-com" class="btn-primary" style="background:#2e7d32; padding:1.2rem;" onclick="Actions.closeComanda('${comanda.id}', '${comanda.client_id}', ${comanda.total}, '${comanda.ticket}')"><i class="ph ph-check-circle"></i> Faturar e Separar Comissões</button>`;
            } else if (App.role === 'owner') {
                html += `<button type="button" class="btn-secondary" style="color:#d32f2f; padding:1.2rem;" onclick="Actions.reopenComanda('${comanda.id}')"><i class="ph ph-warning-circle"></i> Reabrir Comanda</button>`;
            }
        }
        else if (type === 'edit_price') {
            const item = JSON.parse(param3);
            html += `<div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--primary-dark);">Alterar valor de: ${item.name}</h3>
                <p style="color:var(--muted); margin-top:5px;">Valor atual: <b>${U.money(item.price)}</b></p>
            </div>
            <form onsubmit="Actions.saveComandaItemPrice(event, '${param1}', ${param2})">
                <div class="input-group">
                    <label>Digite o novo valor (R$)</label>
                    <input type="number" id="edit-price-val" step="0.01" min="0" value="${item.price}" required style="padding:1.2rem; font-size: 1.2rem;">
                </div>
                <div style="display:flex; gap:10px; margin-top: 20px;">
                    <button type="button" class="btn-secondary" style="flex:1; padding: 1.2rem;" onclick="Modals.open('edit_comanda', '${param1}')">Cancelar</button>
                    <button type="submit" class="btn-primary" style="flex:1; padding: 1.2rem;">Salvar OK</button>
                </div>
            </form>`;
        }
        else if(type === 'agendamento') {
            const [c, s, u] = await Promise.all([
                db.from('clients').select('id,name').order('name'), 
                db.from('services').select('id,name,duration').order('name'), 
                db.from('users').select('id,name').neq('username', 'admin.teste').neq('is_deleted', true).eq('active', true).order('name')
            ]);
            
            const cliOpts = `<li onclick="CustomSelect.select('fa-cli', 'NEW', '+ CADASTRAR NOVO CLIENTE AQUI')" style="font-weight:bold; color:#2e7d32;">+ CADASTRAR NOVO CLIENTE AQUI</li>` + 
                c.data.map(x=>`<li onclick="CustomSelect.select('fa-cli', '${x.id}', '${x.name.replace(/'/g, "\\'")}')">${x.name}</li>`).join('');
            
            const servOpts = s.data.map(x=>`<li onclick="CustomSelect.select('fa-serv', '${x.id}|${x.duration||60}', '${x.name.replace(/'/g, "\\'")} (${x.duration||60}min)')">${x.name} (${x.duration||60}min)</li>`).join('');
            
            let defaultUserName = '-- Atendente --'; let defaultUserId = '';
            const userOpts = u.data.map(x => {
                if(x.id === param1) { defaultUserName = x.name; defaultUserId = x.id; }
                return `<li onclick="CustomSelect.select('fa-user', '${x.id}', '${x.name.replace(/'/g, "\\'")}')">${x.name}</li>`;
            }).join('');
            
            html += `<h3 style="text-align:center; margin-bottom:20px; color:var(--primary-dark)">Novo Agendamento</h3><form onsubmit="Actions.createAppointment(event)">
                <div class="input-group">
                    <label>Cliente</label>
                    ${CustomSelect.render('fa-cli', '-- Buscar Cliente --', cliOpts, 'handleNewClient')}
                </div>
                
                <div id="fa-new-cli-div" style="display:none; background:#f1f8e9; padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid #c5e1a5;">
                    <p style="font-size:0.8rem; color:#2e7d32; font-weight:bold; margin-bottom:10px;"><i class="ph ph-user-plus"></i> Cadastro Rápido</p>
                    <div class="input-group" style="margin-bottom:10px;"><label>Nome Completo (Novo Cliente)</label><input type="text" id="fa-new-nome" placeholder="Ex: Maria Silva"></div>
                    <div class="input-group" style="margin:0;"><label>WhatsApp com DDD</label><input type="text" id="fa-new-fone" placeholder="Ex: 86999999999"></div>
                </div>

                <div class="input-group">
                    <label>Serviço</label>
                    ${CustomSelect.render('fa-serv', '-- Buscar Serviço --', servOpts)}
                </div>
                
                <div class="input-group">
                    <label>Profissional</label>
                    ${CustomSelect.render('fa-user', defaultUserName, userOpts, '', defaultUserId)}
                </div>
                
                <div class="input-group" style="background:#fff3e0; padding:10px; border-radius:8px; border:1px solid #ffb74d;"><label style="margin:0; color:#e65100; cursor:pointer;"><input type="checkbox" id="fa-encaixe"> Forçar Encaixe (Ignora conflitos)</label></div>
                <div style="display:flex; gap:10px;"><div class="input-group"><label>Data</label><input type="date" id="fa-date" value="${param3||''}" required></div><div class="input-group"><label>Hora</label><input type="time" id="fa-time" value="${param2||''}" required></div></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem;">Confirmar Horário</button></form>`;
        }
        else if(type === 'bloquear_agenda') {
            let profSelectHtml = '';
            if (App.role === 'owner') {
                const { data: users } = await db.from('users').select('id,name').neq('username', 'admin.teste').neq('is_deleted', true).eq('active', true).order('name');
                profSelectHtml = `
                    <div class="input-group" style="background:#fff3e0; border: 1px solid #ffb74d; padding:15px; border-radius:12px;">
                        <label style="color:#e65100; font-weight:bold"><i class="ph ph-identification-badge"></i> Qual profissional bloquear?</label>
                        <select id="fb-user" required style="border-color:#ffb74d">
                            <option value="${App.user.id}" ${App.user.id===param1?'selected':''}>Bloquear a Mim Mesmo(a)</option>
                            ${users.filter(u => u.id !== App.user.id).map(x=>`<option value="${x.id}" ${x.id===param1?'selected':''}>${x.name}</option>`).join('')}
                        </select>
                    </div>`;
            }
            
            html += `<h3 style="text-align:center; margin-bottom:20px; color:#d32f2f">Bloquear Horário</h3><form onsubmit="Actions.blockAppointment(event)">
                ${profSelectHtml}
                <div class="input-group"><label>Data</label><input type="date" id="fb-date" value="${param3||''}" required></div>
                <div style="display:flex; gap:10px;"><div class="input-group"><label>Início</label><input type="time" id="fb-time" value="${param2||''}" required></div><div class="input-group"><label>Término</label><input type="time" id="fb-end" required></div></div>
                <div class="input-group"><label>Motivo / Justificativa</label><textarea id="fb-motivo" required rows="2"></textarea></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem; background: #d32f2f;">Confirmar Bloqueio</button></form>`;
        }
        else if(type === 'comanda') {
            const { data: c } = await db.from('clients').select('id,name').order('name');
            
            const cliOptsCom = `<li onclick="CustomSelect.select('fcom-cli', 'NEW', '+ CADASTRAR NOVO CLIENTE AQUI')" style="font-weight:bold; color:#2e7d32;">+ CADASTRAR NOVO CLIENTE AQUI</li>` + 
                c.map(x=>`<li onclick="CustomSelect.select('fcom-cli', '${x.id}', '${x.name.replace(/'/g, "\\'")}')">${x.name}</li>`).join('');
                
            html += `<h3>Gerar Novo Ticket</h3><form onsubmit="Actions.createComanda(event)">
                <div class="input-group">
                    <label>Cliente</label>
                    ${CustomSelect.render('fcom-cli', '-- Buscar Cliente --', cliOptsCom, 'handleNewClientComanda')}
                </div>
                <div id="fcom-new-cli-div" style="display:none; background:#f1f8e9; padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid #c5e1a5;">
                    <p style="font-size:0.8rem; color:#2e7d32; font-weight:bold; margin-bottom:10px;"><i class="ph ph-user-plus"></i> Cadastro Rápido</p>
                    <div class="input-group" style="margin-bottom:10px;"><label>Nome Completo (Obrigatório)</label><input type="text" id="fcom-new-nome" placeholder="Ex: Maria Silva"></div>
                    <div class="input-group" style="margin-bottom:10px;"><label>WhatsApp com DDD (Opcional)</label><input type="text" id="fcom-new-fone" placeholder="Ex: 86999999999"></div>
                    <div class="input-group" style="margin:0;"><label>Data de Nascimento (Opcional)</label><input type="date" id="fcom-new-nasc"></div>
                </div>
                <button type="submit" id="btn-gera-comanda" class="btn-primary" style="padding:1.2rem">Abrir Comanda</button></form>`;
        }
        else if(type === 'servico' || type === 'edit_servico') {
            let s = { name: '', price: '', cost: '', duration: 60, commission: '', has_assistant: false, assistant_commission: 0 };
            if(param1) { const { data } = await db.from('services').select('*').eq('id', param1).single(); s = data; }
            html += `<h3>${param1 ? 'Editar Serviço' : 'Cadastrar Serviço'}</h3><form onsubmit="Actions.saveService(event, '${param1||''}')">
                <div class="input-group"><label>Nome</label><input type="text" id="fs-nome" value="${s.name}" required></div>
                <div style="display:flex; gap:10px;"><div class="input-group"><label>Valor Final (R$)</label><input type="number" id="fs-valor" step="0.01" value="${s.price}" required></div><div class="input-group"><label>Custo Fixo Retido (%)</label><input type="number" id="fs-custo" max="100" value="${s.cost || ''}" required placeholder="Ex: 10%"></div></div>
                <div style="display:flex; gap:10px;"><div class="input-group"><label>Duração Média (min)</label><input type="number" id="fs-duracao" value="${s.duration}" required></div><div class="input-group"><label>Comissão do Pro. (%)</label><input type="number" id="fs-com" max="100" value="${s.commission}" required></div></div>
                <div class="input-group" style="background:#f9f9f9; padding:15px; border-radius:12px"><label style="margin:0"><input type="checkbox" id="fs-aux" ${s.has_assistant?'checked':''} onchange="document.getElementById('aux-com-div').style.display=this.checked?'block':'none'"> Tem Auxiliar?</label></div>
                <div class="input-group" id="aux-com-div" style="display:${s.has_assistant?'block':'none'}; margin-top:15px"><label>Comissão Auxiliar (%)</label><input type="number" id="fs-auxcom" max="100" value="${s.assistant_commission}"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Salvar</button></form>`;
        }
        else if(type === 'produto') {
            html += `<h3>Novo Produto</h3><form onsubmit="Actions.saveProduct(event)">
                <div class="input-group"><label>Descrição do Produto</label><input type="text" id="fp-nome" required placeholder="Nome do Produto"></div>
                <div style="display:flex; gap:10px; background:#f9f9f9; padding:15px; border-radius:12px; margin-bottom:15px"><div class="input-group"><label>Preço Venda (R$)</label><input type="number" id="fp-preco" step="0.01" required></div><div class="input-group"><label>Comissão (%)</label><input type="number" id="fp-com" max="100" required></div></div>
                <div style="display:flex; gap:10px;"><div class="input-group"><label>Estoque Inicial</label><input type="number" id="fp-qtd" required></div><div class="input-group"><label>Alerta Mínimo</label><input type="number" id="fp-min" value="5" required></div></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Salvar Produto</button></form>`;
        }
        else if(type === 'add_estoque') {
            html += `<h3>Repor Estoque</h3><form onsubmit="Actions.updateStock(event, '${param1}', ${param2})">
                <div class="input-group"><label>Estoque Atual: <b style="color:var(--primary)">${param2}</b></label><input type="number" id="fa-qtd" placeholder="Qtd. a somar" required min="1" style="padding:1.2rem;"></div><button type="submit" class="btn-primary" style="padding:1.2rem">Atualizar</button></form>`;
        }
        else if(type === 'despesa') {
            html += `<h3>Lançamento de Despesa Manual</h3><form onsubmit="Actions.createDespesa(event)">
                <div class="input-group"><label>Descrição da Saída</label><input type="text" id="fd-desc" required></div>
                <div class="input-group"><label>Categoria do Gasto</label><select id="fd-cat" required style="padding:1.2rem"><option value="Custos Fixos">Custo Fixo (Aluguel, Luz, etc)</option><option value="Custos Variáveis">Custo Variável (Insumos)</option><option value="Pessoal/Pagamentos">Pessoal (Salários, Retiradas)</option></select></div>
                <div class="input-group"><label>Valor (R$)</label><input type="number" id="fd-val" step="0.01" required style="padding:1.2rem"></div><button type="submit" class="btn-primary" style="padding:1.2rem">Registrar Saída</button></form>`;
        }
        else if(type === 'mensagem' || type === 'edit_mensagem') {
            let m = { title: '', content: '' }; if (param1) { const { data } = await db.from('message_templates').select('*').eq('id', param1).single(); m = data; }
            html += `<h3>${param1 ? 'Editar Mensagem' : 'Novo Template Automático'}</h3><form onsubmit="Actions.saveMensagem(event, '${param1 || ''}')">
                <div class="input-group"><label>Título Interno</label><input type="text" id="fm-tit" value="${m.title}" required></div>
                <div class="input-group"><label>Corpo do Texto</label><textarea id="fm-txt" rows="5" required>${m.content}</textarea><p style="font-size:0.75rem; color:var(--muted); margin-top:8px"><i class="ph ph-magic-wand"></i> Use {cliente}, {data}, {hora}, {profissional}, {servico}, {salao} ou {data_aniversario} para personalizar.</p></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">${param1 ? 'Salvar Edição' : 'Criar Template'}</button></form>`;
        }
        else if(type === 'debitar') {
            html += `<h3>Receber Pagamento (Híbrido)</h3>
            <div style="background:#f9f9f9; padding:20px; border-radius:12px; margin-bottom:20px; border-left:5px solid #2e7d32">
                <p style="color:var(--muted); font-size:0.9rem; margin-bottom:5px">Ref: ${param3 || 'Pendente'}</p><b style="font-size:2rem; color:#2e7d32">${U.money(param2)}</b>
            </div>
            <form onsubmit="Actions.debitDebt(event, '${param1}', ${param2}, '${param3}')">
                <p style="font-size:0.85rem; color:var(--muted); margin-bottom:10px;">Preencha os valores nas formas de pagamento utilizadas (deixe em branco se não usar).</p>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom: 20px;">
                    <div class="input-group" style="margin:0"><label><i class="ph ph-qr-code"></i> Pix</label><input type="number" id="pay-pix" step="0.01" min="0" placeholder="R$ 0,00"></div>
                    <div class="input-group" style="margin:0"><label><i class="ph ph-money"></i> Dinheiro</label><input type="number" id="pay-dinheiro" step="0.01" min="0" placeholder="R$ 0,00"></div>
                    <div class="input-group" style="margin:0"><label><i class="ph ph-credit-card"></i> Cartão Crédito</label><input type="number" id="pay-credito" step="0.01" min="0" placeholder="R$ 0,00"></div>
                    <div class="input-group" style="margin:0"><label><i class="ph ph-credit-card"></i> Cartão Débito</label><input type="number" id="pay-debito" step="0.01" min="0" placeholder="R$ 0,00"></div>
                </div>
                <button type="submit" id="btn-pay" class="btn-primary" style="background:#2e7d32; padding:1.2rem">Confirmar Pagamentos</button>
            </form>`;
        }
        else if(type === 'desconto') {
            html += `<h3>Aplicar Desconto (%)</h3><div style="background:#f9f9f9; padding:20px; border-radius:12px; margin-bottom:20px; border-left:5px solid #d32f2f"><b style="font-size:2rem; color:#d32f2f">${U.money(param2)}</b></div>
            <form onsubmit="Actions.discountDebt(event, '${param1}', ${param2})"><div class="input-group"><label>Porcentagem (%)</label><input type="number" id="f-val" step="0.01" required></div><button type="submit" class="btn-primary" style="padding:1.2rem">Confirmar</button></form>`;
        }
        else if(type === 'nova_observacao') {
            html += `<h3>Nova Observação</h3>
            <form id="form-nova-obs" data-client-id="${param1}" onsubmit="Actions.saveObservacao(event)">
                <div class="input-group">
                    <label>Técnica Aplicada (Não obrigatório)</label>
                    <textarea id="fo-tecnica" rows="2" placeholder="Qual técnica foi utilizada?"></textarea>
                </div>
                <div class="input-group">
                    <label>Observação (Não obrigatório)</label>
                    <textarea id="fo-obs" rows="3" placeholder="Detalhes, fórmulas, restrições..."></textarea>
                </div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Salvar Registro</button>
            </form>`;
        }
        else if(type === 'cliente' || type === 'edit_cliente') {
            let c = { name: '', phone: '', birth_date: '' }; if(param1) { const { data } = await db.from('clients').select('*').eq('id', param1).single(); c = data; }
            html += `<h3>${param1 ? 'Editar Cliente' : 'Novo Cliente'}</h3><form onsubmit="Actions.saveClient(event, '${param1||''}')">
                <div class="input-group"><label>Nome Completo</label><input type="text" id="fc-nome" value="${c.name}" required></div>
                <div class="input-group"><label>WhatsApp com DDD</label><input type="text" id="fc-fone" value="${c.phone}" required></div>
                <div class="input-group"><label>Data de Nascimento (Aniversário)</label><input type="date" id="fc-nasc" value="${c.birth_date||''}"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Salvar</button></form>`;
        }
        else if(type === 'funcionario' || type === 'edit_funcionario') {
            let f = { name: '', role: 'colaborador', active: true, phone: '', birth_date: '', schedule: null }; 
            if(param1) { const { data } = await db.from('users').select('*').eq('id', param1).single(); f = data; }
            
            const sched = f.schedule || { "0":{active:true}, "1":{active:true}, "2":{active:true}, "3":{active:true}, "4":{active:true}, "5":{active:true}, "6":{active:true} };
            
            html += `<h3>${param1 ? 'Editar Colaborador' : 'Novo Colaborador'}</h3><form onsubmit="Actions.saveFuncionario(event, '${param1 || ''}')">
                <div class="input-group"><label>Nome Completo</label><input type="text" id="ff-nome" value="${f.name}" required></div>
                
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <div class="input-group" style="flex:1; min-width:150px;"><label>Telefone/WhatsApp</label><input type="text" id="ff-fone" value="${f.phone || ''}" placeholder="Ex: 86999999999"></div>
                    <div class="input-group" style="flex:1; min-width:150px;"><label>Data de Nascimento</label><input type="date" id="ff-nasc" value="${f.birth_date || ''}"></div>
                </div>

                <div class="input-group"><label>Nível de Acesso</label><select id="ff-role" required><option value="colaborador" ${f.role==='colaborador'?'selected':''}>Colaborador</option><option value="owner" ${f.role==='owner'?'selected':''}>Proprietário/Gestor</option></select></div>
                
                <div class="input-group" style="background:#f9f9f9; padding:15px; border-radius:12px; border:1px solid #eee;">
                    <label style="margin-bottom:10px; color:var(--primary-dark); font-weight:bold;"><i class="ph ph-calendar-check"></i> Dias de Trabalho na Semana</label>
                    <p style="font-size:0.8rem; color:var(--muted); margin-bottom:10px;">Desmarque os dias que este colaborador folga.</p>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <label style="cursor:pointer; background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.9rem"><input type="checkbox" id="chk-dom" ${sched["0"]?.active !== false ? 'checked' : ''}> Dom</label>
                        <label style="cursor:pointer; background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.9rem"><input type="checkbox" id="chk-seg" ${sched["1"]?.active !== false ? 'checked' : ''}> Seg</label>
                        <label style="cursor:pointer; background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.9rem"><input type="checkbox" id="chk-ter" ${sched["2"]?.active !== false ? 'checked' : ''}> Ter</label>
                        <label style="cursor:pointer; background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.9rem"><input type="checkbox" id="chk-qua" ${sched["3"]?.active !== false ? 'checked' : ''}> Qua</label>
                        <label style="cursor:pointer; background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.9rem"><input type="checkbox" id="chk-qui" ${sched["4"]?.active !== false ? 'checked' : ''}> Qui</label>
                        <label style="cursor:pointer; background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.9rem"><input type="checkbox" id="chk-sex" ${sched["5"]?.active !== false ? 'checked' : ''}> Sex</label>
                        <label style="cursor:pointer; background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.9rem"><input type="checkbox" id="chk-sab" ${sched["6"]?.active !== false ? 'checked' : ''}> Sáb</label>
                    </div>
                </div>

                ${param1 ? `<div class="input-group" style="background:#f1f8e9; padding:15px; border-radius:12px; border:1px solid #c5e1a5"><label style="margin:0"><input type="checkbox" id="ff-ativo" ${f.active !== false ? 'checked' : ''}> Conta Ativa (Permitir Login no Sistema)</label></div><button type="button" class="btn-secondary" style="margin-bottom:15px; color:var(--primary)" onclick="Actions.resetFuncionarioPassword('${param1}')"><i class="ph ph-key"></i> Resetar Senha para 123456</button>` : ''}
                <button type="submit" class="btn-primary" style="padding:1.2rem">Salvar Colaborador</button></form>`;
        }
        else if (type === 'filtro_relatorios') {
            const { data: users } = await db.from('users').select('id,name').neq('username', 'admin.teste').neq('is_deleted', true).eq('active', true).order('name');
            const uOpts = users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
            
            html += `<h3>Filtro Avançado (Relatórios)</h3>
            <form onsubmit="Actions.applyFilterRelatorios(event)">
                <div style="display:flex; gap:10px;">
                    <div class="input-group"><label>Data Inicial</label><input type="date" id="frel-start" required></div>
                    <div class="input-group"><label>Data Final</label><input type="date" id="frel-end" required></div>
                </div>
                <div class="input-group">
                    <label>Filtrar Qual Movimentação?</label>
                    <select id="frel-tipo" required onchange="document.getElementById('frel-prof-div').style.display = this.value === 'Comissões' ? 'block' : 'none'">
                        <option value="Todos">Todas (Custos, Comissões e Entradas)</option>
                        <option value="Receitas">Apenas Entradas (Receitas)</option>
                        <option value="Custos Fixos">Apenas Custos Fixos</option>
                        <option value="Comissões">Apenas Comissões</option>
                    </select>
                </div>
                <div class="input-group" id="frel-prof-div" style="display:none;">
                    <label>De Qual Colaborador?</label>
                    <select id="frel-prof"><option value="">-- Todos os Colaboradores --</option>${uOpts}</select>
                </div>
                <button type="submit" class="btn-primary" style="padding:1.2rem">Pesquisar Período</button>
            </form>`;
        }
        else if (type === 'filtro_comissoes') {
            const { data: users } = await db.from('users').select('id,name').neq('username', 'admin.teste').neq('is_deleted', true).eq('active', true).order('name');
            const uOpts = users.map(u => `<option value="${u.id}|${u.name}">${u.name}</option>`).join('');
            
            html += `<h3>Filtro de Comissões</h3>
            <form onsubmit="Actions.applyFilterComissoes(event)">
                <div style="display:flex; gap:10px;">
                    <div class="input-group"><label>Data Inicial</label><input type="date" id="fcom-start" required></div>
                    <div class="input-group"><label>Data Final</label><input type="date" id="fcom-end" required></div>
                </div>
                ${App.role === 'owner' ? `
                <div class="input-group">
                    <label>De Qual Colaborador?</label>
                    <select id="fcom-prof"><option value="">-- Todos os Colaboradores --</option>${uOpts}</select>
                </div>` : ''}
                <button type="submit" class="btn-primary" style="padding:1.2rem">Pesquisar Período</button>
            </form>`;
        }
        else if (type === 'nova_receita') {
            html += `<h3>Injetar Receita (Entrada)</h3>
            <form onsubmit="Actions.createReceita(event)">
                <div class="input-group"><label>Do que se trata? (Descrição)</label><input type="text" id="fr-desc" required placeholder="Ex: Venda Avulsa, Troco Adicional..."></div>
                <div class="input-group">
                    <label>Forma de Entrada</label>
                    <select id="fr-cat" required style="padding:1.2rem">
                        <option value="Pix">Pix</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Cartão Crédito">Cartão de Crédito</option>
                        <option value="Cartão Débito">Cartão de Débito</option>
                    </select>
                </div>
                <div class="input-group"><label>Valor Positivo (R$)</label><input type="number" id="fr-val" step="0.01" min="0.01" required style="padding:1.2rem; font-size:1.2rem"></div>
                <button type="submit" class="btn-primary" style="padding:1.2rem; background:#2e7d32">Confirmar Entrada</button>
            </form>`;
        }
        
        html += `</div>`; cont.innerHTML = html; cont.classList.remove('hidden');

        if(type === 'whatsapp' && window.currentWppVars && window.currentWppVars._kind) {
            const { data: templates } = await db.from('message_templates').select('*');
            const pattern = window.currentWppVars._kind === 'aniversario' ? /anivers/i : /confirma/i;
            const autoT = (templates || []).find(t => pattern.test(t.title));
            if(autoT) { const sel = document.getElementById('wpp-template-sel'); if(sel) { sel.value = autoT.id; Actions.applyTemplate(autoT.id); } }
        }
    },
    close() { document.getElementById('modal-container').classList.add('hidden'); }
};

const Actions = {
    
    consultarDisponibilidade(phone, name) {
        if(!phone || phone === 'undefined') return UI.toast('Profissional não possui telefone cadastrado.', 'error');
        const msg = `Oii ${name}, gostaria da sua disponibilidade para atendimento hoje?`;
        window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        Modals.close();
    },

    async liberarDia(userId) {
        UI.confirm('Deseja liberar a agenda deste profissional para o dia de hoje?', async () => {
            const { data: user } = await db.from('users').select('schedule').eq('id', userId).single();
            if(user) {
                const currentDayOfWeek = App.currentDate.getDay();
                let sched = user.schedule || { "0":{active:true}, "1":{active:true}, "2":{active:true}, "3":{active:true}, "4":{active:true}, "5":{active:true}, "6":{active:true} };
                if(sched[String(currentDayOfWeek)]) {
                    sched[String(currentDayOfWeek)].active = true;
                }
                await db.from('users').update({ schedule: sched }).eq('id', userId);
                Modals.close();
                UI.toast('Agenda liberada com sucesso!');
                Render.agendaDay();
            }
        });
    },

    exportPDF(viewType, quinzenaStr) {
        if(!window.jspdf) return UI.toast('Carregando PDF. Tente novamente em instantes.', 'warning');
        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(183, 110, 121);
        doc.text("ESTÚDIO AMOR QUE CUIDA", 105, 20, null, null, "center");
        doc.setFontSize(12); doc.setTextColor(50, 50, 50);
        
        if (viewType === 'despesas') {
            let isReceitas = window.currentRelatorioTipo === 'Receitas';
            let title = isReceitas ? 'Relatório de Entradas (Receitas)' : 'Relatório de Despesas';
            
            doc.text(title, 105, 30, null, null, "center");
            
            if(!window.currentDespesasData || window.currentDespesasData.length === 0) return UI.toast('Sem dados.', 'warning');
            
            const rows = window.currentDespesasData.map(d => [ U.date(d.date), d.category, d.description, U.money(d.amount) ]);
            
            const corTema = isReceitas ? [46, 125, 50] : [183, 110, 121];
            
            doc.autoTable({ startY: 45, head: [['Data/Hora', 'Categoria', 'Descrição', 'Valor (R$)']], body: rows, theme: 'striped', headStyles: { fillColor: corTema } });
            doc.save(`AQC_${title.replace(/ /g, '_')}_${quinzenaStr}.pdf`);
        } else if (viewType === 'fluxo') {
            doc.text(`Relatório de Fluxo de Caixa`, 105, 30, null, null, "center");
            if(!window.currentFluxoData || window.currentFluxoData.length === 0) return UI.toast('Sem dados.', 'warning');
            const r = window.currentTotaisFluxo; doc.setFontSize(10);
            doc.text(`Entradas: ${U.money(r.receita)}   |   Saídas: ${U.money(r.gasto)}   |   Líquido: ${U.money(r.lucro)}`, 105, 45, null, null, "center");
            const rows = window.currentFluxoData.map(d => [ U.date(d.date), d.type === 'in' ? 'Entrada' : 'Saída', d.desc, U.money(d.val), U.money(d.saldo) ]);
            doc.autoTable({ startY: 55, head: [['Data/Hora', 'Tipo', 'Descrição', 'Valor', 'Caixa']], body: rows, theme: 'striped', headStyles: { fillColor: [183, 110, 121] } });
            doc.save(`AQC_Fluxo_${quinzenaStr}.pdf`);
        }
    },
    
    applyFilterRelatorios(e) {
        e.preventDefault();
        App.filters.relatorios = { start: document.getElementById('frel-start').value, end: document.getElementById('frel-end').value, tipo: document.getElementById('frel-tipo').value, prof_name: document.getElementById('frel-prof').value };
        Modals.close(); Render.relatorios();
    },
    clearFilterRelatorios() { App.filters.relatorios = null; Render.relatorios(); },

    applyFilterComissoes(e) {
        e.preventDefault(); const profVal = document.getElementById('fcom-prof') ? document.getElementById('fcom-prof').value : '';
        App.filters.comissoes = { start: document.getElementById('fcom-start').value, end: document.getElementById('fcom-end').value, prof_id: profVal ? profVal.split('|')[0] : null, prof_name: profVal ? profVal.split('|')[1] : null };
        Modals.close(); Render.comissao();
    },
    clearFilterComissoes() { App.filters.comissoes = null; Render.comissao(); },

    async createReceita(e) {
        e.preventDefault();
        const valorReceita = parseFloat(document.getElementById('fr-val').value) || 0;
        
        await db.from('despesas').insert({ 
            description: "ENTRADA MANUAL: " + document.getElementById('fr-desc').value, 
            amount: valorReceita, 
            category: document.getElementById('fr-cat').value, 
            date: new Date().toISOString() 
        }); 
        
        Modals.close(); 
        UI.toast('Valor positivo injetado com sucesso no Fluxo de Caixa!'); 
        
        Render['resumo-financeiro']();
        if (App.view === 'relatorios') { Render.relatorios(); }
    },

    async updatePassword(e) {
        e.preventDefault(); const newPass = document.getElementById('new-pass').value;
        if(newPass.length < 3) return UI.toast('Senha muito curta.', 'error');
        await db.from('users').update({ password: newPass, first_login: false }).eq('id', App.user.id);
        App.user.first_login = false; Modals.close(); UI.toast('Senha salva!');
        if (!localStorage.getItem('aqc_tour_done')) setTimeout(() => { Tour.start(); }, 500);
    },

    applyTemplate(templateId) {
        const box = document.getElementById('wpp-msg');
        if(!templateId) { box.value = ''; return; }
        db.from('message_templates').select('content').eq('id', templateId).single().then(({ data }) => {
            if(!data) return; box.value = U.fillTemplate(data.content, window.currentWppVars || {});
        });
    },

    async sendConfirmacao(appId) {
        const { data: a } = await db.from('appointments').select('*, clients(name, phone), services(name), users!user_id(name)').eq('id', appId).single();
        if(!a.clients?.phone) return UI.toast('Sem telefone cadastrado.', 'error');
        const vars = { cliente: a.clients?.name||'', data: new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR'), hora: (a.time || '').slice(0,5), profissional: a.users?.name||'', servico: a.services?.name||'', salao: App.settings.studio_name||'Amor que Cuida', _kind: 'confirmacao' };
        Modals.open('whatsapp', a.clients.phone, a.clients.name, JSON.stringify(vars));
    },
    
    async saveClient(e, id) {
        e.preventDefault(); const payload = { name: document.getElementById('fc-nome').value, phone: document.getElementById('fc-fone').value, birth_date: document.getElementById('fc-nasc').value || null };
        if(id) await db.from('clients').update(payload).eq('id', id); else await db.from('clients').insert(payload);
        Modals.close(); UI.toast('Cliente salvo!'); Render.clientes();
    },
    
    async saveObservacao(e) {
        e.preventDefault(); 
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Salvando...'; btn.disabled = true;

        try {
            const idCliente = e.target.getAttribute('data-client-id');
            if (!idCliente || idCliente === 'undefined' || idCliente === 'null') {
                throw new Error('Erro Crítico: Cliente não identificado. Volte e tente novamente.');
            }

            const tecnica = document.getElementById('fo-tecnica').value.trim();
            const obs = document.getElementById('fo-obs').value.trim();

            if (!tecnica && !obs) {
                throw new Error('Preencha ao menos a técnica ou a observação antes de salvar.');
            }

            const { error } = await db.from('anamnesis').insert({ 
                client_id: idCliente, 
                user_id: App.user.id, 
                history: tecnica, 
                notes: obs 
            });

            if (error) throw new Error(error.message);
            
            Modals.close(); 
            UI.toast('Observação registrada com sucesso!'); 
            await this.loadObservacoes(idCliente);
        } catch (err) {
            UI.toast(err.message, 'error');
        } finally {
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
        }
    },
    
    async loadObservacoes(id) {
        const div = document.getElementById('observacao-history-list');
        
        div.innerHTML = `
            <div style="text-align:center; padding:3rem 1rem;">
                <i class="ph ph-spinner ph-spin" style="font-size: 2.5rem; color: var(--primary);"></i>
                <p style="color:var(--muted); margin-top:10px;">Carregando histórico do cliente...</p>
            </div>`;

        const { data, error } = await db.from('anamnesis')
            .select('*, users!user_id(name)')
            .eq('client_id', id)
            .order('created_at', {ascending: false});
        
        if (error) {
            div.innerHTML = `<p style="color:#d32f2f; text-align:center; padding:2rem;">Erro ao carregar: ${error.message}</p>`;
            return;
        }
        
        if(!data || !data.length) {
            div.innerHTML = `
                <div style="text-align:center; padding: 3rem 1rem; border: 2px dashed #eee; border-radius: 12px; margin-top: 20px;">
                    <i class="ph ph-file-text" style="font-size: 3rem; color: var(--muted); margin-bottom: 10px;"></i>
                    <p style="color:var(--muted); font-size: 1.1rem;">Nenhum histórico registrado para este cliente.</p>
                    <p style="color:var(--muted); font-size: 0.9rem; margin-top: 5px;">Clique em "Nova Observação" para iniciar o prontuário.</p>
                </div>`;
            return;
        }
        
        div.innerHTML = `<div style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">` + data.map((d, index) => {
            const dataFormatada = U.date(d.created_at);
            const isLatest = index === 0; 
            
            return `
            <div class="card" style="border-left: 4px solid ${isLatest ? 'var(--primary)' : '#b0bec5'}; background: ${isLatest ? '#fffafb' : '#ffffff'}; box-shadow: 0 4px 10px rgba(0,0,0,0.03); position:relative;">
                
                ${isLatest ? `<span style="position:absolute; top:-12px; right:20px; background:var(--primary); color:white; font-size:0.7rem; padding:4px 12px; border-radius:20px; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.2);">MAIS RECENTE</span>` : ''}

                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 12px;">
                    <div>
                        <span style="color: ${isLatest ? 'var(--primary-dark)' : '#546e7a'}; font-size: 0.85rem; font-weight: bold; background: ${isLatest ? 'var(--primary-light)' : '#eceff1'}; padding: 4px 10px; border-radius: 20px;">
                            <i class="ph ph-calendar-check"></i> ${dataFormatada}
                        </span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; color: var(--muted);">Registrado por:</span>
                        <p style="font-weight: bold; font-size: 0.9rem; color: var(--text); margin-top: 2px;">
                            <i class="ph ph-user-circle"></i> ${d.users?.name || 'Sistema'}
                        </p>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${d.history ? `
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; border-left: 3px solid #6c757d;">
                        <span style="font-size: 0.75rem; color: #6c757d; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;"><i class="ph ph-flask"></i> Técnica Aplicada</span>
                        <p style="color: #333; line-height: 1.5; font-size: 0.95rem; margin:0;">${d.history.replace(/\n/g, '<br>')}</p>
                    </div>` : ''}
                    
                    ${d.notes ? `
                    <div style="background: #fff3e0; padding: 12px; border-radius: 8px; border-left: 3px solid #ff9800;">
                        <span style="font-size: 0.75rem; color: #e65100; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;"><i class="ph ph-warning-circle"></i> Observações / Alertas</span>
                        <p style="color: #333; line-height: 1.5; font-size: 0.95rem; margin:0;">${d.notes.replace(/\n/g, '<br>')}</p>
                    </div>` : ''}
                </div>
            </div>`;
        }).join('') + `</div>`;
    },

    async saveFuncionario(e, id) {
        e.preventDefault();
        const nomeDisplay = document.getElementById('ff-nome').value.trim();
        const palavras = nomeDisplay.toLowerCase().split(/\s+/);
        const username = `${palavras[0]}${palavras.length>1?'.'+palavras[palavras.length-1]:''}`.replace(/[^a-z0-9.]/g, '');
        const role = document.getElementById('ff-role').value;
        const phone = document.getElementById('ff-fone').value;
        const birthDate = document.getElementById('ff-nasc').value || null;
        
        const schedule = {
            "0": { active: document.getElementById('chk-dom').checked },
            "1": { active: document.getElementById('chk-seg').checked },
            "2": { active: document.getElementById('chk-ter').checked },
            "3": { active: document.getElementById('chk-qua').checked },
            "4": { active: document.getElementById('chk-qui').checked },
            "5": { active: document.getElementById('chk-sex').checked },
            "6": { active: document.getElementById('chk-sab').checked }
        };

        const payload = { 
            name: nomeDisplay, 
            role: role, 
            phone: phone, 
            birth_date: birthDate, 
            schedule: schedule 
        };

        if(id) {
            payload.active = document.getElementById('ff-ativo').checked;
            await db.from('users').update(payload).eq('id', id);
            Modals.close(); UI.toast('Atualizado com sucesso!'); Render.funcionarios();
        } else {
            payload.username = username;
            payload.password = '123456';
            payload.first_login = true;
            payload.active = true;
            payload.is_deleted = false;
            await db.from('users').insert(payload);
            UI.confirm(`Usuário Criado: ${username}\nSenha Temp: 123456`, () => { Modals.close(); Render.funcionarios(); });
        }
    },
    
    async resetFuncionarioPassword(id) { await db.from('users').update({ password: '123456', first_login: true }).eq('id', id); Modals.close(); UI.toast('Senha 123456'); Render.funcionarios(); },
    async deleteFuncionario(id) { UI.confirm('Inativar e esconder colaborador permanentemente?', async () => { await db.from('users').update({ is_deleted: true, active: false }).eq('id', id); UI.toast('Conta removida.'); Render.funcionarios(); }); },
    async toggleFuncionarioStatus(id, isActive) { await db.from('users').update({ active: !isActive }).eq('id', id); Render.funcionarios(); },

    async createAppointment(e) {
        e.preventDefault(); 
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Salvando...'; btn.disabled = true;
        
        try {
            let clientId = document.getElementById('fa-cli').value;
            
            if(clientId === 'NEW') {
                const newNome = document.getElementById('fa-new-nome').value.trim();
                const newFone = document.getElementById('fa-new-fone').value.trim();
                if(!newNome) throw new Error('Preencha o nome do novo cliente.');
                
                const { data: newCli, error: cliErr } = await db.from('clients').insert({ name: newNome, phone: newFone }).select().single();
                if(cliErr || !newCli) throw new Error('Erro ao salvar o cliente novo no banco de dados.');
                
                clientId = newCli.id;
                Render.clientes(); 
            }

            const servVal = document.getElementById('fa-serv').value;
            if(!servVal) throw new Error('Selecione o serviço!');
            const [service_id, durStr] = servVal.split('|');
            const dur = parseInt(durStr || 60); 

            const encaixe = document.getElementById('fa-encaixe').checked;
            const time = document.getElementById('fa-time').value; 
            const date = document.getElementById('fa-date').value; 
            const user_id = document.getElementById('fa-user').value;

            if(!user_id) throw new Error('Selecione o Profissional!');

            const { data: over } = await db.from('appointments').select('time, status, notes, services(duration)').eq('date', date).eq('user_id', user_id).neq('status', 'cancelado');
            let conflitoNormal = false;
            let conflitoAdmin = false;
            
            if(over) {
                const sM = (time.split(':')[0]*60)+Number(time.split(':')[1]); const eM = sM + dur;
                over.forEach(a => {
                    const [ash, asm] = (a.time||'00:00').split(':').map(Number);
                    let aEM; 
                    if(a.status === 'bloqueado' && a.notes?.includes('BLOQUEIO_ATE:')) { 
                        aEM = (a.notes.split('|')[0].replace('BLOQUEIO_ATE:','').trim().split(':')[0]*60)+Number(a.notes.split('|')[0].replace('BLOQUEIO_ATE:','').trim().split(':')[1]); 
                    } else { 
                        aEM = (ash*60+asm) + (a.services?.duration||60); 
                    }
                    const aSM = ash*60+asm; 
                    
                    if(sM < aEM && eM > aSM) {
                        if (a.status === 'bloqueado' && a.notes?.includes('ADMIN_BLOCK')) {
                            conflitoAdmin = true;
                        } else {
                            conflitoNormal = true;
                        }
                    }
                });
            }

            if (conflitoAdmin && App.role !== 'owner') {
                throw new Error('Horário bloqueado pelo Gestor. O Encaixe não é permitido neste caso.');
            }
            if ((conflitoNormal || conflitoAdmin) && !encaixe) {
                throw new Error('Horário ocupado! Marque a opção "Forçar Encaixe" se for estritamente necessário.');
            }

            const { error: insertErr } = await db.from('appointments').insert({ 
                client_id: clientId, 
                service_id: service_id, 
                user_id: user_id, 
                date: date, 
                time: time, 
                is_encaixe: encaixe, 
                status: 'agendado',
                created_by_name: App.user.name
            });
            
            if (insertErr) throw new Error(`Falha ao salvar no banco: ${insertErr.message}`);
            
            Modals.close(); 
            UI.toast('Horário salvo com sucesso!'); 
            Render.agendaDay(); 
            
        } catch(err) {
            UI.toast(err.message, 'error');
        } finally {
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
        }
    },
    
    async blockAppointment(e) {
        e.preventDefault(); 
        const date = document.getElementById('fb-date').value; 
        const start = document.getElementById('fb-time').value; 
        const end = document.getElementById('fb-end').value; 
        const motivo = document.getElementById('fb-motivo').value;
        
        const userTargetObj = document.getElementById('fb-user');
        const targetUserId = userTargetObj ? userTargetObj.value : App.user.id;
        
        const isAdminBlock = App.role === 'owner' ? ' | ADMIN_BLOCK' : '';

        if (start >= end) return UI.toast('Término deve ser maior que início.', 'error');
        
        await db.from('appointments').insert({ 
            user_id: targetUserId, 
            date: date, 
            time: start, 
            status: 'bloqueado', 
            notes: `BLOQUEIO_ATE:${end} | ${motivo}${isAdminBlock}` 
        });
        
        Modals.close(); 
        UI.toast('Horário bloqueado com sucesso!'); 
        Render.agendaDay(); 
    },
    
    async markAsArrived(id) { await db.from('appointments').update({ status: 'chegou' }).eq('id', id); Render.agendaDay(); Modals.close(); },
    async deleteAppointment(id) { UI.confirm('Remover bloqueio?', async () => { await db.from('appointments').delete().eq('id', id); Modals.close(); Render.agendaDay(); }); },
    async cancelAppointment(id) { UI.confirm('Cancelar agendamento?', async () => { await db.from('appointments').update({ status: 'cancelado' }).eq('id', id); Modals.close(); Render.agendaDay(); }); },

    async createComanda(e) {
        e.preventDefault(); 
        const btn = document.getElementById('btn-gera-comanda'); 
        const originalText = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = "Gerando...";

        try {
            let clientId = document.getElementById('fcom-cli').value;

            if(clientId === 'NEW') {
                const newNome = document.getElementById('fcom-new-nome').value.trim();
                const newFone = document.getElementById('fcom-new-fone').value.trim();
                const newNasc = document.getElementById('fcom-new-nasc').value;
                if(!newNome) throw new Error('Preencha o nome do novo cliente.');

                const { data: newCli, error: cliErr } = await db.from('clients').insert({ name: newNome, phone: newFone || null, birth_date: newNasc || null }).select().single();
                if(cliErr || !newCli) throw new Error('Erro ao salvar o cliente novo no banco de dados.');

                clientId = newCli.id;
                Render.clientes();
            }

            if(!clientId) throw new Error('Selecione ou cadastre um cliente.');

            const { data } = await db.from('comandas').select('ticket');
            let maxNum = 0; (data || []).forEach(c => { if (c.ticket) { const n = parseInt(c.ticket.split('-')[1], 10); if (n > maxNum) maxNum = n; } });
            const tk = 'TKT-' + String(maxNum + 1).padStart(4, '0');
            
            await db.from('comandas').insert({ client_id: clientId, professional_id: App.user.id, user_id: App.user.id, ticket: tk, status: 'aberta' });
            Modals.close(); UI.toast(`Comanda ${tk} gerada!`); Render.comandas();
        } catch(err) {
            UI.toast(err.message, 'error');
        } finally {
            if(btn) { btn.disabled = false; btn.innerHTML = originalText; }
        }
    },
    
    async addComandaItem(id) {
        const val = document.getElementById('add-item-sel').value; 
        const profVal = document.getElementById('add-item-prof').value;

        if(!val) return UI.toast('Selecione um serviço ou produto.', 'error');
        if(!profVal) return UI.toast('Selecione o profissional que realizou o serviço!', 'error');

        const item = JSON.parse(val); 
        const [prof_id, prof_name] = profVal.split('|');
        item.prof_id = prof_id;
        item.prof_name = prof_name;

        if(item.type === 'product') { 
            const { data: p } = await db.from('products').select('stock').eq('id', item.id).single(); 
            if(p.stock <= 0) return UI.toast('Sem estoque.', 'error'); 
            await db.from('products').update({stock: p.stock - 1}).eq('id', item.id); 
        }

        const { data: c } = await db.from('comandas').select('items, total').eq('id', id).single();
        const items = c.items || []; items.push(item);
        await db.from('comandas').update({ items, total: c.total + item.price }).eq('id', id);
        
        Modals.close(); setTimeout(() => Modals.open('edit_comanda', id), 100);
    },

    async removeComandaItem(id, idx) {
        const { data: c } = await db.from('comandas').select('items, total').eq('id', id).single();
        const items = c.items || []; const item = items[idx];
        
        if(item.type === 'product') { 
            const { data: p } = await db.from('products').select('stock').eq('id', item.id).single(); 
            if(p) await db.from('products').update({stock: p.stock + 1}).eq('id', item.id); 
        }
        
        items.splice(idx, 1); 
        await db.from('comandas').update({ items, total: Math.max(0, c.total - item.price) }).eq('id', id);
        Modals.close(); setTimeout(() => Modals.open('edit_comanda', id), 100);
    },
    
    async editComandaItemPrice(id, idx) {
        const { data: c } = await db.from('comandas').select('items').eq('id', id).single();
        const item = c.items[idx];
        Modals.open('edit_price', id, idx, JSON.stringify(item));
    },

    async saveComandaItemPrice(e, id, idx) {
        e.preventDefault();
        const novoValorStr = document.getElementById('edit-price-val').value;
        const novoValor = parseFloat(novoValorStr);
        
        if (isNaN(novoValor) || novoValor < 0) return UI.toast('Valor inválido.', 'error');

        const { data: c } = await db.from('comandas').select('items, total').eq('id', id).single();
        const items = c.items || [];
        const item = items[idx];
        
        const diferenca = novoValor - item.price;
        item.price = novoValor;
        
        await db.from('comandas').update({ items, total: Math.max(0, c.total + diferenca) }).eq('id', id);
        UI.toast('Valor modificado com sucesso!');
        Modals.close(); 
        setTimeout(() => Modals.open('edit_comanda', id), 100);
    },

    async closeComanda(comandaId, clientId, total, ticketNum) {
        UI.confirm('Deseja fechar esta comanda? Ela gerará os custos e separará as comissões por profissional automaticamente, enviando para cobrança.', async () => {
            const btn = document.getElementById('btn-fechar-com');
            if(btn) { btn.disabled = true; btn.innerHTML = "Processando..."; }
            
            const { data: comanda } = await db.from('comandas').select('items, clients(name)').eq('id', comandaId).single();
            const clientName = comanda.clients?.name || 'Cliente';
            
            let totalCustoFixo = 0; 
            let commissionsByProf = {};
            
            if(comanda.items) {
                comanda.items.forEach(item => {
                    let com = 0;
                    if (item.type === 'service' && item.commission) com = (item.price * item.commission) / 100;
                    if (item.type === 'product' && item.commission) com = (item.price * item.commission) / 100;
                    
                    if (item.type === 'service' && item.cost) {
                        totalCustoFixo += (item.price * item.cost) / 100;
                    }

                    if (com > 0) {
                        let pName = item.prof_name || 'Profissional Desconhecido';
                        commissionsByProf[pName] = (commissionsByProf[pName] || 0) + com;
                    }
                });
            }
            const dtISO = new Date().toISOString();
            await db.from('comandas').update({ status: 'fechada', created_at: dtISO }).eq('id', comandaId);
            
            if(total > 0) { 
                const { data: ext } = await db.from('debts').select('*').eq('client_id', clientId).gt('remaining_amount', 0).maybeSingle();
                if (ext) await db.from('debts').update({ total_amount: ext.total_amount + total, remaining_amount: ext.remaining_amount + total, comanda_ticket: ext.comanda_ticket + ', ' + ticketNum, created_at: dtISO }).eq('id', ext.id);
                else await db.from('debts').insert({ client_id: clientId, total_amount: total, remaining_amount: total, comanda_ticket: ticketNum, created_at: dtISO }); 
            }
            
            if(totalCustoFixo > 0) {
                await db.from('despesas').insert({ description: `Custo Retido: Comanda ${ticketNum} | Cliente: ${clientName}`, amount: totalCustoFixo, category: 'Custos Fixos', date: dtISO });
            }
            
            for (const [pName, val] of Object.entries(commissionsByProf)) {
                await db.from('despesas').insert({ description: `Comissão ${pName}: Comanda ${ticketNum} | Cliente: ${clientName}`, amount: val, category: 'Comissões', date: dtISO });
            }

            Modals.close(); UI.toast('Fechado com sucesso!'); Render.comandas();
        });
    },
    
    async reopenComanda(id) {
        UI.confirm('ALERTA: Isso exclui os custos automáticos associados. Continuar?', async () => {
            const { data: c } = await db.from('comandas').select('ticket, total').eq('id', id).single();
            if(c?.ticket) {
                await db.from('despesas').delete().like('description', `%Comanda ${c.ticket}%`);
                const { data: d } = await db.from('debts').select('*').like('comanda_ticket', `%${c.ticket}%`).maybeSingle();
                if(d) {
                    let rem = d.comanda_ticket.split(', ').map(t=>t.trim()).filter(t => t !== c.ticket).join(', ');
                    if(rem === '') await db.from('debts').delete().eq('id', d.id);
                    else await db.from('debts').update({ total_amount: Math.max(0, d.total_amount - c.total), remaining_amount: Math.max(0, d.remaining_amount - c.total), comanda_ticket: rem }).eq('id', d.id);
                }
            }
            await db.from('comandas').update({ status: 'aberta' }).eq('id', id); Modals.close(); UI.toast('Reaberta!'); Render.comandas();
        });
    },

    async deleteComanda(id) {
        UI.confirm('Tem certeza que deseja deletar permanentemente esta comanda aberta?', async () => {
            try {
                await db.from('comandas').delete().eq('id', id);
                Modals.close(); UI.toast('Comanda deletada com sucesso!'); Render.comandas();
            } catch (err) {
                UI.toast('Erro ao deletar comanda.', 'error');
            }
        });
    },

    async saveService(e, id) {
        e.preventDefault(); 
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Salvando...';
        btn.disabled = true;

        try {
            const aux = document.getElementById('fs-aux').checked;
            const payload = { 
                name: document.getElementById('fs-nome').value.trim(), 
                price: parseFloat(document.getElementById('fs-valor').value.replace(',', '.')) || 0, 
                cost: parseFloat(document.getElementById('fs-custo').value) || 0, 
                commission: parseFloat(document.getElementById('fs-com').value) || 0, 
                duration: parseInt(document.getElementById('fs-duracao').value) || 60, 
                has_assistant: aux, 
                assistant_commission: aux ? (parseFloat(document.getElementById('fs-auxcom').value) || 0) : 0 
            };
            
            let response;
            if(id) {
                response = await db.from('services').update(payload).eq('id', id);
            } else {
                response = await db.from('services').insert([payload]); 
            }

            if (response.error) throw response.error;

            Modals.close(); 
            UI.toast('Serviço salvo com sucesso!'); 
            Render.servicos();
        } catch (error) {
            console.error("Erro no Supabase:", error);
            UI.toast('Erro ao salvar: ' + error.message, 'error');
        } finally {
            if(btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    },
    
    async deleteService(id) { 
        UI.confirm('Deseja realmente excluir este serviço?', async () => { 
            try {
                const { error } = await db.from('services').delete().eq('id', id);
                if (error) throw error;
                UI.toast('Serviço excluído!');
                Render.servicos(); 
            } catch (error) {
                console.error("Erro ao excluir:", error);
                UI.toast('Erro ao excluir: ' + error.message, 'error');
            }
        }); 
    },
    
    async saveProduct(e) { 
        e.preventDefault(); 
        await db.from('products').insert({ 
            name: document.getElementById('fp-nome').value, 
            price: document.getElementById('fp-preco').value, 
            commission: document.getElementById('fp-com').value, 
            stock: document.getElementById('fp-qtd').value, 
            min_stock: document.getElementById('fp-min').value 
        }); 
        Modals.close(); 
        UI.toast('Salvo!'); 
        Render.produtos(); 
    },
    async updateStock(e, id, curStock) { e.preventDefault(); await db.from('products').update({stock: curStock + parseInt(document.getElementById('fa-qtd').value)}).eq('id', id); Modals.close(); UI.toast('Estoque atualizado!'); Render.produtos(); },

    async saveMensagem(e, id) { e.preventDefault(); const payload = { title: document.getElementById('fm-tit').value, content: document.getElementById('fm-txt').value }; if(id) await db.from('message_templates').update(payload).eq('id', id); else await db.from('message_templates').insert(payload); Modals.close(); Render.mensagens(); },
    async deleteMensagem(id) { UI.confirm('Deletar template?', async () => { await db.from('message_templates').delete().eq('id', id); Render.mensagens(); }); },

    async createDespesa(e) { e.preventDefault(); await db.from('despesas').insert({ description: document.getElementById('fd-desc').value, amount: document.getElementById('fd-val').value, category: document.getElementById('fd-cat').value, date: new Date().toISOString() }); Modals.close(); UI.toast('Saída manual registrada!'); Render.despesas(); },

    async debitDebt(e, id, max, refTicket) { 
        e.preventDefault(); 
        const btn = document.getElementById('btn-pay'); btn.disabled = true; btn.innerHTML = "Processando...";
        
        const pix = parseFloat(document.getElementById('pay-pix').value || 0);
        const din = parseFloat(document.getElementById('pay-dinheiro').value || 0);
        const cre = parseFloat(document.getElementById('pay-credito').value || 0);
        const deb = parseFloat(document.getElementById('pay-debito').value || 0);
        
        const totalPaid = pix + din + cre + deb;
        if(totalPaid <= 0) { btn.disabled = false; btn.innerHTML = "Confirmar Pagamentos"; return UI.toast('Preencha os valores.', 'error'); }
        if(totalPaid > max) { btn.disabled = false; btn.innerHTML = "Confirmar Pagamentos"; return UI.toast('Valor pago supera a dívida.', 'error'); }

        const dtISO = new Date().toISOString();
        
        const { data: currDebt } = await db.from('debts').select('payment_details, comanda_ticket, clients(name)').eq('id', id).single();
        const clientName = currDebt.clients?.name || 'Não informado';
        const tkts = currDebt.comanda_ticket || refTicket;
        const descText = `Pgto Comanda(s): ${tkts} | Cliente: ${clientName}`;
        
        if(pix > 0) await db.from('despesas').insert({ description: descText, amount: pix, category: 'Pix', date: dtISO });
        if(din > 0) await db.from('despesas').insert({ description: descText, amount: din, category: 'Dinheiro', date: dtISO });
        if(cre > 0) await db.from('despesas').insert({ description: descText, amount: cre, category: 'Cartão Crédito', date: dtISO });
        if(deb > 0) await db.from('despesas').insert({ description: descText, amount: deb, category: 'Cartão Débito', date: dtISO });

        let pd = currDebt.payment_details || {};
        pd.pix = (pd.pix||0) + pix; pd.dinheiro = (pd.dinheiro||0) + din; pd.credito = (pd.credito||0) + cre; pd.debito = (pd.debito||0) + deb;

        const newRem = Math.max(0, max - totalPaid);
        await db.from('debts').update({ remaining_amount: newRem, payment_details: pd }).eq('id', id); 
        Modals.close(); UI.toast('Pagamento lançado no Fluxo!'); Render.cobrancas(newRem === 0 ? 'pagos' : 'pendentes');
    },
    
    async discountDebt(e, id, max) { 
        e.preventDefault(); const perc = parseFloat(document.getElementById('f-val').value); 
        const { data: currDebt } = await db.from('debts').select('payment_details').eq('id', id).single();
        let pd = currDebt.payment_details || {}; pd.desconto = perc;
        await db.from('debts').update({ remaining_amount: Math.max(0, max - (max * perc / 100)), payment_details: pd }).eq('id', id); 
        Modals.close(); Render.cobrancas('pendentes');
    },

    async saveSettings(e) { e.preventDefault(); const payload = { studio_name: document.getElementById('cfg-name').value, official_phone: document.getElementById('cfg-phone').value }; if(App.settings.id) await db.from('settings').update(payload).eq('id', App.settings.id); else await db.from('settings').insert(payload); App.settings = {...App.settings, ...payload}; document.getElementById('brand-name').textContent = payload.studio_name; UI.toast('Salvo!'); },

    sendWhatsApp(phone) {
        const msg = document.getElementById('wpp-msg').value; if(!msg) return UI.toast('Escreva algo.', 'error');
        Modals.close(); window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    },

    previewAndSaveAvatar(event) {
        const file = event.target.files[0];
        if(!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            
            document.getElementById('perfil-foto-preview').innerHTML = '';
            document.getElementById('perfil-foto-preview').style.backgroundImage = `url(${base64})`;
            document.getElementById('perfil-foto-preview').style.backgroundSize = 'cover';
            document.getElementById('perfil-foto-preview').style.backgroundPosition = 'center';
            document.getElementById('perfil-foto-preview').style.color = 'transparent';
            
            try {
                const {data: existing} = await db.from('user_avatars').select('id').eq('user_id', App.user.id).maybeSingle();
                if(existing) {
                    await db.from('user_avatars').update({avatar_base64: base64}).eq('id', existing.id);
                } else {
                    await db.from('user_avatars').insert({user_id: App.user.id, avatar_base64: base64});
                }
                
                App.avatars[App.user.id] = base64;
                Auth.updateHeaderAvatar();
                Render.agendaDay(); 
                UI.toast('Sua foto de perfil foi atualizada com sucesso!');
            } catch(err) {
                UI.toast('Erro ao salvar no banco. A tabela user_avatars já foi criada?', 'error');
            }
        };
        reader.readAsDataURL(file);
    },
    
    async deleteAvatar() {
        if(!App.avatars[App.user.id]) return UI.toast('Você já não possui foto.', 'warning');
        UI.confirm('Remover sua foto de perfil?', async () => {
            try {
                await db.from('user_avatars').delete().eq('user_id', App.user.id);
                delete App.avatars[App.user.id];
                
                Auth.updateHeaderAvatar();
                Nav.showView('perfil'); 
                Render.agendaDay(); 
                
                UI.toast('Foto removida!');
            } catch(e) {
                UI.toast('Erro ao remover.', 'error');
            }
        });
    }
};

/* --- INJETOR DE CSS --- */
const initCSS = () => {
    if(document.getElementById('aqc-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'aqc-custom-styles';
    style.innerHTML = `
        .aqc-custom-select { position: relative; width: 100%; font-family: inherit; z-index: 1; }
        .aqc-select-trigger { background: #fff; border: 1px solid var(--border); padding: 1.2rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; color: var(--text); font-size: 1rem; }
        .aqc-select-menu { position: absolute; left: 0; width: 100%; background: #ffffff; border: 1px solid #ccc; border-radius: 8px; z-index: 999999; display: flex; flex-direction: column; max-height: 250px; }
        .aqc-select-search-box { padding: 10px; border-bottom: 1px solid #eee; position: sticky; top: 0; background: #f9f9f9; border-radius: 8px 8px 0 0; z-index: 2; }
        .aqc-select-search-box input { width: 100%; padding: 10px 12px; border: 1px solid #ccc; border-radius: 6px; outline: none; font-size: 1rem; font-family: inherit; background: #fff; }
        .aqc-select-options { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; background: #fff; border-radius: 0 0 8px 8px; position: relative; z-index: 1; }
        .aqc-select-options li { padding: 14px 15px; cursor: pointer; border-bottom: 1px solid #f1f1f1; color: var(--text); font-size: 0.95rem; background: #fff; transition: background 0.2s; }
        .aqc-select-options li:hover { background: #f1f8e9; }
        .aqc-select-options li.optgroup-label { font-weight: bold; background: #f5f5f5; cursor: default; color: var(--muted); font-size: 0.85rem; text-transform: uppercase; padding: 8px 15px; border-bottom: none; }
    `;
    document.head.appendChild(style);
};

document.addEventListener('DOMContentLoaded', () => { 
    initCSS();
    setTimeout(() => { const splash = document.getElementById('splash-screen'); if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 500); } }, 4000); 
    Auth.init(); 
});
