import { CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, Typography } from '@mui/material';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';

// Tipagem oficial do TanStack Table pra dado extra por coluna (alinhamento, padding) — ver
// https://tanstack.com/table/latest/docs/api/core/column-def#meta.
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'center' | 'right';
    padding?: 'checkbox' | 'normal' | 'none';
    // Sem isso, texto médio (nome de loja, razão social) quebra em 2-3 linhas mesmo sobrando
    // espaço horizontal — o <TableCell> do MUI não tem white-space: nowrap por padrão, e o
    // <Table> encolhe coluna em vez de deixar a linha estourar (docs/30-CRITICA-UX-ADMIN-WEB.md
    // §1). nowrap vira o padrão de toda coluna; `wrap: true` é o opt-in pra quem precisa mesmo
    // quebrar (texto livre longo, tipo observação).
    wrap?: boolean;
  }
}

export interface DataTableProps<T> {
  // `any` é o mesmo escape hatch que o `useReactTable` usa internamente pra aceitar colunas com
  // tipos de valor diferentes (string, number, JSX...) num array só.
  columns: ColumnDef<T, any>[];
  data: T[];
  // Sem isso o React key some quando a lista pagina — mesmo raciocínio de sempre usar o uuid
  // como key, nunca o índice do array.
  getRowId: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  // Paginação sempre server-side neste projeto — a API pagina, não devolve tudo de uma vez.
  page: number;
  onPageChange: (page: number) => void;
  rowsPerPage: number;
  totalRows: number;
}

/**
 * Wrapper fino de `@tanstack/react-table` sobre os componentes de `Table` do MUI — mantém a
 * mesma cara visual das telas que já existiam (TableContainer/Table/TableHead/TablePagination),
 * só adiciona ordenação por coluna (clicando no header) por cima do que cada tela já fazia na
 * mão. Ordena só as linhas já carregadas na página atual — a paginação/filtro continuam vindo
 * do backend, sem mudança de contrato com a API.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  isError,
  errorMessage,
  emptyMessage,
  onRowClick,
  isRowSelected,
  page,
  onPageChange,
  rowsPerPage,
  totalRows,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const colSpan = columns.length;

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableCell
                  key={header.id}
                  align={header.column.columnDef.meta?.align}
                  padding={header.column.columnDef.meta?.padding}
                  sx={header.column.columnDef.meta?.wrap ? undefined : { whiteSpace: 'nowrap' }}
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <TableSortLabel
                      active={!!header.column.getIsSorted()}
                      direction={header.column.getIsSorted() || 'asc'}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableSortLabel>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHead>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={colSpan} align="center">
                <CircularProgress size={24} />
              </TableCell>
            </TableRow>
          )}
          {isError && (
            <TableRow>
              <TableCell colSpan={colSpan} align="center">
                <Typography color="error" variant="body2">
                  {errorMessage ?? 'Não foi possível carregar a lista — você pode não ter permissão para isto, ou houve um problema de conexão.'}
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {!isLoading && !isError && data.length === 0 && (
            <TableRow>
              <TableCell colSpan={colSpan} align="center">
                {emptyMessage ?? 'Nada encontrado.'}
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            !isError &&
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                hover
                selected={isRowSelected?.(row.original)}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
                onClick={() => onRowClick?.(row.original)}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRowClick(row.original);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    align={cell.column.columnDef.meta?.align}
                    padding={cell.column.columnDef.meta?.padding}
                    sx={cell.column.columnDef.meta?.wrap ? undefined : { whiteSpace: 'nowrap' }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={totalRows}
        page={page}
        onPageChange={(_, newPage) => onPageChange(newPage)}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[rowsPerPage]}
        onRowsPerPageChange={() => {
          // A API não aceita per_page customizado ainda — só existe pra satisfazer o
          // componente controlado do MUI.
        }}
      />
    </TableContainer>
  );
}
