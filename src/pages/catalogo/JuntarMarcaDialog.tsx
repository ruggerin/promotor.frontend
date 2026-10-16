import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { juntarMarca, listarMarcas } from '../../lib/api/marcas';
import type { MarcaAuditoria } from '../../types/api';

/**
 * Junta a marca cadastrada pelo promotor ("DOWNY") numa que já existe ("Downy") — docs/85 §4.2.
 * Os registros dela passam pra marca escolhida e ela some das listas.
 */
export function JuntarMarcaDialog({ marca, onClose }: { marca: MarcaAuditoria | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [destino, setDestino] = useState<MarcaAuditoria | null>(null);
  const opcoesQuery = useQuery({
    queryKey: ['marcas', 'juntar', marca?.id],
    queryFn: () => listarMarcas({ ativo: true, por_pagina: 1000 }),
    enabled: !!marca,
  });
  const mutation = useMutation({
    mutationFn: () => juntarMarca(marca!.id, destino!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marcas'] });
      setDestino(null);
      onClose();
    },
  });

  return (
    <Dialog open={!!marca} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Juntar "{marca?.descricao}"</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Os registros desta marca passam pra marca escolhida, e ela some das listas. Use quando o promotor cadastrou uma marca
          que já existe com outro nome.
        </Typography>
        <Autocomplete
          options={(opcoesQuery.data?.marcas ?? []).filter((m) => m.id !== marca?.id && !m.a_aprovar)}
          loading={opcoesQuery.isLoading}
          getOptionLabel={(m) => m.descricao}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          value={destino}
          onChange={(_, v) => setDestino(v)}
          renderInput={(params) => <TextField {...params} label="Juntar em" autoFocus />}
        />
        {mutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Não foi possível juntar as marcas.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!destino || mutation.isPending} onClick={() => mutation.mutate()}>
          Juntar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
