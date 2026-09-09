import type { T } from "@/lib/i18n"

/** Unlock form. Posts to the Route Handler so the session cookie survives the 303. */
export function DemoLoginForm({
  error,
  email,
  t,
}: {
  error?: string
  email?: string
  t: T
}) {
  const alert =
    error === "missing" ? t("demo.missing_listing") : error ? t("demo.bad_secret") : null

  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("demo.title")}</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">{t("demo.body")}</p>
      <form action="/api/demo/login" method="post" className="mt-6 flex flex-col gap-3">
        <label htmlFor="demo-email" className="text-sm font-semibold uppercase tracking-wide">
          {t("demo.email_label")}
        </label>
        <input
          id="demo-email"
          name="email"
          type="email"
          defaultValue={email ?? ""}
          placeholder={t("demo.email_placeholder")}
          autoComplete="email"
          className="min-h-11 border border-ink bg-paper px-3 py-2"
        />
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
        <fieldset className="mt-1 border border-rule px-3 py-2">
          <legend className="px-1 text-sm font-semibold uppercase tracking-wide">{t("demo.city_label")}</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="city" value="" defaultChecked className="size-4" />
            {t("demo.city_none")}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="city" value="paris" className="size-4" />
            {t("demo.city_paris")}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="city" value="berlin" className="size-4" />
            {t("demo.city_berlin")}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="city" value="stockholm" className="size-4" />
            {t("demo.city_stockholm")}
          </label>
        </fieldset>
        {alert ? (
          <p role="alert" className="border border-alert px-3 py-2 text-sm text-alert">
            {alert}
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
