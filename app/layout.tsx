import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import StoreProvider from '../components/StoreProvider';

export const metadata: Metadata = {
  title: 'Notetaking App',
  description: 'A beautiful glassmorphism note taking application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <StoreProvider>
            {children}
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
