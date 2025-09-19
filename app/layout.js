// app/layout.js
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
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
                className="flex items-center gap-2"
                aria-label="Go to homepage"
                title="TripWeave Home"
              >
                <Image
                  src="/logo.svg"     // <-- replace with "/logo.png" if you prefer the alternate and replace
                  alt="TripWeave Logo"
                  width={36}
                  height={36}
                  priority
                />
                <span className="sr-only">TripWeave</span>
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
