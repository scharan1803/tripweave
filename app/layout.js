import "./globals.css";

export const metadata = {
  title: "TripWeave",
  description: "Plan and organize trips with ease",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* If you previously had font variables (e.g., geistSans/geistMono), 
         you can add them to the className below after bg-gray-50 */}
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}
