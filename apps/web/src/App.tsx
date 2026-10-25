import { Route, Routes } from 'react-router-dom';
import { Dev } from './routes/Dev';
import { DevDiwan } from './routes/DevDiwan';
import { Host } from './routes/Host';
import { Landing } from './routes/Landing';
import { Play } from './routes/Play';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/host" element={<Host />} />
      <Route path="/play" element={<Play />} />
      {import.meta.env.DEV && <Route path="/dev" element={<Dev />} />}
      {import.meta.env.DEV && <Route path="/dev/diwan" element={<DevDiwan />} />}
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
