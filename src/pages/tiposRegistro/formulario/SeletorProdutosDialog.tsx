import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  InputAdornment,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { listarDepartamentos } from '../../../lib/api/departamentos';
import { listarMarcas } from '../../../lib/api/marcas';
import { listarProdutos } from '../../../lib/api/produtos';
import { listarSecoes } from '../../../lib/api/secoes';
import { listarTiposRegistro } from '../../../lib/api/tiposRegistro';

export interface ProdutoEscolhido {
  uuid: string;
  descricao: string;
}

interface Props {
  open: boolean;
  titulo?: string;
  subtitulo?: string;
  // Já no formulário — aparecem marcados e travados ("Já no formulário").
  jaAdicionados: ReadonlySet<string>;
  // Formulário atual, pra não se oferecer em "Copiar de outro formulário".
  tipoAtualId?: string | null;
  onClose: () => void;
  onConfirmar: (produtos: ProdutoEscolhido[]) => void;
}

type Aba = 'buscar' | 'colar' | 'copiar';

/**
 * "Adicionar produtos" do editor de formulário (protótipo "Formulário — revisão de UX", tela 3):
 * três jeitos de montar a lista — buscar no catálogo (texto + seção/departamento/marca), colar uma
 * lista de códigos (externo ou de barras) ou copiar os produtos de outro formulário. A seleção
 * ("Vão entrar") fica guardada enquanto troca de aba, busca ou filtro.
 */
export function SeletorProdutosDialog({ open, titulo = 'Adicionar produtos', subtitulo, jaAdicionados, tipoAtualId, onClose, onConfirmar }: Props) {
  const [aba, setAba] = useState<Aba>('buscar');
  const [selecionados, setSelecionados] = useState<Map<string, ProdutoEscolhido>>(new Map());

  useEffect(() => {
    if (open) {
      setAba('buscar');
      setSelecionados(new Map());
    }
  }, [open]);

  function adicionar(produtos: ProdutoEscolhido[]) {
    setSelecionados((atual) => {
      const novo = new Map(atual);
      for (const p of produtos) if (!jaAdicionados.has(p.uuid)) novo.set(p.uuid, p);
      return novo;
    });
  }

  function alternar(p: ProdutoEscolhido) {
    setSelecionados((atual) => {
      const novo = new Map(atual);
      if (novo.has(p.uuid)) novo.delete(p.uuid);
      else novo.set(p.uuid, p);
      return novo;
    });
  }

  const lista = [...selecionados.values()];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, height: '85vh' } } }}>
      <Box sx={{ px: 3.5, pt: 3, display: 'flex', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {titulo}
          </Typography>
          {subtitulo && (
            <Typography variant="body2" color="text.secondary">
              {subtitulo}
            </Typography>
          )}
        </Box>
        <IconButton aria-label="Fechar" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Tabs value={aba} onChange={(_, v: Aba) => setAba(v)} sx={{ px: 3.5, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="buscar" label="Buscar no catálogo" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="colar" label="Colar lista de códigos" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="copiar" label="Copiar de outro formulário" sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Box sx={{ flex: 1, p: 3.5, overflow: 'auto' }}>
          {aba === 'buscar' && (
            <AbaBuscar selecionados={selecionados} jaAdicionados={jaAdicionados} onAlternar={alternar} onMarcarTodos={adicionar} />
          )}
          {aba === 'colar' && <AbaColar jaAdicionados={jaAdicionados} onAdicionar={adicionar} />}
          {aba === 'copiar' && <AbaCopiar tipoAtualId={tipoAtualId ?? null} onAdicionar={adicionar} />}
        </Box>

        <Box sx={{ width: 360, borderLeft: 1, borderColor: 'divider', bgcolor: 'grey.50', p: 3, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Vão entrar <Typography component="span" color="text.secondary">({lista.length})</Typography>
          </Typography>
          <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {lista.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhum produto escolhido ainda.
              </Typography>
            )}
            {lista.map((p) => (
              <Box
                key={p.uuid}
                sx={{ display: 'flex', alignItems: 'center', bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1 }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {p.descricao}
                </Typography>
                <IconButton size="small" aria-label="Remover produto" onClick={() => alternar(p)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
            A seleção fica guardada enquanto você troca de busca ou filtro — dá pra montar a lista em várias pesquisas.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: 3.5, py: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" disabled={lista.length === 0} onClick={() => onConfirmar(lista)}>
          {lista.length === 0 ? 'Adicionar' : `Adicionar ${lista.length} produto${lista.length === 1 ? '' : 's'}`}
        </Button>
      </Box>
    </Dialog>
  );
}

function AbaBuscar({
  selecionados,
  jaAdicionados,
  onAlternar,
  onMarcarTodos,
}: {
  selecionados: ReadonlyMap<string, ProdutoEscolhido>;
  jaAdicionados: ReadonlySet<string>;
  onAlternar: (p: ProdutoEscolhido) => void;
  onMarcarTodos: (ps: ProdutoEscolhido[]) => void;
}) {
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [secao, setSecao] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [marca, setMarca] = useState('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(texto.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [texto]);

  const secoesQuery = useQuery({ queryKey: ['secoes', { ativo: true }], queryFn: () => listarSecoes({ ativo: true }) });
  const departamentosQuery = useQuery({ queryKey: ['departamentos', { ativo: true }], queryFn: () => listarDepartamentos({ ativo: true }) });
  const marcasQuery = useQuery({ queryKey: ['marcas', { ativo: true }], queryFn: () => listarMarcas({ ativo: true }) });

  const filtros = { busca, secao, departamento, marca, pagina };
  const query = useQuery({
    queryKey: ['produtos', 'seletor-formulario', filtros],
    queryFn: () =>
      listarProdutos({
        ativo: true,
        busca: busca || undefined,
        secao_uuid: secao || undefined,
        departamento_uuid: departamento || undefined,
        marca_uuid: marca || undefined,
        page: pagina,
        por_pagina: 50,
      }),
    placeholderData: keepPreviousData,
  });
  const produtos = query.data?.produtos ?? [];
  const disponiveis = produtos.filter((p) => !jaAdicionados.has(p.id));

  const filtro = (rotulo: string, valor: string, setValor: (v: string) => void, opcoes: { id: string; descricao: string }[]) => (
    <TextField
      select
      size="small"
      value={valor}
      onChange={(e) => {
        setValor(e.target.value);
        setPagina(1);
      }}
      sx={{ minWidth: 150 }}
      slotProps={{ select: { displayEmpty: true } }}
    >
      <MenuItem value="">{rotulo}</MenuItem>
      {opcoes.map((o) => (
        <MenuItem key={o.id} value={o.id}>
          {o.descricao}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <>
      <TextField
        fullWidth
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar produto"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Typography variant="caption" color="text.secondary">
                  nome, código ERP ou código de barras
                </Typography>
              </InputAdornment>
            ),
          },
        }}
      />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          Filtrar:
        </Typography>
        {filtro('Seção', secao, setSecao, secoesQuery.data?.secoes ?? [])}
        {filtro('Departamento', departamento, setDepartamento, departamentosQuery.data?.departamentos ?? [])}
        {filtro('Marca', marca, setMarca, marcasQuery.data?.marcas ?? [])}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2.5, mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {query.isLoading ? 'Buscando...' : `${query.data?.meta.total ?? 0} resultado(s)`}
        </Typography>
        {disponiveis.length > 0 && (
          <Button size="small" onClick={() => onMarcarTodos(disponiveis.map((p) => ({ uuid: p.id, descricao: p.descricao })))}>
            Marcar todos
          </Button>
        )}
      </Box>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        {query.isLoading && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {!query.isLoading && produtos.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            Nenhum produto encontrado.
          </Typography>
        )}
        {produtos.map((p, i) => {
          const ja = jaAdicionados.has(p.id);
          const marcado = ja || selecionados.has(p.id);
          return (
            <Box
              key={p.id}
              onClick={() => !ja && onAlternar({ uuid: p.id, descricao: p.descricao })}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                cursor: ja ? 'default' : 'pointer',
                borderTop: i === 0 ? 0 : 1,
                borderColor: 'divider',
                bgcolor: selecionados.has(p.id) ? 'action.hover' : undefined,
              }}
            >
              <Checkbox checked={marcado} disabled={ja} size="small" />
              <Box
                sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'grey.100', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {p.imagem_url ? (
                  <Box component="img" src={p.imagem_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    foto
                  </Typography>
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {p.descricao}
                </Typography>
                {(p.codigo_externo || p.codigo_barras) && (
                  <Typography variant="caption" color="text.secondary">
                    {[p.codigo_externo, p.codigo_barras].filter(Boolean).join(' · ')}
                  </Typography>
                )}
              </Box>
              {ja && <Chip size="small" label="Já no formulário" />}
            </Box>
          );
        })}
      </Box>
      {(query.data?.meta.last_page ?? 1) > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1.5, alignItems: 'center' }}>
          <Button size="small" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <Typography variant="caption">
            Página {pagina} de {query.data!.meta.last_page}
          </Typography>
          <Button size="small" disabled={pagina >= query.data!.meta.last_page} onClick={() => setPagina((p) => p + 1)}>
            Próxima
          </Button>
        </Box>
      )}
    </>
  );
}

function AbaColar({ jaAdicionados, onAdicionar }: { jaAdicionados: ReadonlySet<string>; onAdicionar: (ps: ProdutoEscolhido[]) => void }) {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<{ encontrados: number; jaNoFormulario: number; naoEncontrados: string[] } | null>(null);

  const codigos = useMemo(
    () => [...new Set(texto.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean))],
    [texto],
  );

  const mutation = useMutation({
    mutationFn: () => listarProdutos({ ativo: true, codigos, por_pagina: 1000 }),
    onSuccess: (data) => {
      const achados = new Set<string>();
      for (const p of data.produtos) {
        if (p.codigo_externo) achados.add(p.codigo_externo);
        if (p.codigo_barras) achados.add(p.codigo_barras);
      }
      const novos = data.produtos.filter((p) => !jaAdicionados.has(p.id));
      onAdicionar(novos.map((p) => ({ uuid: p.id, descricao: p.descricao })));
      setResultado({
        encontrados: novos.length,
        jaNoFormulario: data.produtos.length - novos.length,
        naoEncontrados: codigos.filter((c) => !achados.has(c)),
      });
    },
  });

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Cole os códigos do ERP ou os códigos de barras — um por linha, ou separados por vírgula. Útil quando a lista vem de
        uma planilha.
      </Typography>
      <TextField
        multiline
        minRows={10}
        fullWidth
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setResultado(null);
        }}
        placeholder={'7891000100103\n7891000100110\nERP-4410'}
        slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
        <Button variant="contained" disabled={codigos.length === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Procurando...' : `Procurar ${codigos.length} código(s)`}
        </Button>
        {codigos.length > 1000 && (
          <Typography variant="caption" color="error">
            Máximo de 1.000 códigos por vez.
          </Typography>
        )}
      </Box>
      {resultado && (
        <Alert severity={resultado.naoEncontrados.length ? 'warning' : 'success'} sx={{ mt: 2 }}>
          {resultado.encontrados} produto(s) entraram na seleção
          {resultado.jaNoFormulario > 0 && ` · ${resultado.jaNoFormulario} já estavam no formulário`}.
          {resultado.naoEncontrados.length > 0 && (
            <>
              {' '}
              Não encontrados ({resultado.naoEncontrados.length}): {resultado.naoEncontrados.slice(0, 30).join(', ')}
              {resultado.naoEncontrados.length > 30 && '…'}
            </>
          )}
        </Alert>
      )}
      {mutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Não foi possível procurar os códigos agora. Tente de novo.
        </Alert>
      )}
    </>
  );
}

function AbaCopiar({ tipoAtualId, onAdicionar }: { tipoAtualId: string | null; onAdicionar: (ps: ProdutoEscolhido[]) => void }) {
  const query = useQuery({
    queryKey: ['tipos-registro', 'copiar-produtos'],
    queryFn: () => listarTiposRegistro({ ativo: true, por_pagina: 200 }),
  });

  // Fonte: a lista predefinida do formulário + listas escolhidas de checklists (mix fixo).
  const formularios = (query.data?.tipos_registro ?? [])
    .filter((t) => t.id !== tipoAtualId)
    .map((t) => {
      const produtos = new Map<string, ProdutoEscolhido>();
      for (const p of t.produtos_predefinidos ?? []) produtos.set(p.id, { uuid: p.id, descricao: p.descricao });
      for (const c of t.campos) for (const p of c.sortimento_produtos) produtos.set(p.id, { uuid: p.id, descricao: p.descricao });
      return { id: t.id, descricao: t.descricao, produtos: [...produtos.values()] };
    })
    .filter((t) => t.produtos.length > 0);

  if (query.isLoading) return <CircularProgress size={24} />;

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Traz a lista de produtos de outro formulário — a cópia é independente, mudar lá depois não mexe aqui.
      </Typography>
      {formularios.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nenhum outro formulário tem lista de produtos.
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {formularios.map((f) => (
          <Box key={f.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, border: 1, borderColor: 'divider', borderRadius: 2, px: 2, py: 1.25 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {f.descricao}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {f.produtos.length} produto(s): {f.produtos.slice(0, 4).map((p) => p.descricao).join(', ')}
                {f.produtos.length > 4 && '…'}
              </Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={() => onAdicionar(f.produtos)}>
              Usar esta lista
            </Button>
          </Box>
        ))}
      </Box>
    </>
  );
}
