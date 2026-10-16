import { Autocomplete, Box, FormControlLabel, MenuItem, Radio, RadioGroup, Switch, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Controller, useWatch, type Control } from 'react-hook-form';
import { listarTiposRegistro } from '../../../lib/api/tiposRegistro';
import type { FormData } from './modelo';

// "Ainda está lá?" (docs/83 §3.1): gatilho, frequência, textos dos botões, o que fazer ao
// continuar e ao acabar, e prazo máximo. O botão "Não consegui ver" é fixo.

const AO_CONTINUAR = [
  { valor: 'CONFIRMA', titulo: 'Só confirmar', sub: 'Um toque. Ex.: o ponto extra ainda está lá.' },
  { valor: 'FORMULARIO_PREENCHIDO', titulo: 'Abrir o formulário com a última coleta', sub: 'O promotor só ajusta o que mudou (preço, produtos).' },
  { valor: 'FORMULARIO_CEGO', titulo: 'Abrir o formulário vazio (conferência cega)', sub: 'Sem mostrar o que foi respondido antes. Evita "copiar e colar".' },
] as const;

export function SecaoAcompanhamento({ control, tipoAtualId }: { control: Control<FormData>; tipoAtualId: string | null }) {
  const acompanha = useWatch({ control, name: 'acompanha' });
  const campos = useWatch({ control, name: 'campos' });
  const gatilho = useWatch({ control, name: 'acompanha_gatilho_chave' });
  // Gatilho: perguntas do próprio formulário, menos Mix (o servidor recusa).
  const perguntas = (campos ?? []).filter((c) => c.tipo_campo !== 'SORTIMENTO' && c.chave);
  const perguntaGatilho = perguntas.find((c) => c.chave === gatilho);

  const formulariosQuery = useQuery({
    queryKey: ['tipos-registro', 'justificativa'],
    queryFn: () => listarTiposRegistro({ ativo: true, por_pagina: 200 }),
    enabled: acompanha,
  });
  const formularios = (formulariosQuery.data?.tipos_registro ?? [])
    .filter((t) => t.id !== tipoAtualId)
    .map((t) => ({ id: t.id, descricao: t.descricao }));

  return (
    <Box>
      <Controller
        name="acompanha"
        control={control}
        render={({ field }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Acompanhar este registro nas próximas visitas
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Vira um cartão na aba Ações pra qualquer promotor que fizer check-in na loja, até alguém responder que acabou.
              </Typography>
            </Box>
            <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} slotProps={{ input: { 'aria-label': 'Acompanhar na próxima visita' } }} />
          </Box>
        )}
      />

      {acompanha && (
        <Box sx={{ display: 'grid', gap: 2.5, mt: 2.5 }}>
          {/* Gatilho */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Quando abrir o acompanhamento
            </Typography>
            <Controller
              name="acompanha_gatilho_chave"
              control={control}
              render={({ field }) => (
                <RadioGroup value={field.value ? 'PERGUNTA' : 'TODO'} onChange={(e) => field.onChange(e.target.value === 'TODO' ? null : (perguntas[0]?.chave ?? null))}>
                  <FormControlLabel value="TODO" control={<Radio size="small" />} label={<Typography variant="body2">Em todo registro deste formulário</Typography>} />
                  <FormControlLabel
                    value="PERGUNTA"
                    disabled={perguntas.length === 0}
                    control={<Radio size="small" />}
                    label={<Typography variant="body2">Só quando uma pergunta tiver certa resposta</Typography>}
                  />
                </RadioGroup>
              )}
            />
            {gatilho && (
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1, pl: 4 }}>
                <Controller
                  name="acompanha_gatilho_chave"
                  control={control}
                  render={({ field }) => (
                    <TextField select size="small" label="Pergunta" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} sx={{ minWidth: 240 }}>
                      {perguntas.map((c) => (
                        <MenuItem key={c.chave} value={c.chave}>
                          {c.rotulo || c.chave}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <Controller
                  name="acompanha_gatilho_valor"
                  control={control}
                  render={({ field, fieldState }) =>
                    perguntaGatilho?.tipo_campo === 'BOOLEANO' || perguntaGatilho?.tipo_campo === 'MULTIPLA_ESCOLHA' ? (
                      <TextField
                        select
                        size="small"
                        label="Resposta"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        sx={{ minWidth: 180 }}
                      >
                        {(perguntaGatilho.tipo_campo === 'BOOLEANO'
                          ? [
                              { v: '1', r: 'Sim' },
                              { v: '0', r: 'Não' },
                            ]
                          : perguntaGatilho.opcoesTexto.split(',').map((o) => ({ v: o.trim(), r: o.trim() })).filter((o) => o.v)
                        ).map((o) => (
                          <MenuItem key={o.v} value={o.v}>
                            {o.r}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField
                        size="small"
                        label="Resposta"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )
                  }
                />
              </Box>
            )}
          </Box>

          {/* Frequência */}
          <Controller
            name="acompanha_intervalo_dias"
            control={control}
            render={({ field, fieldState }) => (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Conferir de novo a cada
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={Number.isNaN(field.value) ? '' : field.value}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    slotProps={{ htmlInput: { min: 0, max: 365, step: 1, 'aria-label': 'Dias entre conferências' } }}
                    sx={{ width: 110 }}
                  />
                  <Typography variant="body2">dias</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  0 = confere em toda visita (ex.: validade). 7 = volta 7 dias depois da última resposta (ex.: ponto extra).
                </Typography>
              </Box>
            )}
          />

          {/* Botões */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
              Texto dos botões
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Controller
                name="acompanha_rotulo_continua"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    size="small"
                    label="Quando continua"
                    placeholder="Ainda está lá"
                    {...field}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    sx={{ minWidth: 220 }}
                  />
                )}
              />
              <Controller
                name="acompanha_rotulo_acabou"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    size="small"
                    label="Quando acabou"
                    placeholder="Não está mais"
                    {...field}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    sx={{ minWidth: 220 }}
                  />
                )}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Ex.: ruptura "Ainda falta" / "Já tem o produto". O app sempre mostra também "Não consegui ver", que adia pra próxima visita.
            </Typography>
          </Box>

          {/* Ao continuar */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Quando continua
            </Typography>
            <Controller
              name="acompanha_ao_continuar"
              control={control}
              render={({ field }) => (
                <RadioGroup value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                  {AO_CONTINUAR.map((o) => (
                    <FormControlLabel
                      key={o.valor}
                      value={o.valor}
                      control={<Radio size="small" />}
                      label={
                        <Box>
                          <Typography variant="body2">{o.titulo}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {o.sub}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </RadioGroup>
              )}
            />
          </Box>

          {/* Ao acabar */}
          <Controller
            name="acompanha_formulario_acabou"
            control={control}
            render={({ field }) => (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                  Quando acabou, pedir justificativa (opcional)
                </Typography>
                <Autocomplete
                  size="small"
                  sx={{ maxWidth: 420 }}
                  options={formularios}
                  getOptionLabel={(o) => o.descricao}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  loading={formulariosQuery.isLoading}
                  value={field.value}
                  onChange={(_, v) => field.onChange(v)}
                  renderInput={(params) => <TextField {...params} label="Formulário de justificativa" placeholder="Nenhum: só encerra" />}
                />
                <Typography variant="caption" color="text.secondary">
                  Ex.: "Por que o ponto extra saiu?" com foto. Sem formulário, "acabou" só encerra.
                </Typography>
              </Box>
            )}
          />

          {/* Prazo */}
          <Controller
            name="acompanha_prazo_dias"
            control={control}
            render={({ field, fieldState }) => (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Encerrar sozinho depois de (opcional)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    slotProps={{ htmlInput: { min: 1, max: 3650, step: 1, 'aria-label': 'Prazo máximo em dias' } }}
                    sx={{ width: 110 }}
                  />
                  <Typography variant="body2">dias</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Vazio = só termina quando alguém responder. Vencido, o acompanhamento encerra como expirado.
                </Typography>
              </Box>
            )}
          />
        </Box>
      )}
    </Box>
  );
}
