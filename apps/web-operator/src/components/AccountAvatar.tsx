import type { Account } from '@/lib/accounts';
import { accountMonogram } from '@/lib/accounts';

interface AccountAvatarProps {
  account: Account;
  size?: number;
}

/** Clean monogram avatar — replaces emoji logos. */
export function AccountAvatar({ account, size = 48 }: AccountAvatarProps): JSX.Element {
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl font-semibold tracking-tight shrink-0"
      style={{
        width: size,
        height: size,
        background: account.avatarBg,
        color: account.avatarFg,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {accountMonogram(account.shortName)}
    </span>
  );
}
