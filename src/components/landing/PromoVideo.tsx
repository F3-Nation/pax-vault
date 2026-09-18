/**
 * Landing-page promo video — the "why" behind PAX Vault in ~45 seconds.
 *
 * Presentational only (no client JS): a native `<video>` with browser
 * controls, so keyboard and screen-reader support come for free.
 *
 * - No autoplay: the video is narrated, and nothing should start talking at a
 *   first-time visitor. `preload="none"` also keeps the ~3 MB file off the wire
 *   until someone actually presses play; the poster stands in until then.
 * - Captions ship alongside (`.vtt`) because the narration carries the story.
 * - Assets live in `public/promo/`, which `next.config.ts` excludes from the
 *   PWA precache — otherwise every install would download the whole video.
 * - Like the preview mocks, every name and number in the video is made up.
 */

const PROMO_BASE = "/promo/pax-vault-promo";

export function PromoVideo() {
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2rem] blur-2xl"
        style={{
          background:
            "linear-gradient(to top right, color-mix(in srgb, var(--primary) 14%, transparent), color-mix(in srgb, var(--secondary) 8%, transparent), transparent)",
        }}
      />
      <video
        controls
        playsInline
        preload="none"
        poster={`${PROMO_BASE}.jpg`}
        aria-label="PAX Vault promo video: why the data matters to region leadership, site Qs, and every PAX"
        className="aspect-video w-full rounded-2xl border border-default-200 bg-black shadow-lg"
      >
        <source src={`${PROMO_BASE}.mp4`} type="video/mp4" />
        <track
          kind="captions"
          src={`${PROMO_BASE}.vtt`}
          srcLang="en"
          label="English"
        />
        Your browser can&apos;t play this video.{" "}
        <a href={`${PROMO_BASE}.mp4`}>Download it instead</a>.
      </video>
    </div>
  );
}
