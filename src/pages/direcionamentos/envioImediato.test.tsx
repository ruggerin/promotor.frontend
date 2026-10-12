import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as direcionamentosApi from '../../lib/api/direcionamentos';
import * as pontosVendaApi from '../../lib/api/pontosVenda';
import * as redesLojasApi from '../../lib/api/redesLojas';
import * as tiposRegistroApi from '../../lib/api/tiposRegistro';
import * as usuariosApi from '../../lib/api/usuarios';
import { renderComProviders } from '../../test/renderWithProviders';
import type { TipoRegistro } from '../../types/api';
import { DirecionamentoFormDialog } from './DirecionamentoFormDialog';
import { valoresEnvioImediato } from './envioImediato';

vi.mock('../../lib/api/direcionamentos');
vi.mock('../../lib/api/pontosVenda');
vi.mock('../../lib/api/redesLojas');
vi.mock('../../lib/api/tiposRegistro');
vi.mock('../../lib/api/usuarios');

const META = { current_page: 1, last_page: 1, per_page: 200, total: 0 };

function tipo(extra: Partial<TipoRegistro> = {}): TipoRegistro {
  return {
    id: 'form-1',
    descricao: 'Auditoria de expositor',
    ativo: true,
    acao_obrigatoria: true,
    escopo_acao: 'SEMPRE',
    campanha_auditoria_uuid: null,
    ...extra,
  } as TipoRegistro;
}

describe('valoresEnvioImediato (docs/66)', () => {
  const agora = new Date(2026, 9, 10, 14, 30);

  it('começa 1 minuto antes de agora e termina no fim do dia', () => {
    const v = valoresEnvioImediato(tipo(), [], agora);
    expect(v.vigencia_inicio).toBe('2026-10-10T14:29');
    expect(v.vigencia_fim).toBe('2026-10-10T23:59');
    expect(v.descricao).toBe('Auditoria de expositor — envio imediato');
    expect(v.formularios).toEqual([{ tipo_registro_uuid: 'form-1', descricao: 'Auditoria de expositor', obrigatorio: true, calcula_percentual_compliance: false }]);
  });

  it('escopo define as lojas: LOJA_REDE usa as do formulário, CONTRATO as com contrato, SEMPRE nenhuma (= todas)', () => {
    const lojaRede = valoresEnvioImediato(
      tipo({ escopo_acao: 'LOJA_REDE', pontos_venda_escopo: [{ id: 'l1', fantasia: 'Loja 1' }], redes_lojas_escopo: [{ id: 'r1', descricao: 'Rede Norte' }] }),
      [],
      agora,
    );
    expect(lojaRede.pontos_venda).toEqual([{ uuid: 'l1', fantasia: 'Loja 1' }]);
    expect(lojaRede.redes_loja).toEqual([{ uuid: 'r1', descricao: 'Rede Norte' }]);

    const contrato = valoresEnvioImediato(tipo({ escopo_acao: 'CONTRATO' }), [{ id: 'l9', fantasia: 'Com contrato' }], agora);
    expect(contrato.pontos_venda).toEqual([{ uuid: 'l9', fantasia: 'Com contrato' }]);

    expect(valoresEnvioImediato(tipo({ escopo_acao: 'SEMPRE' }), [], agora).pontos_venda).toEqual([]);
    // Sem ação obrigatória, o escopo não vale — vai pra todas as lojas.
    expect(valoresEnvioImediato(tipo({ acao_obrigatoria: false, escopo_acao: 'LOJA_REDE', pontos_venda_escopo: [{ id: 'l1', fantasia: 'Loja 1' }] }), [], agora).pontos_venda).toEqual([]);
  });
});

describe('DirecionamentoFormDialog — envio imediato', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pontosVendaApi.listarPontosVenda).mockResolvedValue({ pontos_venda: [], meta: META });
    vi.mocked(redesLojasApi.listarRedesLojas).mockResolvedValue({ redes_lojas: [], meta: META } as unknown as Awaited<ReturnType<typeof redesLojasApi.listarRedesLojas>>);
    vi.mocked(usuariosApi.listarUsuarios).mockResolvedValue({ usuarios: [], meta: META } as unknown as Awaited<ReturnType<typeof usuariosApi.listarUsuarios>>);
    vi.mocked(tiposRegistroApi.listarTiposRegistro).mockResolvedValue({
      tipos_registro: [tipo()],
      meta: META,
    } as unknown as Awaited<ReturnType<typeof tiposRegistroApi.listarTiposRegistro>>);
  });

  function abrir(valores = valoresEnvioImediato(tipo())) {
    renderComProviders(<DirecionamentoFormDialog open direcionamento={null} valoresIniciais={valores} titulo="Enviar agora pro app" mostrarResultado onClose={() => {}} />);
  }

  it('cria e mostra quantas ordens de serviço foram geradas', async () => {
    vi.mocked(direcionamentosApi.criarDirecionamento).mockResolvedValue({
      direcionamento: { id: 'dir-1' },
      progresso: { ordens_geradas: 3 },
    } as unknown as Awaited<ReturnType<typeof direcionamentosApi.criarDirecionamento>>);
    const usuario = userEvent.setup();
    abrir();

    expect(await screen.findByDisplayValue('Auditoria de expositor — envio imediato')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText(/3 ordens de serviço criadas/)).toBeInTheDocument();
    const payload = vi.mocked(direcionamentosApi.criarDirecionamento).mock.calls[0][0];
    expect(payload.formularios).toEqual([{ tipo_registro_uuid: 'form-1', obrigatorio: true, calcula_percentual_compliance: false }]);
    expect(new Date(payload.vigencia_inicio).getTime()).toBeLessThanOrEqual(Date.now());
  }, 15_000);

  it('avisa quando nenhuma OS foi gerada', async () => {
    vi.mocked(direcionamentosApi.criarDirecionamento).mockResolvedValue({
      direcionamento: { id: 'dir-1' },
      progresso: { ordens_geradas: 0 },
    } as unknown as Awaited<ReturnType<typeof direcionamentosApi.criarDirecionamento>>);
    const usuario = userEvent.setup();
    abrir();

    await screen.findByDisplayValue('Auditoria de expositor — envio imediato');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Nenhuma ordem de serviço foi criada/)).toBeInTheDocument();
  }, 15_000);

  it('avisa quando o início escolhido está no futuro', async () => {
    const amanha = new Date(Date.now() + 24 * 3600 * 1000);
    abrir({ ...valoresEnvioImediato(tipo()), vigencia_inicio: valoresEnvioImediato(tipo(), [], amanha).vigencia_fim, vigencia_fim: valoresEnvioImediato(tipo(), [], amanha).vigencia_fim });

    await waitFor(() => expect(screen.getByText(/só serão criadas quando a vigência começar/)).toBeInTheDocument());
  }, 15_000);
});
