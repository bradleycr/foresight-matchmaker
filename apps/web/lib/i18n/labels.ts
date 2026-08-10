/**
 * Enum → label resolution. Every controlled-vocabulary value gets its
 * user-facing label from the locale files under `enum.<group>.<value>`.
 * If a key is missing (e.g. the French stub) the value is humanised —
 * "imaging_mri" → "Imaging MRI" beats a raw token in the UI.
 */

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

const ACRONYMS = new Set(["mri", "ct", "ehr", "ecg", "eeg", "nlp", "tre", "dua", "hq", "eu", "uk"])

export function humanise(value: string): string {
  return value
    .split("_")
    .map((word, i) => {
      if (ACRONYMS.has(word)) return word.toUpperCase()
      return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    })
    .join(" ")
}

export function enumLabel(t: TranslateFn, group: string, value: string): string {
  const key = `enum.${group}.${value}`
  const translated = t(key)
  return translated === key ? humanise(value) : translated
}
