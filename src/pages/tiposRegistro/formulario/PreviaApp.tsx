import { Box, Paper, Typography } from '@mui/material';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import { MdiIcon } from '../../../components/MdiIcon';
import { opcoesDoTexto, sobreOQue, type CampoForm, type FormData } from './modelo';

/**
 * Prévia do formulário do jeito que o promotor vê no celular — espelha o visual e o fluxo de
 * mobile/src/components/RegistroFormModal.tsx (bottom sheet, cabeçalho com ícone, campos, ruptura,
 * "Vincular a", botão do rodapé) e dá pra tocar: responder uma pergunta mostra as condicionais, e
 * na coleta guiada (lista de produtos) tocar num produto abre o formulário dele, com a seta de
 * voltar; "Salvar produto" marca o produto como preenchido na lista. Nada aqui vai pro servidor.
 *
 * Cores/raios copiados de mobile/src/theme (cores.ts) — em escala menor pra caber na lateral.
 */
const C = {
  primaria: '#4f46e5',
  primariaClara: '#eef2ff',
  primariaEscura: '#4338ca',
  indigo100: '#e0e7ff',
  indigo300: '#a5b4fc',
  texto: '#111827',
  textoSecundario: '#6b7280',
  textoTerciario: '#9ca3af',
  neutro100: '#f3f4f6',
  neutro300: '#d1d5db',
  neutro700: '#374151',
  borda: '#e5e7eb',
  fundo: '#f9fafb',
  sucesso: '#15803d',
  sucessoFundo: '#f0fdf4',
  erro: '#b91c1c',
  erroFundo: '#fef2f2',
  erroBorda: '#fecaca',
};

type Produto = { uuid: string; descricao: string };

export function PreviaApp({ d }: { d: FormData }) {
  const produtos = d.produtos_predefinidos ?? [];
  const sobre = sobreOQue(d);
  const listaGuiada = sobre === 'PRODUTO' && produtos.length > 0;

  const [aberto, setAberto] = useState<Produto | null>(null);
  const [preenchidos, setPreenchidos] = useState<Set<string>>(new Set());
  const [valores, setValores] = useState<Record<string, string>>({});
  const [ruptura, setRuptura] = useState(false);

  // Produto aberto que saiu da lista (editando ao lado) → volta pra lista.
  const produtoAberto = listaGuiada && aberto && produtos.some((p) => p.uuid === aberto.uuid) ? aberto : null;
  const naLista = listaGuiada && !produtoAberto;

  function abrir(p: Produto) {
    setAberto(p);
    setValores({});
    setRuptura(false);
  }
  function voltar() {
    setAberto(null);
  }
  function salvarProduto() {
    if (produtoAberto) setPreenchidos((s) => new Set(s).add(produtoAberto.uuid));
    setAberto(null);
  }
  function reiniciar() {
    setAberto(null);
    setPreenchidos(new Set());
    setValores({});
    setRuptura(false);
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
          Prévia no app
        </Typography>
        <Typography
          variant="caption"
          color="primary"
          sx={{ cursor: 'pointer', fontWeight: 600 }}
          onClick={reiniciar}
          role="button"
        >
          Recomeçar
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
        Toque nas respostas e nos produtos pra testar como o promotor vai ver.
      </Typography>

      {/* Moldura do celular; o fundo escurecido é a tela da visita por trás do bottom sheet. */}
      <Box
        sx={{
          mx: 'auto',
          width: 272,
          height: 540,
          border: '8px solid #1f1d2e',
          borderRadius: '30px',
          overflow: 'hidden',
          position: 'relative',
          bgcolor: C.fundo,
          fontFamily: 'Roboto, system-ui, sans-serif',
        }}
      >
        <FundoVisita />
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(17,24,39,0.45)' }} />
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '90%',
            bgcolor: '#fff',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.75 }}>
            <Box sx={{ width: 32, height: 4, borderRadius: 4, bgcolor: C.neutro300 }} />
          </Box>
          <Cabecalho
            icone={d.icone}
            titulo={d.descricao || 'Nome do formulário'}
            subtitulo={produtoAberto?.descricao ?? null}
            onVoltar={produtoAberto ? voltar : null}
          />
          {naLista ? (
            <ListaColeta produtos={produtos} preenchidos={preenchidos} onAbrir={abrir} />
          ) : (
            <Formulario
              d={d}
              valores={valores}
              setValor={(chave, v) => setValores((atual) => ({ ...atual, [chave]: v }))}
              ruptura={ruptura}
              setRuptura={setRuptura}
              temProduto={!!produtoAberto}
              onSalvar={produtoAberto ? salvarProduto : undefined}
            />
          )}
        </Box>
      </Box>
    </Paper>
  );
}

/** Esboço bem apagado da tela "Ações da visita" por trás do bottom sheet. */
function FundoVisita() {
  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ height: 10, width: '55%', borderRadius: 1, bgcolor: C.neutro300 }} />
      <Box sx={{ height: 38, borderRadius: 1.5, bgcolor: '#fff', border: `1px solid ${C.borda}` }} />
      <Box sx={{ height: 38, borderRadius: 1.5, bgcolor: '#fff', border: `1px solid ${C.borda}` }} />
    </Box>
  );
}

function Cabecalho({
  icone,
  titulo,
  subtitulo,
  onVoltar,
}: {
  icone: string | null | undefined;
  titulo: string;
  subtitulo: string | null;
  onVoltar: (() => void) | null;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        pt: 0.75,
        pb: 1,
        borderBottom: `1px solid ${C.neutro100}`,
      }}
    >
      {onVoltar ? (
        <Box
          role="button"
          aria-label="Voltar para a lista"
          onClick={onVoltar}
          sx={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <MdiIcon icone="chevron-left" size={22} sx={{ color: C.texto }} />
        </Box>
      ) : (
        <Box
          sx={{
            width: 31,
            height: 31,
            borderRadius: '9px',
            bgcolor: C.primariaClara,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <MdiIcon icone={icone || 'clipboard-text-outline'} size={15} sx={{ color: C.primaria }} />
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 700, color: C.texto, lineHeight: 1.3 }}>
          {titulo}
        </Typography>
        {subtitulo && (
          <Typography noWrap sx={{ fontSize: 10.5, color: C.textoSecundario }}>
            {subtitulo}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: C.neutro100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <MdiIcon icone="close" size={14} sx={{ color: C.neutro700 }} />
      </Box>
    </Box>
  );
}

function ListaColeta({
  produtos,
  preenchidos,
  onAbrir,
}: {
  produtos: Produto[];
  preenchidos: Set<string>;
  onAbrir: (p: Produto) => void;
}) {
  const feitos = produtos.filter((p) => preenchidos.has(p.uuid)).length;
  const faltam = produtos.length - feitos;
  return (
    <>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.texto }}>
            {feitos} de {produtos.length} produto{produtos.length === 1 ? '' : 's'} preenchido{feitos === 1 ? '' : 's'}
          </Typography>
          <Box sx={{ borderRadius: 99, px: 0.9, py: 0.2, bgcolor: C.texto }}>
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>PENDENTE</Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 10.5, color: C.textoSecundario }}>
          Preencha cada produto e toque em Salvar no fim da lista.
        </Typography>
        {produtos.map((p) => {
          const feito = preenchidos.has(p.uuid);
          return (
            <Box
              key={p.uuid}
              role="button"
              onClick={() => onAbrir(p)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 1.1,
                borderRadius: '7px',
                border: `1px solid ${feito ? C.sucesso : C.borda}`,
                bgcolor: '#fff',
                cursor: 'pointer',
                '&:hover': { bgcolor: C.fundo },
              }}
            >
              <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: C.texto }}>
                {p.descricao}
              </Typography>
              <Box
                sx={{
                  width: 17,
                  height: 17,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor: feito ? C.sucesso : C.indigo100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {feito && <MdiIcon icone="check" size={11} sx={{ color: '#fff' }} />}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Rodape texto={faltam > 0 ? `Salvar (faltam ${faltam})` : 'Salvar'} fraco={faltam > 0} />
    </>
  );
}

function Formulario({
  d,
  valores,
  setValor,
  ruptura,
  setRuptura,
  temProduto,
  onSalvar,
}: {
  d: FormData;
  valores: Record<string, string>;
  setValor: (chave: string, valor: string) => void;
  ruptura: boolean;
  setRuptura: (r: boolean) => void;
  temProduto: boolean;
  onSalvar?: () => void;
}) {
  const campos = d.campos ?? [];
  // Mesma regra do app: a condicional só aparece quando a pergunta-mãe tem a resposta combinada.
  const visiveis = campos.filter((c) => !c.depende_de_chave || valores[c.depende_de_chave] === c.depende_de_valor);
  const sobre = sobreOQue(d);
  // "Vincular a" — mesma regra do app (RegistroFormModal): some quando já tem produto (coleta
  // guiada); "por produto" só aceita Produto; senão as 4 categorias, opcional.
  const exigeProduto = sobre === 'PRODUTO';
  const mostraVinculo = !temProduto && (d.permite_vincular_catalogo || exigeProduto);
  const categorias = exigeProduto ? ['Produto'] : ['Produto', 'Seção', 'Departamento', 'Marca'];
  const [vinculo, setVinculo] = useState<string | null>(null);
  // Tocar em "Câmera" simula a foto tirada (no app abre a câmera direto, sem galeria).
  const [fotos, setFotos] = useState(0);
  const faltaFoto = d.exige_foto && fotos === 0;

  return (
    <>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Bloco>
          <Rotulo>
            Fotos{' '}
            <Box component="span" sx={{ fontWeight: 500, color: C.textoTerciario }}>
              · {fotos > 0 ? `${fotos} adicionada${fotos > 1 ? 's' : ''}` : d.exige_foto ? 'obrigatória' : 'opcional'}
            </Box>
          </Rotulo>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Box
              role="button"
              onClick={() => setFotos((n) => n + 1)}
              sx={{
                cursor: 'pointer',
                width: 56,
                height: 56,
                borderRadius: '9px',
                border: `1.5px dashed ${C.indigo300}`,
                bgcolor: C.primariaClara,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.2,
              }}
            >
              <MdiIcon icone="camera-plus-outline" size={17} sx={{ color: C.primaria }} />
              <Typography sx={{ fontSize: 9, fontWeight: 700, color: C.primariaEscura }}>Câmera</Typography>
            </Box>
            {Array.from({ length: fotos }, (_, i) => (
              <Box
                key={i}
                role="button"
                aria-label="Remover foto"
                onClick={() => setFotos((n) => n - 1)}
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '9px',
                  bgcolor: C.neutro300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <MdiIcon icone="image-outline" size={20} sx={{ color: '#fff' }} />
              </Box>
            ))}
          </Box>
        </Bloco>

        {ruptura && visiveis.length > 0 && (
          <Typography sx={{ fontSize: 10.5, color: C.textoSecundario }}>
            Produto em ruptura — não precisa responder as perguntas.
          </Typography>
        )}
        {!ruptura &&
          visiveis.map((c, i) => (
            <Box
              key={`${c.chave}-${i}`}
              sx={c.depende_de_chave ? { borderLeft: `2px solid ${C.indigo300}`, pl: 1.25, ml: 0.4 } : undefined}
            >
              <Campo c={c} valor={valores[c.chave] ?? ''} onChange={(v) => setValor(c.chave, v)} />
            </Box>
          ))}
        {campos.length === 0 && (
          <Typography sx={{ fontSize: 10.5, color: C.textoTerciario, textAlign: 'center', py: 1 }}>
            Sem perguntas ainda
          </Typography>
        )}

        <Box
          role="button"
          onClick={() => setRuptura(!ruptura)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.1,
            borderRadius: '12px',
            border: `1px solid ${ruptura ? C.erroBorda : C.borda}`,
            bgcolor: ruptura ? C.erroFundo : '#fff',
            cursor: 'pointer',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ruptura ? C.erro : C.texto }}>
              Produto em ruptura
            </Typography>
            <Typography sx={{ fontSize: 9.5, color: C.textoSecundario }}>
              Não encontrado na gôndola nem no depósito
            </Typography>
          </Box>
          <Box
            sx={{
              width: 36,
              height: 22,
              borderRadius: 99,
              p: '2.5px',
              bgcolor: ruptura ? C.erro : C.neutro300,
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                width: 17,
                height: 17,
                borderRadius: '50%',
                bgcolor: '#fff',
                transform: ruptura ? 'translateX(14px)' : 'none',
                transition: 'transform .15s',
              }}
            />
          </Box>
        </Box>

        {mostraVinculo && (
          <Bloco>
            <Rotulo>Vincular a {exigeProduto ? '(obrigatório)' : '(opcional)'}</Rotulo>
            <Chips opcoes={categorias} valor={vinculo ?? ''} onChange={(v) => setVinculo(v || null)} />
          </Bloco>
        )}
      </Box>
      <Rodape
        texto={faltaFoto ? 'Adicione uma foto' : onSalvar ? 'Salvar produto' : 'Salvar registro'}
        fraco={faltaFoto}
        onClick={faltaFoto ? undefined : onSalvar}
      />
    </>
  );
}

function Campo({ c, valor, onChange }: { c: CampoForm; valor: string; onChange: (v: string) => void }) {
  const rotulo = (
    <Rotulo>
      {c.rotulo || 'Pergunta sem texto'}
      {c.obrigatorio ? ' *' : ''}
      {c.tipo_campo === 'MOEDA' ? ' (R$)' : ''}
    </Rotulo>
  );

  let corpo: ReactNode;
  switch (c.tipo_campo) {
    case 'BOOLEANO':
      corpo = (
        <Chips
          opcoes={['Sim', 'Não']}
          valor={valor === '1' ? 'Sim' : valor === '0' ? 'Não' : ''}
          onChange={(v) => onChange(v === 'Sim' ? '1' : v === 'Não' ? '0' : '')}
        />
      );
      break;
    case 'MULTIPLA_ESCOLHA': {
      const opcoes = opcoesDoTexto(c.opcoesTexto);
      corpo = opcoes.length ? (
        <Chips opcoes={opcoes} valor={valor} onChange={onChange} />
      ) : (
        <Typography sx={{ fontSize: 10, color: C.textoTerciario }}>Sem opções cadastradas</Typography>
      );
      break;
    }
    case 'SORTIMENTO': {
      const itens =
        c.sortimento_origem === 'FIXO'
          ? c.sortimento_produtos.slice(0, 5).map((p) => p.descricao)
          : ['Produto do mix da loja 1', 'Produto do mix da loja 2'];
      corpo = (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {(itens.length ? itens : ['Nenhum produto escolhido']).map((p) => (
            <Box key={p} sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
              {/* Nasce tudo marcado como presente — o promotor só desmarca o que falta. */}
              <Box
                sx={{
                  width: 17,
                  height: 17,
                  borderRadius: '5px',
                  bgcolor: C.primaria,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MdiIcon icone="check" size={11} sx={{ color: '#fff' }} />
              </Box>
              <Typography noWrap sx={{ fontSize: 11, color: C.texto }}>
                {p}
              </Typography>
            </Box>
          ))}
        </Box>
      );
      break;
    }
    default:
      corpo = (
        <Box
          component="input"
          value={valor}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          placeholder={c.tipo_campo === 'MOEDA' ? '0,00' : c.tipo_campo === 'DATA' ? 'dd/mm/aaaa' : ''}
          inputMode={c.tipo_campo === 'MOEDA' || c.tipo_campo === 'NUMERO' ? 'decimal' : undefined}
          sx={{
            width: '100%',
            boxSizing: 'border-box',
            height: 36,
            border: `1px solid ${C.borda}`,
            borderRadius: '9px',
            px: 1.25,
            fontSize: 12,
            fontFamily: 'inherit',
            color: C.texto,
            bgcolor: '#fff',
            outline: 'none',
            '&:focus': { borderColor: C.primaria },
            '&::placeholder': { color: C.textoTerciario },
          }}
        />
      );
  }

  return (
    <Bloco>
      {rotulo}
      {corpo}
    </Bloco>
  );
}

function Bloco({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>{children}</Box>;
}

function Rotulo({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: C.neutro700 }}>{children}</Typography>;
}

function Chips({ opcoes, valor, onChange }: { opcoes: string[]; valor: string; onChange: (v: string) => void }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {opcoes.map((o) => {
        const sel = valor === o;
        return (
          <Box
            key={o}
            role="button"
            onClick={() => onChange(sel ? '' : o)}
            sx={{
              minHeight: 30,
              px: 1.25,
              borderRadius: 99,
              border: `1px solid ${sel ? C.primaria : C.borda}`,
              bgcolor: sel ? C.primaria : '#fff',
              color: sel ? '#fff' : C.neutro700,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {o}
          </Box>
        );
      })}
    </Box>
  );
}

function Rodape({ texto, fraco, onClick }: { texto: string; fraco?: boolean; onClick?: () => void }) {
  return (
    <Box sx={{ p: 1.5, borderTop: `1px solid ${C.neutro100}`, bgcolor: '#fff' }}>
      <Box
        role="button"
        onClick={onClick}
        sx={{
          minHeight: 40,
          borderRadius: '9px',
          bgcolor: fraco ? C.indigo300 : C.primaria,
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        {texto}
      </Box>
    </Box>
  );
}
