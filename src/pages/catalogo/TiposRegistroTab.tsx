import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { atualizarTipoRegistro, desativarTipoRegistro, listarTiposRegistro } from '../../lib/api/tiposRegistro';
import type { TipoRegistro } from '../../types/api';
import { TipoRegistroFormDialog } from './TipoRegistroFormDialog';

interface TiposRegistroTabProps {
  empresaUuid: string | null;
  isSuperadmin: boolean;
}

export function TiposRegistroTab({ empresaUuid, isSuperadmin }: TiposRegistroTabProps) {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<TipoRegistro | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['tipos-registro', { empresaUuid }],
    queryFn: () => listarTiposRegistro({ empresa_uuid: empresaUuid ?? undefined }),
  });

  const totalColunas = isSuperadmin ? 7 : 6;

  const rotuloEscopo: Record<NonNullable<TipoRegistro['escopo_acao']>, string> = {
    SEMPRE: 'Sempre',
    CAMPANHA: 'Campanha',
    CONTRATO: 'Contrato ativo',
  };

  const reativarMutation = useMutation({
    mutationFn: (t: TipoRegistro) => atualizarTipoRegistro(t.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro'] });
    },
    onError: () => setErro('Não foi possível reativar o tipo.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (t: TipoRegistro) => desativarTipoRegistro(t.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro'] });
    },
    onError: () => setErro('Não foi possível desativar o tipo.'),
  });

  function alternarStatus(t: TipoRegistro) {
    if (t.ativo) {
      if (window.confirm(`Desativar "${t.descricao}"? Promotores não vão mais poder escolher esse tipo em novos registros.`)) {
        desativarMutation.mutate(t);
      }
      return;
    }
    reativarMutation.mutate(t);
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Lista própria da empresa — cada uma define os próprios tipos de registro (ex.: "Foto",
        "Ruptura", "Ponto extra"), com campos de formulário customizados além da foto (ex.:
        quantidade, valor). É isso que o promotor escolhe no app ao registrar algo numa visita.
      </Typography>
      {!isSuperadmin && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEmEdicao(null);
              setDialogAberto(true);
            }}
          >
            Novo tipo
          </Button>
        </Box>
      )}

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {isSuperadmin && <TableCell>Empresa</TableCell>}
              <TableCell>Descrição</TableCell>
              <TableCell>Exige foto</TableCell>
              <TableCell>Campos extras</TableCell>
              <TableCell>Ação</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.data?.tipos_registro.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhum tipo de registro cadastrado.
                </TableCell>
              </TableRow>
            )}
            {query.data?.tipos_registro.map((t) => (
              <TableRow key={t.id} hover>
                {isSuperadmin && <TableCell>{t.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{t.descricao}</TableCell>
                <TableCell>{t.exige_foto ? 'Sim' : 'Não'}</TableCell>
                <TableCell>
                  {t.campos.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {t.campos.map((c) => (
                        <Chip key={c.id} label={c.rotulo} size="small" />
                      ))}
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  {t.acao_obrigatoria && t.escopo_acao ? (
                    <Chip label={rotuloEscopo[t.escopo_acao]} color="warning" size="small" />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={t.ativo ? 'Ativo' : 'Inativo'} color={t.ativo ? 'success' : 'default'} size="small" />
                    {t.eh_ruptura && <Chip label="Ruptura" color="secondary" size="small" />}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {isSuperadmin ? (
                    '—'
                  ) : (
                    <>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEmEdicao(t);
                            setDialogAberto(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(t)}>
                          {t.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!isSuperadmin && (
        <TipoRegistroFormDialog open={dialogAberto} tipo={emEdicao} onClose={() => setDialogAberto(false)} />
      )}
    </Box>
  );
}
