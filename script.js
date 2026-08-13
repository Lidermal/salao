/**
 * SISTEMA ESTÚDIO AMOR QUE CUIDA
 * Versão Completa - CRUD, Renderizadores e Regras de Negócio (Comissão)
 */

// --- 1. CONFIGURAÇÃO SUPABASE ---
const DB_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';

let db = null;
if (typeof window.supabase !== 'undefined') {
    db = window.supabase.createClient(DB_URL, DB_KEY);
}

// --- 2. UTILITÁRIOS ---
const U = {
    money: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0),
    date: (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-',
    id: () => Math.random().toString(36).substr(2, 9)
};

// --- 3. ESTADO GLOBAL E DADOS (MEMÓRIA LOCAL) ---
const App = { 
    user: null, 
    role: 'employee',
    currentView: 'agenda',
    data: {
        agenda: [], clientes: [], servicos: [], produtos: [], 
        despesas: [], funcionarios: [], comandas: [], cobrancas: []
    }
};

// Dados Iniciais para testes imediatos (Mock)
App.data.servicos = [
    { id: '1', nome: 'Corte Feminino', valor: 120, comissao: 40, tempo: 60 },
    { id: '2', nome: 'Mechas Premium', valor: 450, comissao: 50, tempo: 180 }
];
App.data.clientes = [
    { id: '1', nome: 'Maria Silva', telefone: '86999999999', gastoTotal: 570 }
];
App.data.funcionarios = [
    { id: '1', nome: 'Andressa Vieira', cargo: 'Proprietária' },
    { id: '2', nome: 'Membro Equipe', cargo: 'Cabeleireira' }
];

// --- 4. CONTROLE DE NAVEGAÇÃO ---
const Nav = {
    init() {
        document.querySelectorAll('.nav-link, .b-item').forEach(link => {
            link.addEventListener('click', (e) => {
                const view = link.dataset.view;
                if (view && view !== 'menu-mobile') {
                    e.preventDefault();
                    this.showView(view);
                    this.closeMenu();
                }
            });
        });
        const dtAgenda = document.getElementById('filtro-data-agenda');
        if(dtAgenda) {
            dtAgenda.valueAsDate = new Date();
            dtAgenda.addEventListener('change', () => Render.agenda());
        }
    },
    showView(id) {
        App.currentView = id;
        const titles = {
            'agenda': 'Agenda', 'cobrancas': 'Cobranças', 'comandas': 'Comandas', 
            'mensagens': 'Mensagens Prontas', 'clientes': 'Clientes & Anamnese', 
            'servicos': 'Serviços & Pacotes', 'produtos': 'Produto & Estoque', 
            'despesas': 'Despesas', 'funcionarios': 'Equipe', 'comissao': 'Minha Comissão', 
            'performance': 'Performance', 'resumo-financeiro': 'Resumo Financeiro', 
            'melhores-clientes': 'Melhores Clientes', 'configuracoes': 'Configurações'
        };
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = titles[id] || 'Sistema';

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(`view-${id}`);
        if (targetView) targetView.classList.add('active');

        document.querySelectorAll('.nav-link, .b-item').forEach(el => el.classList.toggle('active', el.dataset.view === id));
        
        // Chama a função de renderizar a tela específica
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

// --- 5. RENDERIZADORES DE TELAS (O CORE DO SISTEMA) ---
const Render = {
    agenda() {
        const container = document.getElementById('view-agenda');
        const dt = document.getElementById('filtro-data-agenda')?.value || new Date().toISOString().split('T')[0];
        const agendamentos = App.data.agenda.filter(a => a.data === dt);
        
        let html = `
            <div class="header-actions">
                <h2>Sua Agenda</h2>
                <input type="date" class="input-date" id="filtro-data-agenda" value="${dt}" onchange="Render.agenda()">
                <button class="btn-primary" onclick="Modals.open('agendamento')" style="width: auto; padding: 0.8rem 1.5rem;">+ Novo Agendamento</button>
            </div>
            <div style="display:flex; flex-direction:column; gap: 1rem;">
        `;

        if (agendamentos.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="ph ph-calendar-blank"></i><p>Nenhum agendamento para hoje.</p>
                </div>`;
        } else {
            agendamentos.forEach(a => {
                html += `
                <div style="background:var(--surface); padding:1.5rem; border-radius:var(--radius); border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="font-size:1.1rem">${a.hora} - ${a.clienteNome}</strong>
                        <div style="color:var(--muted); font-size:0.9rem; margin-top:4px;">${a.servicoNome} • Profissional: ${a.profissionalNome}</div>
                    </div>
                    <div style="font-weight:bold; color:var(--primary); font-size:1.2rem;">${U.money(a.valor)}</div>
                </div>`;
            });
        }
        html += `</div>`;
        container.innerHTML = html;
        
        // Re-atacha evento no novo input
        document.getElementById('filtro-data-agenda').addEventListener('change', Render.agenda);
    },

    servicos() {
        const container = document.getElementById('view-servicos');
        let html = `
            <div class="header-actions">
                <h2>Catálogo de Serviços</h2>
                <button class="btn-primary owner-only" onclick="Modals.open('servico')" style="width: auto; padding: 0.8rem 1.5rem;">+ Adicionar Serviço</button>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
        `;
        App.data.servicos.forEach(s => {
            html += `
            <div style="background:var(--surface); padding:1.5rem; border-radius:var(--radius); border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <strong style="font-size:1.2rem">${s.nome}</strong>
                    <span style="font-family:'Playfair Display'; font-weight:bold; color:var(--primary); font-size:1.3rem;">${U.money(s.valor)}</span>
                </div>
                <div style="color:var(--muted); font-size:0.9rem; display:flex; justify-content:space-between;">
                    <span>⏱ ${s.tempo} min</span>
                    <span style="background:var(--primary-light); color:var(--primary-dark); padding:2px 8px; border-radius:10px; font-weight:bold;">Comissão: ${s.comissao}%</span>
                </div>
            </div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
    },

    clientes() {
        const container = document.getElementById('view-clientes');
        let html = `
            <div class="header-actions">
                <h2>Base de Clientes</h2>
                <button class="btn-primary" onclick="Modals.open('cliente')" style="width: auto; padding: 0.8rem 1.5rem;">+ Novo Cliente</button>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
        `;
        App.data.clientes.forEach(c => {
            html += `
            <div style="background:var(--surface); padding:1.5rem; border-radius:var(--radius); border:1px solid var(--border);">
                <strong style="font-size:1.1rem; display:block; margin-bottom:5px;">${c.nome}</strong>
                <div style="color:var(--muted); font-size:0.9rem; margin-bottom:10px;"><i class="ph ph-whatsapp-logo"></i> ${c.telefone}</div>
                <div style="font-weight:bold; color:var(--primary);">Total Gasto: ${U.money(c.gastoTotal)}</div>
            </div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
    },

    comissao() {
        const container = document.getElementById('view-comissao');
        // Filtra os agendamentos do usuário logado (simulação simples)
        const minhas = App.data.agenda.filter(a => a.profissionalNome === App.user.name);
        let total = 0;
        
        let html = `
            <div class="header-actions">
                <h2>Minhas Comissões</h2>
            </div>
            <div style="display:flex; flex-direction:column; gap: 1rem;">
        `;

        if(minhas.length === 0) {
            html += `<div class="empty-state"><p>Nenhum serviço realizado ainda.</p></div>`;
        } else {
            minhas.forEach(m => {
                total += m.valorComissao;
                html += `
                <div style="background:var(--surface); padding:1rem; border-radius:var(--radius); border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${m.servicoNome}</strong>
                        <div style="color:var(--muted); font-size:0.85rem;">${U.date(m.data)} • Cliente: ${m.clienteNome}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.8rem; color:var(--muted);">${m.comissaoPerc}%</div>
                        <div style="font-weight:bold; color:#2e7d32; font-size:1.1rem;">+ ${U.money(m.valorComissao)}</div>
                    </div>
                </div>`;
            });
        }
        
        html += `
            <div style="margin-top:2rem; padding:1.5rem; background:var(--primary); color:white; border-radius:var(--radius); text-align:center;">
                <p style="font-size:1rem; opacity:0.9;">Total a Receber</p>
                <h2 style="color:white; font-size:2.5rem; margin:0;">${U.money(total)}</h2>
            </div>
        </div>`;
        
        container.innerHTML = html;
    },

    // Páginas Genéricas/Em Construção (Para manter o app completo)
    comandas() { document.getElementById('view-comandas').innerHTML = '<h2>Comandas</h2><p>Módulo de comandas abertas será carregado aqui.</p>'; },
    cobrancas() { document.getElementById('view-cobrancas').innerHTML = '<h2>Cobranças</h2><p>Links de pagamento e pendências.</p>'; },
    produtos() { document.getElementById('view-produtos').innerHTML = '<h2>Estoque</h2><p>Controle de produtos do estúdio.</p>'; },
    despesas() { document.getElementById('view-despesas').innerHTML = '<h2>Despesas</h2><p>Controle financeiro de saídas.</p>'; },
    funcionarios() { document.getElementById('view-funcionarios').innerHTML = '<h2>Equipe</h2><p>Gerenciamento de profissionais.</p>'; },
    performance() { document.getElementById('view-performance').innerHTML = '<h2>Performance</h2><p>Gráficos em desenvolvimento.</p>'; },
    'resumo-financeiro': function() { document.getElementById('view-resumo-financeiro').innerHTML = '<h2>Resumo Financeiro</h2><p>Fluxo de caixa completo.</p>'; },
    'melhores-clientes': function() { document.getElementById('view-melhores-clientes').innerHTML = '<h2>Melhores Clientes</h2><p>Ranking VIP.</p>'; },
    configuracoes() { document.getElementById('view-configuracoes').innerHTML = '<h2>Configurações</h2><p>Ajustes do estúdio.</p>'; },
    mensagens() { document.getElementById('view-mensagens').innerHTML = '<h2>Mensagens Prontas</h2><p>Atalhos para WhatsApp.</p>'; }
};

// --- 6. GESTÃO DE MODAIS E FORMULÁRIOS DINÂMICOS ---
const Modals = {
    open(type) {
        // Remove modal anterior se existir
        const oldModal = document.getElementById('dynamic-modal');
        if(oldModal) oldModal.remove();

        let content = '';
        if (type === 'servico') {
            content = `
                <h3>Novo Serviço</h3>
                <form id="form-generico" onsubmit="Actions.saveServico(event)">
                    <div class="input-group"><label>Nome do Serviço</label><input type="text" id="s-nome" required></div>
                    <div class="input-group"><label>Valor (R$)</label><input type="number" step="0.01" id="s-valor" required></div>
                    <div class="input-group"><label>Comissão do Profissional (%) - Digite de 0 a 100</label><input type="number" id="s-comissao" min="0" max="100" required></div>
                    <div class="input-group"><label>Tempo Estimado (minutos)</label><input type="number" id="s-tempo" required></div>
                    <button type="submit" class="btn-primary">Salvar Serviço</button>
                </form>
            `;
        } else if (type === 'cliente') {
            content = `
                <h3>Novo Cliente</h3>
                <form id="form-generico" onsubmit="Actions.saveCliente(event)">
                    <div class="input-group"><label>Nome Completo</label><input type="text" id="c-nome" required></div>
                    <div class="input-group"><label>WhatsApp</label><input type="tel" id="c-tel" required></div>
                    <button type="submit" class="btn-primary">Salvar Cliente</button>
                </form>
            `;
        } else if (type === 'agendamento') {
            // Gera opções para os selects
            const servOpts = App.data.servicos.map(s => `<option value="${s.id}">${s.nome} - ${U.money(s.valor)}</option>`).join('');
            const cliOpts = App.data.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
            const funcOpts = App.data.funcionarios.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
            
            content = `
                <h3>Novo Agendamento</h3>
                <form id="form-generico" onsubmit="Actions.saveAgendamento(event)">
                    <div class="input-group"><label>Cliente</label><select id="a-cli" class="input-date" style="width:100%" required>${cliOpts}</select></div>
                    <div class="input-group"><label>Serviço</label><select id="a-serv" class="input-date" style="width:100%" required>${servOpts}</select></div>
                    <div class="input-group"><label>Profissional</label><select id="a-func" class="input-date" style="width:100%" required>${funcOpts}</select></div>
                    <div style="display:flex; gap:10px;">
                        <div class="input-group" style="flex:1"><label>Data</label><input type="date" id="a-data" required></div>
                        <div class="input-group" style="flex:1"><label>Hora</label><input type="time" id="a-hora" required></div>
                    </div>
                    <button type="submit" class="btn-primary">Confirmar Agendamento</button>
                </form>
            `;
        }

        const modalHtml = `
            <div id="dynamic-modal" class="modal-container">
                <div class="modal-content">
                    <button onclick="Modals.close()" style="float:right; background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                    ${content}
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('mobile-overlay').classList.remove('hidden');
    },
    close() {
        const modal = document.getElementById('dynamic-modal');
        if(modal) modal.remove();
        document.getElementById('mobile-overlay').classList.add('hidden');
    }
};

// CSS Injetado Dinamicamente para os Modais ficarem perfeitos
document.head.insertAdjacentHTML('beforeend', `
<style>
.modal-container { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 1rem; pointer-events: none; }
.modal-content { background: var(--surface); padding: 2rem; border-radius: var(--radius); width: 100%; max-width: 500px; box-shadow: var(--shadow); pointer-events: auto; animation: slideUp 0.3s ease; max-height: 90vh; overflow-y: auto; }
</style>
`);

// --- 7. AÇÕES DE SALVAMENTO (CRUD) ---
const Actions = {
    saveServico(e) {
        e.preventDefault();
        const servico = {
            id: U.id(),
            nome: document.getElementById('s-nome').value,
            valor: parseFloat(document.getElementById('s-valor').value),
            comissao: parseInt(document.getElementById('s-comissao').value), // Regra do 100%
            tempo: parseInt(document.getElementById('s-tempo').value)
        };
        App.data.servicos.push(servico);
        Modals.close();
        Render.servicos();
    },
    saveCliente(e) {
        e.preventDefault();
        const cliente = {
            id: U.id(),
            nome: document.getElementById('c-nome').value,
            telefone: document.getElementById('c-tel').value,
            gastoTotal: 0
        };
        App.data.clientes.push(cliente);
        Modals.close();
        Render.clientes();
    },
    saveAgendamento(e) {
        e.preventDefault();
        const cliId = document.getElementById('a-cli').value;
        const servId = document.getElementById('a-serv').value;
        const funcId = document.getElementById('a-func').value;
        
        const cliente = App.data.clientes.find(c => c.id === cliId);
        const servico = App.data.servicos.find(s => s.id === servId);
        const func = App.data.funcionarios.find(f => f.id === funcId);

        // Cálculo da Comissão Exata com base na porcentagem cadastrada pelo proprietário
        const valorComissao = (servico.valor * servico.comissao) / 100;

        const agendamento = {
            id: U.id(),
            clienteNome: cliente.nome,
            servicoNome: servico.nome,
            profissionalNome: func.nome,
            valor: servico.valor,
            comissaoPerc: servico.comissao,
            valorComissao: valorComissao,
            data: document.getElementById('a-data').value,
            hora: document.getElementById('a-hora').value
        };
        
        App.data.agenda.push(agendamento);
        Modals.close();
        Render.agenda();
        
        // Atualiza a tela se tiver na mesma data
        document.getElementById('filtro-data-agenda').value = agendamento.data;
        Render.agenda();
    }
};

// --- 8. AUTENTICAÇÃO ---
const Auth = {
    init() {
        setTimeout(() => {
            document.getElementById('splash-screen').classList.remove('active');
            document.getElementById('login-screen').classList.add('active');
        }, 1500);

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
    },
    handleLogin() {
        const user = document.getElementById('username').value.trim().toLowerCase();
        
        if (user === 'admin' || user === 'andressa') {
            this.success({ name: 'Andressa Vieira', role: 'owner', initials: 'AV' });
        } else {
            this.success({ name: 'Membro Equipe', role: 'employee', initials: 'ME' });
        }
    },
    success(userData) {
        App.user = userData;
        App.role = userData.role;
        document.getElementById('auth-layer').classList.add('hidden');
        document.getElementById('system-layout').classList.remove('hidden');
        document.getElementById('header-user').textContent = userData.name;
        document.getElementById('header-avatar').textContent = userData.initials;

        if (userData.role === 'owner') document.body.classList.add('is-owner');
        else document.body.classList.remove('is-owner');

        Nav.showView('agenda');
    },
    logout() {
        if(confirm('Tem certeza que deseja sair?')) location.reload();
    }
};

// --- 9. BOOT DO APP ---
document.addEventListener('DOMContentLoaded', () => {
    Nav.init();
    Auth.init();
});
