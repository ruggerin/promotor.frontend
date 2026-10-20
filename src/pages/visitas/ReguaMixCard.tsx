import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
  Box,
  Checkbox,
  Chip,
  Collapse,
  FormControlLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme, type Theme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import type { ItemReguaMix, ReguaMix, SituacaoMix } from '../../lib/api/visitas';

type Nivel = 'produto' | 'secao' | 'marca' | 'departamento';

const CHAVE_NIVEL = 'visita-detalhe:nivel-mix';
const ORDEM: SituacaoMix[] = ['registrado', 'recorte', 'ruptura', 'sem_registro'];

const ROTULO: Record<SituacaoMix, string> = {
  registrado: 'Registrado',
  recorte: 'Pelo recorte',
  ruptura: 'Ruptura',
  sem_registro: 'Sem registro',
};

const LEGENDA: Record<SituacaoMix, string> = {
  registrado: 'Registrado no produto',
  recorte: 'Coberto pelo recorte',
  ruptura: 'Ruptura',
  sem_registro: 'Sem registro',
};

const COR_CHIP: Record<SituacaoMix, 'success' | 'primary' | 'error' | 'default'> = {
  registrado: 'success',
  recorte: 'primary',
  ruptura: 'error',
  sem_registro: 'default',
};

function corDa(t: Theme, s: SituacaoMix): string {
  return { registrado: t.palette.success.main, recorte: t.palette.primary.main, ruptura: t.palette.error.main, sem_registro: t.palette.divider }[s];
}

const coberto = (i: ItemReguaMix) => i.situacao !== 'sem_registro';

function lerNivel(): Nivel {
  try {
    const salvo = localStorage.getItem(CHAVE_NIVEL);
    if (salvo === 'produto' || salvo === 'secao' || salvo === 'marca' || salvo === 'departamento') return salvo;
  } catch {
    // Sem storage (aba anônima, bloqueio): fica no padrão.
  }
  return 'secao';
}

/** Barra empilhada pelos 4 estados. */
export function BarraMix({ itens, altura = 8 }: { itens: ItemReguaMix[]; altura?: number }) {
  const t = useTheme();
  return (
    <Box sx={{ height: altura, borderRadius: altura / 2, bgcolor: 'action.hover', display: 'flex', overflow: 'hidden' }}>
      {ORDEM.map((s) => {
        const n = itens.filter((i) => i.situacao === s).length;
        return n > 0 ? <Box key={s} sx={{ width: `${(n / itens.length) * 100}%`, bgcolor: corDa(t, s) }} /> : null;
      })}
    </Box>
  );
}

function TabelaProdutos({ itens }: { itens: ItemReguaMix[] }) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Produto</TableCell>
            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Marca</TableCell>
            <TableCell>Situação</TableCell>
            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Onde foi registrado</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {itens.map((i) => (
            <TableRow key={i.produto_id ?? i.descricao}>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                  {i.descricao}
                  {i.produto_chave && <Chip size="small" color="warning" label="Chave" sx={{ height: 20 }} />}
                  {i.adicionado_na_visita && <Chip size="small" variant="outlined" label="Entrou na visita" sx={{ height: 20 }} />}
                </Box>
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{i.marca ?? '—'}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={COR_CHIP[i.situacao]}
                  variant={i.situacao === 'sem_registro' ? 'outlined' : 'filled'}
                  label={ROTULO[i.situacao]}
                  sx={{ height: 22 }}
                />
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary' }}>{i.onde.length ? i.onde.join(' · ') : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function Grupo({ nome, itens, soPendentes }: { nome: string; itens: ItemReguaMix[]; soPendentes: boolean }) {
  const feitos = itens.filter(coberto).length;
  const [aberto, setAberto] = useState(feitos < itens.length);
  const visiveis = soPendentes ? itens.filter((i) => !coberto(i)) : itens;
  if (visiveis.length === 0) return null;
  const selo = feitos === itens.length ? { cor: 'success' as const, rotulo: 'Completa' } : feitos > 0 ? { cor: 'warning' as const, rotulo: 'Parcial' } : { cor: 'error' as const, rotulo: 'Sem registro' };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, boxShadow: 'none', overflow: 'hidden' }}>
      <Box
        component="button"
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        sx={{
          all: 'unset',
          boxSizing: 'border-box',
          width: '100%',
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr) 44px 104px', sm: 'minmax(0,1fr) 140px 44px 104px' },
          gap: 1.5,
          alignItems: 'center',
          px: 1.5,
          py: 1,
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', transition: 'transform .15s', transform: aberto ? 'rotate(90deg)' : 'none' }} />
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            {nome}
          </Typography>
        </Box>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <BarraMix itens={itens} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
          {feitos}/{itens.length}
        </Typography>
        <Box sx={{ justifySelf: 'end' }}>
          <Chip size="small" color={selo.cor} variant="outlined" label={selo.rotulo} sx={{ height: 22 }} />
        </Box>
      </Box>
      <Collapse in={aberto} unmountOnExit>
        <TabelaProdutos itens={visiveis} />
      </Collapse>
    </Paper>
  );
}

/**
 * Régua do mix (docs/90 §3.3): os produtos do mix da loja no dia da visita (cópia gravada no
 * check-out) e o que teve registro, em qualquer formulário — por produto, seção, marca ou
 * departamento. Grupos incompletos já abrem expandidos.
 */
export function ReguaMixCard({ regua, cardSx }: { regua: ReguaMix; cardSx: object }) {
  const t = useTheme();
  const [nivel, setNivel] = useState<Nivel>(lerNivel);
  const [soPendentes, setSoPendentes] = useState(false);

  const grupos = useMemo(() => {
    if (nivel === 'produto') return [];
    const campo = nivel === 'secao' ? 'secao' : nivel === 'marca' ? 'marca' : 'departamento';
    const porNome = new Map<string, ItemReguaMix[]>();
    for (const i of regua.itens) {
      const nome = i[campo] ?? 'Sem ' + (nivel === 'secao' ? 'seção' : nivel);
      porNome.set(nome, [...(porNome.get(nome) ?? []), i]);
    }
    return [...porNome.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [regua.itens, nivel]);

  function trocarNivel(n: Nivel) {
    setNivel(n);
    try {
      localStorage.setItem(CHAVE_NIVEL, n);
    } catch {
      // Só não lembra a escolha.
    }
  }

  const pendentes = regua.itens.filter((i) => !coberto(i));
  const gravado = regua.gravado_em
    ? new Date(regua.gravado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Paper variant="outlined" sx={{ ...cardSx, p: 2, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChecklistOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Régua do mix
            </Typography>
            <Chip size="small" label={`${regua.percentual}% · ${regua.cobertos} de ${regua.total}`} sx={{ height: 22, fontWeight: 700 }} />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Produtos do mix da loja no dia e o que teve registro, em qualquer formulário.
          </Typography>
        </Box>
        {gravado && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <LockOutlinedIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">Mix do dia da visita · gravado no check-out {gravado}</Typography>
          </Box>
        )}
      </Box>

      <BarraMix itens={regua.itens} />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {ORDEM.map((s) => (
          <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: corDa(t, s) }} />
            <Typography variant="caption" color="text.secondary">
              {LEGENDA[s]} {regua.contagem[s]}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={nivel}
          onChange={(_, v) => v && trocarNivel(v)}
          aria-label="Ver por"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5 } }}
        >
          <ToggleButton value="produto">Produto</ToggleButton>
          <ToggleButton value="secao">Seção</ToggleButton>
          <ToggleButton value="marca">Marca</ToggleButton>
          <ToggleButton value="departamento">Departamento</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Checkbox size="small" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />}
          label={<Typography variant="body2" color="text.secondary">Só sem registro ({pendentes.length})</Typography>}
        />
      </Box>

      {soPendentes && pendentes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Todos os produtos do mix tiveram registro.
        </Typography>
      ) : nivel === 'produto' ? (
        <Paper variant="outlined" sx={{ borderRadius: 1, boxShadow: 'none', overflow: 'hidden' }}>
          <TabelaProdutos itens={soPendentes ? pendentes : regua.itens} />
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {grupos.map(([nome, itens]) => (
            <Grupo key={`${nivel}:${nome}`} nome={nome} itens={itens} soPendentes={soPendentes} />
          ))}
        </Box>
      )}
    </Paper>
  );
}
