import { Route, Routes } from 'react-router-dom';
import { Host } from './routes/Host';
import { Landing } from './routes/Landing';
import { Play } from './routes/Play';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/host" element={<Host />} />
      <Route path="/play" element={<Play />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
