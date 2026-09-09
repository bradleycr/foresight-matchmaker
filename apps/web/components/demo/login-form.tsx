import type { T } from "@/lib/i18n"

/** Unlock form. Posts to the Route Handler so the session cookie survives the 303. */
export function DemoLoginForm({ error, t }: { error?: string; t: T }) {
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("demo.title")}</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">{t("demo.body")}</p>
      <form action="/api/demo/login" method="post" className="mt-6 flex flex-col gap-3">
        <label htmlFor="demo-secret" className="text-sm font-semibold uppercase tracking-wide">
          {t("demo.secret_label")}
        </label>
        <input
          id="demo-secret"
          name="secret"
          type="password"
          required
          autoComplete="current-password"
          className="min-h-11 border border-ink bg-paper px-3 py-2"
        />
        {error ? (
          <p role="alert" className="border border-alert px-3 py-2 text-sm text-alert">
            {t("demo.bad_secret")}
          </p>
        ) : null}
        <button
          type="submit"
          className="min-h-11 self-start border border-ink bg-mark px-4 font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("demo.unlock")}
        </button>
      </form>
    </div>
  )
}
