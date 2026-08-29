import { PersonMark } from './icons';

/**
 * The account's picture, at whatever size the caller needs.
 *
 * A missing picture is the ordinary case, not an error: an account is complete
 * without one. So there is no broken-image state to design around — `src` absent
 * simply means the placeholder mark.
 */
export function Avatar({
  src,
  size = 44,
  alt = '',
}: {
  src?: string | null;
  size?: number;
  alt?: string;
}) {
  const style = { width: size, height: size } as const;

  if (!src) {
    return (
      <span className="avatar avatar--placeholder" style={style} aria-hidden={alt ? undefined : true}>
        <PersonMark />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="avatar"
      style={style}
      src={src}
      alt={alt}
      width={size}
      height={size}
      // A provider's picture is served by the provider; sending our address with
      // the request tells them where their user is, which they do not need.
      referrerPolicy="no-referrer"
    />
  );
}
