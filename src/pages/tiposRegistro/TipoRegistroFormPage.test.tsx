import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../lib/auth/AuthContext';
import { criarQueryClientDeTeste } from '../../test/renderWithProviders';
import type { TipoRegistro } from '../../types/api';
import { TipoRegistroFormPage } from './TipoRegistroFormPage';

vi.mock('../../lib/api/tiposRegistro');
vi.mock('../../lib/api/campanhas');
vi.mock('../../lib/api/redesLojas');
vi.mock('../../lib/api/pontosVenda');
vi.mock('../../lib/api/secoes');
vi.mock('../../lib/api/departamentos');
vi.mock('../../lib/api/marcas');
vi.mock('../../lib/api/produtos');

import * as campanhasApi from '../../lib/api/campanhas';
import * as redesApi from '../../lib/api/redesLojas';
import * as tiposApi from '../../lib/api/tiposRegistro';

const meta = { current_page: 1, last_page: 1, per_page: 15, total: 0 };

function tipoSalvo(): TipoRegistro {
  return {
    id: 'tipo-1',
    descricao: 'Pesquisa de Preço Igor',
    icone: 'cash',
    ordem: 1,
    exige_foto: false,
    permite_vincular_catalogo: true,
    acao_obrigatoria: true,
    escopo_acao: 'SEMPRE',
    campanha_auditoria_uuid: null,
    granularidade_padrao: 'PRODUTO',
    produtos_predefinidos: [
      { id: 'p1', descricao: 'Big Tekitos 900g', codigo_barras: null, codigo_externo: null },
      { id: 'p2', descricao: 'Chicken Supreme', codigo_barras: null, codigo_externo: null },
    ],
    excecoes_granularidade: [],
    eh_ruptura: false,
    eh_alerta: false,
    usa_pontuacao: false,
    disponivel_registro_livre: false,
    campos: [
      {
        id: 'c1',
        chave: 'preco_atual',
        rotulo: 'Preço atual',
        tipo_campo: 'MOEDA',
        opcoes: null,
        obrigatorio: true,
        ordem: 0,
        limite_dias_retroativos: null,
        depende_de_chave: null,
        depende_de_valor: null,
        sortimento_origem: null,
        sortimento_tipo_vinculo: null,
        sortimento_secao: null,
        sortimento_departamento: null,
        sortimento_marca: null,
        sortimento_produtos: [],
        confirmar_ruptura_ausentes: false,
      },
    ],
    ativo: true,
    created_at: '',
    updated_at: '',
  } as unknown as TipoRegistro;
}

function renderizar(rota: string) {
  return render(
    <QueryClientProvider client={criarQueryClientDeTeste()}>
      <MemoryRouter initialEntries={[rota]}>
        <AuthProvider>
          <Routes>
            <Route path="/tipos-registro/novo" element={<TipoRegistroFormPage />} />
            <Route path="/tipos-registro/:publicId" element={<TipoRegistroFormPage />} />
            <Route path="/tipos-registro" element={<div>lista de formulários</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TipoRegistroFormPage (editor de formulário)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(campanhasApi.listarCampanhas).mockResolvedValue({ campanhas: [], meta } as never);
    vi.mocked(redesApi.listarRedesLojas).mockResolvedValue({ redes_lojas: [], meta } as never);
    vi.mocked(tiposApi.listarTiposRegistro).mockResolvedValue({ tipos_registro: [], meta } as never);
    vi.mocked(tiposApi.criarTipoRegistro).mockResolvedValue({ tipo_registro: tipoSalvo() } as never);
    // jsdom não implementa scrollIntoView (usado pelas abas).
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('cria formulário obrigatório com uma pergunta de valor, gerando o código interno do texto', async () => {
    const user = userEvent.setup();
    renderizar('/tipos-registro/novo');

    await user.type(screen.getByPlaceholderText('Ex.: Pesquisa de Preço'), 'Pesquisa de Preço');
    await user.click(screen.getByText('Em toda visita'));

    await user.click(screen.getByRole('button', { name: /Adicionar pergunta/ }));
    const pergunta = await screen.findByPlaceholderText('Ex.: Preço atual');
    await user.type(pergunta, 'Preço atual');
    await user.click(screen.getByText('Valor (R$)'));
    await user.click(screen.getByLabelText('Obrigatória'));
    expect(screen.getByText('preco_atual')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Criar formulário' }));

    await waitFor(() => expect(tiposApi.criarTipoRegistro).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(tiposApi.criarTipoRegistro).mock.calls[0][0];
    expect(payload).toMatchObject({
      descricao: 'Pesquisa de Preço',
      acao_obrigatoria: true,
      escopo_acao: 'SEMPRE',
      disponivel_registro_livre: false,
      campos: [{ chave: 'preco_atual', rotulo: 'Preço atual', tipo_campo: 'MOEDA', obrigatorio: true }],
    });
  });

  it('bloqueia salvar sem nome e mostra o motivo', async () => {
    const user = userEvent.setup();
    renderizar('/tipos-registro/novo');

    await user.click(screen.getByRole('button', { name: 'Criar formulário' }));

    expect(await screen.findAllByText('Dê um nome ao formulário')).not.toHaveLength(0);
    expect(tiposApi.criarTipoRegistro).not.toHaveBeenCalled();
  });

  it('abre um formulário existente com as opções certas, produtos e resumo', async () => {
    vi.mocked(tiposApi.buscarTipoRegistro).mockResolvedValue({ tipo_registro: tipoSalvo() } as never);
    renderizar('/tipos-registro/tipo-1');

    expect(await screen.findByText('Tudo salvo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pesquisa de Preço Igor')).toBeInTheDocument();
    expect(screen.getAllByText('Big Tekitos 900g').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chicken Supreme').length).toBeGreaterThan(0);
    // Resumo em linguagem de gente, na lateral.
    const resumo = screen.getByText('Resumo').parentElement!;
    expect(within(resumo).getByText(/cada um dos 2 produtos/)).toBeInTheDocument();
    expect(within(resumo).getByText(/preço atual/)).toBeInTheDocument();
  });

  it('aba "Perguntas" entra no modo foco: as outras seções viram resumo com Editar', async () => {
    vi.mocked(tiposApi.buscarTipoRegistro).mockResolvedValue({ tipo_registro: tipoSalvo() } as never);
    const user = userEvent.setup();
    renderizar('/tipos-registro/tipo-1');
    await screen.findByText('Tudo salvo');

    await user.click(screen.getAllByText('Perguntas')[0]);

    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(4);
    expect(screen.queryByPlaceholderText('Ex.: Pesquisa de Preço')).not.toBeInTheDocument();
    expect(screen.getByText('Em toda visita — Qualquer loja visitada')).toBeInTheDocument();
  });

  it('prévia imita o app: lista guiada de produtos, abre o produto e marca como preenchido', async () => {
    vi.mocked(tiposApi.buscarTipoRegistro).mockResolvedValue({ tipo_registro: tipoSalvo() } as never);
    const user = userEvent.setup();
    renderizar('/tipos-registro/tipo-1');
    await screen.findByText('Tudo salvo');

    const previa = screen.getByText('Prévia no app').closest('.MuiPaper-root') as HTMLElement;
    expect(within(previa).getByText('0 de 2 produtos preenchidos')).toBeInTheDocument();
    expect(within(previa).getByText('Salvar (faltam 2)')).toBeInTheDocument();

    await user.click(within(previa).getByText('Chicken Supreme'));
    expect(within(previa).getByText('Preço atual * (R$)')).toBeInTheDocument();
    expect(within(previa).getByPlaceholderText('0,00')).toBeInTheDocument();
    // Com produto já definido pela lista, o app não pede "Vincular a".
    expect(within(previa).queryByText(/Vincular a/)).not.toBeInTheDocument();

    await user.click(within(previa).getByText('Salvar produto'));
    expect(within(previa).getByText('1 de 2 produtos preenchido')).toBeInTheDocument();
    expect(within(previa).getByText('Salvar (faltam 1)')).toBeInTheDocument();
  });
});
