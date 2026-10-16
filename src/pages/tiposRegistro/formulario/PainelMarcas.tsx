import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import { Autocomplete, Box, Chip, FormControlLabel, IconButton, Switch, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { criarMarca, listarMarcas } from '../../../lib/api/marcas';
import { horus } from '../../../theme';
import type { FormData } from './modelo';

type MarcaDaLista = FormData['marcas_predefinidas'][number];

/**
 * "Cada marca concorrente" (docs/85 §3.1): as marcas da lista (só concorrentes; a ordem é a do
 * app), se o promotor pode cadastrar marca fora dela e se vale mais de uma embalagem por marca.
 */
export function PainelMarcas({ control }: { control: Control<FormData> }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const marcasQuery = useQuery({
    queryKey: ['marcas', 'concorrentes'],
    queryFn: () => listarMarcas({ propriedade: 'CONCORRENTE', ativo: true, por_pagina: 500 }),
  });
  const criarMutation = useMutation({
    mutationFn: (descricao: string) => criarMarca({ descricao, propriedade: 'CONCORRENTE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['marcas'] }),
  });

  return (
    <Box sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden' }}>
      <Controller
        name="marcas_predefinidas"
        control={control}
        render={({ field, fieldState }) => {
          const escolhidas = new Set(field.value.map((m) => m.uuid));
          const opcoes = (marcasQuery.data?.marcas ?? []).filter((m) => !escolhidas.has(m.id));
          const mover = (i: number, d: -1 | 1) => {
            const lista = [...field.value];
            [lista[i], lista[i + d]] = [lista[i + d], lista[i]];
            field.onChange(lista);
          };
          const adicionar = (m: MarcaDaLista) => field.onChange([...field.value, m]);
          const textoNovo = busca.trim();
          const podeCriar =
            textoNovo !== '' && !(marcasQuery.data?.marcas ?? []).some((m) => m.descricao.toLowerCase() === textoNovo.toLowerCase());

          return (
            <>
              <Box sx={{ px: 2, py: 1.25, bgcolor: horus.subcard, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Marcas da lista <Typography component="span" variant="body2" color="text.secondary">({field.value.length})</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Do cadastro de marcas com propriedade "Concorrente". A ordem é a que aparece no app.
                </Typography>
              </Box>
              <Box sx={{ px: 2, py: 1.5 }}>
                {field.value.length > 0 && (
                  <Box sx={{ display: 'grid', gap: 0.5, mb: 1.5 }}>
                    {field.value.map((m, i) => (
                      <Box key={m.uuid} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ width: 18 }}>
                          {i + 1}
                        </Typography>
                        <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                          {m.descricao}
                        </Typography>
                        {m.a_aprovar && <Chip size="small" color="warning" variant="outlined" label="a aprovar" />}
                        <IconButton size="small" aria-label={`Subir ${m.descricao}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" aria-label={`Descer ${m.descricao}`} disabled={i === field.value.length - 1} onClick={() => mover(i, 1)}>
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" aria-label={`Remover ${m.descricao}`} onClick={() => field.onChange(field.value.filter((x) => x.uuid !== m.uuid))}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
                <Autocomplete
                  size="small"
                  options={opcoes}
                  loading={marcasQuery.isLoading}
                  getOptionLabel={(o) => o.descricao}
                  value={null}
                  inputValue={busca}
                  onInputChange={(_, v, motivo) => motivo !== 'reset' && setBusca(v)}
                  onChange={(_, m) => {
                    if (!m) return;
                    adicionar({ uuid: m.id, descricao: m.descricao, a_aprovar: !!m.a_aprovar });
                    setBusca('');
                  }}
                  noOptionsText={podeCriar ? 'Nenhuma marca com esse nome' : 'Nenhuma marca concorrente'}
                  renderInput={(params) => <TextField {...params} label="Adicionar marca concorrente" placeholder="Ex.: Downy" />}
                  sx={{ maxWidth: 420 }}
                />
                {podeCriar && (
                  <Chip
                    sx={{ mt: 1 }}
                    icon={<AddIcon />}
                    label={`Cadastrar "${textoNovo}" como concorrente`}
                    disabled={criarMutation.isPending}
                    onClick={() =>
                      criarMutation.mutate(textoNovo, {
                        onSuccess: ({ marca }) => {
                          adicionar({ uuid: marca.id, descricao: marca.descricao, a_aprovar: false });
                          setBusca('');
                        },
                      })
                    }
                  />
                )}
                {fieldState.error && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                    {fieldState.error.message}
                  </Typography>
                )}
              </Box>
            </>
          );
        }}
      />
      <Box sx={{ px: 2, pb: 1.5, display: 'grid', gap: 0.5 }}>
        <Controller
          name="permite_marca_nova"
          control={control}
          render={({ field }) => (
            <OpcaoSwitch
              titulo="Promotor pode cadastrar marca que não está na lista"
              sub='Entra como "a aprovar" no cadastro de marcas. Os registros dela já ficam salvos.'
              valor={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          name="varias_embalagens"
          control={control}
          render={({ field }) => (
            <OpcaoSwitch
              titulo="Várias embalagens por marca"
              sub="Cada embalagem vira um registro: marca + embalagem + respostas."
              valor={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: horus.subcard }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Embalagem (sempre pedida)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Quantidade (número) + unidade (ml, L, g, kg, un). O R$ por litro/kg é calculado sozinho.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function OpcaoSwitch({ titulo, sub, valor, onChange }: { titulo: string; sub: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <FormControlLabel
      sx={{ mx: 0, alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}
      labelPlacement="start"
      control={<Switch checked={valor} onChange={(e) => onChange(e.target.checked)} slotProps={{ input: { 'aria-label': titulo } }} />}
      label={
        <Box sx={{ pt: 0.75 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {titulo}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        </Box>
      }
    />
  );
}
