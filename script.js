// --- SUPABASE CONFIG ---
const SUPABASE_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userProfile = null;
let services = [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  setTimeout(() => document.getElementById('splash').style.display = 'none', 1200);

  // Eventos
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('date-picker').addEventListener('change', loadAgenda);
  document.getElementById('search-client').addEventListener('input', debounce(searchClients, 300));
  document.getElementById('fab-new-appt').addEventListener('click', () => openModal('modal-appt'));
  document.getElementById('close-appt').addEventListener('click', () => closeModal('modal-appt'));
  document.getElementById('save-appt').addEventListener('click', saveAppointment);
  document.getElementById('more-btn').addEventListener('click', () => openModal('modal-menu'));
  document.getElementById('close-menu').addEventListener('click', () => closeModal('modal-menu'));
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // Navegação
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });
  document.querySelectorAll('.menu-link').forEach(el => {
    el.addEventListener('click', () => {
      switchView(el.dataset.view);
      closeModal('modal-menu');
    });
  });

  // Carregar serviços
  const { data } = await supabase.from('services').select('*').eq('is_active', true);
  services = data || [];
  const sel = document.getElementById('appt-service');
  services.forEach(s => sel.innerHTML += `<option value="${s.id}">${s.name} (${s.duration_minutes}min)</option>`);

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date-picker').value = today;
  document.getElementById('appt-date').value = today;
});

// --- UTILS ---
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(val) || 0);
}

// --- LOGIN ---
async function handleLogin() {
  const username = document.getElementById('username').value.trim().toLowerCase();
  const msgEl = document.getElementById('msg');
  
  if (!username) {
    msgEl.textContent = "Digite seu usuário (nome.sobrenome)";
    msgEl.className = 'error';
    return;
  }

  msgEl.textContent = "Verificando...";
  msgEl.className = '';

  const { data, error } = await supabase.from('profiles').select('*').eq('username', username).single();

  if (error || !data || !data.is_active) {
    msgEl.textContent = "Usuário não encontrado ou desativado.";
    msgEl.className = 'error';
    return;
  }

  userProfile = data;

  if (data.first_login) {
    showCreatePasswordScreen(username);
  } else {
    showPasswordScreen(username);
  }
}

function showCreatePasswordScreen(username) {
  document.getElementById('login-screen').innerHTML = `
    <div class="login-card">
      <div class="login-header">
        <h2>Crie sua senha</h2>
        <p>Primeiro acesso ao sistema</p>
      </div>
      <div class="input-group">
        <label>Nova Senha (mín. 6 caracteres)</label>
        <input type="password" id="new-pass" placeholder="••••••">
      </div>
      <button class="btn btn-primary" id="btn-set-pass">Salvar e Entrar</button>
      <p id="msg2"></p>
    </div>
  `;
  document.getElementById('btn-set-pass').addEventListener('click', async () => {
    const pwd = document.getElementById('new-pass').value;
    if (pwd.length < 6) {
      document.getElementById('msg2').textContent = "Senha muito curta";
      document.getElementById('msg2').className = 'error';
      return;
    }
    const email = `${username}@estudio.local`;
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: '123456' });
    if (authError) {
      document.getElementById('msg2').textContent = "Erro interno. Tente novamente.";
      document.getElementById('msg2').className = 'error';
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: pwd });
    if (updateError) {
      document.getElementById('msg2').textContent = "Erro ao salvar senha.";
      document.getElementById('msg2').className = 'error';
      return;
    }
    await supabase.from('profiles').update({ first_login: false }).eq('id', userProfile.id);
    showApp();
  });
}

function showPasswordScreen(username) {
  document.getElementById('login-screen').innerHTML = `
    <div class="login-card">
      <div class="login-header">
        <h2>Digite sua senha</h2>
        <p>Para continuar no Estúdio Amor que Cuida</p>
      </div>
      <div class="input-group">
        <label>Senha</label>
        <input type="password" id="login-pass" placeholder="••••••">
      </div>
      <button class="btn btn-primary" id="btn-do-login">Entrar</button>
      <p id="msg2"></p>
    </div>
  `;
  document.getElementById('btn-do-login').addEventListener('click', async () => {
    const pwd = document.getElementById('login-pass').value;
    const email = `${username}@estudio.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) {
      document.getElementById('msg2').textContent = "Senha incorreta";
      document.getElementById('msg2').className = 'error';
      return;
    }
    showApp();
  });
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('role-display').textContent = 
    userProfile.role === 'proprietario' ? 'Proprietário' : 'Freelancer';
  loadDashboard();
}

async function handleLogout() {
  await supabase.auth.signOut();
  location.reload();
}

// --- NAVIGATION ---
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(view).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = Array.from(document.querySelectorAll('.nav-item')).find(n => n.dataset.view === view);
  if (activeNav) activeNav.classList.add('active');

  if (view === 'agenda') loadAgenda();
  if (view === 'comandas') loadComandas();
  if (view === 'clientes') loadClientes();
  if (view === 'mensagens') loadTemplates();
  if (view === 'servicos') loadServicos();
  if (view === 'home') loadDashboard();
}

// --- DATA LOADING ---
async function loadDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const { data: cmds } = await supabase.from('commands')
    .select('total_amount')
    .eq('status', 'paid')
    .gte('closed_at', `${today}T00:00:00`);
  const rev = cmds?.reduce((a,b)=>a+parseFloat(b.total_amount),0) || 0;
  document.getElementById('rev-today').textContent = formatCurrency(rev);

  const { data: appts } = await supabase.from('appointments')
    .select('id')
    .gte('appointment_date', `${today}T00:00:00`)
    .lte('appointment_date', `${today}T23:59:59`)
    .eq('professional_id', userProfile.id);
  document.getElementById('appts-today').textContent = appts?.length || 0;
  document.getElementById('pending').textContent = appts?.filter(a => a.status === 'pending').length || 0;

  const { data: nextAppts } = await supabase.from('appointments')
    .select('client_name, client_phone, appointment_date, service_id, custom_service_name')
    .gte('appointment_date', new Date().toISOString())
    .eq('professional_id', userProfile.id)
    .order('appointment_date', { ascending: true })
    .limit(3);
  
  const list = document.getElementById('home-appts');
  if (!nextAppts || nextAppts.length === 0) {
    list.innerHTML = '<div class="card" style="text-align:center">Nenhum horário.</div>';
    return;
  }

  list.innerHTML = nextAppts.map(a => {
    const time = formatTime(a.appointment_date);
    const svc = services.find(s => s.id == a.service_id)?.name || a.custom_service_name || 'Serviço';
    return `<div class="card" style="border-left:4px solid var(--primary)">
      <div><strong>${time}</strong> - ${a.client_name}</div>
      <div style="font-size:0.85rem; color:var(--text-light);">${svc}</div>
    </div>`;
  }).join('');
}

async function loadAgenda() {
  const date = document.getElementById('date-picker').value;
  const { data } = await supabase.from('appointments')
    .select('client_name, client_phone, appointment_date, end_date, service_id, custom_service_name, status')
    .gte('appointment_date', `${date}T00:00:00`)
    .lte('appointment_date', `${date}T23:59:59`)
    .eq('professional_id', userProfile.id)
    .order('appointment_date', { ascending: true });

  const list = document.getElementById('agenda-list');
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="card" style="text-align:center">Nenhum horário.</div>';
    return;
  }

  list.innerHTML = data.map(a => {
    const start = formatTime(a.appointment_date);
    const end = formatTime(a.end_date);
    const svc = services.find(s => s.id == a.service_id)?.name || a.custom_service_name || 'Serviço';
    const status = a.status === 'pending' ? '<span class="badge" style="background:#E3F2FD; color:#1976D2; padding:4px 8px; border-radius:4px; font-size:0.7rem;">Pendente</span>' : '';
    return `<div class="card">
      <div><strong>${start}–${end}</strong> ${status}</div>
      <div>${a.client_name} | ${a.client_phone}</div>
      <div style="font-size:0.85rem; color:var(--text-light);">${svc}</div>
    </div>`;
  }).join('');
}

async function loadComandas() {
  const { data } = await supabase.from('commands')
    .select('client_name, client_phone, total_amount, status, opened_at')
    .eq('professional_id', userProfile.id)
    .eq('status', 'open');

  const list = document.getElementById('comandas-list');
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="card" style="text-align:center">Nenhuma comanda aberta.</div>';
    return;
  }

  list.innerHTML = data.map(c => `
    <div class="card">
      <div><strong>${c.client_name}</strong> | ${c.client_phone}</div>
      <div>${formatCurrency(c.total_amount)}</div>
      <div style="font-size:0.8rem; color:var(--text-light);">${formatDate(c.opened_at)}</div>
    </div>`).join('');
}

async function loadClientes() {
  const term = document.getElementById('search-client').value.toLowerCase();
  let query = supabase.from('appointments')
    .select('client_name, client_phone', { count: 'exact' })
    .eq('professional_id', userProfile.id)
    .neq('client_name', '');

  if (term) {
    query = query.or(`client_name.ilike.%${term}%,client_phone.ilike.%${term}%`);
  }

  const { data } = await query;
  const unique = Array.from(new Map(data.map(item => [item.client_phone, item])).values());

  const list = document.getElementById('clientes-list');
  if (!unique || unique.length === 0) {
    list.innerHTML = '<div class="card" style="text-align:center">Nenhum cliente.</div>';
    return;
  }

  list.innerHTML = unique.map(c => `
    <div class="card">
      <strong>${c.client_name}</strong><br>
      <small>${c.client_phone}</small>
    </div>`).join('');
}

async function loadTemplates() {
  const { data } = await supabase.from('message_templates').select('*').eq('is_active', true);
  const list = document.getElementById('templates-list');
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="card" style="text-align:center">Sem templates.</div>';
    return;
  }
  list.innerHTML = data.map(t => `
    <div class="card">
      <strong>${t.name}</strong>
      <p style="font-size:0.85rem; margin:6px 0;">${t.message_body.substring(0, 70)}${t.message_body.length > 70 ? '...' : ''}</p>
    </div>`).join('');
}

async function loadServicos() {
  const { data } = await supabase.from('services').select('*').eq('is_active', true);
  const list = document.getElementById('servicos-list');
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="card" style="text-align:center">Nenhum serviço cadastrado.</div>';
    return;
  }
  list.innerHTML = data.map(s => `
    <div class="card">
      <strong>${s.name}</strong> (${s.duration_minutes}min)
      <div>${formatCurrency(s.price)} | Custo: ${formatCurrency(s.cost_price)}</div>
    </div>`).join('');
}

// --- ACTIONS ---
async function saveAppointment() {
  const name = document.getElementById('appt-client-name').value.trim();
  const phone = document.getElementById('appt-phone').value.replace(/\D/g, '');
  const servId = document.getElementById('appt-service').value;
  const date = document.getElementById('appt-date').value;
  const time = document.getElementById('appt-time').value;

  if (!name || !phone || !servId || !date || !time) {
    alert("Preencha todos os campos.");
    return;
  }

  if (phone.length < 10) {
    alert("Número de WhatsApp inválido.");
    return;
  }

  const start = `${date}T${time}:00`;
  const serv = services.find(s => s.id == servId);
  const duration = serv?.duration_minutes || 60;
  const end = new Date(new Date(start).getTime() + duration*60000).toISOString();

  const { error } = await supabase.from('appointments').insert({
    client_name: name,
    client_phone: phone,
    professional_id: userProfile.id,
    service_id: servId,
    appointment_date: start,
    end_date: end,
    status: 'pending'
  });

  if (error) {
    console.error(error);
    alert("Erro ao agendar: " + error.message);
  } else {
    alert("Agendado com sucesso!");
    closeModal('modal-appt');
    loadAgenda();
    loadDashboard();
  }
}

// --- MODALS ---
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
