import Image from "next/image";

/**
 * Logo Win Time posé sur une pastille blanche.
 *
 * Le chronomètre reprend le dégradé framboise → orange du bandeau : sans fond
 * blanc il disparaîtrait dedans. La pastille est la déclinaison inversée du
 * badge de la charte (fond blanc, ombre douce).
 */
export function WinTimeLogo() {
  return (
    <span className="wt-logo">
      <Image
        src="/win-time-logo.svg"
        alt="Win Time"
        width={40}
        height={40}
        priority
      />
    </span>
  );
}
