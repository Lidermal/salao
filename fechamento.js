/**
 * FECHAMENTO MANUAL DE PERÍODO FINANCEIRO - Amor que Cuida
 * Carregar DEPOIS do script.js.
 *
 * Objetivos:
 * - manter as quinzenas automáticas já existentes;
 * - permitir fechamento manual em qualquer data/hora;
 * - fazer o próximo período começar exatamente no fechamento anterior;
 * - manter relatórios e filtros apontando para o período correto;
 * - salvar cada fechamento em public.financial_periods.
 */

const Fechamento = {
    list: [],
    currentStart: null,
    baseStart: null,
    legacyCurrent: null,
    legacyDates: null,
    legacyOptions: null,
    last: null,
    loading: false,

    fmt(iso) {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('pt-BR');
    },

    fmtFull(iso) {
        if (!iso) return '';
        return new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    toLocalInput(date) {
        const d = date instanceof Date ? date : new Date(date);
        const local = new Date(
            d.getTime() - d.getTimezoneOffset() * 60000
        );

        return local.toISOString().slice(0, 16);
    },

    async load() {
        if (this.loading) return;

        this.loading = true;

        try {
            const { data, error } = await db
                .from('financial_periods')
                .select('*')
                .order('end_date', {
                    ascending: false
                });

            if (error) throw error;

            this.list = (data || []).filter(
                p => p.start_date && p.end_date
            );

        } catch (error) {

            console.error(
                '[Fechamento] financial_periods:',
                error
            );

            this.list = [];

            /*
             * Não bloqueia o sistema caso a tabela/RLS ainda não esteja pronta.
             * Nesse cenário, o sistema continua usando a quinzena automática.
             */
            if (App.role === 'owner') {

                UI.toast(
                    'Não foi possível carregar os fechamentos. O sistema continuará usando a quinzena automática.',
                    'error'
                );
            }

        } finally {

            /*
             * Só depois de carregar os fechamentos definimos o período vigente.
             * Isso evita o problema de filtros iniciarem com uma quinzena antiga.
             */
            const fallback =
                this.legacyDates(
                    this.legacyCurrent
                );

            this.currentStart = this.list.length
                ? this.list[0].end_date
                : fallback.start;

            this.baseStart = this.list.length
                ? this.list[this.list.length - 1].start_date
                : fallback.start;

            this.loading = false;
        }
    },

    getDates(value) {

        if (!value || value === 'current') {

            return {
                start:
                    this.currentStart ||
                    this.legacyDates(
                        this.legacyCurrent
                    ).start,

                end:
                    '2099-12-31T23:59:59Z'
            };
        }

        if (
            typeof value === 'string' &&
            value.startsWith('p:')
        ) {

            const id = value.slice(2);

            const period = this.list.find(
                p =>
                    String(p.id) === String(id)
            );

            if (period) {

                return {
                    start: period.start_date,
                    end: period.end_date
                };
            }
        }

        return this.legacyDates(value);
    },

    options() {

        let html = '';

        const currentStart =
            this.currentStart ||
            this.legacyDates(
                this.legacyCurrent
            ).start;

        html += `
            <option value="current">
                Período Atual (desde ${this.fmt(currentStart)})
            </option>
        `;

        /*
         * Fechamentos manuais aparecem primeiro,
         * do mais recente para o mais antigo.
         */
        this.list.forEach(period => {

            html += `
                <option value="p:${period.id}">
                    Fechado: ${this.fmt(period.start_date)} a ${this.fmt(period.end_date)}
                </option>
            `;
        });

        /*
         * Mantém as quinzenas automáticas antigas que ficam antes
         * do primeiro período manual existente.
         */
        const temp =
            document.createElement('select');

        temp.innerHTML =
            this.legacyOptions();

        [
            ...temp.options
        ].forEach(option => {

            const range =
                this.legacyDates(
                    option.value
                );

            if (
                new Date(range.end).getTime() <
                new Date(this.baseStart).getTime()
            ) {

                html += option.outerHTML;
            }
        });

        return html;
    },

    async open() {

        if (App.role !== 'owner') {

            return UI.toast(
                'Apenas o gestor pode fechar o período.',
                'error'
            );
        }

        if (!this.currentStart) {

            return UI.toast(
                'O período atual ainda não foi carregado.',
                'error'
            );
        }

        const container =
            document.getElementById(
                'modal-container'
            );

        container.innerHTML = `
            <div class="modal" style="max-width:620px;">

                <button
                    class="modal-close"
                    onclick="Modals.close()"
                >
                    <i class="ph ph-x"></i>
                </button>

                <h3 style="margin-bottom:5px;">
                    <i
                        class="ph ph-lock-key"
                        style="color:var(--primary);"
                    ></i>

                    Fechar Período Financeiro
                </h3>

                <p
                    style="
                        color:var(--muted);
                        font-size:0.9rem;
                        margin-bottom:15px;
                    "
                >
                    Período vigente desde
                    <b>${this.fmtFull(this.currentStart)}</b>
                </p>

                <div
                    id="fech-resumo"
                    style="margin-bottom:15px;"
                ></div>

                <div class="input-group">

                    <label>
                        Data e hora do fechamento
                    </label>

                    <input
                        type="datetime-local"
                        id="fech-end"
                        value="${this.toLocalInput(new Date())}"
                        onchange="Fechamento.preview()"
                    >

                </div>

                <div
                    style="
                        background:var(--primary-light);
                        border:1px solid var(--primary);
                        border-radius:10px;
                        padding:12px;
                        margin-bottom:15px;
                        font-size:0.86rem;
                        line-height:1.45;
                    "
                >
                    <i class="ph ph-info"></i>

                    Tudo que ocorrer
                    <b>depois desta data e hora</b>
                    não fará parte deste período.

                    Esses registros ficarão no próximo período.
                </div>

                <button
                    class="btn-primary"
                    id="btn-fech"
                    style="
                        padding:1.1rem;
                        background:#2e7d32;
                    "
                    onclick="Fechamento.confirm()"
                >
                    <i class="ph ph-lock-key"></i>
                    Confirmar Fechamento
                </button>

            </div>
        `;

        container.classList.remove(
            'hidden'
        );

        await this.preview();
    },

    async preview() {

        const box =
            document.getElementById(
                'fech-resumo'
            );

        const input =
            document.getElementById(
                'fech-end'
            );

        if (!box || !input) return;

        const value = input.value;

        if (!value) {

            this.last = null;

            box.innerHTML = '';

            return;
        }

        const endISO =
            new Date(value).toISOString();

        const startISO =
            new Date(
                this.currentStart
            ).toISOString();

        if (
            new Date(endISO).getTime() <=
            new Date(startISO).getTime()
        ) {

            this.last = null;

            box.innerHTML = `
                <div
                    style="
                        background:#ffebee;
                        color:#c62828;
                        border:1px solid #ffcdd2;
                        border-radius:10px;
                        padding:12px;
                    "
                >
                    <i class="ph ph-warning-circle"></i>

                    A data/hora do fechamento
                    precisa ser posterior ao início
                    do período vigente.
                </div>
            `;

            return;
        }

        box.innerHTML = `
            <div
                class="card"
                style="
                    padding:14px;
                    text-align:center;
                "
            >

                <i
                    class="ph ph-spinner ph-spin"
                    style="font-size:1.5rem;"
                ></i>

                <p
                    style="
                        margin-top:6px;
                        color:var(--muted);
                    "
                >
                    Calculando resumo do período...
                </p>

            </div>
        `;

        /*
         * O limite superior é inclusivo:
         * se algo foi lançado exatamente no momento
         * do fechamento, pertence ao período que
         * está sendo fechado.
         */

        const {
            data: despesas,
            error: despesasError
        } = await db
            .from('despesas')
            .select('*')
            .gte('date', startISO)
            .lte('date', endISO)
            .order('date', {
                ascending: false
            });

        if (despesasError) {

            console.error(
                '[Fechamento] despesas:',
                despesasError
            );

            this.last = null;

            box.innerHTML = `
                <div
                    style="
                        color:#c62828;
                        padding:12px;
                    "
                >
                    Não foi possível calcular
                    as despesas do período.

                    ${despesasError.message || ''}
                </div>
            `;

            return;
        }

        const {
            count: comandasFechadas,
            error: comandasError
        } = await db
            .from('comandas')
            .select(
                'id',
                {
                    count: 'exact',
                    head: true
                }
            )
            .eq(
                'status',
                'fechada'
            )
            .gte(
                'created_at',
                startISO
            )
            .lte(
                'created_at',
                endISO
            );

        if (comandasError) {

            console.warn(
                '[Fechamento] comandas:',
                comandasError
            );
        }

        const {
            totalIn,
            totalOut
        } = U.buildExtrato(
            despesas || []
        );

        const lucro =
            totalIn - totalOut;

        const porForma = {};

        (App.inflowCategories || [])
            .forEach(category => {

                porForma[category] = 0;
            });

        (despesas || [])
            .forEach(item => {

                if (
                    App.inflowCategories.includes(
                        item.category
                    )
                ) {

                    porForma[item.category] =
                        (
                            porForma[item.category] ||
                            0
                        ) +
                        (
                            Number(item.amount) ||
                            0
                        );
                }
            });

        const summary = {

            entradas: totalIn,

            saidas: totalOut,

            lucro,

            porForma,

            comissoes:
                (despesas || [])
                    .filter(
                        d =>
                            d.category ===
                            'Comissões'
                    )
                    .reduce(
                        (s, d) =>
                            s +
                            (
                                Number(d.amount) ||
                                0
                            ),
                        0
                    ),

            custosFixos:
                (despesas || [])
                    .filter(
                        d =>
                            d.category ===
                            'Custos Fixos'
                    )
                    .reduce(
                        (s, d) =>
                            s +
                            (
                                Number(d.amount) ||
                                0
                            ),
                        0
                    ),

            comandasFechadas:
                comandasFechadas || 0,

            quantidadeMovimentacoes:
                (despesas || []).length
        };

        this.last = {

            start: startISO,

            end: endISO,

            summary
        };

        const row = (
            label,
            value,
            color = 'var(--text)'
        ) => `

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:15px;
                    padding:7px 0;
                    border-bottom:1px dashed #eee;
                "
            >

                <span>
                    ${label}
                </span>

                <b
                    style="
                        color:${color};
                        white-space:nowrap;
                    "
                >
                    ${value}
                </b>

            </div>
        `;

        const formasHtml =
            (App.inflowCategories || [])
                .map(
                    category =>
                        row(
                            category,
                            U.money(
                                porForma[
                                    category
                                ] || 0
                            ),
                            '#2e7d32'
                        )
                )
                .join('');

        box.innerHTML = `

            <div
                style="
                    background:#fafafa;
                    border:1px solid var(--border);
                    border-radius:12px;
                    padding:15px;
                "
            >

                <p
                    style="
                        font-size:0.85rem;
                        color:var(--muted);
                        margin-bottom:10px;
                    "
                >
                    ${this.fmtFull(startISO)}
                    →
                    ${this.fmtFull(endISO)}
                </p>

                ${row(
                    'Comandas fechadas',
                    comandasFechadas || 0
                )}

                ${row(
                    'Movimentações financeiras',
                    despesas?.length || 0
                )}

                <div
                    style="
                        margin:10px 0;
                        padding-top:5px;
                        font-size:0.85rem;
                        color:var(--muted);
                        font-weight:bold;
                    "
                >
                    ENTRADAS POR FORMA DE PAGAMENTO
                </div>

                ${formasHtml}

                ${row(
                    'Total de Entradas',
                    U.money(totalIn),
                    '#2e7d32'
                )}

                ${row(
                    'Custos Fixos',
                    '-' +
                    U.money(
                        summary.custosFixos
                    ),
                    '#d32f2f'
                )}

                ${row(
                    'Comissões',
                    '-' +
                    U.money(
                        summary.comissoes
                    ),
                    '#cd7f32'
                )}

                ${row(
                    'Total de Saídas',
                    '-' +
                    U.money(totalOut),
                    '#d32f2f'
                )}

                ${row(
                    'Resultado Líquido',
                    U.money(lucro),
                    lucro >= 0
                        ? '#2e7d32'
                        : '#d32f2f'
                )}

            </div>
        `;
    },

    confirm() {

        if (!this.last) {

            return UI.toast(
                'Escolha uma data de fechamento válida.',
                'error'
            );
        }

        const fechamento =
            this.last;

        UI.confirm(
            `Fechar o período até ${this.fmtFull(
                fechamento.end
            )}? Tudo que ocorrer depois desse momento ficará no próximo período.`,
            async () => {

                const button =
                    document.getElementById(
                        'btn-fech'
                    );

                if (button) {

                    button.disabled = true;

                    button.innerHTML =
                        '<i class="ph ph-spinner ph-spin"></i> Fechando...';
                }

                /*
                 * Proteção contra fechamento duplicado.
                 * O banco continua sendo a fonte de verdade.
                 */

                const {
                    data: existing,
                    error: existingError
                } = await db
                    .from(
                        'financial_periods'
                    )
                    .select('id')
                    .eq(
                        'end_date',
                        fechamento.end
                    )
                    .maybeSingle();

                if (existingError) {

                    console.warn(
                        '[Fechamento] verificação duplicidade:',
                        existingError
                    );
                }

                if (existing) {

                    if (button) {
                        button.disabled = false;
                    }

                    return UI.toast(
                        'Esse período já foi fechado.',
                        'error'
                    );
                }

                const { error } =
                    await db
                        .from(
                            'financial_periods'
                        )
                        .insert({

                            start_date:
                                fechamento.start,

                            end_date:
                                fechamento.end,

                            closed_by:
                                App.user?.name ||
                                'Gestor',

                            summary:
                                fechamento.summary
                        });

                if (error) {

                    console.error(
                        '[Fechamento] insert:',
                        error
                    );

                    if (button) {

                        button.disabled =
                            false;

                        button.innerHTML =
                            '<i class="ph ph-lock-key"></i> Confirmar Fechamento';
                    }

                    return UI.toast(
                        'Erro ao fechar período: ' +
                        error.message,
                        'error'
                    );
                }

                await this.load();

                /*
                 * Atualiza todos os filtros depois
                 * do fechamento.
                 *
                 * O novo "current" começa exatamente
                 * no end_date recém salvo.
                 */

                U.initFilters();

                Modals.close();

                UI.toast(
                    'Período fechado com sucesso!'
                );

                if (
                    Render[App.view] &&
                    ![
                        'agenda',
                        'perfil'
                    ].includes(
                        App.view
                    )
                ) {

                    await Render[
                        App.view
                    ]();
                }
            }
        );
    },

    injectButton() {

        const cards =
            document.getElementById(
                'resumo-cards'
            );

        if (
            !cards ||
            App.role !== 'owner' ||
            !this.currentStart
        ) {
            return;
        }

        let bar =
            document.getElementById(
                'fech-bar'
            );

        if (!bar) {

            bar =
                document.createElement(
                    'div'
                );

            bar.id =
                'fech-bar';

            bar.style = `
                margin-bottom:15px;
                display:flex;
                justify-content:space-between;
                align-items:center;
                flex-wrap:wrap;
                gap:10px;
                background:var(--surface);
                border:1px solid var(--border);
                border-radius:12px;
                padding:12px 14px;
            `;

            cards.parentNode.insertBefore(
                bar,
                cards
            );
        }

        bar.innerHTML = `

            <span
                style="
                    font-size:0.9rem;
                    color:var(--primary-dark);
                    font-weight:bold;
                "
            >
                <i
                    class="ph ph-calendar-check"
                ></i>

                Período vigente desde
                ${this.fmtFull(
                    this.currentStart
                )}
            </span>

            <button
                class="btn-primary"
                style="
                    width:auto;
                    padding:0.7rem 1.2rem;
                    background:#2e7d32;
                "
                onclick="Fechamento.open()"
            >

                <i
                    class="ph ph-lock-key"
                ></i>

                Fechar Período

            </button>
        `;
    }
};


/*
 * Guardamos as funções originais ANTES de substituir os filtros.
 * Isso é importante para não perder o comportamento das quinzenas antigas.
 */

Fechamento.legacyCurrent =
    U.getCurrentQuinzenaValue.bind(U);

Fechamento.legacyDates =
    U.getQuinzenaDates.bind(U);

Fechamento.legacyOptions =
    U.generateQuinzenasOptions.bind(U);


/*
 * Depois do carregamento do fechamento,
 * os filtros passam a aceitar:
 *
 * - current = período manual vigente;
 * - p:<uuid> = período manual fechado;
 * - YYYY-MM-Q1/Q2 = quinzenas automáticas antigas.
 */

U.getCurrentQuinzenaValue =
    function () {

        return 'current';
    };


U.getQuinzenaDates =
    function (value) {

        return Fechamento.getDates(
            value
        );
    };


U.generateQuinzenasOptions =
    function () {

        return Fechamento.options();
    };


/*
 * Integração com o login existente.
 * O Auth.success original continua sendo executado normalmente.
 */

const _AQC_originalAuthSuccess =
    Auth.success.bind(Auth);

Auth.success =
    async function () {

        await Fechamento.load();

        return _AQC_originalAuthSuccess();
    };


/*
 * Integração com o Fluxo de Caixa.
 * O render original continua sendo executado e,
 * em seguida, o botão de fechamento é inserido.
 */

const _AQC_originalResumoFinanceiro =
    Render[
        'resumo-financeiro'
    ].bind(Render);

Render[
    'resumo-financeiro'
] =
    async function () {

        await _AQC_originalResumoFinanceiro();

        Fechamento.injectButton();
    };
