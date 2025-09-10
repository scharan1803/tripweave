// app/layout.js
import "./globals.css";
import Link from "next/link";
import AuthProvider from "./context/AuthProvider";
import UserMenu from "./components/UserMenu";
import NotificationsBell from "./components/NotificationsBell";

export const metadata = {
  title: "TripWeave",
  description: "Plan beautiful trips together.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-gray-900">
        <AuthProvider>
          <header className="sticky top-0 z-20 border-b border-white/40 bg-white/60 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link
                href="/"
                className="text-lg font-semibold hover:opacity-90"
                aria-label="Go to homepage"
                title="TripWeave Home"
              >
                TripWeave
              </Link>
              <div className="flex items-center gap-3">
                <NotificationsBell />
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
