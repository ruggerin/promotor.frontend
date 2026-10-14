import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, type DataTableProps } from './DataTable';

type Linha = { id: string; nome: string };

function montar(props: Partial<DataTableProps<Linha>> = {}) {
  return render(
    <DataTable<Linha>
      columns={[{ accessorKey: 'nome', header: 'Nome' }]}
      data={[{ id: '1', nome: 'Loja antiga' }]}
      getRowId={(l) => l.id}
      page={0}
      onPageChange={() => {}}
      rowsPerPage={15}
      totalRows={30}
      {...props}
    />,
  );
}

describe('DataTable', () => {
  it('sem busca em andamento não mostra barra de progresso', () => {
    montar();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('trocando de página mostra a barra e apaga as linhas da página anterior', () => {
    montar({ isFetching: true, isPlaceholderData: true });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Loja antiga').closest('tbody')).toHaveStyle({ opacity: '0.45' });
  });

  it('atualização com dados atuais mostra a barra sem apagar as linhas', () => {
    montar({ isFetching: true });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Loja antiga').closest('tbody')).not.toHaveStyle({ opacity: '0.45' });
  });
});
