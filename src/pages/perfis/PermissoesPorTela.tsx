import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { TELAS, type DefTela } from '../../lib/acesso/telas';
import { horus } from '../../theme';
import type { Permissao } from '../../types/api';

// Formulário de Perfil agrupado como o menu (docs/64 §4): cada tela é um checkbox e as ações dela
// ficam embaixo, só marcáveis com a tela marcada. Desmarcar a tela desmarca as ações junto.

/** Permissões que não são de tela: valem no app do promotor, em integração ou no header. */
const OUTRAS: { valor: Permissao; rotulo: string; ajuda: string }[] = [
  {
    valor: 'visitas.intervir',
    rotulo: 'Intervir em visita',
    ajuda: 'Cancelar, forçar checkout e corrigir horários, com motivo. Só tem efeito em Gestor.',
  },
  {
    valor: 'pontos_venda.visualizar_todos',
    rotulo: 'Ver todas as lojas no app',
    ajuda: 'Ignora o vínculo loja × promotor. Única que vale para Promotor.',
  },
  {
    valor: 'pedidos.gerenciar',
    rotulo: 'Gravar pedidos do ERP',
    ajuda: 'Para o usuário do integrador, não para digitação no admin.',
  },
];

/** Telas que no Perfil são uma ação de outra (ou regra fixa) e não ganham linha própria. */
const SEM_LINHA = new Set<DefTela['chave']>(['planejamento', 'importacao', 'perfis', 'manual', 'empresas']);

const NOTAS: Partial<Record<Permissao, string>> = {
  'ordens_servico.gerenciar': 'Também libera Agenda, Planejador, Direcionamentos e Visitas não realizadas.',
  'pontos_venda.gerenciar': 'Também libera a Importação de lojas e sortimento.',
  'catalogo.gerenciar': 'Também libera a Importação de produtos.',
};

const GRUPOS = [...new Set(TELAS.filter((t) => !SEM_LINHA.has(t.chave)).map((t) => t.grupo))];

export function PermissoesPorTela({
  valor,
  onChange,
  pedidosVendaHabilitado,
}: {
  valor: string[];
  onChange: (v: string[]) => void;
  pedidosVendaHabilitado: boolean;
}) {
  const tem = (p: Permissao) => valor.includes(p);
  const alternar = (p: Permissao, marcar: boolean, junto: Permissao[] = []) => {
    const sem = valor.filter((v) => v !== p && !junto.includes(v as Permissao));
    onChange(marcar ? [...sem, p] : sem);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
      {GRUPOS.map((grupo) => (
        <Box key={grupo}>
          <Typography sx={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: horus.textoFraco, mb: 0.25 }}>
            {grupo}
          </Typography>
          {TELAS.filter((t) => t.grupo === grupo && !SEM_LINHA.has(t.chave)).map((tela) => {
            // Tela com mais de uma permissão que libera (pedidos de venda): não tem checkbox próprio,
            // qualquer uma das ações dá acesso.
            const permTela = tela.libera?.length === 1 ? tela.libera[0] : null;
            const acoes = permTela ? (tela.acoes ?? []) : (tela.libera ?? []).map((p) => ({ valor: p, rotulo: rotuloPedidoVenda(p) }));
            const modulo = tela.chave === 'pedidos_venda' && !pedidosVendaHabilitado;
            const telaMarcada = permTela ? tem(permTela) : true;
            return (
              <Box key={tela.chave} sx={{ py: 0.25 }}>
                {permTela ? (
                  <FormControlLabel
                    sx={{ my: -0.5 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={telaMarcada}
                        onChange={(e) => alternar(permTela, e.target.checked, acoes.map((a) => a.valor))}
                      />
                    }
                    label={<Rotulo texto={tela.rotulo} ajuda={tela.ajuda} />}
                  />
                ) : (
                  <Box sx={{ pl: 0.5, py: 0.5 }}>
                    <Rotulo texto={tela.rotulo} ajuda={modulo ? 'Módulo não contratado' : tela.ajuda} />
                  </Box>
                )}
                {acoes.length > 0 && (
                  <Box sx={{ pl: permTela ? 4 : 2, display: 'flex', flexDirection: 'column' }}>
                    {acoes.map((acao) => (
                      <FormControlLabel
                        key={acao.valor}
                        sx={{ my: -0.75 }}
                        disabled={!telaMarcada || modulo}
                        control={<Checkbox size="small" checked={tem(acao.valor)} onChange={(e) => alternar(acao.valor, e.target.checked)} />}
                        label={<Rotulo texto={acao.rotulo} ajuda={NOTAS[acao.valor]} pequeno />}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      ))}

      <Box>
        <Typography sx={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: horus.textoFraco, mb: 0.25 }}>
          Outras permissões
        </Typography>
        {OUTRAS.map((o) => (
          <FormControlLabel
            key={o.valor}
            sx={{ display: 'flex', my: -0.5 }}
            control={<Checkbox size="small" checked={tem(o.valor)} onChange={(e) => alternar(o.valor, e.target.checked)} />}
            label={<Rotulo texto={o.rotulo} ajuda={o.ajuda} />}
          />
        ))}
      </Box>
    </Box>
  );
}

function rotuloPedidoVenda(p: Permissao): string {
  if (p === 'pedidos_venda.visualizar') return 'Ver os próprios pedidos';
  if (p === 'pedidos_venda.criar') return 'Tirar pedido (liga o modo Vendedor no app)';
  if (p === 'pedidos_venda.aprovar') return 'Autorizar preço abaixo do mínimo (vê os pedidos de todos)';
  return p;
}

function Rotulo({ texto, ajuda, pequeno }: { texto: string; ajuda?: string; pequeno?: boolean }) {
  return (
    <Box component="span" sx={{ display: 'block', lineHeight: 1.3, py: 0.5 }}>
      <Box component="span" sx={{ fontSize: pequeno ? 13 : 14 }}>
        {texto}
      </Box>
      {ajuda && (
        <Box component="span" sx={{ display: 'block', fontSize: 12, color: 'text.secondary' }}>
          {ajuda}
        </Box>
      )}
    </Box>
  );
}
