import { Routes, Route, NavLink } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AwardsPage from "./pages/AwardsPage";
import AwardDetailPage from "./pages/AwardDetailPage";
import StatsPage from "./pages/StatsPage";
import SearchPage from "./pages/SearchPage";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <NavLink to="/" className="shrink-0 text-lg font-semibold text-slate-950">
            FundingTrack
          </NavLink>
          <div className="flex gap-4 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "font-medium text-emerald-700" : "text-slate-600 hover:text-slate-950"
              }
            >
              Portal
            </NavLink>
            <NavLink
              to="/awards"
              className={({ isActive }) =>
                isActive ? "font-medium text-emerald-700" : "text-slate-600 hover:text-slate-950"
              }
            >
              Awards
            </NavLink>
            <NavLink
              to="/search"
              className={({ isActive }) =>
                isActive ? "font-medium text-emerald-700" : "text-slate-600 hover:text-slate-950"
              }
            >
              Search
            </NavLink>
            <NavLink
              to="/stats"
              className={({ isActive }) =>
                isActive ? "font-medium text-emerald-700" : "text-slate-600 hover:text-slate-950"
              }
            >
              Stats
            </NavLink>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/awards" element={<AwardsPage />} />
          <Route path="/awards/:id" element={<AwardDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </main>
    </div>
  );
}
