import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HeaderSlotContext } from '../../components/layout/PageHeaderSlot';
import { Visualizacao } from '../../components/relatoriosPersonalizados/Visualizacao';
import * as api from '../../lib/api/relatoriosPersonalizados';
import type { CatalogoEntidade, ResultadoRelatorio } from '../../lib/api/relatoriosPersonalizados';
import { criarQueryClientDeTeste, renderComProviders } from '../../test/renderWithProviders';
import { RelatorioEditorPage } from './RelatorioEditorPage';
import { RelatorioPersonalizadoPage } from './RelatorioPersonalizadoPage';

vi.mock('../../lib/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ usuario: { id: 'u1', nome: 'Admin', user_type: 'ADMIN' }, isAuthenticated: true, isLoading: false }),
}));

vi.mock('../../lib/api/relatoriosPersonalizados', async (original) => ({
  ...(await original<typeof import('../../lib/api/relatoriosPersonalizados')>()),
  listarEntidadesRelatorio: vi.fn(),
  buscarCatalogoEntidade: vi.fn(),
  executarDefinicao: vi.fn(),
  criarRelatorioPersonalizado: vi.fn(),
  buscarOpcoesFiltro: vi.fn(),
  buscarRelatorioPersonalizado: vi.fn(),
  executarRelatorioPersonalizado: vi.fn(),
}));

const catalogo: CatalogoEntidade = {
  chave: 'visita',
  rotulo: 'Visitas realizadas',
  campo_periodo_padrao: 'inicio_data',
  presets: ['hoje', 'ultimos_7_dias', 'ultimos_30_dias', 'mes_atual', 'mes_anterior'],
  campos: [
    { chave: 'loja', rotulo: 'Loja', tipo: 'relacao', operadores: ['em', 'nao_em'], agrupavel: true, periodo: false, fonte: 'pontos_venda' },
    { chave: 'rede', rotulo: 'Rede', tipo: 'relacao', operadores: ['em', 'nao_em'], agrupavel: true, periodo: false, fonte: 'redes_lojas' },
    {
      chave: 'inicio_data',
      rotulo: 'Início da visita',
      tipo: 'data',
      operadores: [],
      agrupavel: true,
      periodo: true,
      granularidades: ['ano', 'trimestre', 'mes', 'semana', 'dia', 'mes_do_ano', 'dia_da_semana'],
    },
  ],
  metricas: [
    { chave: 'visitas', rotulo: 'Visitas', formato: 'inteiro' },
    { chave: 'tempo_medio', rotulo: 'Tempo médio', formato: 'minutos' },
    { chave: 'contagem_distinta:loja', rotulo: 'Contagem distinta de Loja', formato: 'inteiro', campo: 'loja', campo_rotulo: 'Loja', agregacao: 'contagem_distinta' },
    { chave: 'moda:loja', rotulo: 'Moda de Loja', formato: 'texto', campo: 'loja', campo_rotulo: 'Loja', agregacao: 'moda' },
  ],
};

function resultado(parcial: Partial<ResultadoRelatorio>): ResultadoRelatorio {
  return {
    periodo: { data_inicio: '2026-09-01', data_fim: '2026-09-30', fuso: 'America/Manaus' },
    colunas: [],
    linhas: [],
    linhas_truncadas: false,
    totais: {},
    definicao_resolvida: { entidade: 'visita', periodo: {}, filtros: { combinador: 'E', regras: [] }, agrupar: [], metricas: [], comparar: null },
    ...parcial,
  };
}

// O editor espera a prévia (debounce de 500 ms) e renderiza bastante MUI — com a suíte inteira
// rodando em paralelo, 5 s (padrão) fica apertado.
const LIMITE_EDITOR = 15_000;

describe('RelatorioEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listarEntidadesRelatorio).mockResolvedValue([{ chave: 'visita', rotulo: 'Visitas realizadas' }]);
    vi.mocked(api.buscarCatalogoEntidade).mockResolvedValue(catalogo);
    vi.mocked(api.executarDefinicao).mockImplementation(async (d) =>
      resultado({
        definicao_resolvida: d,
        colunas: [
          ...d.agrupar.map((g) => ({ chave: g.campo, rotulo: 'Loja', tipo: 'dimensao' as const })),
          { chave: 'visitas', rotulo: 'Visitas', tipo: 'inteiro' as const },
        ],
        linhas: d.agrupar.length ? [{ dimensoes: { loja: { chave: 'l1', rotulo: 'Mercado Bom Preço' } }, valores: { visitas: 7 } }] : [],
        totais: { visitas: 7 },
      }),
    );
  });

  it('monta o relatório com cliques e a prévia vem do backend', async () => {
    const usuario = userEvent.setup();
    renderComProviders(<RelatorioEditorPage />, { rota: '/relatorios-personalizados/novo' });

    await usuario.click(await screen.findByText('Visitas'));
    await usuario.click(screen.getByText('Loja'));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Adicionar em Linhas' }));

    await waitFor(
      () =>
        expect(api.executarDefinicao).toHaveBeenLastCalledWith(
          expect.objectContaining({
            entidade: 'visita',
            metricas: [{ chave: 'visitas' }],
            agrupar: [{ campo: 'loja', granularidade: undefined, eixo: 'linha' }],
            periodo: { campo: undefined, preset: 'ultimos_30_dias' },
          }),
        ),
      { timeout: 3000 },
    );
    expect(await screen.findByText('Mercado Bom Preço')).toBeInTheDocument();
  }, LIMITE_EDITOR);

  it('salva com nome e a definição montada', async () => {
    vi.mocked(api.criarRelatorioPersonalizado).mockResolvedValue({ id: 'novo-1' } as api.RelatorioPersonalizado);
    const usuario = userEvent.setup();
    // O botão Salvar fica no header (portal do AppLayout) — aqui o alvo é um div do próprio teste.
    const header = document.body.appendChild(document.createElement('div'));
    renderComProviders(
      <HeaderSlotContext.Provider value={header}>
        <RelatorioEditorPage />
      </HeaderSlotContext.Provider>,
      { rota: '/relatorios-personalizados/novo' },
    );

    await usuario.click(await screen.findByText('Tempo médio'));
    await usuario.click(screen.getByRole('button', { name: 'Salvar relatório' }));
    const dialogo = await screen.findByRole('dialog');
    await usuario.type(within(dialogo).getByLabelText(/nome/i), 'Tempo por mês');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(api.criarRelatorioPersonalizado).toHaveBeenCalledWith(
        expect.objectContaining({ nome: 'Tempo por mês', compartilhado: false, definicao: expect.objectContaining({ metricas: [{ chave: 'tempo_medio' }] }) }),
      ),
    );
  }, LIMITE_EDITOR);
});

describe('RelatorioEditorPage — registros e formulários', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listarEntidadesRelatorio).mockResolvedValue([
      { chave: 'visita', rotulo: 'Visitas realizadas' },
      { chave: 'registro', rotulo: 'Registros e formulários' },
    ]);
    vi.mocked(api.buscarOpcoesFiltro).mockResolvedValue([{ valor: 'form-1', rotulo: 'Loja perfeita' }]);
    vi.mocked(api.buscarCatalogoEntidade).mockImplementation(async (entidade, formulario) => ({
      ...catalogo,
      chave: entidade,
      metricas: [
        { chave: 'registros', rotulo: 'Registros', formato: 'inteiro' as const },
        ...(formulario
          ? [
              { chave: 'soma:preco', rotulo: 'Soma de Preço', formato: 'moeda' as const, grupo: 'Perguntas do formulário', campo: 'preco', campo_rotulo: 'Preço', agregacao: 'soma' as const },
              { chave: 'media:preco', rotulo: 'Média de Preço', formato: 'moeda' as const, grupo: 'Perguntas do formulário', campo: 'preco', campo_rotulo: 'Preço', agregacao: 'media' as const },
            ]
          : []),
      ],
    }));
    vi.mocked(api.executarDefinicao).mockImplementation(async (d) => resultado({ definicao_resolvida: d }));
  });

  it('escolher o formulário traz as perguntas e manda o formulário na definição', async () => {
    const usuario = userEvent.setup();
    renderComProviders(<RelatorioEditorPage />, { rota: '/relatorios-personalizados/novo' });

    await usuario.click(await screen.findByRole('combobox', { name: 'Analisar' }));
    await usuario.click(await screen.findByRole('option', { name: 'Registros e formulários' }));
    await usuario.click(await screen.findByRole('combobox', { name: 'Formulário' }));
    await usuario.click(await screen.findByRole('option', { name: 'Loja perfeita' }));

    expect(await screen.findByText('Perguntas do formulário')).toBeInTheDocument();
    await usuario.click(screen.getByText('Preço'));
    await usuario.click(await screen.findByRole('button', { name: 'Operação de Preço' }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Média' }));

    await waitFor(
      () =>
        expect(api.executarDefinicao).toHaveBeenLastCalledWith(
          expect.objectContaining({ entidade: 'registro', formulario: 'form-1', metricas: [{ chave: 'media:preco' }] }),
        ),
      { timeout: 3000 },
    );
  }, LIMITE_EDITOR);
});

describe('Hierarquia de datas e filtros rápidos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listarEntidadesRelatorio).mockResolvedValue([{ chave: 'visita', rotulo: 'Visitas realizadas' }]);
    vi.mocked(api.buscarCatalogoEntidade).mockResolvedValue(catalogo);
    vi.mocked(api.executarDefinicao).mockImplementation(async (d) => resultado({ definicao_resolvida: d }));
  });

  it('a mesma data entra como mês nas linhas e ano nas colunas', async () => {
    const usuario = userEvent.setup();
    renderComProviders(<RelatorioEditorPage />, { rota: '/relatorios-personalizados/novo' });

    await usuario.click(await screen.findByText('Visitas'));
    await usuario.click(screen.getByText('Mês'));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Adicionar em Linhas' }));
    await usuario.click(screen.getByText('Ano'));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Adicionar em Colunas' }));

    await waitFor(
      () =>
        expect(api.executarDefinicao).toHaveBeenLastCalledWith(
          expect.objectContaining({
            agrupar: [
              { campo: 'inicio_data', granularidade: 'mes', eixo: 'linha' },
              { campo: 'inicio_data', granularidade: 'ano', eixo: 'coluna' },
            ],
          }),
        ),
      { timeout: 3000 },
    );
  }, LIMITE_EDITOR);

  it('filtro rápido na tela do relatório vai só na execução', async () => {
    vi.mocked(api.buscarRelatorioPersonalizado).mockResolvedValue({
      id: 'r1',
      nome: 'Visitas por loja',
      descricao: null,
      entidade: 'visita',
      definicao: { entidade: 'visita', periodo: { preset: 'mes_atual' }, filtros: { combinador: 'E', regras: [] }, agrupar: [], metricas: [{ chave: 'visitas' }], comparar: null },
      compartilhado: true,
      padrao: false,
      chave: null,
      pode_editar: true,
      fixado_empresa: false,
      created_at: '',
      updated_at: '',
    });
    vi.mocked(api.executarRelatorioPersonalizado).mockResolvedValue(resultado({ totais: { visitas: 3 } }));
    vi.mocked(api.buscarOpcoesFiltro).mockResolvedValue([{ valor: 'rede-1', rotulo: 'Rede Norte' }]);
    const usuario = userEvent.setup();

    render(
      <QueryClientProvider client={criarQueryClientDeTeste()}>
        <MemoryRouter initialEntries={['/relatorios-personalizados/r1']}>
          <Routes>
            <Route path="/relatorios-personalizados/:id" element={<RelatorioPersonalizadoPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await usuario.click(await screen.findByRole('button', { name: 'Filtrar' }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Rede' }));
    const dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByLabelText('Valores'));
    await usuario.click(await screen.findByRole('option', { name: 'Rede Norte' }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aplicar filtro' }));

    await waitFor(() =>
      expect(api.executarRelatorioPersonalizado).toHaveBeenLastCalledWith(
        'r1',
        expect.objectContaining({ filtros: JSON.stringify([{ campo: 'rede', operador: 'em', valor: ['rede-1'] }]) }),
      ),
    );
    expect(screen.getByText('Rede: Rede Norte')).toBeInTheDocument();
  }, LIMITE_EDITOR);
});

describe('Operação do campo em Valores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listarEntidadesRelatorio).mockResolvedValue([{ chave: 'visita', rotulo: 'Visitas realizadas' }]);
    vi.mocked(api.buscarCatalogoEntidade).mockResolvedValue(catalogo);
    vi.mocked(api.executarDefinicao).mockImplementation(async (d) => resultado({ definicao_resolvida: d }));
  });

  it('campo em Valores entra como contagem distinta e troca de operação no chip', async () => {
    const usuario = userEvent.setup();
    renderComProviders(<RelatorioEditorPage />, { rota: '/relatorios-personalizados/novo' });

    // A lista mostra o campo, não uma métrica por operação.
    await screen.findByText('Visitas');
    expect(screen.queryByText('Contagem distinta de Loja')).not.toBeInTheDocument();

    await usuario.click(screen.getByText('Loja'));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Adicionar em Valores' }));
    await waitFor(() => expect(api.executarDefinicao).toHaveBeenLastCalledWith(expect.objectContaining({ metricas: [{ chave: 'contagem_distinta:loja' }] })), {
      timeout: 3000,
    });

    await usuario.click(screen.getByRole('button', { name: 'Operação de Loja' }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Moda' }));
    await waitFor(() => expect(api.executarDefinicao).toHaveBeenLastCalledWith(expect.objectContaining({ metricas: [{ chave: 'moda:loja' }] })), {
      timeout: 3000,
    });
  }, LIMITE_EDITOR);
});

describe('Visualizacao — matriz', () => {
  it('desenha colunas do pivot, a coluna Total e o rodapé com os subtotais do backend', () => {
    const r = resultado({
      definicao_resolvida: {
        entidade: 'ordem_servico',
        periodo: {},
        filtros: { combinador: 'E', regras: [] },
        agrupar: [{ campo: 'promotor', eixo: 'linha' }, { campo: 'origem', eixo: 'coluna' }],
        metricas: [{ chave: 'cumprimento' }],
        comparar: null,
      },
      colunas: [
        { chave: 'promotor', rotulo: 'Promotor', tipo: 'dimensao' },
        { chave: 'origem', rotulo: 'Origem', tipo: 'dimensao' },
        { chave: 'cumprimento', rotulo: 'Cumprimento', tipo: 'percentual' },
      ],
      linhas: [
        { dimensoes: { promotor: { chave: 'a', rotulo: 'Ana' }, origem: { chave: 'AGENDA', rotulo: 'Agenda' } }, valores: { cumprimento: 100 } },
        { dimensoes: { promotor: { chave: 'a', rotulo: 'Ana' }, origem: { chave: 'MANUAL', rotulo: 'Manual' } }, valores: { cumprimento: 0 } },
      ],
      subtotais: {
        linhas: [{ dimensoes: { promotor: { chave: 'a', rotulo: 'Ana' } }, valores: { cumprimento: 50 } }],
        colunas: [
          { dimensoes: { origem: { chave: 'AGENDA', rotulo: 'Agenda' } }, valores: { cumprimento: 100 } },
          { dimensoes: { origem: { chave: 'MANUAL', rotulo: 'Manual' } }, valores: { cumprimento: 0 } },
        ],
      },
      totais: { cumprimento: 50 },
    });

    render(
      <QueryClientProvider client={criarQueryClientDeTeste()}>
        <MemoryRouter>
          <Visualizacao resultado={r} visual="tabela" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const tabela = screen.getByRole('table');
    const cabecalho = within(tabela).getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalho).toEqual(['Promotor', 'Agenda', 'Manual', 'Total']);
    const [, linhaAna, rodape] = within(tabela).getAllByRole('row');
    expect(within(linhaAna).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Ana', '100%', '0%', '50%']);
    expect(within(rodape).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Total', '100%', '0%', '50%']);
  });
});

describe('Visualizacao — moda', () => {
  it('mostra a moda como texto no KPI e na tabela', () => {
    const r = resultado({
      definicao_resolvida: { entidade: 'visita', periodo: {}, filtros: { combinador: 'E', regras: [] }, agrupar: [{ campo: 'loja', eixo: 'linha' }], metricas: [{ chave: 'moda:promotor' }], comparar: null },
      colunas: [
        { chave: 'loja', rotulo: 'Loja', tipo: 'dimensao' },
        { chave: 'moda:promotor', rotulo: 'Moda — Promotor', tipo: 'texto' },
      ],
      linhas: [{ dimensoes: { loja: { chave: 'l1', rotulo: 'Loja A' } }, valores: { 'moda:promotor': 'Bruno' } }],
      totais: { 'moda:promotor': 'Ana' },
    });

    render(
      <QueryClientProvider client={criarQueryClientDeTeste()}>
        <MemoryRouter>
          <Visualizacao resultado={r} visual="tabela" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0);
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });
});
