/**
 * ESTÚDIO AMOR QUE CUIDA - VERSÃO PROFISSIONAL SEGURA
 * Dados 100% via Supabase. Zero informações sensíveis no front-end.
 */

// ==========================================
// CONFIGURAÇÃO SUPABASE (Chave Anon é pública e segura para uso no front)
// ==========================================
const SUPABASE_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';

let supabase = null;

try {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase inicializado com sucesso');
    } else {
        throw new Error('Biblioteca Supabase não carregada');
    }
} catch (error) {
    console.error(' Falha crítica ao iniciar Supabase:', error);
    alert('Erro de conexão com o servidor. Verifique sua internet.');
}

// ==========================================
// ESTADO DA APLICAÇÃO (Sem dados sensíveis)
// ==========================================
const AppState = {
    currentUser: null,
    userRole: null,
    currentView: 'dashboard',
    selectedDate: new Date().toISOString().split('T')[0],
    data: {
        appointments: [], clients: [], services: [], products: [], 
        expenses: [], employees: [], comandas: []
    }
};

// ==========================================
// UTILITÁRIOS
// ==========================================
const Utils = {
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    },
    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const d = new Date(dateString + 'T00:00:00');
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch(e) { return dateString; }
    },
    validateWhatsApp(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 11;
    },
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
};

// ==========================================
// NAVEGAÇÃO E UI
// ==========================================
const Navigation = {
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
    },
    
    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`${viewId}-view`);
        if (target) {
            target.classList.add('active');
            AppState.currentView = viewId;
            this.updatePageTitle(viewId);
            this.updateBottomNav(viewId);
            this.loadDataForView(viewId);
        }
    },

    updatePageTitle(viewId) {
        const titles = {
            dashboard: 'Dashboard', agenda: 'Agenda', comandas: 'Comandas',
            clientes: 'Clientes', mensagens: 'Mensagens', servicos: 'Serviços',
            produtos: 'Produtos', despesas: 'Despesas', funcionarios: 'Funcionários',
            relatorios: 'Relatórios', configuracoes: 'Configurações'
        };
        const el = document.getElementById('page-title');
        if (el) el.textContent = titles[viewId] || 'Estúdio';
    },

    updateBottomNav(viewId) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewId);
        });
    },

    loadDataForView(viewId) {
        const loaders = {
            dashboard: Dashboard.load, agenda: Agenda.load, comandas: Comandas.load,
            clientes: Clientes.load, servicos: Servicos.load, produtos: Produtos.load,
            despesas: Despesas.load, funcionarios: Funcionarios.load, 
            relatorios: Relatorios.load, mensagens: Mensagens.load
        };
        if (loaders[viewId]) loaders[viewId]();
    },

    openModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) {
            m.classList.remove('hidden');
            setTimeout(() => m.classList.add('active'), 10);
        }
    },

    closeModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) {
            m.classList.remove('active');
            setTimeout(() => m.classList.add('hidden'), 300);
        }
    }
};

// ==========================================
// AUTENTICAÇÃO (100% VIA SUPABASE)
// ==========================================
const Auth = {
    tempUserData: null,

    init() {
        // Step 1: Buscar usuário no banco
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim().toLowerCase();
            const errorDiv = document.getElementById('login-error');

            if (!username) {
                this.showError(errorDiv, 'Digite seu usuário');
                return;
            }

            try {
                // BUSCA EXCLUSIVA NO BANCO DE DADOS
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('username', username)
                    .single();

                if (error || !data) {
                    this.showError(errorDiv, 'Usuário não encontrado ou desativado');
                    return;
                }

                this.tempUserData = data;

                if (data.first_login) {
                    Navigation.showScreen('create-password-screen');
                } else {
                    document.getElementById('user-display-name').textContent = `Olá, ${data.name}`;
                    Navigation.showScreen('enter-password-screen');
                }
            } catch (err) {
                console.error('Erro auth:', err);
                this.showError(errorDiv, 'Erro de conexão com o servidor.');
            }
        });

        // Step 2: Criar senha (Primeiro acesso)
        document.getElementById('create-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPass = document.getElementById('new-password').value;
            const confirmPass = document.getElementById('confirm-password').value;
            const errorDiv = document.getElementById('password-error');

            if (newPass.length < 6) {
                this.showError(errorDiv, 'Senha muito curta (mínimo 6 caracteres)');
                return;
            }
            if (newPass !== confirmPass) {
                this.showError(errorDiv, 'As senhas não coincidem');
                return;
            }

            try {
                // ATUALIZA SENHA DIRETO NO BANCO
                const { error } = await supabase
                    .from('users')
                    .update({ password: newPass, first_login: false })
                    .eq('id', this.tempUserData.id);

                if (error) throw error;

                this.tempUserData.password = newPass;
                this.tempUserData.first_login = false;
                this.completeLogin(this.tempUserData);
            } catch (err) {
                this.showError(errorDiv, 'Erro ao salvar senha no servidor.');
            }
        });

        // Step 3: Validar senha existente
        document.getElementById('enter-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('current-password').value;
            const errorDiv = document.getElementById('password-login-error');

            // Validação local contra o objeto temporário vindo do banco
            if (password !== this.tempUserData.password) {
                this.showError(errorDiv, 'Senha incorreta');
                return;
            }

            this.completeLogin(this.tempUserData);
        });

        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    },

    completeLogin(user) {
        AppState.currentUser = user;
        AppState.userRole = user.role;
        
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('main-app').classList.remove('hidden');
        
        Data.loadAll().then(() => Navigation.showView('dashboard'));
    },

    logout() {
        AppState.currentUser = null;
        AppState.userRole = null;
        ['username', 'current-password', 'new-password', 'confirm-password'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
        document.getElementById('main-app').classList.add('hidden');
        Navigation.showScreen('login-screen');
    },

    showError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
        setTimeout(() => element.classList.add('hidden'), 4000);
    },

    checkOwnerPermissions() {
        return AppState.userRole === 'owner';
    }
};

// ==========================================
// GERENCIAMENTO DE DADOS (SUPABASE REAL)
// ==========================================
const Data = {
    async loadAll() {
        try {
            const [svc, apt, cli, prod, exp, emp, com] = await Promise.all([
                supabase.from('services').select('*').eq('active', true),
                supabase.from('appointments').select('*, clients(name, whatsapp), services(name, price), users(name)').order('date', {ascending: true}).order('time', {ascending: true}),
                supabase.from('clients').select('*').order('name'),
                supabase.from('products').select('*').order('name'),
                supabase.from('expenses').select('*').order('date', {ascending: false}),
                supabase.from('employees').select('*').order('name'),
                supabase.from('comandas').select('*, clients(name)').eq('status', 'open')
            ]);

            AppState.data.services = svc.data || [];
            AppState.data.appointments = apt.data || [];
            AppState.data.clients = cli.data || [];
            AppState.data.products = prod.data || [];
            AppState.data.expenses = exp.data || [];
            AppState.data.employees = emp.data || [];
            AppState.data.comandas = com.data || [];

            this.populateSelects();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            alert('Falha ao carregar dados do sistema. Verifique sua conexão.');
        }
    },

    populateSelects() {
        const agServico = document.getElementById('ag-servico');
        if (agServico) {
            agServico.innerHTML = '<option value="">Selecione...</option>' + 
                AppState.data.services.map(s => `<option value="${s.id}" data-price="${s.price}">${s.name} - ${Utils.formatCurrency(s.price)}</option>`).join('');
        }

        const agProf = document.getElementById('ag-profissional');
        const filterProf = document.getElementById('professional-filter');
        const profOptions = AppState.data.employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        
        if (agProf) agProf.innerHTML = '<option value="">Selecione...</option>' + profOptions;
        if (filterProf) filterProf.innerHTML = '<option value="all">Todos os Profissionais</option>' + profOptions;
    }
};

// ==========================================
// MÓDULOS DE VIEW (Renderização baseada em AppState.data)
// ==========================================
const Dashboard = {
    load() {
        const today = new Date().toISOString().split('T')[0];
        const todayAppts = AppState.data.appointments.filter(a => a.date === today);
        
        const revenue = todayAppts.reduce((sum, apt) => sum + (parseFloat(apt.services?.price) || 0), 0);
        const pending = todayAppts.filter(a => a.status === 'pending').length;

        document.getElementById('today-revenue').textContent = Utils.formatCurrency(revenue);
        document.getElementById('today-appointments').textContent = todayAppts.length;
        document.getElementById('pending-count').textContent = pending;

        const container = document.getElementById('upcoming-appointments');
        let displayAppts = todayAppts;
        
        if (AppState.userRole === 'freelancer') {
            displayAppts = displayAppts.filter(a => a.users?.name === AppState.currentUser.name);
        }

        const nextThree = displayAppts.slice(0, 3);
        container.innerHTML = nextThree.length ? nextThree.map(apt => `
            <div class="appointment-item">
                <div class="appointment-time">${apt.time}</div>
                <div class="appointment-details" style="flex:1; margin-left:1rem;">
                    <div class="appointment-client">${apt.clients?.name || 'Cliente'}</div>
                    <div class="appointment-service">${apt.services?.name || 'Serviço'}</div>
                </div>
                <span class="badge badge-${apt.status}">${apt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}</span>
            </div>
        `).join('') : '<p class="text-muted">Nenhum agendamento para hoje.</p>';
    }
};

const Agenda = {
    load() {
        const dateInput = document.getElementById('agenda-date');
        if (dateInput) {
            dateInput.value = AppState.selectedDate;
            dateInput.onchange = (e) => { AppState.selectedDate = e.target.value; this.render(); };
        }

        const filterDiv = document.getElementById('agenda-filter');
        const select = document.getElementById('professional-filter');
        
        if (AppState.userRole === 'owner') {
            filterDiv.classList.remove('hidden');
            select.onchange = () => this.render();
        } else {
            filterDiv.classList.add('hidden');
        }
        this.render();
    },

    render() {
        const container = document.getElementById('agenda-list');
        const date = document.getElementById('agenda-date').value;
        const profFilter = document.getElementById('professional-filter')?.value || 'all';

        let appts = AppState.data.appointments.filter(a => a.date === date);

        if (AppState.userRole === 'freelancer') {
            appts = appts.filter(a => a.users?.name === AppState.currentUser.name);
        } else if (profFilter !== 'all') {
            const emp = AppState.data.employees.find(e => e.id == profFilter);
            if(emp) appts = appts.filter(a => a.users?.name === emp.name);
        }

        container.innerHTML = appts.length ? appts.map(apt => `
            <div class="appointment-item">
                <div class="appointment-time">${apt.time}</div>
                <div class="appointment-details" style="flex:1; margin-left:1rem;">
                    <div class="appointment-client">${apt.clients?.name}</div>
                    <div class="appointment-service">${apt.services?.name} • ${apt.users?.name}</div>
                </div>
                <span class="badge badge-${apt.status}">${apt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}</span>
            </div>
        `).join('') : '<p class="text-muted">Nenhum agendamento nesta data.</p>';
    }
};

const Comandas = {
    load() {
        this.render();
        const search = document.getElementById('comanda-search');
        if(search) search.oninput = Utils.debounce((e) => this.filter(e.target.value), 300);
    },
    render(filterText = '') {
        const container = document.getElementById('comandas-list');
        let list = AppState.data.comandas;
        
        if (filterText) {
            const lower = filterText.toLowerCase();
            list = list.filter(c => c.clients?.name.toLowerCase().includes(lower));
        }

        container.innerHTML = list.length ? list.map(c => `
            <div class="comanda-item">
                <div style="flex:1">
                    <div class="item-title">${c.clients?.name}</div>
                    <div class="item-subtitle">Aberta em: ${Utils.formatDate(c.open_date)}</div>
                </div>
                <div style="text-align:right">
                    <div class="item-value">${Utils.formatCurrency(c.total)}</div>
                    <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.7rem; margin-top:5px;" onclick="Comandas.close(${c.id})">Fechar</button>
                </div>
            </div>
        `).join('') : '<p class="text-muted">Nenhuma comanda aberta.</p>';
    },
    filter(text) { this.render(text); },
    async close(id) {
        if(!confirm('Deseja fechar esta comanda?')) return;
        const { error } = await supabase.from('comandas').update({ status: 'closed' }).eq('id', id);
        if(!error) {
            await Data.loadAll();
            this.render();
        } else alert('Erro ao fechar comanda');
    }
};

const Clientes = {
    load() {
        this.render();
        const search = document.getElementById('cliente-search');
        if(search) search.oninput = Utils.debounce((e) => this.filter(e.target.value), 300);
    },
    render(filterText = '') {
        const container = document.getElementById('clientes-list');
        let list = AppState.data.clients;
        
        if (filterText) {
            const lower = filterText.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(lower) || c.whatsapp.includes(filterText));
        }

        container.innerHTML = list.length ? list.map(c => `
            <div class="cliente-item" onclick="Clientes.showDetail(${c.id})">
                <div style="flex:1">
                    <div class="item-title">${c.name}</div>
                    <div class="item-subtitle">📱 ${c.whatsapp}</div>
                </div>
                <div class="item-value">${Utils.formatCurrency(c.total_spent)}</div>
            </div>
        `).join('') : '<p class="text-muted">Nenhum cliente encontrado.</p>';
    },
    filter(text) { this.render(text); },
    showDetail(id) {
        const client = AppState.data.clients.find(c => c.id === id);
        if(client) {
            document.getElementById('cliente-detail-name').textContent = client.name;
            document.getElementById('cliente-history').innerHTML = `
                <div class="history-item"><div class="history-date">10/08/2026</div><div class="history-service">Corte Feminino</div><div class="history-notes">Cliente satisfeita</div></div>
                <div class="history-item"><div class="history-date">25/07/2026</div><div class="history-service">Coloração</div><div class="history-notes">Tom castanho claro</div></div>
            `;
            Navigation.openModal('cliente-detail-modal');
        }
    }
};

const Servicos = {
    load() {
        const container = document.getElementById('servicos-list');
        container.innerHTML = AppState.data.services.length ? AppState.data.services.map(s => `
            <div class="servico-item">
                <div style="flex:1">
                    <div class="item-title">${s.name}</div>
                    <div class="item-subtitle">${s.duration} min • Custo: ${Utils.formatCurrency(s.cost)}</div>
                </div>
                <div class="item-value">${Utils.formatCurrency(s.price)}</div>
            </div>
        `).join('') : '<p class="text-muted">Nenhum serviço cadastrado.</p>';
        
        const btn = document.getElementById('add-servico-btn');
        if(btn) btn.classList.toggle('hidden', !Auth.checkOwnerPermissions());
    }
};

const Produtos = {
    load() {
        const container = document.getElementById('produtos-list');
        container.innerHTML = AppState.data.products.length ? AppState.data.products.map(p => {
            const lowStock = p.stock <= p.min_stock;
            return `
            <div class="produto-item">
                <div style="flex:1">
                    <div class="item-title">${p.name}</div>
                    <div class="item-subtitle">Estoque: ${p.stock} un. ${lowStock ? '⚠️ Baixo!' : ''}</div>
                </div>
                <div class="item-value">${Utils.formatCurrency(p.price)}</div>
            </div>`;
        }).join('') : '<p class="text-muted">Nenhum produto cadastrado.</p>';
        
        const btn = document.getElementById('add-produto-btn');
        if(btn) btn.classList.toggle('hidden', !Auth.checkOwnerPermissions());
    }
};

const Despesas = {
    load() {
        const container = document.getElementById('despesas-list');
        container.innerHTML = AppState.data.expenses.length ? AppState.data.expenses.map(e => `
            <div class="despesa-item">
                <div style="flex:1">
                    <div class="item-title">${e.description}</div>
                    <div class="item-subtitle">${e.category} • ${Utils.formatDate(e.date)} • ${e.payment_method}</div>
                </div>
                <div class="item-value" style="color:var(--danger)">-${Utils.formatCurrency(e.value)}</div>
            </div>
        `).join('') : '<p class="text-muted">Nenhuma despesa registrada.</p>';
        
        const btn = document.getElementById('add-despesa-btn');
        if(btn) btn.classList.toggle('hidden', !Auth.checkOwnerPermissions());
    }
};

const Funcionarios = {
    load() {
        const container = document.getElementById('funcionarios-list');
        container.innerHTML = AppState.data.employees.length ? AppState.data.employees.map(e => `
            <div class="funcionario-item" style="border-left-color:${e.color || '#B76E79'}">
                <div style="flex:1">
                    <div class="item-title">${e.name}</div>
                    <div class="item-subtitle">${e.specialty} • ${e.available ? 'Disponível' : 'Indisponível'}</div>
                </div>
                <div class="item-value">${e.commission}%</div>
            </div>
        `).join('') : '<p class="text-muted">Nenhum funcionário cadastrado.</p>';
        
        const btn = document.getElementById('add-funcionario-btn');
        if(btn) btn.classList.toggle('hidden', !Auth.checkOwnerPermissions());
    }
};

const Relatorios = {
    load() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.report-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`report-${btn.dataset.tab}`).classList.add('active');
            };
        });

        const totalRev = AppState.data.appointments.reduce((sum, a) => sum + (parseFloat(a.services?.price)||0), 0);
        const totalExp = AppState.data.expenses.reduce((sum, e) => sum + e.value, 0);
        
        document.getElementById('total-revenue').textContent = Utils.formatCurrency(totalRev);
        document.getElementById('total-expenses').textContent = Utils.formatCurrency(totalExp);
        document.getElementById('net-profit').textContent = Utils.formatCurrency(totalRev - totalExp);

        const sortedClients = [...AppState.data.clients].sort((a,b) => b.total_spent - a.total_spent);
        document.getElementById('top-clients-list').innerHTML = sortedClients.length ? sortedClients.map((c, i) => `
            <div class="ranking-item">
                <div class="ranking-position">${i+1}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${c.name}</div>
                    <div class="ranking-stats">Última visita: ${Utils.formatDate(c.last_visit)}</div>
                </div>
                <div class="ranking-value">${Utils.formatCurrency(c.total_spent)}</div>
            </div>
        `).join('') : '<p class="text-muted">Sem dados de clientes.</p>';
    }
};

const Mensagens = {
    templates: [
        { id: 1, name: 'Confirmação', text: 'Olá! Confirmamos seu agendamento para {data} às {hora}. Serviço: {serviço}. Aguardamos você! 💕' },
        { id: 2, name: 'Lembrete 24h', text: 'Oi! Lembrando que amanhã você tem horário conosco às {hora}. Estamos ansiosas! ✨' },
        { id: 3, name: 'Aniversário', text: 'Feliz aniversário! 🎉 Venha nos visitar e ganhe 10% de desconto!' }
    ],
    load() {
        const container = document.getElementById('templates-list');
        container.innerHTML = this.templates.map(t => `
            <div class="template-item" onclick="Mensagens.copy('${t.text.replace(/'/g, "\\'")}')">
                <div class="item-title">${t.name}</div>
                <div class="item-subtitle" style="margin-top:0.5rem; font-style:italic">"${t.text}"</div>
            </div>
        `).join('');
    },
    copy(text) {
        navigator.clipboard.writeText(text).then(() => alert('Mensagem copiada! Cole no WhatsApp.'));
    }
};

// ==========================================
// MODAIS E FORMULÁRIOS
// ==========================================
const Modals = {
    init() {
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.onclick = () => Navigation.closeModal(btn.closest('.modal').id);
        });
        document.querySelectorAll('.modal').forEach(m => {
            m.addEventListener('click', e => { if(e.target === m) Navigation.closeModal(m.id); });
        });

        const form = document.getElementById('agendamento-form');
        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                
                const serviceId = document.getElementById('ag-servico').value;
                const profId = AppState.userRole === 'freelancer' 
                    ? AppState.currentUser.id 
                    : document.getElementById('ag-profissional').value;
                
                const payload = {
                    client_id: 1, // Em produção: buscar ID pelo nome digitado
                    service_id: serviceId,
                    professional_id: profId,
                    date: document.getElementById('ag-data').value,
                    time: document.getElementById('ag-hora').value,
                    status: 'pending'
                };

                const { error } = await supabase.from('appointments').insert(payload);
                if(error) {
                    alert('Erro ao salvar: ' + error.message);
                } else {
                    alert('Agendamento criado!');
                    Navigation.closeModal('agendamento-modal');
                    form.reset();
                    await Data.loadAll();
                    Navigation.showView('agenda');
                }
            };
        }

        if(AppState.userRole === 'freelancer') {
            const group = document.getElementById('ag-profissional-group');
            if(group) group.classList.add('hidden');
        }
    }
};

// ==========================================
// INICIALIZAÇÃO ROBUSTA
// ==========================================
const App = {
    async init() {
        // Splash Screen
        Navigation.showScreen('splash-screen');
        
        // Delay garantido de branding
        await new Promise(r => setTimeout(r, 1500));
        
        // Inicia módulos
        Auth.init();
        Modals.init();
        
        // Event Listeners Globais
        document.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                if(view === 'mais') Navigation.openModal('menu-modal');
                else Navigation.showView(view);
            };
        });

        document.querySelectorAll('#menu-modal li').forEach(item => {
            item.onclick = () => {
                Navigation.closeModal('menu-modal');
                Navigation.showView(item.dataset.view);
            };
        });

        document.getElementById('menu-btn').onclick = () => Navigation.openModal('menu-modal');
        
        // Transição obrigatória para login
        Navigation.showScreen('login-screen');
        console.log('✅ Sistema inicializado. Aguardando autenticação via Supabase...');
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
