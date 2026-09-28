/** FECHAMENTO MANUAL DE PERÍODO - Amor que Cuida
 *  Carregar DEPOIS do script.js. Grava em: financial_periods (Supabase)
 *  Períodos antigos (quinzenas automáticas) continuam funcionando.
 */
const Fechamento = {
    list: [],            // períodos fechados (mais recente primeiro)
    baseStart: null,     // início do período vigente
    legacyCurrent: U.getCurrentQuinzenaValue.call(U),
    legacyDates: U.getQuinzenaDates.bind(U),
    legacyOptions: U.generateQuinzenasOptions.bind(U),
    last: null,

    fmt: iso => new Date(iso).toLocaleDateString('pt-BR'),
    fmtFull: iso => new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }),
    toLocalInput: d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16),

    async load() {
        try {
            const { data, error } = await db.from('financial_periods').select('*').order('end_date', { ascending: false });
            if (error) throw error;
            this.list = data || [];
        } catch (e) {
            this.list = [];
            console.error('financial_periods:', e);
            if (App.role === 'owner') UI.toast('Não foi possível ler financial_periods (verifique as políticas RLS).', 'error');
        }
        // início do período vigente = fim do último fechamento; sem fechamentos = início da quinzena automática atual
        this.currentStart = this.list.length ? this.list[0].end_date : this.legacyDates(this.legacyCurrent).start;
        // limite dos registros "antigos" (quinzenas automáticas)
        this.baseStart = this.list.length ? this.list[this.list.length - 1].start_date : this.currentStart;
    },

    getDates(val) {
        if (val === 'current') return { start: this.currentStart, end: '2099-12-31T23:59:59Z' };
        if (val && val.startsWith('p:')) {
            const p = this.list.find(x => x.id === val.slice(2));
            if (p) return { start: p.start_date, end: p.end_date };
        }
        return this.legacyDates(val);
    },

    options() {
        let html = `<option value="current">Período Atual (desde ${this.fmt(this.currentStart)})</option>`;
        this.list.forEach(p => { html += `<option value="p:${p.id}">Fechado: ${this.fmt(p.start_date)} a ${this.fmt(p.end_date)}</option>`; });
        const tmp = document.createElement('select'); tmp.innerHTML = this.legacyOptions();
        [...tmp.options].forEach(o => { if (this.legacyDates(o.value).end < this.baseStart) html += o.outerHTML; });
        return html;
    },

    // ---------- Modal de fechamento ----------
    async open() {
        if (App.role !== 'owner') return UI.toast('Apenas o gestor pode fechar o período.', 'error');
        const cont = document.getElementById('modal-container');
        cont.innerHTML = `<div class="modal"><button class="modal-close" onclick="Modals.close()"><i class="ph ph-x"></i></button>
            <h3 style="margin-bottom:5px">Fechar Período Financeiro</h3>
            <p style="color:var(--muted); font-size:0.9rem; margin-bottom:15px">Período vigente desde <b>${this.fmtFull(this.currentStart)}</b></p>
            <div id="fech-resumo" style="margin-bottom:15px"></div>
            <div class="input-group"><label>Data e hora do fechamento (pode ser antes ou depois de hoje)</label>
                <input type="datetime-local" id="fech-end" value="${this.toLocalInput(new Date())}" onchange="Fechamento.preview()"></div>
            <p style="font-size:0.8rem; color:var(--muted); margin-bottom:15px"><i class="ph ph-info"></i> Tudo o que ocorrer após este momento entra no próximo período.</p>
            <button class="btn-primary" id="btn-fech" style="padding:1.2rem; background:#2e7d32" onclick="Fechamento.confirm()"><i class="ph ph-lock-key"></i> Confirmar Fechamento</button></div>`;
        cont.classList.remove('hidden');
        this.preview();
    },

    async preview() {
        const box = document.getElementById('fech-resumo'); if (!box) return;
        const v = document.getElementById('fech-end').value;
        if (!v) { box.innerHTML = ''; this.last = null; return; }
        const endISO = new Date(v).toISOString();
        if (endISO <= this.currentStart) {
            this.last = null;
            box.innerHTML = `<p style="color:#d32f2f; font-weight:bold"><i class="ph ph-warning-circle"></i> A data de fechamento precisa ser posterior ao início do período.</p>`;
            return;
        }
        box.innerHTML = `<p style="color:var(--muted)">Calculando resumo...</p>`;
        const { data: desp } = await db.from('despesas').select('*').gte('date', this.currentStart).lte('date', endISO);
        const { count } = await db.from('comandas').select('id', { count: 'exact', head: true }).eq('status', 'fechada').gte('created_at', this.currentStart).lte('created_at', endISO);
        const { totalIn, totalOut } = U.buildExtrato(desp);
        const cat = {}; (desp || []).forEach(d => { cat[d.category] = (cat[d.category] || 0) + (Number(d.amount) || 0); });
        const forma = {}; App.inflowCategories.forEach(c => forma[c] = cat[c] || 0);
        const lucro = totalIn - totalOut;
        this.last = { start: this.currentStart, end: endISO, summary: { entradas: totalIn, saidas: totalOut, lucro, porForma: forma, comissoes: cat['Comissões'] || 0, custosFixos: cat['Custos Fixos'] || 0, comandasFechadas: count || 0 } };
        const row = (l, val, c) => `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed #eee"><span>${l}</span><b style="color:${c || 'var(--text)'}">${val}</b></div>`;
        box.innerHTML = `<div style="background:#fafafa; border:1px solid var(--border); border-radius:12px; padding:15px">
            <p style="font-size:0.85rem; color:var(--muted); margin-bottom:8px">${this.fmtFull(this.currentStart)} → ${this.fmtFull(endISO)}</p>
            ${row('Comandas fechadas', count || 0)}
            ${App.inflowCategories.map(c => row(c, U.money(forma[c]))).join('')}
            ${row('Total de Entradas', U.money(totalIn), '#2e7d32')}
            ${row('Custos Fixos Retidos', '-' + U.money(cat['Custos Fixos'] || 0), '#d32f2f')}
            ${row('Comissões', '-' + U.money(cat['Comissões'] || 0), '#cd7f32')}
            ${row('Total de Saídas', '-' + U.money(totalOut), '#d32f2f')}
            ${row('Resultado Líquido', U.money(lucro), lucro >= 0 ? '#2e7d32' : '#d32f2f')}</div>`;
    },

    confirm() {
        if (!this.last) return UI.toast('Escolha uma data de fechamento válida.', 'error');
        UI.confirm(`Fechar o período até ${this.fmtFull(this.last.end)}? Os registros posteriores irão para o próximo período.`, async () => {
            const btn = document.getElementById('btn-fech'); if (btn) btn.disabled = true;
            const { error } = await db.from('financial_periods').insert({ start_date: this.last.start, end_date: this.last.end, closed_by: App.user.name, summary: this.last.summary });
            if (error) { if (btn) btn.disabled = false; return UI.toast('Erro ao fechar: ' + error.message, 'error'); }
            await this.load(); U.initFilters(); Modals.close();
            UI.toast('Período fechado com sucesso!');
            if (Render[App.view] && !['agenda', 'perfil'].includes(App.view)) Render[App.view]();
        });
    },

    injectButton() {
        const rc = document.getElementById('resumo-cards'); if (!rc || App.role !== 'owner') return;
        let w = document.getElementById('fech-bar');
        if (!w) { w = document.createElement('div'); w.id = 'fech-bar'; w.style = 'margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;'; rc.parentNode.insertBefore(w, rc); }
        w.innerHTML = `<span style="font-size:0.9rem; color:var(--primary-dark); font-weight:bold"><i class="ph ph-calendar-check"></i> Período vigente desde ${this.fmtFull(this.currentStart)}</span>
            <button class="btn-primary" style="width:auto; padding:0.7rem 1.2rem" onclick="Fechamento.open()"><i class="ph ph-lock-key"></i> Fechar Período</button>`;
    }
};

// ---- Integração com o sistema existente ----
U.getCurrentQuinzenaValue = () => 'current';
U.getQuinzenaDates = val => Fechamento.getDates(val);
U.generateQuinzenasOptions = () => Fechamento.options();

const _success = Auth.success;
Auth.success = async function () { await Fechamento.load(); return _success.call(this); };

const _resumo = Render['resumo-financeiro'];
Render['resumo-financeiro'] = async function () { await _resumo.call(this); Fechamento.injectButton(); };
