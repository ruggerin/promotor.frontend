import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  importarImagensProdutos,
  simularImportacaoImagens,
  type ChaveImagemProduto,
  type ResultadoImagemProduto,
  type SituacaoImagemProduto,
} from '../../lib/api/produtos';
import { baixarCsv } from '../../lib/csv';
import { reduzirImagem } from '../../lib/reduzirImagem';

// Importação de imagens de produtos pelo nome do arquivo (docs/89-IMPORTACAO-DE-IMAGENS-DE-PRODUTOS.md).
// Etapa 1: só os nomes vão pro servidor (prévia instantânea, sem subir nada). Etapa 2: as fotos que
// casaram sobem em lotes de 10 (limite do backend), 2 lotes em paralelo, reduzidas no navegador.
// Cada lote é independente: se cair no meio, reenviar a mesma pasta continua de onde parou (sem
// "Substituir", produto que já tem foto fica de fora).

const POR_LOTE = 10;
const LOTES_EM_PARALELO = 2;
const LINHAS_NA_TABELA = 200;

const ROTULOS: Record<SituacaoImagemProduto | 'erro', string> = {
  ok: 'Pronta',
  gravado: 'Enviada',
  nao_encontrado: 'Não encontrado',
  ambiguo: 'Código repetido',
  duplicado: 'Arquivo repetido',
  ja_tem_imagem: 'Já tem foto',
  formato_invalido: 'Formato não aceito',
  erro: 'Falhou',
};

const CORES: Record<SituacaoImagemProduto | 'erro', 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  ok: 'info',
  gravado: 'success',
  nao_encontrado: 'error',
  ambiguo: 'warning',
  duplicado: 'warning',
  ja_tem_imagem: 'default',
  formato_invalido: 'error',
  erro: 'error',
};

type Situacao = SituacaoImagemProduto | 'erro';
interface Linha extends Omit<ResultadoImagemProduto, 'situacao'> {
  situacao: Situacao;
}

// Lixo de sistema que vem junto quando se escolhe uma pasta inteira.
function ehArquivoDeSistema(nome: string): boolean {
  return nome.startsWith('.') || nome.toLowerCase() === 'thumbs.db' || nome.toLowerCase() === 'desktop.ini';
}

function Miniatura({ arquivo }: { arquivo: File | undefined }) {
  const url = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : null), [arquivo]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {url ? (
        <Box component="img" src={url} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <ImageOutlinedIcon fontSize="small" color="disabled" />
      )}
    </Box>
  );
}

function mensagemDeErro(err: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(err)) {
    return err.response?.data?.message ?? 'Sem conexão com a API.';
  }
  return 'Erro inesperado.';
}

export function ImportarImagensDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [chave, setChave] = useState<ChaveImagemProduto>('codigo_barras');
  const [substituir, setSubstituir] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [filtro, setFiltro] = useState<Situacao | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  // Envio: resultado por nome de arquivo (substitui a linha da prévia), progresso e cancelamento.
  const [enviados, setEnviados] = useState<Record<string, Linha>>({});
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [interrompido, setInterrompido] = useState(false);
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 });
  const cancelarRef = useRef(false);

  // Zera tudo ao fechar, pra próxima abertura começar limpa.
  function fechar() {
    setArquivos([]);
    setFiltro(null);
    setEnviados({});
    setConcluido(false);
    setInterrompido(false);
    setProgresso({ feito: 0, total: 0 });
    onClose();
  }

  // Fechar a aba no meio do envio para tudo — o navegador avisa.
  useEffect(() => {
    if (!enviando) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [enviando]);

  const porNome = useMemo(() => new Map(arquivos.map((a) => [a.name, a])), [arquivos]);
  const nomes = useMemo(() => arquivos.map((a) => a.name), [arquivos]);

  const previa = useQuery({
    queryKey: ['importacao-imagens-previa', chave, substituir, nomes],
    queryFn: () => simularImportacaoImagens(chave, nomes, substituir),
    enabled: open && nomes.length > 0 && !enviando && !concluido,
    staleTime: Infinity,
    gcTime: 0,
  });

  const linhas: Linha[] = useMemo(
    () => (previa.data?.resultados ?? []).map((r) => enviados[r.nome] ?? r),
    [previa.data, enviados],
  );
  const contagem = useMemo(() => {
    const c: Partial<Record<Situacao, number>> = {};
    for (const l of linhas) c[l.situacao] = (c[l.situacao] ?? 0) + 1;
    return c;
  }, [linhas]);
  const prontas = linhas.filter((l) => l.situacao === 'ok');
  const trocas = prontas.filter((l) => l.produto?.imagem_url).length;
  const deFora = linhas.filter((l) => l.situacao !== 'ok' && l.situacao !== 'gravado');
  const visiveis = filtro ? linhas.filter((l) => l.situacao === filtro) : linhas;

  function adicionar(lista: FileList | File[]) {
    // Mesmo nome duas vezes (pastas diferentes): fica o último — o nome é o código.
    const mapa = new Map(arquivos.map((a) => [a.name, a]));
    for (const a of Array.from(lista)) {
      if (!ehArquivoDeSistema(a.name)) mapa.set(a.name, a);
    }
    setArquivos(Array.from(mapa.values()));
    setFiltro(null);
  }

  function aoSoltar(e: DragEvent) {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files.length) adicionar(e.dataTransfer.files);
  }

  async function enviar() {
    setConfirmando(false);
    cancelarRef.current = false;
    setEnviando(true);
    const fila = prontas.map((l) => l.nome);
    const lotes: string[][] = [];
    for (let i = 0; i < fila.length; i += POR_LOTE) lotes.push(fila.slice(i, i + POR_LOTE));
    setProgresso({ feito: 0, total: fila.length });

    let proximo = 0;
    const trabalhador = async () => {
      while (!cancelarRef.current && proximo < lotes.length) {
        const lote = lotes[proximo++];
        const resultado: Record<string, Linha> = {};
        try {
          const reduzidas = await Promise.all(lote.map((nome) => reduzirImagem(porNome.get(nome)!)));
          const resposta = await importarImagensProdutos(chave, reduzidas, substituir);
          // A redução pode trocar a extensão (foto.png → foto.jpg): casa pela posição no lote.
          resposta.resultados.forEach((r, i) => {
            resultado[lote[i]] = { ...r, nome: lote[i] };
          });
        } catch (err) {
          for (const nome of lote) resultado[nome] = { nome, situacao: 'erro', mensagem: mensagemDeErro(err) };
        }
        setEnviados((atual) => ({ ...atual, ...resultado }));
        setProgresso((p) => ({ ...p, feito: p.feito + lote.length }));
      }
    };
    await Promise.all(Array.from({ length: LOTES_EM_PARALELO }, trabalhador));

    setInterrompido(cancelarRef.current);
    setEnviando(false);
    setConcluido(true);
    void queryClient.invalidateQueries({ queryKey: ['produtos'] });
  }

  function baixarDeFora() {
    baixarCsv(
      'imagens-nao-importadas.csv',
      ['arquivo', 'situacao', 'motivo', 'produto'],
      deFora.map((l) => [
        l.nome,
        ROTULOS[l.situacao],
        l.mensagem ?? '',
        l.produtos?.map((p) => p.descricao).join(' | ') ?? l.produto?.descricao ?? '',
      ]),
    );
  }

  const nomeDaChave = chave === 'codigo_barras' ? 'código de barras' : 'código externo';

  return (
    <Dialog open={open} onClose={enviando ? undefined : fechar} maxWidth="md" fullWidth>
      <DialogTitle>Importar imagens de produtos</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          O nome de cada arquivo é o código do produto: <code>7891000100103.jpg</code> ou <code>P1001.png</code>. JPG, PNG
          ou WEBP. As fotos são reduzidas antes de enviar (até 1200 px), então podem ser grandes.
        </DialogContentText>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Os arquivos estão nomeados por
            </Typography>
            <RadioGroup row value={chave} onChange={(e) => setChave(e.target.value as ChaveImagemProduto)}>
              <FormControlLabel value="codigo_barras" control={<Radio size="small" />} label="Código de barras" disabled={enviando || concluido} />
              <FormControlLabel value="codigo_externo" control={<Radio size="small" />} label="Código externo" disabled={enviando || concluido} />
            </RadioGroup>
          </Box>
          <FormControlLabel
            control={<Switch checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} disabled={enviando || concluido} />}
            label="Substituir imagens existentes"
          />
        </Box>

        {!enviando && !concluido && (
          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={aoSoltar}
            sx={{
              border: 2,
              borderStyle: 'dashed',
              borderColor: arrastando ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              bgcolor: arrastando ? 'action.hover' : 'transparent',
              mb: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {arquivos.length
                ? `${arquivos.length} arquivo(s) escolhido(s). Arraste mais ou escolha de novo pra somar.`
                : 'Arraste as fotos aqui, ou'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button component="label" variant="outlined" startIcon={<FolderOpenIcon />}>
                Escolher pasta
                <input
                  hidden
                  type="file"
                  multiple
                  // webkitdirectory não está nos tipos do React.
                  ref={(el) => el?.setAttribute('webkitdirectory', '')}
                  onChange={(e) => {
                    if (e.target.files) adicionar(e.target.files);
                    e.target.value = '';
                  }}
                />
              </Button>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                Escolher arquivos
                <input
                  hidden
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    if (e.target.files) adicionar(e.target.files);
                    e.target.value = '';
                  }}
                />
              </Button>
              {arquivos.length > 0 && <Button onClick={() => setArquivos([])}>Limpar</Button>}
            </Box>
          </Box>
        )}

        {previa.isFetching && <LinearProgress sx={{ mb: 2 }} />}
        {previa.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {mensagemDeErro(previa.error)}
          </Alert>
        )}

        {(enviando || concluido) && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {enviando
                ? `Enviando ${progresso.feito} de ${progresso.total}...`
                : interrompido
                  ? `Envio interrompido: ${contagem.gravado ?? 0} foto(s) enviada(s).`
                  : `Pronto: ${contagem.gravado ?? 0} foto(s) enviada(s).`}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progresso.total ? (progresso.feito / progresso.total) * 100 : 0}
              color={concluido ? 'success' : 'primary'}
            />
          </Box>
        )}

        {linhas.length > 0 && (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
              <Chip label={`Todas (${linhas.length})`} onClick={() => setFiltro(null)} color={filtro === null ? 'primary' : 'default'} size="small" />
              {(Object.keys(ROTULOS) as Situacao[])
                .filter((s) => contagem[s])
                .map((s) => (
                  <Chip
                    key={s}
                    label={`${ROTULOS[s]} (${contagem[s]})`}
                    onClick={() => setFiltro(filtro === s ? null : s)}
                    color={filtro === s ? 'primary' : CORES[s]}
                    variant={filtro === s ? 'filled' : 'outlined'}
                    size="small"
                  />
                ))}
            </Box>

            {substituir && trocas > 0 && !concluido && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                {trocas} produto(s) já têm foto e vão ter a foto trocada.
              </Alert>
            )}
            {!substituir && (contagem.ja_tem_imagem ?? 0) > 0 && !concluido && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                {contagem.ja_tem_imagem} produto(s) já têm foto e ficam como estão. Ligue "Substituir imagens existentes"
                pra trocar.
              </Alert>
            )}

            <Box sx={{ maxHeight: 360, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 56 }} />
                    <TableCell>Arquivo</TableCell>
                    <TableCell>Produto</TableCell>
                    <TableCell>Situação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visiveis.slice(0, LINHAS_NA_TABELA).map((l) => (
                    <TableRow key={l.nome}>
                      <TableCell>
                        <Miniatura arquivo={porNome.get(l.nome)} />
                      </TableCell>
                      <TableCell sx={{ wordBreak: 'break-all' }}>{l.nome}</TableCell>
                      <TableCell>
                        {l.produto ? (
                          <>
                            {l.produto.descricao}
                            <Typography variant="caption" color="text.secondary" component="div">
                              {chave === 'codigo_barras' ? l.produto.codigo_barras : l.produto.codigo_externo}
                            </Typography>
                          </>
                        ) : l.produtos ? (
                          l.produtos.map((p) => (
                            <Typography key={p.id} variant="body2">
                              {p.descricao}
                            </Typography>
                          ))
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={ROTULOS[l.situacao]} color={CORES[l.situacao]} size="small" variant="outlined" />
                        {l.mensagem && l.situacao !== 'ok' && l.situacao !== 'gravado' && (
                          <Typography variant="caption" color="text.secondary" component="div">
                            {l.mensagem}
                          </Typography>
                        )}
                        {l.mensagem && l.situacao === 'ok' && (
                          <Typography variant="caption" color="warning.main" component="div">
                            {l.mensagem}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {visiveis.length > LINHAS_NA_TABELA && (
              <Typography variant="caption" color="text.secondary">
                Mostrando {LINHAS_NA_TABELA} de {visiveis.length}. Use os filtros ou baixe a lista.
              </Typography>
            )}
          </>
        )}

        {arquivos.length > 0 && previa.isSuccess && prontas.length === 0 && !concluido && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Nenhum arquivo casou com um produto pelo {nomeDaChave}. Confira se escolheu a opção certa acima.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {deFora.length > 0 && !enviando && (
          <Button startIcon={<DownloadIcon />} onClick={baixarDeFora} sx={{ mr: 'auto' }}>
            Baixar lista do que ficou de fora
          </Button>
        )}
        {enviando ? (
          <Button
            color="warning"
            onClick={() => {
              cancelarRef.current = true;
            }}
          >
            Parar envio
          </Button>
        ) : (
          <Button onClick={fechar}>{concluido ? 'Fechar' : 'Cancelar'}</Button>
        )}
        {!enviando && !concluido && (
          <Button
            variant="contained"
            disabled={prontas.length === 0 || previa.isFetching}
            onClick={() => (substituir && trocas > 0 ? setConfirmando(true) : void enviar())}
          >
            Enviar {prontas.length} foto(s)
          </Button>
        )}
      </DialogActions>

      <Dialog open={confirmando} onClose={() => setConfirmando(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Substituir imagens existentes?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{trocas} produto(s)</strong> vão ter a foto trocada. A foto anterior, se foi enviada por aqui, é apagada;
            URL externa só deixa de ser usada.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={() => void enviar()}>
            Trocar {trocas} e enviar
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
