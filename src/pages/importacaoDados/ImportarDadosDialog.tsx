import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRef, useState } from 'react';
import type { RelatorioImportacao } from '../../lib/api/importacaoDados';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { Usuario } from '../../types/api';
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
  // Rota de visitas (docs/78 §2.2): promotor das linhas que vierem sem a coluna `promotor`.
  const [promotorDaRota, setPromotorDaRota] = useState<Usuario | null>(null);
  // "Substituir dados existentes" (docs/42 §4.3.1, docs/78 §4.1) — só nos tipos com `substituir`.
  const [substituir, setSubstituir] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const promotoresQuery = useQuery({
    queryKey: ['usuarios', { user_type: 'PROMOTOR', ativo: true, por_pagina: 200 }],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', ativo: true, por_pagina: 200 }),
    enabled: Boolean(tipo?.promotorDaRota),
  });

  const mutation = useMutation({
    // Arquivo vai nas variáveis (não lido do state) — a validação dispara no mesmo clique em que o
    // arquivo é escolhido, antes do setArquivo ter efeito. Promotor e substituir idem (trocar
    // qualquer um revalida no mesmo clique).
    mutationFn: ({ file, simular, promotor, substituir }: { file: File; simular: boolean; promotor: Usuario | null; substituir: boolean }) => {
      const extras: Record<string, string> = {};
      if (promotor) extras.promotor_padrao = promotor.email;
      if (substituir) extras.substituir = '1';
      return tipo!.importar(file, simular, extras);
    },
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
    if (file) mutation.mutate({ file, simular: true, promotor: promotorDaRota, substituir });
  }

  // Trocar o promotor da rota muda o resultado: valida de novo o arquivo já escolhido.
  function escolherPromotor(promotor: Usuario | null) {
    setPromotorDaRota(promotor);
    setRelatorio(null);
    if (arquivo) mutation.mutate({ file: arquivo, simular: true, promotor, substituir });
  }

  // Idem pro substituir: a prévia passa a contar (ou deixa de contar) o que sai.
  function alternarSubstituir(valor: boolean) {
    setSubstituir(valor);
    setRelatorio(null);
    if (arquivo) mutation.mutate({ file: arquivo, simular: true, promotor: promotorDaRota, substituir: valor });
  }

  function importar() {
    setConfirmando(false);
    if (arquivo) mutation.mutate({ file: arquivo, simular: false, promotor: promotorDaRota, substituir });
  }

  function fechar() {
    setArquivo(null);
    setRelatorio(null);
    setErro(null);
    setPromotorDaRota(null);
    setSubstituir(false);
    setConfirmando(false);
    if (inputRef.current) inputRef.current.value = '';
    onClose();
  }

  if (!tipo) return null;

  const validadoSemErro = relatorio && !relatorio.aplicado && relatorio.erros.length === 0;
  const item = tipo.itemSingularPlural;
  // Loja/Produto: criadas + atualizadas. Vínculo: criadas + já existentes (nada a atualizar), mais
  // os removidos quando substitui. Carteira: removidos por loja.
  const segundaContagem =
    relatorio?.agendas_desativadas !== undefined
      ? `${relatorio.agendas_desativadas} dia(s) saindo da rota, em ${relatorio.lojas ?? 0} loja(s)`
      : relatorio?.ja_existentes !== undefined && relatorio.removidas !== undefined
      ? `${relatorio.ja_existentes} já existia(m) e ${relatorio.removidas} removido(s), em ${relatorio.lojas ?? 0} loja(s)`
      : relatorio?.removidas !== undefined
      ? `${relatorio.removidas} removido(s), em ${relatorio.lojas ?? 0} loja(s)`
      : relatorio?.ja_existentes !== undefined
      ? `${relatorio.ja_existentes} já existia(m) e fica(m) como está(ão)`
      : `${relatorio?.atualizadas ?? 0} atualização(ões)`;
  // Rota com substituir: o que mais acontece além dos dias (lojas que saem, visita de hoje, app).
  const efeitosRota =
    relatorio?.lojas_saindo !== undefined
      ? `${relatorio.lojas_saindo} loja(s) saindo da rota dos promotores do arquivo · ${relatorio.os_canceladas ?? 0} visita(s) de hoje cancelada(s) · ${relatorio.promotores_desatribuidos ?? 0} loja(s) saindo do app do promotor`
      : null;
  // Pede confirmação só quando a substituição vai de fato apagar/desativar algo.
  const vaiRemover =
    substituir && !!relatorio && ((relatorio.removidas ?? 0) > 0 || (relatorio.agendas_desativadas ?? 0) > 0 || (relatorio.promotores_desatribuidos ?? 0) > 0);

  return (
    <Dialog open={!!tipo} onClose={fechar} maxWidth="md" fullWidth>
      <DialogTitle>Importar {tipo.titulo.toLowerCase()} por CSV</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {tipo.introducao ? (
            tipo.introducao
          ) : tipo.chave === 'sortimento' ? (
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

        {tipo.promotorDaRota && (
          <Autocomplete
            id="importacao-promotor-rota"
            size="small"
            sx={{ mb: 2, maxWidth: 420 }}
            options={promotoresQuery.data?.usuarios ?? []}
            getOptionLabel={(u) => `${u.nome} (${u.email})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            loading={promotoresQuery.isLoading}
            value={promotorDaRota}
            onChange={(_, u) => escolherPromotor(u)}
            disabled={mutation.isPending}
            renderInput={(params) => (
              <TextField {...params} label="Promotor da rota" helperText="Vale pras linhas sem a coluna promotor. Opcional." />
            )}
          />
        )}
        {tipo.substituir && (
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={substituir}
                  onChange={(e) => alternarSubstituir(e.target.checked)}
                  disabled={mutation.isPending || !!relatorio?.aplicado}
                  color="warning"
                />
              }
              label="Substituir dados existentes (apagar os antigos e subir os novos)"
            />
            {substituir && (
              <Alert severity="warning" sx={{ mt: 0.5 }}>
                {tipo.substituir.ajuda} Tudo numa operação só: se der qualquer erro, nada é apagado.
              </Alert>
            )}
          </Box>
        )}
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
            {/* Linhas que entram com ressalva (vendedor sem supervisor cadastrado, docs/73) — não impedem a importação. */}
            {relatorio.erros.length === 0 && (relatorio.avisos?.length ?? 0) > 0 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {relatorio.avisos!.length} linha(s) com aviso:
                <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 160, overflowY: 'auto' }}>
                  {relatorio.avisos!.map((a, i) => (
                    <li key={i}>
                      Linha {a.linha} ({a.codigo_externo ?? '—'}): {a.mensagem}
                    </li>
                  ))}
                </Box>
              </Alert>
            )}
            {relatorio.aplicado ? (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                Importação concluída: {relatorio.criadas} {item} criado(s) e {segundaContagem}.
                {efeitosRota && <Box sx={{ mt: 0.5 }}>{efeitosRota}.</Box>}
              </Alert>
            ) : relatorio.erros.length === 0 ? (
              <Alert severity={vaiRemover ? 'warning' : 'info'}>
                Arquivo válido — {relatorio.total} linha(s): <strong>{relatorio.criadas} {item} novo(s)</strong> e{' '}
                <strong>{segundaContagem}</strong>. Nada foi gravado ainda.
                {efeitosRota && <Box sx={{ mt: 0.5 }}>{efeitosRota}.</Box>}
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
            color={vaiRemover ? 'warning' : 'primary'}
            disabled={mutation.isPending}
            onClick={() => (vaiRemover ? setConfirmando(true) : importar())}
          >
            {/* Vínculo só com pares já existentes ainda vale importar: aprova os pendentes. */}
            {vaiRemover ? 'Substituir e importar' : `Importar ${relatorio.total} linha(s)`}
          </Button>
        )}
      </DialogActions>

      <Dialog open={confirmando && !!relatorio} onClose={() => setConfirmando(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Substituir dados existentes?</DialogTitle>
        <DialogContent>
          {relatorio?.lojas_saindo !== undefined ? (
            <DialogContentText>
              <strong>{relatorio.agendas_desativadas} dia(s) de visita</strong> vão sair da rota
              {relatorio.lojas_saindo > 0 && (
                <>
                  , e <strong>{relatorio.lojas_saindo} loja(s)</strong> deixam de ser atendidas pelos promotores do arquivo
                </>
              )}
              . {relatorio.os_canceladas ?? 0} visita(s) de hoje ainda não iniciada(s) serão canceladas e{' '}
              {relatorio.promotores_desatribuidos ?? 0} loja(s) saem do app do promotor. Visitas já realizadas ficam no
              histórico.
            </DialogContentText>
          ) : (
            <DialogContentText>
              Vão ser removidos <strong>{relatorio?.removidas ?? 0} vínculo(s) de produto</strong> de{' '}
              <strong>{relatorio?.lojas ?? 0} loja(s)</strong> que não estão no arquivo, e criados {relatorio?.criadas ?? 0}{' '}
              novo(s).
            </DialogContentText>
          )}
          <DialogContentText sx={{ mt: 1.5 }}>
            A importação não desfaz isso depois. Se qualquer coisa der errado durante a gravação, nada é alterado.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={importar}>
            {relatorio?.lojas_saindo !== undefined ? 'Substituir a rota' : `Remover ${relatorio?.removidas ?? 0} e importar`}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
