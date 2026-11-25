import { PageHeader } from '../components/AppShell';
import { GamesManager } from '../components/GamesManager';

export default function Games() {
  return (
    <div>
      <PageHeader eyebrow="Ludoteca" title="Juegos" subtitle="Toca un juego para ver sus imágenes, sus normas paso a paso y empezar a jugar." />
      <GamesManager />
    </div>
  );
}
