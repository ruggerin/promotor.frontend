import SearchIcon from '@mui/icons-material/Search';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { listarDepartamentos } from '../lib/api/departamentos';
import { listarMarcas } from '../lib/api/marcas';
import { listarProdutos } from '../lib/api/produtos';
import { listarSecoes } from '../lib/api/secoes';

export interface ProdutoSelecionado {
  id: string;
  descricao: string;
}

interface ProdutoBuscaDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmar: (produtos: ProdutoSelecionado[]) => void;
  titulo?: string;
  confirmando?: boolean;
  /** uuids que já estão no destino — aparecem marcados e travados, pra não duplicar. */
  jaAdicionados?: ReadonlySet<string>;
}

/**
 * Busca de produtos com filtros combináveis e multi-seleção (docs/27-BUSCA-MULTIPLA-DE-PRODUTOS.md
 * §3.2): texto (nome, código de barras ou código externo) + Departamento/Seção/Marca. A seleção
 * sobrevive à troca de página e de filtro — só some ao fechar o diálogo.
 */
export function ProdutoBuscaDialog({
  open,
  onClose,
  onConfirmar,
  titulo = 'Buscar produtos',
  confirmando = false,
  jaAdicionados,
}: ProdutoBuscaDialogProps) {
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [departamentoUuid, setDepartamentoUuid] = useState<string | null>(null);
  const [secaoUuid, setSecaoUuid] = useState<string | null>(null);
  const [marcaUuid, setMarcaUuid] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [selecionados, setSelecionados] = useState<Map<string, ProdutoSelecionado>>(new Map());

  // Debounce da caixa de texto — evita uma requisição por tecla (nem tem sentido pro leitor de
  // código de barras, que digita tudo de uma vez).
  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(texto.trim());
      setPagina(0);
    }, 350);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    if (open) {
      setTexto('');
      setBusca('');
      setDepartamentoUuid(null);
      setSecaoUuid(null);
      setMarcaUuid(null);
      setPagina(0);
      setSelecionados(new Map());
    }
  }, [open]);

  const departamentosQuery = useQuery({ queryKey: ['departamentos'], queryFn: () => listarDepartamentos(), enabled: open });
  const secoesQuery = useQuery({
    queryKey: ['secoes', { departamento_uuid: departamentoUuid }],
    queryFn: () => listarSecoes({ departamento_uuid: departamentoUuid ?? undefined }),
    enabled: open,
  });
  const marcasQuery = useQuery({ queryKey: ['marcas'], queryFn: () => listarMarcas(), enabled: open });

  const produtosQuery = useQuery({
    queryKey: ['produtos-busca', { busca, departamentoUuid, secaoUuid, marcaUuid, pagina }],
    queryFn: () =>
      listarProdutos({
        ativo: true,
        busca,
        departamento_uuid: departamentoUuid ?? undefined,
        secao_uuid: secaoUuid ?? undefined,
        marca_uuid: marcaUuid ?? undefined,
        page: pagina + 1,
      }),
    enabled: open,
    placeholderData: (anterior) => anterior,
  });

  const produtos = produtosQuery.data?.produtos ?? [];
  const meta = produtosQuery.data?.meta;

  function alternar(produto: ProdutoSelecionado) {
    setSelecionados((atual) => {
      const novo = new Map(atual);
      if (novo.has(produto.id)) novo.delete(produto.id);
      else novo.set(produto.id, { id: produto.id, descricao: produto.descricao });
      return novo;
    });
  }

  function trocarFiltro(aplicar: () => void) {
    aplicar();
    setPagina(0);
  }

  return (
    <Dialog open={open} onClose={confirmando ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            size="small"
            autoFocus
            label="Nome, código de barras ou código externo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            sx={{ flex: '2 1 260px' }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Autocomplete
            size="small"
            sx={{ flex: '1 1 180px' }}
            options={departamentosQuery.data?.departamentos ?? []}
            getOptionLabel={(o) => o.descricao}
            value={departamentosQuery.data?.departamentos.find((d) => d.id === departamentoUuid) ?? null}
            onChange={(_, v) =>
              trocarFiltro(() => {
                setDepartamentoUuid(v?.id ?? null);
                setSecaoUuid(null);
              })
            }
            renderInput={(params) => <TextField {...params} label="Departamento" />}
          />
          <Autocomplete
            size="small"
            sx={{ flex: '1 1 180px' }}
            options={secoesQuery.data?.secoes ?? []}
            getOptionLabel={(o) => o.descricao}
            value={secoesQuery.data?.secoes.find((s) => s.id === secaoUuid) ?? null}
            onChange={(_, v) => trocarFiltro(() => setSecaoUuid(v?.id ?? null))}
            renderInput={(params) => <TextField {...params} label="Seção" />}
          />
          <Autocomplete
            size="small"
            sx={{ flex: '1 1 180px' }}
            options={marcasQuery.data?.marcas ?? []}
            getOptionLabel={(o) => o.descricao}
            value={marcasQuery.data?.marcas.find((m) => m.id === marcaUuid) ?? null}
            onChange={(_, v) => trocarFiltro(() => setMarcaUuid(v?.id ?? null))}
            renderInput={(params) => <TextField {...params} label="Marca" />}
          />
        </Box>

        <TableContainer sx={{ maxHeight: 420, opacity: produtosQuery.isFetching ? 0.6 : 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Produto</TableCell>
                <TableCell>Cód. externo</TableCell>
                <TableCell>Cód. de barras</TableCell>
                <TableCell>Departamento</TableCell>
                <TableCell>Seção</TableCell>
                <TableCell>Marca</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {produtosQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              )}
              {!produtosQuery.isLoading && produtos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    Nenhum produto encontrado com esses filtros.
                  </TableCell>
                </TableRow>
              )}
              {produtos.map((p) => {
                const jaTem = jaAdicionados?.has(p.id) ?? false;
                const marcado = jaTem || selecionados.has(p.id);
                return (
                  <TableRow
                    key={p.id}
                    hover
                    selected={marcado && !jaTem}
                    onClick={() => !jaTem && alternar(p)}
                    sx={{ cursor: jaTem ? 'default' : 'pointer', opacity: jaTem ? 0.55 : 1 }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={marcado} disabled={jaTem} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar variant="rounded" src={p.imagem_url ?? undefined} sx={{ width: 32, height: 32 }}>
                          {p.descricao.charAt(0)}
                        </Avatar>
                        <Box>
                          {p.descricao}
                          {jaTem && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              já está na lista
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{p.codigo_externo ?? '—'}</TableCell>
                    <TableCell>{p.codigo_barras ?? '—'}</TableCell>
                    <TableCell>{p.departamento?.descricao ?? '—'}</TableCell>
                    <TableCell>{p.secao?.descricao ?? '—'}</TableCell>
                    <TableCell>{p.marca?.descricao ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {meta && (
          <TablePagination
            component="div"
            count={meta.total}
            page={pagina}
            rowsPerPage={meta.per_page}
            rowsPerPageOptions={[meta.per_page]}
            onPageChange={(_, nova) => setPagina(nova)}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          {selecionados.size === 0 ? 'Nenhum produto selecionado' : `${selecionados.size} selecionado(s)`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selecionados.size > 0 && (
            <Button onClick={() => setSelecionados(new Map())} disabled={confirmando}>
              Limpar
            </Button>
          )}
          <Button onClick={onClose} disabled={confirmando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={selecionados.size === 0 || confirmando}
            onClick={() => onConfirmar(Array.from(selecionados.values()))}
          >
            {confirmando ? 'Adicionando...' : `Adicionar (${selecionados.size})`}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
