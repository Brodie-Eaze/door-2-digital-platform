import { monogramFrom } from '@/lib/account-color';

/**
 * Clean monogram avatar. Decoupled from the fixture `Account` type — it takes
 * only what it draws, so both live account meta and (legacy) fixture accounts
 * can feed it. `avatarFg` defaults to white (the house monogram foreground).
 */
interface AccountAvatarProps {
  account: { shortName: string; avatarBg: string; avatarFg?: string };
  size?: number;
}

export function AccountAvatar({ account, size = 48 }: AccountAvatarProps): JSX.Element {
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl font-semibold tracking-tight shrink-0"
      style={{
        width: size,
        height: size,
        background: account.avatarBg,
        color: account.avatarFg ?? '#FFFFFF',
        fontSize: Math.round(size * 0.36),
      }}
    >
      {monogramFrom(account.shortName)}
    </span>
  );
}
