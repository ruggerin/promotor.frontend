import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { listarDepartamentos } from '../../lib/api/departamentos';
import { listarMarcas } from '../../lib/api/marcas';
import { listarNiveisExibicao } from '../../lib/api/niveisExibicao';
import { atualizarProduto, criarProduto } from '../../lib/api/produtos';
import { listarSecoes } from '../../lib/api/secoes';
import type { ProdutoAuditoria } from '../../types/api';

const schema = z.object({
  descricao: z.string().min(1, 'Obrigatório').max(255),
  // Sem exigir aqui — obrigatoriedade é parametrizável por empresa (CODIGO_BARRAS_OBRIGATORIO),
  // o backend decide e devolve 422 se faltar; o form só limita o tamanho.
  codigo_barras: z.string().max(64, 'Máximo 64 caracteres'),
  // Mesmo limite de StoreProdutoAuditoriaRequest.php (max:2048) — sem isso, uma URL longa colada
  // passava na validação do form e só falhava no 422 do backend.
  imagem_url: z.string().max(2048, 'URL muito longa (máximo 2048 caracteres)'),
  departamento_uuid: z.string().nullable(),
  secao_uuid: z.string().nullable(),
  marca_uuid: z.string().nullable(),
  codigo_externo: z.string().max(64, 'Máximo 64 caracteres'),
  nivel_exibicao_uuid: z.string().nullable(),
  produto_final: z.boolean(),
  produto_chave: z.boolean(),
  gerar_via_secoes_marcas: z.boolean(),
  peso_kg: z.string().refine((v) => v === '' || !Number.isNaN(Number(v)), 'Deve ser um número'),
  propriedade: z.enum(['PROPRIA', 'CONCORRENTE']),
  ativo: z.boolean(),
});
type FormData = z.infer<typeof schema>;
const DEFAULT_VALUES: FormData = {
  descricao: '',
  codigo_barras: '',
  imagem_url: '',
  departamento_uuid: null,
  secao_uuid: null,
  marca_uuid: null,
  codigo_externo: '',
  nivel_exibicao_uuid: null,
  produto_final: false,
  produto_chave: false,
  gerar_via_secoes_marcas: false,
  peso_kg: '',
  propriedade: 'PROPRIA',
  ativo: true,
};

interface ProdutoFormDialogProps {
  open: boolean;
  produto: ProdutoAuditoria | null;
  onClose: () => void;
}

export function ProdutoFormDialog({ open, produto, onClose }: ProdutoFormDialogProps) {
  const modoEdicao = produto !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const departamentosQuery = useQuery({ queryKey: ['departamentos'], queryFn: () => listarDepartamentos(), enabled: open });
  const marcasQuery = useQuery({ queryKey: ['marcas'], queryFn: () => listarMarcas(), enabled: open });
  const niveisQuery = useQuery({ queryKey: ['niveis-exibicao'], queryFn: () => listarNiveisExibicao(), enabled: open });

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const departamentoUuidAtual = useWatch({ control, name: 'departamento_uuid' });

  // Seções filtradas pelo departamento escolhido — se nenhum departamento, lista todas (produto
  // pode ficar solto direto numa seção sem departamento definido, mesmo padrão do backend).
  const secoesQuery = useQuery({
    queryKey: ['secoes', { departamento_uuid: departamentoUuidAtual }],
    queryFn: () => listarSecoes({ departamento_uuid: departamentoUuidAtual ?? undefined }),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        produto
          ? {
              descricao: produto.descricao,
              codigo_barras: produto.codigo_barras ?? '',
              imagem_url: produto.imagem_url ?? '',
              departamento_uuid: produto.departamento?.id ?? null,
              secao_uuid: produto.secao?.id ?? null,
              marca_uuid: produto.marca?.id ?? null,
              codigo_externo: produto.codigo_externo ?? '',
              nivel_exibicao_uuid: produto.nivel_exibicao?.id ?? null,
              produto_final: produto.produto_final,
              produto_chave: produto.produto_chave,
              gerar_via_secoes_marcas: produto.gerar_via_secoes_marcas,
              peso_kg: produto.peso_kg === null ? '' : String(produto.peso_kg),
              propriedade: produto.propriedade,
              ativo: produto.ativo,
            }
          : DEFAULT_VALUES,
      );
    }
  }, [open, produto, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        descricao: data.descricao,
        codigo_barras: data.codigo_barras || null,
        imagem_url: data.imagem_url || null,
        departamento_uuid: data.departamento_uuid,
        secao_uuid: data.secao_uuid,
        marca_uuid: data.marca_uuid,
        codigo_externo: data.codigo_externo || null,
        nivel_exibicao_uuid: data.nivel_exibicao_uuid,
        produto_final: data.produto_final,
        produto_chave: data.produto_chave,
        gerar_via_secoes_marcas: data.gerar_via_secoes_marcas,
        peso_kg: data.peso_kg === '' ? null : Number(data.peso_kg),
        propriedade: data.propriedade,
      };

      if (modoEdicao) {
        return atualizarProduto(produto!.id, { ...payload, ativo: data.ativo });
      }

      return criarProduto(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['produtos'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response?.status === 422) {
        const errors = err.response.data.errors;
        if (errors) {
          for (const [campo, mensagens] of Object.entries(errors)) {
            if (campo in DEFAULT_VALUES) {
              setError(campo as keyof FormData, { message: mensagens[0] });
            }
          }
        }
        setErroGeral(errors ? null : (err.response.data.message ?? 'Não foi possível salvar.'));
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar produto' : 'Novo produto'}</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) =>
          void handleSubmit((data) => {
            setErroGeral(null);
            mutation.mutate(data);
          })(e)
        }
        noValidate
      >
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}
          <Controller
            name="descricao"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Descrição"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                autoFocus
              />
            )}
          />
          <Controller
            name="codigo_barras"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Código de barras"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={
                  fieldState.error?.message ??
                  'Unicidade depende da configuração da empresa; obrigatoriedade também depende dela, mas só quando "Produto final" está marcado'
                }
              />
            )}
          />
          <Controller
            name="codigo_externo"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Código externo"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Código do ERP/sistema de origem — também entra na busca de produtos'}
              />
            )}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="departamento_uuid"
              control={control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  sx={{ flex: 1 }}
                  options={departamentosQuery.data?.departamentos ?? []}
                  getOptionLabel={(option) => option.descricao}
                  loading={departamentosQuery.isLoading}
                  value={departamentosQuery.data?.departamentos.find((d) => d.id === field.value) ?? null}
                  onChange={(_, value) => field.onChange(value?.id ?? null)}
                  renderInput={(params) => (
                    <TextField {...params} label="Departamento" margin="normal" error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )}
                />
              )}
            />
            <Controller
              name="secao_uuid"
              control={control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  sx={{ flex: 1 }}
                  options={secoesQuery.data?.secoes ?? []}
                  getOptionLabel={(option) => option.descricao}
                  loading={secoesQuery.isLoading}
                  value={secoesQuery.data?.secoes.find((s) => s.id === field.value) ?? null}
                  onChange={(_, value) => field.onChange(value?.id ?? null)}
                  renderInput={(params) => (
                    <TextField {...params} label="Seção" margin="normal" error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )}
                />
              )}
            />
          </Box>
          <Controller
            name="marca_uuid"
            control={control}
            render={({ field, fieldState }) => (
              <Autocomplete
                options={marcasQuery.data?.marcas ?? []}
                getOptionLabel={(option) => option.descricao}
                loading={marcasQuery.isLoading}
                value={marcasQuery.data?.marcas.find((m) => m.id === field.value) ?? null}
                onChange={(_, value) => field.onChange(value?.id ?? null)}
                renderInput={(params) => (
                  <TextField {...params} label="Marca" margin="normal" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )}
              />
            )}
          />
          <Controller
            name="propriedade"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                select
                label="Propriedade"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              >
                <MenuItem value="PROPRIA">Própria</MenuItem>
                <MenuItem value="CONCORRENTE">Concorrente</MenuItem>
              </TextField>
            )}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="nivel_exibicao_uuid"
              control={control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  sx={{ flex: 1 }}
                  options={niveisQuery.data?.niveis_exibicao ?? []}
                  getOptionLabel={(option) => option.descricao}
                  loading={niveisQuery.isLoading}
                  value={niveisQuery.data?.niveis_exibicao.find((n) => n.id === field.value) ?? null}
                  onChange={(_, value) => field.onChange(value?.id ?? null)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Nível de exibição"
                      margin="normal"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="peso_kg"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Peso (kg)"
                  sx={{ flex: 1 }}
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Box>
          <Controller
            name="imagem_url"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="URL da imagem"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="produto_final"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Produto final (SKU específico, não uma combinação genérica)"
              />
            )}
          />
          <Controller
            name="gerar_via_secoes_marcas"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Gerar via seção × marca (combinação genérica, não um SKU específico)"
              />
            )}
          />
          <Controller
            name="produto_chave"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                sx={{ display: 'block' }}
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label='Produto-chave — avisa o promotor pelo nome ao finalizar a visita se este produto ficar sem registro'
              />
            )}
          />
          {modoEdicao && (
            <Controller
              name="ativo"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  sx={{ mt: 1, display: 'block' }}
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Ativo"
                />
              )}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
