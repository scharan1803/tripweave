// app/page.js
import Image from "next/image";
import Navbar from "./components/Navbar"; // <-- import your component

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-10 text-center">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">
          Hello, Tailwind is working! 🎉
        </h1>

        
        <a
          href="#"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition duration-300 ease-in-out"
        >
          Test Tailwind Button
        </a>
      </main>
    </div>
  );
}
