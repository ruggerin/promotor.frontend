import {
  Alert,
  Box,
  Chip,
  Divider,
  Link as MuiLink,
  Paper,
  Typography,
} from '@mui/material';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import printUsuariosNovo from './screenshots/usuarios-novo.png';
import printPontosVendaNovo from './screenshots/pontos-venda-novo.png';
import printAtribuirPromotor from './screenshots/pontos-venda-atribuir-promotor.png';
import printFormularioNovo from './screenshots/formularios-novo.png';
import printOrdemServicoNovo from './screenshots/ordens-servico-novo.png';
import printDirecionamentoNovo from './screenshots/direcionamentos-novo.png';

interface ItemToc {
  id: string;
  titulo: string;
}

const SUMARIO: ItemToc[] = [
  { id: 'visao-geral', titulo: 'Visão geral' },
  { id: 'usuarios', titulo: '1. Cadastrar usuários' },
  { id: 'pontos-venda', titulo: '2. Cadastrar lojas' },
  { id: 'vincular-promotor', titulo: '3. Vincular promotor a loja' },
  { id: 'formularios', titulo: '4. Criar um formulário' },
  { id: 'ordem-servico', titulo: '5. Criar uma Ordem de Serviço' },
  { id: 'direcionamento', titulo: '6. Direcionamento (em massa)' },
  { id: 'coleta', titulo: '7. A coleta no celular' },
];

/**
 * Manual operacional do sistema — base de conhecimento embutida no próprio admin, pedido
 * explícito do usuário ("primeiro, como uma pessoa que nunca usou o sistema, tem o
 * direcionamento do começo, já tá pra fazer as primeiras coletas"). Conteúdo estático (sem
 * endpoint, sem CRUD) — texto + prints reais tirados ao vivo da própria aplicação (ver processo
 * na sessão que criou este arquivo). Deliberadamente sem dado real de cliente em nenhum print —
 * só telas de cadastro vazias e diálogos que não expõem linha nenhuma da tabela por trás.
 */
export function ManualPage() {
  const cabecalho = usePageHeader(
    <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
      Manual
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Passo a passo pra quem nunca usou o sistema — do zero até a primeira coleta em campo.
      </Typography>

      <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        <Box
          component="nav"
          sx={{
            position: 'sticky',
            top: 80,
            flexShrink: 0,
            width: 220,
            display: { xs: 'none', md: 'block' },
          }}
        >
          {SUMARIO.map((item) => (
            <MuiLink
              key={item.id}
              href={`#${item.id}`}
              underline="hover"
              sx={{
                display: 'block',
                py: 0.5,
                fontSize: 13.5,
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' },
              }}
            >
              {item.titulo}
            </MuiLink>
          ))}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, maxWidth: 760 }}>
          <Secao id="visao-geral" titulo="Visão geral — as peças do sistema">
            <Typography sx={{ mb: 2 }}>
              Antes de sair cadastrando, vale entender como as peças se encaixam. Na ordem em que
              você normalmente vai usá-las:
            </Typography>
            <Box component="ol" sx={{ pl: 3, m: 0, '& li': { mb: 1 } }}>
              <li>
                <b>Usuário</b> — quem acessa o sistema: um promotor (faz a coleta no celular) ou
                um admin/gestor (usa esta tela aqui).
              </li>
              <li>
                <b>Ponto de Venda</b> — a loja que vai ser visitada.
              </li>
              <li>
                <b>Formulário</b> — o que o promotor responde numa visita (ex.: "Foto", "Ruptura",
                "Ponto extra"). Hoje aparece no menu como "Formulários", mas por baixo é chamado
                de "Tipo de Registro".
              </li>
              <li>
                <b>Ordem de Serviço</b> — uma tarefa pontual: "promotor X, vá na loja Y, até tal
                data, responda esses formulários".
              </li>
              <li>
                <b>Direcionamento</b> — um molde que cria várias Ordens de Serviço de uma vez, pra
                várias lojas ao mesmo tempo, em vez de criar uma por uma.
              </li>
              <li>
                <b>Visita / Registro</b> — o que acontece de verdade: o promotor chega na loja
                (check-in), responde os formulários (cada resposta é um "registro"), e sai
                (checkout).
              </li>
            </Box>
            <Alert severity="info" sx={{ mt: 2 }}>
              Ordem de Serviço e Direcionamento resolvem o mesmo problema ("o que o promotor
              precisa fazer nessa loja") — a diferença é só a escala. Uma loja específica → Ordem
              de Serviço direto. Um monte de lojas de uma vez → Direcionamento.
            </Alert>
          </Secao>

          <Secao id="usuarios" titulo="1. Cadastrar usuários">
            <Typography sx={{ mb: 2 }}>
              Menu <b>Usuários</b> → botão <b>Novo usuário</b>.
            </Typography>
            <Print src={printUsuariosNovo} legenda="Formulário de novo usuário" />
            <Box component="ul" sx={{ pl: 3, m: 0, '& li': { mb: 1 } }}>
              <li>
                <b>Tipo de usuário</b>: Promotor (faz visita no celular), Gestor ou Admin (usam o
                admin web).
              </li>
              <li>
                <b>Perfil</b>: só preenche se este promotor for "supervisor" — ex.: alguém que
                precisa enxergar todos os PDVs no app, não só os dele.
              </li>
              <li>
                <b>Centro de custo</b>: opcional, usado pro cálculo de custo/hora deste promotor.
              </li>
            </Box>
          </Secao>

          <Secao id="pontos-venda" titulo="2. Cadastrar lojas (Pontos de Venda)">
            <Typography sx={{ mb: 2 }}>
              Menu <b>Pontos de Venda</b> → botão <b>Novo ponto de venda</b>.
            </Typography>
            <Print src={printPontosVendaNovo} legenda="Formulário de novo ponto de venda" />
            <Typography sx={{ mb: 2 }}>
              Latitude/Longitude são obrigatórios — é contra eles que o app confere se o promotor
              está mesmo dentro da loja na hora do check-in. Rede de Lojas e Ramo de Atividade são
              opcionais, servem pra organizar/filtrar depois (inclusive dentro de um
              Direcionamento, ver seção 6).
            </Typography>
          </Secao>

          <Secao id="vincular-promotor" titulo="3. Vincular um promotor a uma loja">
            <Typography sx={{ mb: 2 }}>
              Na lista de <b>Pontos de Venda</b>, marque a caixinha de uma ou mais lojas e clique
              em <b>Atribuir promotor</b>.
            </Typography>
            <Print src={printAtribuirPromotor} legenda="Atribuir promotor a lojas selecionadas" />
            <Typography sx={{ mb: 2 }}>
              Isso <b>soma</b> — não substitui quem já estava atribuído. Uma loja pode ter mais de
              um promotor (ex.: um titular e um backup). Pra remover um vínculo específico, é o
              "x" no chip do promotor direto na listagem.
            </Typography>
          </Secao>

          <Secao id="formularios" titulo="4. Criar um formulário">
            <Typography sx={{ mb: 2 }}>
              Menu <b>Formulários</b> → botão <b>Novo formulário</b>. É aqui que você define o que
              o promotor vai ver e preencher numa visita.
            </Typography>
            <Print src={printFormularioNovo} legenda="Página de novo formulário" />
            <Box component="ul" sx={{ pl: 3, m: 0, '& li': { mb: 1 } }}>
              <li>
                <b>Exige foto</b>: obriga o promotor a tirar uma foto pra responder esse
                formulário.
              </li>
              <li>
                <b>Permite vincular a produto/seção/departamento/marca</b>: liga esse formulário a
                um item do catálogo — é assim que um registro fica associado a um produto
                específico (ex.: "Ruptura do produto X").
              </li>
              <li>
                <b>É uma ação obrigatória</b>: vira pendência automática na aba "Ações" do
                promotor (toda visita, ou só em campanha/contrato específico) — sem precisar criar
                Ordem de Serviço nem Direcionamento pra isso.
              </li>
              <li>
                <b>Campos extras do formulário</b>: além da foto, pergunta adicional (texto,
                número, sim/não, múltipla escolha, mix — um checklist de vários produtos de
                uma vez).
              </li>
            </Box>
          </Secao>

          <Secao id="ordem-servico" titulo="5. Criar uma Ordem de Serviço (uma loja)">
            <Typography sx={{ mb: 2 }}>
              Menu <b>Ordens de Serviço</b> → botão <b>Nova ordem de serviço</b>. Use isso quando
              é uma tarefa pontual, pra <b>uma loja só</b> (ou fila aberta, pra qualquer promotor
              da empresa atender).
            </Typography>
            <Print src={printOrdemServicoNovo} legenda="Formulário de nova ordem de serviço" />
            <Typography sx={{ mb: 2 }}>
              O campo <b>Formulários (opcional)</b> no fim vincula formulários específicos direto
              nesta ordem — o promotor só vê essa pendência quando estiver atendendo essa loja
              exata, sem precisar que o formulário esteja marcado como "ação obrigatória" global.
            </Typography>
          </Secao>

          <Secao id="direcionamento" titulo='6. Direcionamento — "várias Ordens de Serviço de uma vez"'>
            <Alert severity="info" sx={{ mb: 2 }}>
              Se só uma coisa deste manual ficar clara: <b>Direcionamento não é um conceito
              novo</b> — é uma fábrica de Ordem de Serviço. Você preenche uma vez, o sistema cria
              uma Ordem de Serviço pra cada loja elegível sozinho.
            </Alert>
            <Typography sx={{ mb: 2 }}>
              Exemplo: "quero que <b>todas as lojas</b> (ou só as de uma rede, ou só as de um
              promotor específico) respondam o checklist de Dia dos Pais até o fim do mês." Sem
              Direcionamento, você criaria uma Ordem de Serviço manual pra cada loja, uma por uma.
              Com Direcionamento, você cria isso <b>uma vez só</b> e o sistema gera todas.
            </Typography>
            <Print src={printDirecionamentoNovo} legenda="Formulário de novo direcionamento" />
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Como ler os filtros
            </Typography>
            <Typography sx={{ mb: 2 }}>
              Os três filtros (Pontos de venda, Redes de loja, Promotores) são todos opcionais.{' '}
              <b>Nenhum marcado</b> = vale pra empresa inteira. Quando você marca mais de um,{' '}
              <b>dentro do mesmo filtro é "ou"</b> (Redes A <i>ou</i> B), mas{' '}
              <b>entre filtros diferentes é "e"</b> (lojas da rede A/B <i>e</i> atendidas pelo
              promotor X).
            </Typography>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Depois de criado
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0, '& li': { mb: 1 } }}>
              <li>
                O sistema já gera as Ordens de Serviço na hora — não precisa esperar nada.
              </li>
              <li>
                A tela de detalhe mostra o progresso: quantas ordens foram geradas, quantas já
                foram respondidas.
              </li>
              <li>
                Desativar o Direcionamento cancela as Ordens de Serviço que ainda não começaram —
                as que já estão em andamento ou concluídas nunca são mexidas.
              </li>
            </Box>
          </Secao>

          <Secao id="coleta" titulo="7. A coleta no celular (visão geral)">
            <Typography sx={{ mb: 2 }}>
              Isso já acontece no app do promotor, não no admin web — só pra fechar o fluxo:
            </Typography>
            <Box component="ol" sx={{ pl: 3, m: 0, '& li': { mb: 1 } }}>
              <li>O promotor abre o app e vê a loja na lista (ou na Agenda, se tiver prazo).</li>
              <li>
                Faz <b>check-in</b> — o app confere se ele está mesmo dentro do raio da loja.
              </li>
              <li>
                Na aba <b>Ações</b>, aparecem os formulários pendentes — vindos de ação
                obrigatória, de uma Ordem de Serviço ou de um Direcionamento, tudo junto na mesma
                lista.
              </li>
              <li>
                Ele toca em cada um, responde os campos, tira foto se o formulário exigir, e —
                quando o formulário permite — vincula a resposta a um produto/seção/departamento/
                marca específico do catálogo (é o "registro vinculado a produto" que gera a
                Galeria de Fotos e o Painel de Atividades depois).
              </li>
              <li>
                Faz <b>checkout</b> pra encerrar a visita. Se a empresa configurar o parâmetro de
                bloqueio (ver Parâmetros), o checkout não fecha enquanto sobrar formulário
                obrigatório de Direcionamento sem responder.
              </li>
            </Box>
            <Alert severity="warning" sx={{ mt: 2 }}>
              Tudo isso funciona offline — o app guarda numa fila local e sincroniza sozinho
              quando o sinal voltar. O promotor não precisa ficar esperando internet dentro da
              loja.
            </Alert>
          </Secao>

          <Divider sx={{ my: 4 }} />
          <Typography variant="caption" color="text.secondary">
            Alguma tela mudou e este manual ficou desatualizado? Os prints são reais, tirados
            direto da aplicação — se a tela mudar de verdade, vale atualizar este manual junto.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function Secao({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <Box id={id} component="section" sx={{ mb: 5, scrollMarginTop: 80 }}>
      <Chip
        label={titulo}
        color="primary"
        variant="outlined"
        sx={{ mb: 2, fontWeight: 700, fontSize: 14, height: 32, px: 0.5 }}
      />
      {children}
    </Box>
  );
}

function Print({ src, legenda }: { src: string; legenda: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1, my: 2, borderRadius: 2, bgcolor: 'action.hover', display: 'inline-block', maxWidth: '100%' }}
    >
      <Box
        component="img"
        src={src}
        alt={legenda}
        sx={{ display: 'block', maxWidth: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, textAlign: 'center' }}>
        {legenda}
      </Typography>
    </Paper>
  );
}
