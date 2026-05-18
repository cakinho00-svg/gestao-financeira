ETAPA 6 — PUBLICAÇÃO, RESPONSIVIDADE E PWA

Incluído nesta versão:
- Layout responsivo para celular e tablet.
- Menu lateral mobile com botão hamburguer.
- Manifest PWA para instalação como aplicativo.
- Service Worker básico para cache dos arquivos principais.
- Arquivo vercel.json para publicação na Vercel.
- Ícones SVG do aplicativo.

Como testar localmente:
1. Abra o projeto no VS Code.
2. Execute com Live Server.
3. Teste no Chrome usando F12 > Toggle device toolbar.
4. Teste celular, tablet e desktop.

Como publicar na Vercel:
1. Suba a pasta do projeto para o GitHub.
2. Entre na Vercel.
3. Clique em Add New Project.
4. Importe o repositório.
5. Framework Preset: Other.
6. Build Command: deixe vazio.
7. Output Directory: deixe vazio ou use .
8. Clique em Deploy.

Observação:
O app usa Firebase no frontend. Confirme se o domínio publicado na Vercel foi autorizado no Firebase Authentication em:
Authentication > Settings > Authorized domains.
