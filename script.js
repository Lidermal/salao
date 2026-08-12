// ==========================================
// CONFIGURAÇÃO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variáveis de Estado
let currentUserAuth = null;
let userProfile = null;
let attemptUsername = "";
let servicesCache = [];

// ==========================================
// INICIALIZAÇÃO & VERIFICAÇÃO DE SESSÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Splash Screen rápida (1 segundo)
    setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUserAuth = session.user;
            await loadUserProfile();
        } else {
            document.getElementById('splash-screen').classList.remove('active-flex');
            document.getElementById('auth-screen').classList.add('active-flex');
        }
    }, 1000);

    // 2. Setup Data Atual nos Inputs
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('agenda-date-picker').value = today;
    document.getElementById('appt-date').value = today;

    // 3. Listeners Globais
    setupListeners();
});

function setupListeners() {
    // Login Flow
    document.getElementById('btn-check-user').addEventListener('click', checkUser);
    document.getElementById('btn-create-pass').addEventListener('click', createPasswordAndLogin);
    document.getElementById('btn-do-login').addEventListener('click', doNormalLogin);
    document.getElementById('btn-back-1').addEventListener('click', resetLoginUI);
    document.getElementById('btn-back-2').addEventListener('click', resetLoginUI);
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        location.reload();
    });

    // Navegação (Bottom Nav & Menu Links)
    document.querySelectorAll('.nav-item[data-target], .menu-link[data-target]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const target = el.getAttribute('data-target');
            navigateSpa(target);
            closeModal('menu-modal'); // Fecha o menu se clicou por lá
        });
    });

    // Ações de Funcionalidades
    document.getElementById('agenda-date-picker').addEventListener('change', loadAgenda);
    document.getElementById('btn-save-appt').addEventListener('click', saveAppointment);
}

// ==========================================
// FLUXO DE LOGIN CUSTOMIZADO (Sem depender de e-mail na UI)
// ==========================================
async function checkUser() {
    const inputUser = document.getElementById('username').value.trim().toLowerCase();
    const msg = document.getElementById('login-msg');
    
    if (!inputUser) { msg.innerText = "Digite o usuário."; return; }
    
    msg.innerText = "Buscando...";
    attemptUsername = inputUser;

    // Busca na tabela profiles do Supabase pelo username (ou email que simula o username)
    // Nota: Baseado no seu JSON, o email no banco é 'username@estudio.com'
    const expectedEmail = `${inputUser}@estudio.com`;
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('email', expectedEmail).single();

    if (error || !profile) {
        msg.innerText = "Usuário não encontrado no sistema.";
        return;
    }

    // Se existe, verifica se é primeiro acesso
    document.getElementById('step-identify').classList.add('hidden');
    if (profile.first_login) {
        document.getElementById('step-create-pass').classList.remove('hidden');
    } else {
        document.getElementById('step-login-pass').classList.remove('hidden');
    }
}

async function createPasswordAndLogin() {
    const newPass = document.getElementById('new-password').value;
    if (newPass.length < 6) { alert("A senha precisa ter no mínimo 6 caracteres."); return; }

    const email = `${attemptUsername}@estudio.com`;

    // No primeiro acesso (como a conta já foi criada pelo Supabase com uma senha padrão), 
    // fazemos login com a senha padrão (ex: 123456) e depois atualizamos
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: '123456' // Padrão que você inseriu no backend
    });

    if (authError) {
        alert("Erro no backend. Verifique a senha padrão do usuário configurado.");
        return;
    }

    // Atualiza a senha definitivamente
    await supabase.auth.updateUser({ password: newPass });
    // Atualiza o first_login no profile
    await supabase.from('profiles').update({ first_login: false }).eq('id', authData.user.id);
    
    currentUserAuth = authData.user;
    await loadUserProfile();
}

async function doNormalLogin() {
    const pass = document.getElementById('existing-password').value;
    const msg = document.getElementById('login-msg-2');
    const email = `${attemptUsername}@estudio.com`;

    const { data, error } = await supabase.auth.signInWithPassword({ email: email, password: pass });
    
    if (error) {
        msg.innerText = "Senha incorreta.";
        return;
    }

    currentUserAuth = data.user;
    await loadUserProfile();
}

function resetLoginUI() {
    document.getElementById('step-create-pass').classList.add('hidden');
    document.getElementById('step-login-pass').classList.add('hidden');
    document.getElementById('step-identify').classList.remove('hidden');
    document.getElementById('login-msg').innerText = "";
    document.getElementById('login-msg-2').innerText = "";
}

// ==========================================
// CONTROLE DE PERFIL (Proprietário vs Freelancer)
// ==========================================
async function loadUserProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', currentUserAuth.id).single();
    if (data) {
        userProfile = data;
        applyPermissions();
        
        // Esconde telas de carregamento/login e mostra o App
        document.getElementById('splash-screen').classList.remove('active-flex');
        document.getElementById('auth-screen').classList.remove('active-flex');
        document.getElementById('app-screen').classList.add('active-flex');
        
        loadInitialData(); // Carrega serviços pro modal, dashboard, etc.
    }
}

function applyPermissions() {
    // É proprietário (admin) se o banco diz 'admin' ou 'proprietario'
    const isAdmin = (userProfile.role === 'admin' || userProfile.role === 'proprietario');
    
    document.getElementById('user-role-display').innerText = isAdmin ? "Proprietário" : "Freelancer";

    // Libera itens exclusivos do administrador
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = isAdmin ? 'block' : 'none';
    });
}

// ==========================================
// NAVEGAÇÃO SPA (Single Page Application)
// ==========================================
function navigateSpa(targetView) {
    // Oculta todas as sections
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    // Ativa a desejada
    document.getElementById(`view-${targetView}`).classList.add('active');

    // Atualiza estado do Menu Inferior
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.getAttribute('data-target') === targetView) nav.classList.add('active');
    });

    // Carrega dados baseados na tela
    if (targetView === 'home') loadDashboard();
    if (targetView === 'agenda') loadAgenda();
    if (targetView === 'comandas') loadComandas();
    if (targetView === 'clientes') loadClientes();
    if (targetView === 'mensagens') loadTemplates();
    if (targetView === 'servicos') loadServices();
    if (targetView === 'despesas') loadExpenses();
    if (targetView === 'relatorios') loadReports();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ==========================================
// CARREGAMENTO DE DADOS (Exemplos Práticos)
// ==========================================
async function loadInitialData() {
    // Preenche o Select de Serviços do Modal
    const { data: servs } = await supabase.from('services').select('*').eq('is_active', true);
    servicesCache = servs || [];
    const sel = document.getElementById('appt-service');
    sel.innerHTML = '<option value="">Selecione...</option>';
    servicesCache.forEach(s => sel.innerHTML += `<option value="${s.id}">${s.name} - R$ ${s.price}</option>`);

    // Inicia ouvindo o banco em tempo real
    subscribeToRealtime();
    
    // Inicia no Dashboard
    navigateSpa('home');
}

async function loadDashboard() {
    // Como Freelancer, só vê as próprias comandas/agendas. Admin vê tudo.
    const today = new Date().toISOString().split('T')[0];
    
    // Total Arrecadado Hoje
    let queryCmds = supabase.from('commands').select('total_amount').eq('status', 'paid').gte('closed_at', `${today}T00:00:00`);
    if (userProfile.role !== 'admin') queryCmds = queryCmds.eq('employee_id', userProfile.id);
    const { data: cmds } = await queryCmds;
    
    const rev = cmds ? cmds.reduce((acc, curr) => acc + parseFloat(curr.total_amount), 0) : 0;
    document.getElementById('dash-revenue').innerText = `R$ ${rev.toFixed(2)}`;

    // Busca Agenda pro Dashboard
    loadAgendaBase('home-appointments-list', today, 3);
}

async function loadAgenda() {
    const dateSelected = document.getElementById('agenda-date-picker').value;
    loadAgendaBase('agenda-list', dateSelected, 50);
}

async function loadAgendaBase(containerId, dateStr, limit) {
    const container = document.getElementById(containerId);
    container.innerHTML = 'Carregando...';

    // RLS fará o filtro automático baseado no SQL enviado, mas reforçamos no frontend
    let query = supabase.from('appointments')
        .select('*, client:profiles!client_id(full_name), service:services(name)')
        .gte('appointment_date', `${dateStr}T00:00:00`)
        .lte('appointment_date', `${dateStr}T23:59:59`)
        .order('appointment_date', { ascending: true })
        .limit(limit);

    if (userProfile.role !== 'admin') query = query.eq('employee_id', userProfile.id);

    const { data } = await query;

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="card text-center" style="color:var(--text-light)">Sem horários marcados.</div>';
        return;
    }

    container.innerHTML = data.map(a => {
        const time = new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clientName = a.client ? a.client.full_name : 'Cliente Indefinido';
        const serviceName = a.service ? a.service.name : 'Serviço Personalizado';
        return `<div class="card"><strong>${time}</strong> - ${clientName}<br><small>${serviceName}</small></div>`;
    }).join('');
}

// Exemplos de carregamento de outras telas (Ajuste conforme os campos do seu banco)
async function loadComandas() { document.getElementById('comandas-list').innerHTML = '<div class="card">Comanda Exemplo</div>'; }
async function loadClientes() { document.getElementById('clientes-list').innerHTML = '<div class="card">Maria Exemplo - (86) 99999-9999</div>'; }
async function loadTemplates() { document.getElementById('templates-list').innerHTML = '<div class="card">Confirmação: Olá, seu horário...</div>'; }
async function loadServices() { document.getElementById('servicos-list').innerHTML = '<div class="card">Corte - R$ 60,00</div>'; }
async function loadExpenses() { document.getElementById('despesas-list').innerHTML = '<div class="card">Aluguel - R$ 1000,00</div>'; }
async function loadReports() { /* Lógica de relatório financeiro */ }

// ==========================================
// AÇÕES (Salvar Agendamento)
// ==========================================
async function saveAppointment() {
    const name = document.getElementById('appt-client-name').value;
    const phone = document.getElementById('appt-whatsapp').value;
    const servId = document.getElementById('appt-service').value;
    const date = document.getElementById('appt-date').value;
    const time = document.getElementById('appt-time').value;

    if (!name || !phone || !servId || !date || !time) {
        alert("Preencha todos os campos.");
        return;
    }

    // 1. Verifica se o cliente já existe, se não, cadastra (Colaboradores podem fazer isso)
    let clientId = null;
    const { data: existClient } = await supabase.from('profiles').select('id').eq('phone', phone).single();
    
    if (existClient) {
        clientId = existClient.id;
    } else {
        // Como o cliente não acessa o sistema, inserimos ele apenas como um "profile" sem usuário no Auth
        const { data: newC, error: errC } = await supabase.from('profiles').insert({
            full_name: name,
            phone: phone,
            role: 'client' // ou 'cliente' dependendo do seu enum no SQL
        }).select().single();
        
        if (errC) { alert("Erro ao cadastrar cliente."); return; }
        clientId = newC.id;
    }

    // 2. Insere na Agenda da funcionária que está logada (userProfile.id)
    const startTimestamp = `${date}T${time}:00`;
    const { error: apptError } = await supabase.from('appointments').insert({
        client_id: clientId,
        employee_id: userProfile.id, 
        service_id: servId,
        appointment_date: startTimestamp,
        status: 'pending'
    });

    if (apptError) {
        alert("Erro ao salvar agendamento: " + apptError.message);
    } else {
        alert("Agendado com sucesso!");
        closeModal('agendamento-modal');
        loadDashboard();
        loadAgenda();
    }
}

// ==========================================
// TEMPO REAL
// ==========================================
function subscribeToRealtime() {
    supabase.channel('public:appointments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
            if (document.getElementById('view-agenda').classList.contains('active')) loadAgenda();
            if (document.getElementById('view-home').classList.contains('active')) loadDashboard();
        }).subscribe();
}
