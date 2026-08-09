import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-ui",
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "PDA Visualiser - Pushdown Automata Simulator",
  description: "Interactive tool for visualising and simulating Pushdown Automata",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the script below sets data-theme before hydration,
    // so the client's html attributes intentionally differ from the server's.
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          Runs before first paint so the stored or system theme is applied without a
          flash of the default palette. Kept inline and dependency-free on purpose.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
