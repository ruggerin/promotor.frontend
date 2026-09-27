import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CheckIcon from '@mui/icons-material/Check';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import SendIcon from '@mui/icons-material/Send';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, CircularProgress, IconButton, InputBase, Link as MuiLink, Popover, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ComentariosRegistro } from '../../components/ComentariosRegistro';
import { AutenticatedImage } from '../../components/fotos/AutenticatedImage';
import { achatarFotos, type FotoComRegistro } from '../../components/fotos/tipos';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { criarComentario } from '../../lib/api/comentarios';
import type { AtividadeEvento, MensagemConversa, VisitaRegistro } from '../../types/api';
import {
  assuntoDoRegistro,
  corDaPessoa,
  formatarDistancia,
  formatarHora,
  formatarMinutos,
  primeiroNome,
} from './feedUtil';

// Itens do feed do Painel de Atividades, na hierarquia por importância do protótipo
// "Painel de atividades— revisão de UX.html" (v2) — ver docs/43-REVISAO-UX-PAINEL-ATIVIDADES.md §2:
// chegada = linha de sistema; saída/registro = post; alerta = post grande com conversa embutida;
// alerta resolvido = post compacto. Cards sem sombra, só borda (decisão 6).

const COR = {
  texto: '#1a1830',
  suave: '#5b5873',
  borda: '#e7e5f0',
  fundoSuave: '#f7f6fb',
  indigo: '#4f46e5',
};

export interface AcoesFeed {
  requerResolucao: boolean;
  resolvendo: boolean;
  onResolver: (visitaUuid: string, registroUuid: string) => void;
  onAbrirPlano: (evento: AtividadeEvento) => void;
  onAbrirFotos: (fotos: FotoComRegistro[], indice: number) => void;
}

// ————— peças comuns —————

function Pilula({ children, bg, fg, sx }: { children: ReactNode; bg: string; fg: string; sx?: object }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        fontSize: 12,
        fontWeight: 700,
        px: 1.25,
        py: 0.5,
        borderRadius: 99,
        bgcolor: bg,
        color: fg,
        whiteSpace: 'nowrap',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

// "Juliana Reis terminou a visita no Supermercado Vitória" — nome na cor da pessoa, verbo suave.
function Frase({ evento, verbo, objeto }: { evento: AtividadeEvento; verbo: string; objeto?: ReactNode }) {
  const cor = corDaPessoa(evento.usuario?.id);
  return (
    <Typography component="span" sx={{ fontSize: 15, fontWeight: 600, color: COR.texto, lineHeight: 1.35 }}>
      <Box component="span" sx={{ color: cor.fg }}>
        {evento.usuario?.nome ?? 'Alguém'}
      </Box>{' '}
      <Box component="span" sx={{ fontWeight: 400, color: COR.suave }}>
        {verbo}
      </Box>
      {objeto ? <> {objeto}</> : null}
    </Typography>
  );
}

function Subtitulo({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 13, color: COR.suave }}>{children}</Typography>;
}

function LinkVisita({ visitaId }: { visitaId: string }) {
  return (
    <MuiLink component={RouterLink} to={`/visitas/${visitaId}`} underline="hover" sx={{ ml: 'auto', fontSize: 14, fontWeight: 500 }}>
      Ver visita
    </MuiLink>
  );
}

// Post = avatar grande + balão (canto do lado do avatar quase reto, jeito de conversa).
function Post({ evento, children, compacto }: { evento: AtividadeEvento; children: ReactNode; compacto?: boolean }) {
  return (
    <Box id={`evento-${evento.id}`} component="article" sx={{ display: 'flex', gap: 1.5, opacity: compacto ? 0.92 : 1, scrollMarginTop: 140 }}>
      <UsuarioAvatar nome={evento.usuario?.nome ?? '?'} fotoUrl={evento.usuario?.foto_url} size={44} cor={corDaPessoa(evento.usuario?.id)} />
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: '#ffffff',
          border: `1px solid ${COR.borda}`,
          borderRadius: '4px 12px 12px 12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

// Álbum de fotos — até `maximo` quadros, o último com "+N" quando sobra foto.
function Album({
  fotos,
  altura,
  maximo,
  onAbrir,
}: {
  fotos: FotoComRegistro[];
  altura: number;
  maximo: number;
  onAbrir: (indice: number) => void;
}) {
  if (fotos.length === 0) return null;
  const visiveis = fotos.slice(0, maximo);
  const sobra = fotos.length - visiveis.length;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${visiveis.length}, minmax(0, 1fr))`, gap: '3px' }}>
      {visiveis.map((foto, i) => {
        const ultimo = i === visiveis.length - 1;
        const raio =
          visiveis.length === 1
            ? '10px'
            : i === 0
              ? '10px 3px 3px 10px'
              : ultimo
                ? '3px 10px 10px 3px'
                : '3px';
        return (
          <Box
            key={`${foto.registro.id}-${foto.imagem.id}`}
            onClick={() => onAbrir(i)}
            sx={{ position: 'relative', height: altura, borderRadius: raio, overflow: 'hidden', cursor: 'pointer', bgcolor: '#ecebf3' }}
          >
            <AutenticatedImage url={foto.imagem.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {ultimo && sobra > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(26,24,48,0.55)',
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +{sobra}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ————— linhas de sistema —————

function LinhaSistema({
  evento,
  icone,
  children,
  destaque,
  extra,
}: {
  evento: AtividadeEvento;
  icone: ReactNode;
  children: ReactNode;
  destaque?: boolean;
  extra?: ReactNode;
}) {
  return (
    <Box
      id={`evento-${evento.id}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1,
        py: destaque ? 1 : 0.25,
        fontSize: 13,
        color: destaque ? '#78350f' : '#4a4766',
        bgcolor: destaque ? '#fef3c7' : 'transparent',
        borderRadius: 1.5,
        scrollMarginTop: 140,
      }}
    >
      <UsuarioAvatar nome={evento.usuario?.nome ?? '?'} fotoUrl={evento.usuario?.foto_url} size={28} cor={corDaPessoa(evento.usuario?.id)} />
      <Box sx={{ display: 'flex', flexShrink: 0 }}>{icone}</Box>
      <Box component="span" sx={{ minWidth: 0 }}>
        {children}
      </Box>
      {extra}
      <Box component="span" sx={{ ml: 'auto', fontSize: 12, color: destaque ? '#78350f' : '#6b6884', flexShrink: 0 }}>
        {formatarHora(evento.ocorrido_em)}
      </Box>
    </Box>
  );
}

function urlMapaEmbed(lat: number, lon: number): string {
  const delta = 0.004;
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
}

export function LinhaChegada({ evento }: { evento: AtividadeEvento }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const loc = evento.localizacao;
  const fora = !!loc?.fora_do_raio;
  const nomeB = <b style={{ color: fora ? undefined : COR.texto }}>{evento.usuario?.nome ?? 'Alguém'}</b>;
  const lojaB = <b style={{ color: fora ? undefined : COR.texto }}>{evento.ponto_venda?.fantasia ?? 'loja'}</b>;

  return (
    <>
      <LinhaSistema
        evento={evento}
        destaque={fora}
        icone={
          fora ? (
            <WarningAmberIcon sx={{ fontSize: 16 }} />
          ) : (
            <PlaceOutlinedIcon sx={{ fontSize: 16, color: '#15803d' }} />
          )
        }
        extra={
          fora && loc ? (
            <MuiLink component="button" type="button" onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: '#78350f', fontWeight: 600, fontSize: 13 }}>
              mapa
            </MuiLink>
          ) : null
        }
      >
        {nomeB} chegou no {lojaB}
        {loc?.distancia_metros != null && (
          <>
            {' · '}
            {fora ? <b>a {formatarDistancia(loc.distancia_metros)} da loja</b> : `a ${formatarDistancia(loc.distancia_metros)} da loja`}
          </>
        )}
      </LinhaSistema>
      {loc && (
        <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
          <Box sx={{ width: 340 }}>
            <Box component="iframe" title="Local do check-in" src={urlMapaEmbed(loc.latitude, loc.longitude)} sx={{ width: '100%', height: 220, border: 0, display: 'block' }} />
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Ponto onde o promotor fez check-in
              </Typography>
              <MuiLink component={RouterLink} to={`/visitas/${evento.visita.id}`} variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                Ver na visita <OpenInNewIcon sx={{ fontSize: 12 }} />
              </MuiLink>
            </Box>
          </Box>
        </Popover>
      )}
    </>
  );
}

// Resposta de promotor num registro que não é card do feed (alerta de outro dia, registro só de
// foto) — docs/43 §6 decisão 4. Clicar abre a conversa ali mesmo.
export function LinhaComentario({ evento }: { evento: AtividadeEvento }) {
  const [aberto, setAberto] = useState(false);
  const c = evento.comentario!;
  const sobre = [c.tipo_registro, c.produto].filter(Boolean).join(' · ');

  return (
    <Box>
      <Box onClick={() => setAberto((a) => !a)} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(79,70,229,0.04)' }, borderRadius: 1.5 }}>
        <LinhaSistema
          evento={evento}
          icone={<ChatBubbleOutlineIcon sx={{ fontSize: 16, color: COR.indigo }} />}
          extra={c.comentarios_novos > 0 ? <Pilula bg={COR.indigo} fg="#fff" sx={{ fontSize: 10, py: 0.1, px: 0.75 }}>NOVO</Pilula> : null}
        >
          <b style={{ color: COR.texto }}>{evento.usuario?.nome ?? 'Alguém'}</b> respondeu em <b style={{ color: COR.texto }}>{sobre || 'um registro'}</b>
          {': '}
          <Box component="span" sx={{ fontStyle: 'italic' }}>
            “{c.texto.length > 80 ? `${c.texto.slice(0, 80)}…` : c.texto}”
          </Box>
        </LinhaSistema>
      </Box>
      {aberto && (
        <Box sx={{ ml: 5, mt: 0.5, p: 1.5, bgcolor: '#fff', border: `1px solid ${COR.borda}`, borderRadius: 1.5 }}>
          <ComentariosRegistro
            visitaUuid={evento.visita.id}
            registroUuid={c.registro_id}
            totalInicial={c.comentarios_count}
            novosIniciais={c.comentarios_novos}
            abertoInicial
          />
        </Box>
      )}
    </Box>
  );
}

// ————— conversa embutida —————

function ConversaEmbutida({
  visitaId,
  registroId,
  mensagens,
  total,
  novos,
  nomePromotor,
}: {
  visitaId: string;
  registroId: string;
  mensagens: MensagemConversa[];
  total: number;
  novos: number;
  nomePromotor: string;
}) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [completa, setCompleta] = useState(false);

  const enviar = useMutation({
    mutationFn: () => criarComentario(visitaId, registroId, texto.trim()),
    onSuccess: () => {
      setTexto('');
      void queryClient.invalidateQueries({ queryKey: ['atividades'] });
      void queryClient.invalidateQueries({ queryKey: ['atividades-resumo'] });
      void queryClient.invalidateQueries({ queryKey: ['comentarios-nao-lidos'] });
      void queryClient.invalidateQueries({ queryKey: ['comentarios', registroId] });
    },
  });

  return (
    <Box sx={{ bgcolor: COR.fundoSuave, borderTop: '1px solid #efeef5', px: 2, pt: 1.5, pb: 1.75, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {total > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: COR.suave }}>
            {total} {total === 1 ? 'comentário' : 'comentários'}
            {novos > 0 ? ` · ${novos} ${novos === 1 ? 'novo' : 'novos'}` : ''}
          </Typography>
          {!completa && total > mensagens.length && (
            <MuiLink component="button" type="button" onClick={() => setCompleta(true)} sx={{ fontSize: 12 }}>
              ver conversa inteira
            </MuiLink>
          )}
        </Box>
      )}

      {completa ? (
        // Conversa inteira — aqui sim marca como lido (é abrir de propósito).
        <ComentariosRegistro visitaUuid={visitaId} registroUuid={registroId} totalInicial={total} novosIniciais={novos} abertoInicial />
      ) : (
        <>
          {mensagens.map((m) =>
            m.meu ? (
              <Box key={m.id} sx={{ alignSelf: 'flex-end', maxWidth: '80%', bgcolor: '#e3e5ff', borderRadius: '12px 4px 12px 12px', px: 1.5, py: 1 }}>
                <Typography sx={{ fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{m.texto}</Typography>
                <Typography sx={{ fontSize: 11, color: '#4a4766', textAlign: 'right' }}>Você · {formatarHora(m.criado_em)}</Typography>
              </Box>
            ) : (
              <Box key={m.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', maxWidth: '85%' }}>
                <UsuarioAvatar nome={m.autor?.nome ?? '?'} fotoUrl={m.autor?.foto_url} size={26} cor={corDaPessoa(m.autor?.id)} />
                <Box sx={{ bgcolor: '#fff', border: `1px solid ${COR.borda}`, borderRadius: '4px 12px 12px 12px', px: 1.5, py: 0.75 }}>
                  <Typography sx={{ fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{m.texto}</Typography>
                  <Typography component="div" sx={{ fontSize: 11, color: '#6b6884', display: 'flex', gap: 0.75, alignItems: 'center' }}>
                    {primeiroNome(m.autor?.nome)} · {formatarHora(m.criado_em)}
                    {m.novo && (
                      <Pilula bg={COR.indigo} fg="#fff" sx={{ fontSize: 10, py: 0, px: 0.75 }}>
                        NOVO
                      </Pilula>
                    )}
                  </Typography>
                </Box>
              </Box>
            ),
          )}
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (texto.trim()) enviar.mutate();
            }}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 40, pl: 1.75, pr: 0.75, borderRadius: 99, bgcolor: '#fff', border: `1px solid ${COR.borda}`, mt: 0.25 }}
          >
            <InputBase
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Responder a ${primeiroNome(nomePromotor)}…`}
              inputProps={{ 'aria-label': 'Comentário' }}
              sx={{ flexGrow: 1, fontSize: 14 }}
            />
            <IconButton
              type="submit"
              size="small"
              aria-label="Enviar"
              disabled={!texto.trim() || enviar.isPending}
              sx={{ bgcolor: COR.indigo, color: '#fff', width: 30, height: 30, '&:hover': { bgcolor: '#4338ca' }, '&.Mui-disabled': { bgcolor: '#c7c9f5', color: '#fff' } }}
            >
              {enviar.isPending ? <CircularProgress size={14} color="inherit" /> : <SendIcon sx={{ fontSize: 15 }} />}
            </IconButton>
          </Box>
        </>
      )}
    </Box>
  );
}

// ————— posts —————

export function PostSaida({ evento, acoes }: { evento: AtividadeEvento; acoes: AcoesFeed }) {
  const fotos = achatarFotos(evento.imagens ?? []);
  const resumo = evento.resumo;

  return (
    <Post evento={evento}>
      <Box sx={{ px: 2, py: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Frase evento={evento} verbo="terminou a visita no" objeto={evento.ponto_venda?.fantasia} />
          <Subtitulo>
            {formatarHora(evento.ocorrido_em)}
            {resumo ? ` · ficou ${formatarMinutos(resumo.duracao_minutos)} na loja` : ''}
          </Subtitulo>
        </Box>
        <Album fotos={fotos} altura={130} maximo={4} onAbrir={(i) => acoes.onAbrirFotos(fotos, i)} />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {resumo && (
            <Pilula bg="#f3f2f8" fg={COR.texto} sx={{ fontWeight: 500, fontSize: 13 }}>
              {resumo.registros} {resumo.registros === 1 ? 'registro' : 'registros'}
            </Pilula>
          )}
          {resumo && resumo.rupturas > 0 && (
            <Pilula bg="#fdeeee" fg="#b91c1c" sx={{ fontSize: 13 }}>
              {resumo.rupturas} {resumo.rupturas === 1 ? 'ruptura' : 'rupturas'}
            </Pilula>
          )}
          <LinkVisita visitaId={evento.visita.id} />
        </Box>
      </Box>
    </Post>
  );
}

// Formulário com uma resposta só — respostas em blocos (Produto · Quantidade · Valor), como o
// "Ponto extra" do protótipo. Com várias respostas, ver PostFormulario (tabela).
function PostRegistroUnico({
  evento,
  registro,
  conversa,
  acoes,
}: {
  evento: AtividadeEvento;
  registro: VisitaRegistro;
  conversa: MensagemConversa[];
  acoes: AcoesFeed;
}) {
  const [comentando, setComentando] = useState(false);
  const fotos = achatarFotos([registro]);
  const assunto = assuntoDoRegistro(registro);
  const campos = registro.campos_respondidos.filter((c) => c.tipo_campo !== 'SORTIMENTO' && c.valor);
  const blocos = [...(assunto ? [{ rotulo: 'Produto', valor: assunto }] : []), ...campos.map((c) => ({ rotulo: c.rotulo, valor: c.valor }))];
  const visiveis = blocos.slice(0, assunto ? 3 : 3);
  const sobra = blocos.length - visiveis.length;
  const total = registro.comentarios_count ?? 0;

  return (
    <Post evento={evento}>
      <Box sx={{ px: 2, py: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Frase evento={evento} verbo="respondeu" objeto={registro.tipo_registro.descricao} />
            <Subtitulo>
              {evento.ponto_venda?.fantasia} · {formatarHora(evento.ocorrido_em)}
            </Subtitulo>
          </Box>
          {registro.pontuacao !== null && (
            <Pilula bg="#fff7e6" fg="#92400e">
              {registro.pontuacao}% compliance
            </Pilula>
          )}
        </Box>
        {visiveis.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(visiveis.length, 3)}, minmax(0, 1fr))`, gap: 1 }}>
            {visiveis.map((b) => (
              <Box key={b.rotulo} sx={{ bgcolor: COR.fundoSuave, borderRadius: 1, px: 1.5, py: 1.25, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: COR.suave }} noWrap>
                  {b.rotulo}
                </Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 600 }} noWrap title={String(b.valor)}>
                  {b.valor}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        {registro.observacao && <Typography sx={{ fontSize: 14, lineHeight: 1.5 }}>{registro.observacao}</Typography>}
        <Album fotos={fotos} altura={130} maximo={4} onAbrir={(i) => acoes.onAbrirFotos(fotos, i)} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {total === 0 && !comentando && (
            <Button size="small" startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />} onClick={() => setComentando(true)} sx={{ textTransform: 'none', fontSize: 14, px: 0.5 }}>
              Comentar
            </Button>
          )}
          {sobra > 0 && (
            <Typography sx={{ fontSize: 13, color: COR.suave }}>
              + {sobra} {sobra === 1 ? 'resposta' : 'respostas'} na visita
            </Typography>
          )}
          <LinkVisita visitaId={evento.visita.id} />
        </Box>
      </Box>
      {(total > 0 || comentando) && (
        <ConversaEmbutida
          visitaId={evento.visita.id}
          registroId={registro.id}
          mensagens={conversa}
          total={total}
          novos={registro.comentarios_novos ?? 0}
          nomePromotor={evento.usuario?.nome ?? ''}
        />
      )}
    </Post>
  );
}

const LINHAS_RECOLHIDO = 6;

// Formulário respondido (docs/43 §8) — todas as respostas do mesmo formulário na mesma visita num
// post só: "mano respondeu Pesquisa de Preço · 12 itens", com as respostas em tabela (uma linha por
// produto/registro, até 3 perguntas como colunas). Com uma resposta só, vira o post em blocos.
export function PostFormulario({ evento, acoes }: { evento: AtividadeEvento; acoes: AcoesFeed }) {
  const registros = evento.registros ?? [];
  const conversas = evento.conversas ?? {};
  const [expandido, setExpandido] = useState(false);
  const [conversaAberta, setConversaAberta] = useState<string | null>(null);

  if (registros.length === 1) {
    return <PostRegistroUnico evento={evento} registro={registros[0]} conversa={conversas[registros[0].id] ?? []} acoes={acoes} />;
  }

  // Colunas = perguntas respondidas, na ordem em que aparecem (até 3); SORTIMENTO fica de fora
  // (lista de produtos não cabe numa célula — está no detalhe da visita).
  const colunas: { chave: string; rotulo: string }[] = [];
  for (const r of registros) {
    for (const c of r.campos_respondidos) {
      if (c.tipo_campo === 'SORTIMENTO' || !c.valor || colunas.some((col) => col.chave === c.chave)) continue;
      colunas.push({ chave: c.chave, rotulo: c.rotulo });
    }
  }
  const colunasVisiveis = colunas.slice(0, 3);
  const temAssunto = registros.some((r) => assuntoDoRegistro(r));
  const fotos = achatarFotos(registros);
  const pontuados = registros.filter((r) => r.pontuacao !== null);
  const compliance = pontuados.length
    ? Math.round(pontuados.reduce((soma, r) => soma + (r.pontuacao ?? 0), 0) / pontuados.length)
    : null;
  const rupturas = registros.filter((r) => r.ruptura).length;
  const visiveis = expandido ? registros : registros.slice(0, LINHAS_RECOLHIDO);
  const grade = `${temAssunto ? 'minmax(0, 1.6fr) ' : ''}repeat(${colunasVisiveis.length}, minmax(0, 1fr)) 64px`;

  return (
    <Post evento={evento}>
      <Box sx={{ px: 2, pt: 1.75, pb: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Frase evento={evento} verbo="respondeu" objeto={evento.tipo_registro?.descricao} />
          <Subtitulo>
            {evento.ponto_venda?.fantasia} · {formatarHora(evento.ocorrido_em)} · {registros.length} itens
          </Subtitulo>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {rupturas > 0 && (
            <Pilula bg="#fdeeee" fg="#b91c1c">
              {rupturas} {rupturas === 1 ? 'ruptura' : 'rupturas'}
            </Pilula>
          )}
          {compliance !== null && (
            <Pilula bg="#fff7e6" fg="#92400e">
              {compliance}% compliance
            </Pilula>
          )}
        </Box>
      </Box>

      {/* Tabela de respostas */}
      <Box sx={{ mx: 2, border: `1px solid ${COR.borda}`, borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: grade, gap: 1.5, px: 1.5, py: 0.75, bgcolor: COR.fundoSuave }}>
          {temAssunto && <Typography sx={{ fontSize: 12, color: COR.suave, fontWeight: 600 }}>Produto</Typography>}
          {colunasVisiveis.map((c) => (
            <Typography key={c.chave} sx={{ fontSize: 12, color: COR.suave, fontWeight: 600 }} noWrap title={c.rotulo}>
              {c.rotulo}
            </Typography>
          ))}
          <Box />
        </Box>
        {visiveis.map((r) => {
          const total = r.comentarios_count ?? 0;
          const novos = r.comentarios_novos ?? 0;
          const fotosDoRegistro = achatarFotos([r]);
          const aberta = conversaAberta === r.id;
          return (
            <Box key={r.id} sx={{ borderTop: `1px solid ${COR.borda}` }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: grade, gap: 1.5, px: 1.5, py: 1, alignItems: 'center' }}>
                {temAssunto && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    {r.ruptura && <Box title="Ruptura" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#dc2626', flexShrink: 0 }} />}
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap title={assuntoDoRegistro(r) ?? ''}>
                      {assuntoDoRegistro(r) ?? '—'}
                    </Typography>
                  </Box>
                )}
                {colunasVisiveis.map((c) => {
                  const valor = r.campos_respondidos.find((cr) => cr.chave === c.chave)?.valor;
                  return (
                    <Typography key={c.chave} sx={{ fontSize: 14 }} noWrap title={valor ? String(valor) : ''}>
                      {valor || '—'}
                    </Typography>
                  );
                })}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25 }}>
                  {fotosDoRegistro.length > 0 && (
                    <IconButton size="small" title="Ver foto" onClick={() => acoes.onAbrirFotos(fotosDoRegistro, 0)}>
                      <ImageOutlinedIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    title={total > 0 ? `${total} comentário(s)` : 'Comentar'}
                    onClick={() => setConversaAberta(aberta ? null : r.id)}
                    sx={{ color: novos > 0 ? COR.indigo : total > 0 ? COR.texto : 'text.disabled', gap: 0.25 }}
                  >
                    <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
                    {total > 0 && <Box component="span" sx={{ fontSize: 12, fontWeight: 600 }}>{total}</Box>}
                  </IconButton>
                </Box>
              </Box>
              {aberta && (
                <ConversaEmbutida
                  visitaId={evento.visita.id}
                  registroId={r.id}
                  mensagens={conversas[r.id] ?? []}
                  total={total}
                  novos={novos}
                  nomePromotor={evento.usuario?.nome ?? ''}
                />
              )}
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25 }}>
        {registros.length > LINHAS_RECOLHIDO && (
          <MuiLink component="button" type="button" onClick={() => setExpandido((e) => !e)} sx={{ fontSize: 14 }}>
            {expandido ? 'Mostrar menos' : `Ver todos os ${registros.length} itens`}
          </MuiLink>
        )}
        {fotos.length > 0 && (
          <Button
            size="small"
            startIcon={<ImageOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => acoes.onAbrirFotos(fotos, 0)}
            sx={{ textTransform: 'none', fontSize: 14 }}
          >
            {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
          </Button>
        )}
        {colunas.length > colunasVisiveis.length && (
          <Typography sx={{ fontSize: 13, color: COR.suave }}>+ {colunas.length - colunasVisiveis.length} perguntas na visita</Typography>
        )}
        <LinkVisita visitaId={evento.visita.id} />
      </Box>
    </Post>
  );
}

export function PostAlerta({ evento, acoes }: { evento: AtividadeEvento; acoes: AcoesFeed }) {
  const registro = evento.registro!;
  const [comentando, setComentando] = useState(false);
  const fotos = achatarFotos([registro]);
  const assunto = assuntoDoRegistro(registro);
  const resolvido = !!registro.alerta_resolvido_em;
  const plano = registro.plano_acao_ativo;
  const total = registro.comentarios_count ?? 0;

  // Resolvido (sem plano correndo) → post compacto: quem já foi tratado não disputa atenção.
  if (resolvido && !plano) {
    return (
      <Post evento={evento} compacto>
        <Box sx={{ px: 1.75, py: 1.5, display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Box
            onClick={() => fotos.length > 0 && acoes.onAbrirFotos(fotos, 0)}
            sx={{
              width: 56,
              height: 56,
              borderRadius: 1.25,
              overflow: 'hidden',
              flexShrink: 0,
              bgcolor: '#ecebf3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: fotos.length > 0 ? 'pointer' : 'default',
            }}
          >
            {fotos.length > 0 ? (
              <AutenticatedImage url={fotos[0].imagem.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <ImageOutlinedIcon sx={{ color: 'text.disabled' }} />
            )}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600 }} noWrap>
              <Box component="span" sx={{ color: corDaPessoa(evento.usuario?.id).fg }}>
                {evento.usuario?.nome ?? 'Alguém'}
              </Box>
              <Box component="span" sx={{ fontWeight: 400, color: COR.suave }}>
                {' · '}
              </Box>
              {registro.tipo_registro.descricao}
              {assunto ? ` · ${assunto}` : ''}
            </Typography>
            <Subtitulo>
              {evento.ponto_venda?.fantasia} · {formatarHora(evento.ocorrido_em)}
              {total > 0 ? ` · ${total} ${total === 1 ? 'comentário' : 'comentários'}` : ''}
            </Subtitulo>
          </Box>
          <Pilula bg="#eafaf0" fg="#166534" sx={{ fontWeight: 600 }}>
            <CheckIcon sx={{ fontSize: 14 }} />
            {registro.resolvido_por ? `Resolvido por ${primeiroNome(registro.resolvido_por.nome)}` : 'Resolvido'}
          </Pilula>
        </Box>
      </Post>
    );
  }

  const selo = plano ? (
    <Pilula bg="#eef0ff" fg="#3730a3">
      <TaskAltIcon sx={{ fontSize: 14 }} />
      Plano em andamento
    </Pilula>
  ) : acoes.requerResolucao ? (
    <Pilula bg="#fdeeee" fg="#b91c1c">
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#dc2626' }} />
      Pendente
    </Pilula>
  ) : null;

  return (
    <Post evento={evento}>
      <Box sx={{ px: 2, pt: 1.75, pb: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Frase evento={evento} verbo="registrou" objeto={registro.tipo_registro.descricao} />
          <Subtitulo>
            {evento.ponto_venda?.fantasia} · {formatarHora(evento.ocorrido_em)}
          </Subtitulo>
        </Box>
        {selo}
      </Box>
      {(assunto || registro.observacao) && (
        <Box sx={{ px: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {assunto && <Typography sx={{ fontSize: 17, fontWeight: 600 }}>{assunto}</Typography>}
          {registro.observacao && <Typography sx={{ fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{registro.observacao}</Typography>}
        </Box>
      )}
      {fotos.length > 0 && (
        <Box sx={{ px: 2 }}>
          <Album fotos={fotos} altura={220} maximo={2} onAbrir={(i) => acoes.onAbrirFotos(fotos, i)} />
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        {plano ? (
          <Button variant="outlined" size="small" startIcon={<TaskAltIcon />} component={RouterLink} to={`/planos-acao/${plano.id}`} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.25, height: 36 }}>
            Ver plano de ação
          </Button>
        ) : (
          <>
            <Button variant="contained" disableElevation size="small" onClick={() => acoes.onAbrirPlano(evento)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.25, height: 36, px: 1.75 }}>
              Abrir plano de ação
            </Button>
            {acoes.requerResolucao && (
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                disabled={acoes.resolvendo}
                onClick={() => acoes.onResolver(evento.visita.id, registro.id)}
                sx={{ textTransform: 'none', borderRadius: 1.25, height: 36, borderColor: '#d9d7e6' }}
              >
                Marcar resolvido
              </Button>
            )}
          </>
        )}
        {total === 0 && !comentando && (
          <Button size="small" startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />} onClick={() => setComentando(true)} sx={{ textTransform: 'none', fontSize: 14 }}>
            Comentar
          </Button>
        )}
        <LinkVisita visitaId={evento.visita.id} />
      </Box>
      {(total > 0 || comentando) && (
        <ConversaEmbutida
          visitaId={evento.visita.id}
          registroId={registro.id}
          mensagens={evento.conversa ?? []}
          total={total}
          novos={registro.comentarios_novos ?? 0}
          nomePromotor={evento.usuario?.nome ?? ''}
        />
      )}
    </Post>
  );
}
