import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DiwanTv } from '../games/diwan/tv/DiwanTv';
import { fixtureRoom, scenes, type Scene, type SceneId } from '../games/diwan/tv/fixtures';

/** How long a moment's "before" view shows before the gallery plays the moment. */
const BEFORE_MS = 1200;

/**
 * Dev-only: the TV rendered from fixtures, one scene per phase and big moment.
 * Moment scenes start from their "before" view and then play; press R to replay.
 */
export function DevDiwanHost() {
  const [params] = useSearchParams();
  const id = params.get('scene');
  const scene: Scene | null = id && id in scenes ? scenes[id as SceneId] : null;
  const [run, setRun] = useState(0);
  const [after, setAfter] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key.toLowerCase() === 'r' && setRun((n) => n + 1);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setAfter(false);
    const t = setTimeout(() => setAfter(true), BEFORE_MS);
    return () => clearTimeout(t);
  }, [id, run]);

  if (!scene) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 px-safe py-8">
        <h1 className="font-display text-4xl text-court-goldLight">Diwan TV scenes</h1>
        {Object.keys(scenes).map((key) => (
          <Link
            key={key}
            to={`?scene=${key}`}
            className="rounded-button bg-court-dusk px-4 py-3 text-lg"
          >
            {key}
          </Link>
        ))}
      </main>
    );
  }

  const view = scene.before && !after ? scene.before : scene.view;
  return <DiwanTv key={`${id}:${run}`} room={fixtureRoom(view, scene.away)} game={view} />;
}
