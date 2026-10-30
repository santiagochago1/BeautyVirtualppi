import './globals.css';
import { Inter, Playfair_Display } from 'next/font/google';
import AuthProvider from '@/components/AuthProvider';
import ToastProvider from '@/components/ToastProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ChatbotWidget from '@/components/ChatbotWidget';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata = {
  title: 'Beauty Virtual | Beauty Salón - Barbosa, Antioquia',
  description:
    'Asistente virtual, catálogo de servicios y agenda online de Beauty Salón en Barbosa, Antioquia.',
  keywords: ['estética', 'Barbosa', 'Antioquia', 'salón de belleza', 'citas', 'asistente virtual'],
  openGraph: {
    title: 'Beauty Virtual | Beauty Salón',
    description: 'Agenda tu cita y consulta nuestros servicios con el asistente virtual.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-white">
        <AuthProvider>
          <ToastProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            {/* Asistente virtual flotante disponible en todo el sitio */}
            <ChatbotWidget />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
