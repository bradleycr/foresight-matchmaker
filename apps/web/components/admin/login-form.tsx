import type { T } from "@/lib/i18n"

/** Unlock form. Posts to the Route Handler so the admin cookie survives the 303. */
export function AdminLoginForm({ next, error, t }: { next: string; error?: string; t: T }) {
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("admin.title")}</h1>
      <form action="/api/admin/login" method="post" className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="admin-secret" className="text-sm font-semibold uppercase tracking-wide">
          {t("admin.secret_label")}
        </label>
        <input
          id="admin-secret"
          name="secret"
          type="password"
          required
          className="min-h-11 border border-ink bg-paper px-3 py-2"
        />
        {error ? (
          <p role="alert" className="border border-alert px-3 py-2 text-sm text-alert">
            {t("admin.bad_secret")}
          </p>
        ) : null}
        <button
          type="submit"
          className="min-h-11 self-start border border-ink bg-mark px-4 font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("admin.unlock")}
        </button>
      </form>
    </div>
  )
}
