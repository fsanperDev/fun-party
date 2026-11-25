import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import Dashboard from './pages/Dashboard';
import GameDetail from './pages/GameDetail';
import Games from './pages/Games';
import Home from './pages/Home';
import MatchPage from './pages/Match';
import NewMatch from './pages/NewMatch';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="juegos" element={<Games />} />
        <Route path="juegos/:id" element={<GameDetail />} />
        <Route path="nueva" element={<NewMatch />} />
        <Route path="partida/:id" element={<MatchPage />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="ajustes" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
