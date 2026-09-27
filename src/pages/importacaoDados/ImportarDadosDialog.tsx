import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRef, useState } from 'react';
import type { RelatorioImportacao } from '../../lib/api/importacaoDados';
import { baixarCsv } from '../../lib/csv';
import type { TipoImportacao } from './tiposImportacao';

function mensagemErro(err: unknown): string {
  if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err)) {
    const erros = err.response?.data?.errors;
    if (erros) return Object.values(erros)[0]?.[0] ?? 'Não foi possível ler o arquivo.';
    return err.response?.data?.message ?? 'Não foi possível enviar o arquivo.';
  }
  return 'Não foi possível enviar o arquivo.';
}

interface Props {
  tipo: TipoImportacao | null;
  onClose: () => void;
}

/**
 * Importação em lote via CSV, genérica por tipo (docs/42-IMPORTACAO-DE-DADOS.md §3.2) — Loja,
 * Produto ou Vínculo Loja × Produto, configurados em tiposImportacao.tsx. Fluxo em dois passos:
 * escolher o arquivo já valida tudo (simulação, nada é gravado) e mostra o relatório; só então
 * "Importar N". Qualquer erro no arquivo = nada gravado.
 */
export function ImportarDadosDialog({ tipo, onClose }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const mutation = useMutation({
    // Arquivo vai nas variáveis (não lido do state) — a validação dispara no mesmo clique em que o
    // arquivo é escolhido, antes do setArquivo ter efeito.
    mutationFn: ({ file, simular }: { file: File; simular: boolean }) => tipo!.importar(file, simular),
    onSuccess: (dados) => {
      setRelatorio(dados);
      setErro(null);
      if (dados.aplicado) {
        for (const chave of tipo!.invalidar) void queryClient.invalidateQueries({ queryKey: [chave] });
      }
    },
    onError: (err) => {
      setRelatorio(null);
      setErro(mensagemErro(err));
    },
  });

  function escolher(file: File | null) {
    setArquivo(file);
    setRelatorio(null);
    setErro(null);
    if (file) mutation.mutate({ file, simular: true });
  }

  function fechar() {
    setArquivo(null);
    setRelatorio(null);
    setErro(null);
    if (inputRef.current) inputRef.current.value = '';
    onClose();
  }

  if (!tipo) return null;

  const validadoSemErro = relatorio && !relatorio.aplicado && relatorio.erros.length === 0;
  const item = tipo.itemSingularPlural;
  // Loja/Produto: criadas + atualizadas. Vínculo: criadas + já existentes (nada a atualizar).
  const segundaContagem =
    relatorio?.ja_existentes !== undefined
      ? `${relatorio.ja_existentes} já existia(m) e fica(m) como está(ão)`
      : `${relatorio?.atualizadas ?? 0} atualização(ões)`;

  return (
    <Dialog open={!!tipo} onClose={fechar} maxWidth="md" fullWidth>
      <DialogTitle>Importar {tipo.titulo.toLowerCase()} por CSV</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {tipo.chave === 'sortimento' ? (
            <>
              Cada linha liga uma loja a um produto, pelos <strong>códigos externos</strong> dos dois.
            </>
          ) : (
            <>
              O <strong>código externo</strong> é a chave: se já existe, é <strong>atualizado</strong>; se não existe, é{' '}
              <strong>criado</strong>. Num cadastro que já existe, célula vazia mantém o valor atual — dá pra enviar só as
              colunas que mudaram.
            </>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {tipo.ajuda} Se houver qualquer erro no arquivo, nada é gravado.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => baixarCsv(tipo.arquivoModelo, tipo.colunas, tipo.exemplo)}
          >
            Baixar arquivo modelo
          </Button>
          <Button variant="contained" component="label" startIcon={<UploadFileIcon />} disabled={mutation.isPending}>
            {arquivo ? 'Trocar arquivo' : 'Escolher arquivo CSV'}
            <input
              ref={inputRef}
              hidden
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => escolher(e.target.files?.[0] ?? null)}
            />
          </Button>
          {arquivo && (
            <Typography variant="body2" sx={{ alignSelf: 'center' }}>
              {arquivo.name}
            </Typography>
          )}
        </Box>

        {mutation.isPending && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <CircularProgress size={20} />
            <Typography variant="body2">
              {mutation.variables?.simular ? 'Validando arquivo...' : 'Importando...'}
            </Typography>
          </Box>
        )}

        {erro && <Alert severity="error">{erro}</Alert>}

        {relatorio && !mutation.isPending && (
          <>
            {relatorio.aplicado ? (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                Importação concluída: {relatorio.criadas} {item} criado(s) e {segundaContagem}.
              </Alert>
            ) : relatorio.erros.length === 0 ? (
              <Alert severity="info">
                Arquivo válido — {relatorio.total} linha(s): <strong>{relatorio.criadas} {item} novo(s)</strong> e{' '}
                <strong>{segundaContagem}</strong>. Nada foi gravado ainda.
              </Alert>
            ) : (
              <>
                <Alert severity="error" sx={{ mb: 1 }}>
                  {relatorio.erros.length} erro(s) no arquivo — nada foi gravado. Corrija e envie de novo.
                </Alert>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 70 }}>Linha</TableCell>
                        <TableCell sx={{ width: 180 }}>Código</TableCell>
                        <TableCell>Problema</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {relatorio.erros.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell>{e.linha || '—'}</TableCell>
                          <TableCell>{e.codigo_externo ?? '—'}</TableCell>
                          <TableCell>{e.mensagem}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={fechar}>{relatorio?.aplicado ? 'Fechar' : 'Cancelar'}</Button>
        {validadoSemErro && (
          <Button
            variant="contained"
            disabled={mutation.isPending}
            onClick={() => arquivo && mutation.mutate({ file: arquivo, simular: false })}
          >
            {/* Vínculo só com pares já existentes ainda vale importar: aprova os pendentes. */}
            Importar {relatorio.total} linha(s)
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
