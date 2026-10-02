import './globals.css';

export const metadata = { title: 'Metas da Equipe', description: 'Acompanhamento de metas de Televendas, Consultivo e Indireto' };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
