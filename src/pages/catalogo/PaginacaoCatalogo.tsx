import { TablePagination } from '@mui/material';
import { useState } from 'react';

// Rodapé de paginação das abas do Catálogo. A API pagina essas listas (15 por padrão), então sem
// ele a tela mostrava só a primeira página.

export function usePaginacaoCatalogo() {
  const [page, setPage] = useState(0);
  const [porPagina, setPorPagina] = useState(25);

  return {
    page,
    porPagina,
    setPage,
    setPorPagina,
    // Filtro novo sempre volta pra primeira página.
    filtrar:
      <V,>(set: (v: V) => void) =>
      (v: V) => {
        setPage(0);
        set(v);
      },
    // `page` da API começa em 1; a do TablePagination, em 0.
    params: { page: page + 1, por_pagina: porPagina },
  };
}

export function PaginacaoCatalogo({
  total,
  paginacao,
}: {
  total: number;
  paginacao: ReturnType<typeof usePaginacaoCatalogo>;
}) {
  return (
    <TablePagination
      component="div"
      count={total}
      page={paginacao.page}
      onPageChange={(_, nova) => paginacao.setPage(nova)}
      rowsPerPage={paginacao.porPagina}
      rowsPerPageOptions={[25, 50, 100]}
      onRowsPerPageChange={(e) => paginacao.filtrar(paginacao.setPorPagina)(Number(e.target.value))}
      labelRowsPerPage="Por página"
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
    />
  );
}
