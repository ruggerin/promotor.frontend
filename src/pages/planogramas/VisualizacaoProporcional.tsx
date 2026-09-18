import PhotoSizeSelectLargeIcon from '@mui/icons-material/PhotoSizeSelectLarge';
import PhotoSizeSelectSmallIcon from '@mui/icons-material/PhotoSizeSelectSmall';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Box, IconButton, Slider, Tooltip, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import type { Planograma, PlanogramaBloco, PlanogramaPrateleira } from '../../types/api';

const ZOOM_PADRAO = 100;
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ALTURA_ANDAR = 110;
const ALTURA_MOLDURA = 560;

interface Segmento {
  posicao: number;
  percentual: number;
  bloco: PlanogramaBloco | undefined;
}

// Mesma varredura "posição a posição" do editor (posicoesCobertasPorPrateleira em
// PlanogramaEditorPage) e do modo mobile (resolverSegmentos em PlanogramaDetalheScreen) — a
// diferença de propósito aqui é devolver o percentual da largura em vez de span de grid CSS.
// Célula vazia conta como largura 1; os percentuais de uma prateleira sempre somam 100% porque
// os segmentos cobrem `quantidade_blocos` inteiro sem sobrepor (regra já validada no cadastro).
// Ver docs/22-PLANOGRAMA.md §9.3.
function resolverSegmentos(prateleira: PlanogramaPrateleira): Segmento[] {
  const segmentos: Segmento[] = [];
  let posicao = 0;
  while (posicao < prateleira.quantidade_blocos) {
    const bloco = prateleira.blocos.find((b) => b.posicao_inicio === posicao);
    const largura = bloco?.largura ?? 1;
    segmentos.push({ posicao, percentual: (largura / prateleira.quantidade_blocos) * 100, bloco });
    posicao += largura;
  }
  return segmentos;
}

/**
 * Modo de visualização alternativo do mesmo planograma já cadastrado — sem edição nenhuma aqui
 * (decisão 18 de docs/22-PLANOGRAMA.md §9.2), só um jeito mais bonito/realista de olhar pro que
 * já existe. A peça INTEIRA (todos os andares juntos) é uma arte só, tipo um canva — zoom e
 * arrastar valem pro conjunto de uma vez, não andar por andar (pedido explícito do usuário
 * depois da primeira versão ter feito isso errado, cada andar com zoom independente).
 */
export function VisualizacaoProporcional({ planograma }: { planograma: Planograma }) {
  const [zoom, setZoom] = useState(ZOOM_PADRAO);
  const [deslocamento, setDeslocamento] = useState({ x: 0, y: 0 });
  const arrastando = useRef<{ x: number; y: number; deslocInicial: { x: number; y: number } } | null>(null);

  function aoIniciarArrasto(evento: React.MouseEvent) {
    arrastando.current = { x: evento.clientX, y: evento.clientY, deslocInicial: deslocamento };
  }

  function aoMoverArrasto(evento: React.MouseEvent) {
    if (!arrastando.current) return;
    const dx = evento.clientX - arrastando.current.x;
    const dy = evento.clientY - arrastando.current.y;
    setDeslocamento({ x: arrastando.current.deslocInicial.x + dx, y: arrastando.current.deslocInicial.y + dy });
  }

  function aoSoltarArrasto() {
    arrastando.current = null;
  }

  function resetar() {
    setZoom(ZOOM_PADRAO);
    setDeslocamento({ x: 0, y: 0 });
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <PhotoSizeSelectSmallIcon fontSize="small" color="action" />
        <Slider
          size="small"
          value={zoom}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={10}
          onChange={(_, valor) => setZoom(valor as number)}
          sx={{ width: 160 }}
          aria-label="Zoom da visualização"
        />
        <PhotoSizeSelectLargeIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', minWidth: 36 }}>
          {zoom}%
        </Typography>
        <Tooltip title="Restaurar zoom e posição">
          <IconButton size="small" onClick={resetar}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          Arraste pra mover a peça inteira.
        </Typography>
      </Box>

      {planograma.prateleiras.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nenhum andar cadastrado ainda — volte pro modo Editor pra criar o primeiro.
        </Typography>
      )}

      {planograma.prateleiras.length > 0 && (
        // Moldura — recorte fixo (o "quadro" do canva). O conteúdo pode ficar maior (zoom) ou
        // deslocado (arrastar) sem vazar visualmente pro resto da tela.
        <Box
          onMouseDown={aoIniciarArrasto}
          onMouseMove={aoMoverArrasto}
          onMouseUp={aoSoltarArrasto}
          onMouseLeave={aoSoltarArrasto}
          sx={{
            height: ALTURA_MOLDURA,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'grey.50',
            cursor: arrastando.current ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          {/* Único filho transformado — zoom e posição valem pra peça inteira, não por andar. */}
          <Box
            sx={{
              p: 2,
              transform: `translate(${deslocamento.x}px, ${deslocamento.y}px) scale(${zoom / 100})`,
              transformOrigin: 'left top',
            }}
          >
            {planograma.prateleiras.map((prateleira) => (
              <Andar key={prateleira.id} prateleira={prateleira} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function Andar({ prateleira }: { prateleira: PlanogramaPrateleira }) {
  return (
    <Box sx={{ mb: 3, width: 700 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
        {prateleira.descricao || `Andar ${prateleira.ordem + 1}`}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', height: ALTURA_ANDAR }}>
        {resolverSegmentos(prateleira).map((segmento) => (
          <SegmentoProduto key={segmento.posicao} segmento={segmento} />
        ))}
      </Box>
      {/* Tabuleiro — faixa cinza mais escura simulando o "metal" da prateleira de verdade, mesma
          ambientação do modo mobile (decisão 20). */}
      <Box sx={{ height: 8, mt: '-1px', borderRadius: 0.5, bgcolor: 'grey.400', boxShadow: 1 }} />
    </Box>
  );
}

function SegmentoProduto({ segmento }: { segmento: Segmento }) {
  const { bloco, percentual } = segmento;

  return (
    <Box
      sx={{
        flex: `0 0 ${percentual}%`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        borderRight: '1px solid',
        borderColor: 'divider',
        px: 0.5,
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}
    >
      {bloco?.produto_auditoria?.imagem_url ? (
        <>
          <Box
            component="img"
            src={bloco.produto_auditoria.imagem_url}
            draggable={false}
            sx={{ maxWidth: '100%', maxHeight: '82%', objectFit: 'contain' }}
          />
          {/* Sombra achatada sob o produto — pseudo-elemento simples em vez de box-shadow
              nativa, mesmo efeito visual da imagem de referência que motivou este modo. */}
          <Box sx={{ width: '70%', height: 6, borderRadius: 999, bgcolor: 'rgba(17, 24, 39, 0.18)', mt: 0.5 }} />
        </>
      ) : bloco ? (
        <Typography variant="caption" sx={{ fontSize: 9, textAlign: 'center', color: 'text.secondary', mb: 0.5 }}>
          {bloco.produto_auditoria?.descricao}
        </Typography>
      ) : null}
    </Box>
  );
}
