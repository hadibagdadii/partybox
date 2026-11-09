import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { About } from './routes/About';
import { Dev } from './routes/Dev';
import { DevDiwan } from './routes/DevDiwan';
import { DevDiwanHost } from './routes/DevDiwanHost';
import { Host } from './routes/Host';
import { Landing } from './routes/Landing';
import { Play } from './routes/Play';

/** Dev-only and heavy (it runs the engine for its fixtures), so it loads on demand. */
const DevCambioCards = lazy(() =>
  import('./routes/DevCambioCards').then((m) => ({ default: m.DevCambioCards })),
);
const DevCambioHost = lazy(() =>
  import('./routes/DevCambioHost').then((m) => ({ default: m.DevCambioHost })),
);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/host" element={<Host />} />
      <Route path="/play" element={<Play />} />
      <Route path="/about" element={<About />} />
      {import.meta.env.DEV && <Route path="/dev" element={<Dev />} />}
      {import.meta.env.DEV && <Route path="/dev/diwan" element={<DevDiwan />} />}
      {import.meta.env.DEV && <Route path="/dev/diwan-host" element={<DevDiwanHost />} />}
      {import.meta.env.DEV && (
        <Route
          path="/dev/cambio-cards"
          element={
            <Suspense fallback={null}>
              <DevCambioCards />
            </Suspense>
          }
        />
      )}
      {import.meta.env.DEV && (
        <Route
          path="/dev/cambio-host"
          element={
            <Suspense fallback={null}>
              <DevCambioHost />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
