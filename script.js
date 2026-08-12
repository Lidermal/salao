const SUPABASE_URL = 'https://bjppgfssceayiryeffcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcHBnZnNzY2VheWlyeWVmZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjM0MTMsImV4cCI6MjEwMjAzOTQxM30.jlHXRs87X2rTtjRQk5Uwptqlph0JePKBSMuIzuHIo18';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserAuth = null;
let userProfile = null;
let attemptUsername = "";
let servicesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                currentUserAuth = session.user;
                await loadProfileAndStartApp();
            } else {
                showScreen('screen-auth');
            }
        } catch (e) {
            showScreen('screen-auth');
        }
    }, 1200);

    document.getElementById('btn-verify').addEventListener('click', verifyUserInDB);
    document.getElementById('btn-create-pass').addEventListener('click', createPassAndLogin);
    document.getElementById('btn-login').addEventListener('click', doLogin);
    document.getElementById('btn-save-appt').addEventListener('click', saveAppointment);
    document.getElementById('search-client').addEventListener('input', (e) => loadClientes(e.target.value));

    document.querySelectorAll('.btn-logout').forEach(btn => {
        btn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            location.reload();
        });
    });

    document.querySelectorAll('.nav-item[data-target], .menu-link[data-target]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const target = el.getAttribute('data-target');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(n => {
                n.classList.remove('active');
                if(n.getAttribute('data-target') === target) n.classList.add('active');
            });
            closeModal('modal-menu');
            routerLoad(target);
        });
    });

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('input-date-agenda').value = today;
    document.getElementById('appt-date').value = today;
});

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function resetAuth() {
    document.querySelectorAll('.auth-step').forEach(s => s.classList.remove('active'));
    document.getElementById('auth-step-1').classList.add('active');
}

async function verifyUserInDB() {
    const input = document.getElementById('input-username').value.trim().toLowerCase();
    const msg = document.getElementById('msg-auth-1');
    if (!input) { msg.innerText = "Digite o usuário."; return; }
    attemptUsername = input;

    const { data, error } = await supabase.from('profiles').select('*').eq('username', input).single();
    if (error || !data) { msg.innerText = "Usuário não encontrado."; return; }

    document.getElementById('auth-step-1').classList.remove('active');
    if (data.first_login) {
        document.getElementById('auth-step-new').classList.add('active');
    } else {
        document.getElementById('auth-step-login').classList.add('active');
    }
}

async function createPassAndLogin() {
    const pass = document.getElementById('input-new-pass').value;
    if (pass.length < 6) { alert("Mínimo 6 caracteres."); return; }
    const email = `${attemptUsername}@estudio.com`;

    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: '123456' });
    if (error) { alert("Erro na senha padrão."); return; }

    await supabase.auth.updateUser({ password: pass });
    await supabase.from('profiles').update({ first_login: false }).eq('id', authData.user.id);
    currentUserAuth = authData.user;
    await loadProfileAndStartApp();
}

async function doLogin() {
    const pass = document.getElementById('input-pass').value;
    const email = `${attemptUsername}@estudio.com`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) { document.getElementById('msg-auth-2').innerText = "Senha incorreta."; return; }

    currentUserAuth = data.user;
    await loadProfileAndStartApp();
}

async function loadProfileAndStartApp() {
    const { data } = await supabase.from('profiles').select('*').eq('id', currentUserAuth.id).single();
    userProfile = data;

    const isOwner = (userProfile.role === 'proprietario' || userProfile.role === 'admin');
    document.getElementById('badge-role').innerText = isOwner ? "Proprietário" : "Freelancer";
    if (isOwner) document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');

    await loadServicesCache();
    showScreen('screen-app');
    loadDashboard();
}

async function loadServicesCache() {
    const { data } = await supabase.from('services').select('*').eq('is_active', true);
    servicesCache = data || [];
    const sel = document.getElementById('appt-service');
    sel.innerHTML = '<option value="">Selecione o Serviço...</option>';
    servicesCache.forEach(s => sel.innerHTML += `<option value="${s.id}">${s.name} (${s.duration_minutes}min) - R$ ${s.price}</option>`);
}

function routerLoad(target) {
    if (target === 'view-home') loadDashboard();
    if (target === 'view-agenda') loadAgenda();
    if (target === 'view-comandas') loadComandas();
    if (target === 'view-cobrancas') loadCobrancas();
    if (target === 'view-clientes') loadClientes();
    if (target === 'view-mensagens') loadTemplates();
    if (target === 'view-servicos') loadServicosAdmin();
    if (target === 'view-produtos') loadProdutos();
    if (target === 'view-despesas') loadDespesas();
    if (target === 'view-funcionarios') loadFuncionarios();
    if (target === 'view-relatorios') loadRelatorios();
}

// ================= MÓDULOS =================
async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    let q = supabase.from('commands').select('total_amount').eq('status', 'paid').gte('closed_at', `${today}T00:00:00`);
    if (userProfile.role !== 'admin' && userProfile.role !== 'proprietario') q = q.eq('professional_id', userProfile.id);
    const { data: cmds } = await q;
    const rev = cmds ? cmds.reduce((a,b)=> a + parseFloat(b.total_amount), 0) : 0;
    document.getElementById('dash-rev').innerText = `R$ ${rev.toFixed(2)}`;
    loadAgendaList('list-home-agenda', today, 3);
}

async function loadAgenda() {
    const date = document.getElementById('input-date-agenda').value;
    loadAgendaList('list-agenda', date, 50);
}

async function loadAgendaList(elementId, dateStr, limit) {
    const container = document.getElementById(elementId);
    container.innerHTML = '<p class="empty-state">Carregando...</p>';
    
    let query = supabase.from('appointments')
        .select('*, client:profiles!client_id(full_name, phone), service:services(name)')
        .gte('appointment_date', `${dateStr}T00:00:00`).lte('appointment_date', `${dateStr}T23:59:59`)
        .order('appointment_date', {ascending: true}).limit(limit);

    if (userProfile.role !== 'admin' && userProfile.role !== 'proprietario') {
        query = query.eq('professional_id', userProfile.id);
    }

    const { data } = await query;
    if (!data || data.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum agendamento.</p>'; return; }

    container.innerHTML = data.map(a => {
        const time = new Date(a.appointment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `<div class="card"><strong>${time}</strong> - ${a.client?.full_name || 'Cliente'} <br><small>${a.service?.name || 'Serviço'} | WhatsApp: ${a.client?.phone || '-'}</small></div>`;
    }).join('');
}

async function saveAppointment() {
    const name = document.getElementById('appt-client-name').value;
    const phone = document.getElementById('appt-whatsapp').value;
    const servId = document.getElementById('appt-service').value;
    const date = document.getElementById('appt-date').value;
    const time = document.getElementById('appt-time').value;

    if (!name || !phone || !servId || !date || !time) { alert("Preencha todos os campos."); return; }

    let clientId;
    const { data: exist } = await supabase.from('profiles').select('id').eq('phone', phone).single();
    if (exist) {
        clientId = exist.id;
    } else {
        const { data: newC, error: errC } = await supabase.from('profiles').insert({ full_name: name, phone, role: 'cliente' }).select().single();
        if (errC) { alert("Erro ao criar cliente."); return; }
        clientId = newC.id;
    }

    const serv = servicesCache.find(s => s.id === servId);
    const start = `${date}T${time}:00`;
    const endDate = new Date(new Date(start).getTime() + (serv?.duration_minutes || 60)*60000).toISOString();

    const { error } = await supabase.from('appointments').insert({
        client_id: clientId, professional_id: userProfile.id, service_id: servId, appointment_date: start, end_date: endDate, status: 'pending'
    });

    if (error) alert(error.message);
    else { alert("Agendado com sucesso!"); closeModal('modal-appt'); loadDashboard(); loadAgenda(); }
}

async function loadComandas() {
    const { data } = await supabase.from('commands').select('*, client:profiles!client_id(full_name)').eq('status', 'open');
    document.getElementById('list-comandas').innerHTML = data?.map(c => `<div class="card"><strong>${c.client?.full_name}</strong><br>Total: R$ ${c.total_amount} <button class="btn-primary mt-2" onclick="closeCommand('${c.id}')">Fechar Comanda</button></div>`).join('') || '<p class="empty-state">Nenhuma comanda aberta.</p>';
}

async function closeCommand(id) {
    await supabase.from('commands').update({ status: 'paid', closed_at: new Date().toISOString() }).eq('id', id);
    alert("Comanda fechada com sucesso!");
    loadComandas();
}

async function loadCobrancas() {
    const { data } = await supabase.from('commands').select('*, client:profiles!client_id(full_name)').eq('status', 'debt');
    document.getElementById('list-cobrancas').innerHTML = data?.map(c => `<div class="card" style="border-left-color:var(--danger)"><strong>${c.client?.full_name}</strong><br>Débito: R$ ${c.total_amount}</div>`).join('') || '<p class="empty-state">Nenhum débito pendente.</p>';
}

async function loadClientes(filter = '') {
    let q = supabase.from('profiles').select('*').eq('role', 'cliente').limit(20);
    if(filter) q = q.ilike('full_name', `%${filter}%`);
    const { data } = await q;
    document.getElementById('list-clientes').innerHTML = data?.map(c => `<div class="card"><strong>${c.full_name}</strong><br>Tel: ${c.phone}</div>`).join('') || '<p class="empty-state">Nenhum cliente encontrado.</p>';
}

async function loadTemplates() {
    const { data } = await supabase.from('message_templates').select('*');
    document.getElementById('list-mensagens').innerHTML = data?.map(t => `<div class="card"><strong>${t.name}</strong><p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${t.body}</p></div>`).join('') || '<p class="empty-state">Sem templates.</p>';
}

async function loadServicosAdmin() {
    const { data } = await supabase.from('services').select('*');
    document.getElementById('list-servicos').innerHTML = data?.map(s => `<div class="card"><strong>${s.name}</strong> - R$ ${s.price} (${s.duration_minutes} min)</div>`).join('') || '<p class="empty-state">Sem serviços.</p>';
}

async function loadProdutos() {
    const { data } = await supabase.from('products').select('*');
    document.getElementById('list-produtos').innerHTML = data?.map(p => `<div class="card"><strong>${p.name}</strong> - R$ ${p.sale_price} (Estoque: ${p.stock_qty})</div>`).join('') || '<p class="empty-state">Estoque vazio.</p>';
}

async function loadDespesas() {
    const { data } = await supabase.from('expenses').select('*');
    document.getElementById('list-despesas').innerHTML = data?.map(d => `<div class="card"><strong>${d.description}</strong> - R$ ${d.amount}</div>`).join('') || '<p class="empty-state">Sem despesas.</p>';
}

async function loadFuncionarios() {
    const { data } = await supabase.from('profiles').select('*').neq('role', 'cliente');
    document.getElementById('list-funcionarios').innerHTML = data?.map(f => `<div class="card"><strong>${f.full_name}</strong> (${f.role})</div>`).join('') || '<p class="empty-state">Sem equipe.</p>';
}

async function loadRelatorios() {
    const { data: rev } = await supabase.from('commands').select('total_amount').eq('status', 'paid');
    const { data: exp } = await supabase.from('expenses').select('amount').eq('is_paid', true);
    const tRev = rev?.reduce((a,b)=>a+parseFloat(b.total_amount),0) || 0;
    const tExp = exp?.reduce((a,b)=>a+parseFloat(b.amount),0) || 0;
    document.getElementById('rep-rev').innerText = `R$ ${tRev.toFixed(2)}`;
    document.getElementById('rep-exp').innerText = `R$ ${tExp.toFixed(2)}`;
    document.getElementById('rep-profit').innerText = `R$ ${(tRev - tExp).toFixed(2)}`;

    // Melhores Clientes
    const { data: best } = await supabase.rpc('get_top_clients');
    document.getElementById('list-best-clients').innerHTML = best?.map(b => `<div class="card"><strong>${b.full_name}</strong><br>Total Gasto: R$ ${b.total}</div>`).join('') || '<p class="empty-state">Sem dados de clientes ainda.</p>';
}

function openNewCommandModal() { alert("Para abrir comanda, selecione um agendamento concluído."); }
function openServiceModal() { alert("Painel restrito de cadastro de serviços."); }
