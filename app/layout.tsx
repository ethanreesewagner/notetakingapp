import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import StoreProvider from '../components/StoreProvider';
import BackgroundVideo from '../components/BackgroundVideo';
import { BackgroundProvider } from '../lib/background';

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
            <BackgroundProvider>
              {/* Optional YouTube background video sits behind everything;
                  its controls stay fully opaque outside .site-layer. */}
              <BackgroundVideo>
                <div className="site-layer">{children}</div>
              </BackgroundVideo>
            </BackgroundProvider>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
