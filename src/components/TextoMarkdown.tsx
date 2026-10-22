import { Box } from '@mui/material';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Texto em Markdown (Termos de Uso, Política de Privacidade) com a tipografia do admin. HTML
 * embutido no texto não é interpretado (padrão do react-markdown); links abrem em aba nova.
 */
export function TextoMarkdown({ conteudo }: { conteudo: string }) {
  return (
    <Box
      sx={{
        fontSize: 14,
        lineHeight: 1.65,
        color: 'text.primary',
        '& h1': { fontSize: 22, fontWeight: 700, mt: 0, mb: 2 },
        '& h2': { fontSize: 17, fontWeight: 700, mt: 3, mb: 1 },
        '& h3': { fontSize: 15, fontWeight: 700, mt: 2.5, mb: 1 },
        '& p': { my: 1.25 },
        '& ul, & ol': { pl: 3, my: 1.25 },
        '& li': { my: 0.5 },
        '& a': { color: 'primary.main' },
        '& table': { borderCollapse: 'collapse', width: '100%', my: 2, fontSize: 13 },
        '& th, & td': { border: 1, borderColor: 'divider', px: 1.25, py: 0.75, textAlign: 'left', verticalAlign: 'top' },
        '& th': { bgcolor: 'action.hover', fontWeight: 600 },
        '& hr': { border: 0, borderTop: 1, borderColor: 'divider', my: 3 },
        '& blockquote': { borderLeft: 3, borderColor: 'divider', m: 0, pl: 2, color: 'text.secondary' },
      }}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
      >
        {conteudo}
      </Markdown>
    </Box>
  );
}
