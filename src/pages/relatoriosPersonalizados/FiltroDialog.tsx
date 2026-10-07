import {
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { buscarOpcoesFiltro, type CampoCatalogo, type Operador } from '../../lib/api/relatoriosPersonalizados';
import { OPERADOR_LABELS, regraCompleta, type RegraFiltro } from './filtros';

/** Edita uma regra de filtro: operador e valores (lista fixa, busca na empresa ou Sim/Não). */
export function FiltroDialog({
  regra,
  campo,
  onFechar,
  onSalvar,
}: {
  regra: RegraFiltro | null;
  campo: CampoCatalogo | undefined;
  onFechar: () => void;
  onSalvar: (regra: RegraFiltro) => void;
}) {
  const [rascunho, setRascunho] = useState<RegraFiltro | null>(regra);
  const [busca, setBusca] = useState('');

  const fonte = campo?.tipo === 'relacao' ? campo.fonte : undefined;
  const opcoesQuery = useQuery({
    queryKey: ['relatorios-personalizados', 'opcoes', fonte, busca],
    queryFn: () => buscarOpcoesFiltro(fonte!, { busca }),
    enabled: Boolean(regra && fonte),
  });

  if (!rascunho || !campo) return null;
  const precisaValor = rascunho.operador === 'em' || rascunho.operador === 'nao_em';
  const valores = Array.isArray(rascunho.valor) ? rascunho.valor : [];
  const alterar = (parcial: Partial<RegraFiltro>) => setRascunho({ ...rascunho, ...parcial });

  return (
    <Dialog open={Boolean(regra)} onClose={onFechar} maxWidth="xs" fullWidth>
      <DialogTitle>Filtrar por {campo.rotulo.toLowerCase()}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {campo.operadores.length > 1 && (
            <TextField
              select
              label="Condição"
              value={rascunho.operador}
              onChange={(e) => alterar({ operador: e.target.value as Operador, valor: e.target.value === 'igual' ? true : rascunho.valor })}
            >
              {campo.operadores.map((op) => (
                <MenuItem key={op} value={op}>
                  {OPERADOR_LABELS[op]}
                </MenuItem>
              ))}
            </TextField>
          )}

          {precisaValor && campo.tipo === 'enum' && (
            <Stack>
              {(campo.opcoes ?? []).map((o) => (
                <FormControlLabel
                  key={o.valor}
                  label={o.rotulo}
                  control={
                    <Checkbox
                      size="small"
                      checked={valores.includes(o.valor)}
                      onChange={(e) => alterar({ valor: e.target.checked ? [...valores, o.valor] : valores.filter((v) => v !== o.valor) })}
                    />
                  }
                />
              ))}
            </Stack>
          )}

          {precisaValor && campo.tipo === 'relacao' && (
            <Autocomplete
              multiple
              filterSelectedOptions
              options={opcoesQuery.data ?? []}
              value={valores.map((v) => ({ valor: v, rotulo: rascunho.rotulos?.[v] ?? '…' }))}
              isOptionEqualToValue={(a, b) => a.valor === b.valor}
              getOptionLabel={(o) => o.rotulo}
              filterOptions={(x) => x}
              loading={opcoesQuery.isFetching}
              onInputChange={(_, texto, motivo) => motivo === 'input' && setBusca(texto)}
              onChange={(_, escolhidas) =>
                alterar({
                  valor: escolhidas.map((o) => o.valor),
                  rotulos: { ...rascunho.rotulos, ...Object.fromEntries(escolhidas.map((o) => [o.valor, o.rotulo])) },
                })
              }
              noOptionsText="Nada encontrado"
              renderInput={(params) => <TextField {...params} label="Valores" placeholder="Buscar…" />}
            />
          )}

          {rascunho.operador === 'igual' && (
            <RadioGroup row value={rascunho.valor === false ? 'nao' : 'sim'} onChange={(e) => alterar({ valor: e.target.value === 'sim' })}>
              <FormControlLabel value="sim" control={<Radio size="small" />} label="Sim" />
              <FormControlLabel value="nao" control={<Radio size="small" />} label="Não" />
            </RadioGroup>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variant="contained" disabled={!regraCompleta(rascunho)} onClick={() => onSalvar(rascunho)}>
          Aplicar filtro
        </Button>
      </DialogActions>
    </Dialog>
  );
}
