import { Autocomplete, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { listarPontosVenda } from '../../lib/api/pontosVenda';

/** Filtro "Loja" dos relatórios — mesma lista (até 200 PDVs ativos) usada em outros filtros do admin. */
// `valor` opcional: a tela que guarda o filtro na URL abre já com a loja escolhida.
export function SeletorPontoVenda({ onChange, valor }: { onChange: (pontoVendaUuid: string | null) => void; valor?: string | null }) {
  const query = useQuery({
    queryKey: ['pontos-venda', 'filtro-relatorio'],
    queryFn: () => listarPontosVenda({ ativo: true, por_pagina: 200 }),
  });

  return (
    <Autocomplete
      size="small"
      sx={{ width: 240 }}
      options={query.data?.pontos_venda ?? []}
      {...(valor !== undefined ? { value: query.data?.pontos_venda.find((p) => p.id === valor) ?? null } : {})}
      getOptionLabel={(p) => p.fantasia}
      loading={query.isLoading}
      onChange={(_, p) => onChange(p?.id ?? null)}
      renderInput={(params) => <TextField {...params} label="Loja" />}
    />
  );
}
