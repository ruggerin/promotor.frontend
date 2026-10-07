import { describe, expect, it } from 'vitest';
import appSource from '../../App.tsx?raw';
import { PERMISSOES_DE_TELA } from '../../lib/acesso/telas';
import type { Usuario } from '../../types/api';
import { CONTADORES_ZERADOS, caminhoAtivo, filtrarVisiveis, montarMenu } from './menuAdmin';

// docs/63 §1.6 (A2) — trava a estrutura do menu: toda tela navegável em exatamente um grupo,
// nenhum grupo vira gaveta de novo, e as regras de visibilidade por perfil.

function usuario(user_type: Usuario['user_type'], extra: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u1',
    nome: 'Teste',
    email: 't@t',
    user_type,
    ativo: true,
    avatar_url: null,
    foto_url: null,
    created_at: '',
    updated_at: '',
    ...extra,
  } as Usuario;
}

const adminComTudo = usuario('ADMIN', { empresa: { pedidos_venda_habilitado: true } as Usuario['empresa'] });

function caminhos(u: Usuario | null) {
  return filtrarVisiveis(montarMenu(u, CONTADORES_ZERADOS)).flatMap((g) => g.itens.map((i) => i.caminho));
}

// Rotas sem parâmetro que de propósito não estão no menu.
const FORA_DO_MENU = new Set(['/login', '/', '*', '/tipos-registro/novo', '/contratos/novo', '/relatorios-personalizados/novo']);

describe('menu do admin (docs/63)', () => {
  it('toda rota navegável aparece em exatamente um grupo', () => {
    const rotas = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]).filter((p) => !p.includes(':') && !FORA_DO_MENU.has(p));

    // SUPERADMIN só soma "Empresas" — junta os dois pra cobrir todas as telas.
    const todos = [...caminhos(adminComTudo), '/empresas'];
    for (const rota of rotas) {
      expect(todos.filter((c) => c === rota), rota).toHaveLength(1);
    }
    for (const c of todos) expect(rotas, `${c} não é rota do App.tsx`).toContain(c);
  });

  it('nenhum grupo passa de 7 itens fixos', () => {
    for (const g of montarMenu(adminComTudo, CONTADORES_ZERADOS)) {
      expect(g.itens.filter((i) => !i.fixado).length, g.rotulo).toBeLessThanOrEqual(7);
    }
  });

  it('fixados entram no grupo Relatórios e acendem sozinhos', () => {
    const grupos = filtrarVisiveis(montarMenu(adminComTudo, CONTADORES_ZERADOS, [{ id: 'abc', nome: 'Rupturas', alcance: 'meu' }]));
    const relatorios = grupos.find((g) => g.chave === 'relatorios');
    expect(relatorios?.itens.map((i) => i.rotulo)).toContain('Rupturas');
    expect(caminhoAtivo(grupos, '/relatorios-personalizados/abc')).toBe('/relatorios-personalizados/abc');
    expect(caminhoAtivo(grupos, '/relatorios-personalizados/outro')).toBe('/relatorios-personalizados');
  });

  it('GESTOR com todas as telas e sem ações não vê Perfis, Importação, Contratos nem Pedidos de venda', () => {
    const c = caminhos(
      usuario('GESTOR', {
        empresa: { pedidos_venda_habilitado: true } as Usuario['empresa'],
        perfil: { id: 'p', nome: 'Leitura', permissoes: PERMISSOES_DE_TELA },
      }),
    );
    expect(c).toContain('/operacao-do-dia');
    expect(c).toContain('/pontos-venda');
    expect(c).not.toContain('/perfis');
    expect(c).not.toContain('/importacao-dados');
    expect(c).not.toContain('/contratos');
    expect(c).not.toContain('/pedidos-venda');
  });

  it('GESTOR sem perfil só vê o Manual (docs/64)', () => {
    expect(caminhos(usuario('GESTOR', { perfil: null }))).toEqual(['/manual']);
  });

  it('tela desmarcada some do menu', () => {
    const semRelatorios = PERMISSOES_DE_TELA.filter((p) => p !== 'tela.relatorios');
    const c = caminhos(usuario('GESTOR', { perfil: { id: 'p', nome: 'X', permissoes: [...semRelatorios, 'planos_acao.visualizar'] } }));
    expect(c).not.toContain('/relatorios-personalizados');
    expect(c).not.toContain('/relatorios/tempo-na-loja');
    expect(c).toContain('/planos-acao');
  });

  it('SUPERADMIN vê Empresas e não vê as telas de gestão do dia', () => {
    const c = caminhos(usuario('SUPERADMIN'));
    expect(c).toContain('/empresas');
    expect(c).not.toContain('/operacao-do-dia');
    expect(c).not.toContain('/relatorios-personalizados');
  });

  it('grupo sem item visível não aparece', () => {
    const grupos = filtrarVisiveis(montarMenu(usuario('SUPERADMIN'), CONTADORES_ZERADOS));
    expect(grupos.map((g) => g.chave)).not.toContain('acompanhamento');
  });
});
