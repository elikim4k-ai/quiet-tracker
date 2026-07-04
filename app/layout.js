import './globals.css';

export const metadata = {
  title: 'Quiet Tracker — WISER Insider Program',
  description: 'Prospect tracker with AI-powered outreach for WISER',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
