"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { AIcon } from "@/components/admin/icons";
import { AnimatedNumber, Badge, Button, Card, Checkbox, ConfirmButton, PageHeader, Stagger, StaggerItem, buttonClass, ease, toast } from "@/components/admin/ui";
import { useT } from "@/components/admin/i18n";
import { cx } from "@/lib/format";
import type { DbInfo } from "@/server/queries/stats";
import { clearDemo, importBackup } from "./actions";

interface Preview {
  file: File;
  exportedAt?: string;
  counts: { key: "products" | "collections" | "reviews" | "orders"; value: number }[];
  demo: number;
  error?: { missing: string } | "json";
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);

async function gzip(file: File): Promise<Blob | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    return await new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
  } catch {
    return null;
  }
}

export function BackupView({ info }: { info: DbInfo }) {
  const router = useRouter();
  const { t, fmt } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [agree, setAgree] = useState(false);
  const [drag, setDrag] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setAgree(false);
    try {
      const d = JSON.parse(await file.text()) as Record<string, unknown>;
      const missing = ["products", "collections", "reviews", "orders"].filter((k) => !Array.isArray(d[k]));
      setPreview({
        file,
        exportedAt: typeof d.exportedAt === "string" ? d.exportedAt : undefined,
        counts: [
          { key: "products", value: len(d.products) },
          { key: "collections", value: len(d.collections) },
          { key: "reviews", value: len(d.reviews) },
          { key: "orders", value: len(d.orders) },
        ],
        demo: Array.isArray(d.orders) ? d.orders.filter((o: { demo?: boolean }) => o?.demo).length : 0,
        error: missing.length || !d.settings || !d.content ? { missing: [...missing, ...(!d.settings ? ["settings"] : []), ...(!d.content ? ["content"] : [])].join(", ") } : undefined,
      });
    } catch {
      setPreview({ file, counts: [], demo: 0, error: "json" });
    }
  }

  async function restore() {
    if (!preview || preview.error) return;
    const fd = new FormData();
    const gz = await gzip(preview.file);
    fd.set("file", gz ?? preview.file, preview.file.name);
    fd.set("gzip", gz ? "1" : "0");
    const res = await importBackup(fd);
    if (!res.ok) return void toast.error(t("overview.backup.restoreFailed"), res.error);
    toast.success(t("overview.backup.restored"), t("overview.backup.restoredHint", { products: res.data?.products ?? 0, orders: res.data?.orders ?? 0 }));
    setPreview(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <PageHeader title={t("overview.backup.title")} description={t("overview.backup.description")} />

      <Stagger className="grid gap-4 lg:grid-cols-2">
        <StaggerItem>
          <Card title={t("overview.backup.export")} description={t("overview.backup.exportHint")} className="h-full">
            <div className="flex items-center gap-4 rounded-xl border border-a-line bg-a-panel-2/60 p-4">
              <span className="a-grad grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-[0_8px_24px_-10px_rgb(139_116_255/0.8)]">
                <AIcon name="download" size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">{t("overview.backup.full")}</p>
                <p className="text-[12px] text-a-faint">{t("overview.backup.fullHint", { size: kb(info.size) })}</p>
              </div>
              <a href="/admin/backup/export" download className={buttonClass("primary", "md")}>
                {t("overview.backup.download")}
              </a>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-a-faint">{t("overview.backup.mediaNote")}</p>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card title={t("overview.backup.restore")} description={t("overview.backup.restoreHint")} className="h-full">
            <input ref={input} type="file" accept="application/json,.json" className="peer sr-only" id="backup-file" onChange={(e) => pick(e.target.files?.[0])} />
            <label
              htmlFor="backup-file"
              onDragOver={(e) => (e.preventDefault(), setDrag(true))}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                pick(e.dataTransfer.files?.[0]);
              }}
              className={cx("flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-a-accent", drag ? "border-a-violet bg-a-violet/10" : "border-a-line-strong hover:border-a-violet/60 hover:bg-a-ink/[0.02]")}
            >
              <AIcon name="upload" size={20} className="text-a-accent" />
              <span className="text-[13px] font-medium">{preview ? <bdi dir="ltr">{preview.file.name}</bdi> : t("overview.backup.choose")}</span>
              <span className="text-[12px] text-a-faint">{preview ? kb(preview.file.size) : t("overview.backup.drop")}</span>
            </label>

            <AnimatePresence initial={false}>
              {preview ? (
                <motion.div key={preview.file.name + preview.file.lastModified} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
                  {preview.error ? (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-a-danger/10 p-3 text-[12.5px] text-a-danger ring-1 ring-inset ring-a-danger/20">
                      <AIcon name="alert" size={15} className="mt-0.5 shrink-0" />
                      {preview.error === "json" ? t("overview.backup.invalidJson") : t("overview.backup.notBackup", { missing: preview.error.missing })}
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="mb-2 text-[12px] text-a-dim">
                          {preview.exportedAt ? t("overview.backup.containsFrom", { date: fmt.dateTime(preview.exportedAt, { dateStyle: "medium", timeStyle: "short" }) }) : t("overview.backup.contains")}
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {preview.counts.map((c) => {
                            const current = info.tables.find((x) => x.key === c.key)?.count ?? 0;
                            return (
                              <div key={c.key} className="rounded-xl border border-a-line bg-a-panel-2/60 px-3 py-2.5">
                                <p className="text-[11.5px] text-a-faint">{t(`overview.backup.tables.${c.key}`)}</p>
                                <p className="text-[17px] font-semibold tabular-nums">{c.value.toLocaleString("en")}</p>
                                <p className="text-[11px] tabular-nums text-a-faint">{t("overview.backup.now", { count: current })}</p>
                              </div>
                            );
                          })}
                        </div>
                        {preview.demo ? <p className="mt-2 text-[12px] text-a-faint">{t("overview.backup.demoOf", { count: preview.demo })}</p> : null}
                      </div>
                      <Checkbox checked={agree} onChange={setAgree} label={<span className="text-a-dim">{t("overview.backup.agree")}</span>} />
                      <div className="flex flex-wrap items-center gap-2">
                        {agree ? (
                          <ConfirmButton onConfirm={restore} icon="upload" variant="primary" size="md" confirmLabel={t("overview.backup.confirmRestore")}>
                            {t("overview.backup.restoreBtn")}
                          </ConfirmButton>
                        ) : (
                          <Button variant="primary" icon="upload" disabled>
                            {t("overview.backup.restoreBtn")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setPreview(null);
                            if (input.current) input.current.value = "";
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                      <p className="text-[12px] text-a-faint">{t("overview.backup.safetyNote")}</p>
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card title={t("overview.backup.database")} description={<span dir="ltr" className="font-mono text-[11.5px]">{info.file} · {kb(info.size)}</span>} className="h-full">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {info.tables.map((t) => (
                <li key={t.key} className="rounded-xl border border-a-line bg-a-panel-2/60 px-3 py-2.5">
                  <p className="text-[11.5px] text-a-faint">{t.label}</p>
                  <p className="text-[18px] font-semibold tracking-[-0.02em]">
                    <AnimatedNumber value={t.count} />
                  </p>
                  {t.detail ? <p className="text-[11px] text-a-faint">{t.detail}</p> : null}
                </li>
              ))}
            </ul>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card title={t("overview.backup.demo")} description={t("overview.backup.demoHint")} className="h-full">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-a-danger/20 bg-a-danger/[0.05] p-4">
              <div>
                <p className="flex items-center gap-2 text-[13.5px] font-medium">
                  {t("overview.backup.demoOrders")} {info.demoOrders ? <Badge tone="amber">{info.demoOrders}</Badge> : <Badge tone="green">{t("overview.backup.none")}</Badge>}
                </p>
                <p className="mt-0.5 text-[12px] text-a-faint">{t("overview.backup.demoNote")}</p>
              </div>
              {info.demoOrders ? (
                <ConfirmButton
                  confirmLabel={t("overview.backup.removeN", { count: info.demoOrders })}
                  onConfirm={async () => {
                    const res = await clearDemo();
                    if (!res.ok) return void toast.error(t("overview.backup.clearFailed"), res.error);
                    toast.success(t("overview.backup.cleared"), t("overview.backup.clearedHint", { count: res.data?.removed ?? 0 }));
                    router.refresh();
                  }}
                >
                  {t("overview.backup.clear")}
                </ConfirmButton>
              ) : null}
            </div>
          </Card>
        </StaggerItem>
      </Stagger>
    </div>
  );
}
