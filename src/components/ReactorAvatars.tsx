import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { generateRandomProfile } from '@/lib/randomProfile';

const MAX_VISIBLE = 8;

interface ReactorAvatarProps {
  pubkey: string;
}

/** One reactor's avatar. Falls back to a deterministic DiceBear thumbs SVG. */
function ReactorAvatar({ pubkey }: ReactorAvatarProps) {
  const author = useAuthor(pubkey);
  const meta = author.data?.metadata;

  const fallback = generateRandomProfile(pubkey);
  const picture = meta?.picture || fallback.picture;
  const name = meta?.name || meta?.display_name || fallback.name;

  return (
    <Avatar className="size-8">
      <AvatarImage src={picture} alt={name} />
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

interface ReactorAvatarsProps {
  pubkeys: string[];
}

export function ReactorAvatars({ pubkeys }: ReactorAvatarsProps) {
  if (pubkeys.length === 0) return null;
  const visible = pubkeys.slice(0, MAX_VISIBLE);
  const overflow = pubkeys.length - visible.length;

  return (
    <AvatarGroup>
      {visible.map((pk) => (
        <ReactorAvatar key={pk} pubkey={pk} />
      ))}
      {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
    </AvatarGroup>
  );
}
