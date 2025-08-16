// app/components/Navbar.js
export default function Navbar() {
  return (
    <nav className="bg-blue-600 text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: brand */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-white text-blue-600 grid place-items-center font-bold">
            TW
          </div>
          <span className="text-lg font-semibold">TripWeave</span>
        </div>

        {/* Right: links */}
        <ul className="flex items-center gap-4 text-sm">
          <li><a href="/" className="hover:opacity-90">Home</a></li>
          <li><a href="#" className="hover:opacity-90">Destinations</a></li>
          <li><a href="#" className="hover:opacity-90">Planner</a></li>
          <li><a href="#" className="hover:opacity-90">Contact</a></li>
        </ul>
      </div>
    </nav>
  );
}
