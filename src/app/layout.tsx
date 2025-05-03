import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./styles/globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GitHub Scraper App",
  description: "Application for scraping and analyzing GitHub repositories",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
