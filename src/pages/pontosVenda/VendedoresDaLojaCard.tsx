import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Alert, Autocomplete, Box, Button, Chip, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { podeVerTela } from '../../lib/acesso/telas';
import { desvincularVendedorLoja, listarVendedores, vincularVendedorLoja } from '../../lib/api/equipeComercial';
import { useAuth } from '../../lib/auth/AuthContext';
import type { PontoVenda, Vendedor } from '../../types/api';

// Carteira da loja (docs/73 §11.1): vendedores do ERP que atendem esta loja, N por loja. Quem vê a
// loja vê a carteira; adicionar/remover pede `vendedores.gerenciar` (a mesma da tela de vendedores).
export function VendedoresDaLojaCard({ pdv }: { pdv: PontoVenda }) {
  const { usuario } = useAuth();
  const podeEditar = podeVerTela(usuario, 'equipe_comercial');
  const queryClient = useQueryClient();
  const vendedores = pdv.vendedores ?? [];
  const [busca, setBusca] = useState('');
  const [buscaAtrasada, setBuscaAtrasada] = useState('');
  const [escolhido, setEscolhido] = useState<Vendedor | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setBuscaAtrasada(busca), 300);
    return () => clearTimeout(id);
  }, [busca]);

  const opcoesQuery = useQuery({
    queryKey: ['vendedores', 'opcoes-loja', buscaAtrasada],
    queryFn: () => listarVendedores({ busca: buscaAtrasada, ativo: true }),
    enabled: podeEditar,
  });
  const opcoes = (opcoesQuery.data?.vendedores ?? []).filter((v) => !vendedores.some((n) => n.id === v.id));

  const atualizar = () => {
    void queryClient.invalidateQueries({ queryKey: ['pontos-venda', pdv.id] });
    void queryClient.invalidateQueries({ queryKey: ['vendedores'] });
  };
  const vincular = useMutation({
    mutationFn: (vendedorId: string) => vincularVendedorLoja(pdv.id, vendedorId),
    onSuccess: () => {
      setEscolhido(null);
      atualizar();
    },
  });
  const desvincular = useMutation({
    mutationFn: (vendedorId: string) => desvincularVendedorLoja(pdv.id, vendedorId),
    onSuccess: atualizar,
  });

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Vendedores
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Vendedores do ERP que atendem esta loja. Os promotores veem nome, telefone e supervisor no app, na aba de dados da
        loja.
      </Typography>

      {(vincular.isError || desvincular.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Não foi possível atualizar os vendedores da loja.
        </Alert>
      )}

      {vendedores.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: podeEditar ? 2 : 0 }}>
          Nenhum vendedor nesta loja ainda.
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.5, mb: podeEditar ? 2 : 0 }}>
          {vendedores.map((v) => (
            <Box
              key={v.id}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-start', minWidth: 0 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {v.nome}{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    ({v.codigo_externo})
                  </Typography>
                </Typography>
                <Typography variant="body2">{v.telefone ?? 'Sem telefone'}</Typography>
                {v.email && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                    {v.email}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Supervisor: {v.supervisor?.nome ?? '—'}
                </Typography>
                {!v.ativo && <Chip size="small" label="Inativo no ERP" sx={{ mt: 0.5 }} />}
              </Box>
              {podeEditar && (
                <Tooltip title="Tirar da loja">
                  <IconButton size="small" onClick={() => desvincular.mutate(v.id)} disabled={desvincular.isPending} aria-label={`Tirar ${v.nome} da loja`}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))}
        </Box>
      )}

      {podeEditar && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Autocomplete
            id="loja-adicionar-vendedor"
            size="small"
            sx={{ width: 320 }}
            options={opcoes}
            getOptionLabel={(v) => `${v.nome} (${v.codigo_externo})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(x) => x}
            loading={opcoesQuery.isFetching}
            value={escolhido}
            onChange={(_, v) => setEscolhido(v)}
            onInputChange={(_, v, motivo) => motivo === 'input' && setBusca(v)}
            renderInput={(params) => <TextField {...params} label="Adicionar vendedor" placeholder="Código ou nome" />}
          />
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            disabled={!escolhido || vincular.isPending}
            onClick={() => escolhido && vincular.mutate(escolhido.id)}
          >
            Adicionar
          </Button>
        </Box>
      )}
    </Paper>
  );
}
