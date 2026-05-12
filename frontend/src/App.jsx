import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import SetupPage from "./pages/SetupPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import AgentsPage from "./pages/AgentsPage.jsx";
import TaxonomyPage from "./pages/TaxonomyPage.jsx";

const navItems = [
  { to: "/", label: "Setup" },
  { to: "/taxonomy", label: "Taxonomy" },
  { to: "/search", label: "Search" },
  { to: "/agents", label: "Agents" },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Nav */}
        <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex gap-6 items-center">
          <span className="text-lg font-bold text-emerald-400 mr-4">
            Graph Connections
          </span>
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `px-3 py-1 rounded text-sm font-medium transition ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Pages */}
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<SetupPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/taxonomy" element={<TaxonomyPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
