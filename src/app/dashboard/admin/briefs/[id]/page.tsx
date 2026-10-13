import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBriefsActor } from "@/lib/briefs/access";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { homePathForRole } from "@/lib/auth/roles";
import { GROUP_LABELS, type FindingKind } from "@/lib/briefs/sections";
import { adsFromFindings } from "@/lib/briefs/ads";
import { companyName, findingsByKind, telegramBrief, type PresentFinding } from "@/lib/briefs/present";
import { strategyOutline } from "@/lib/briefs/strategy";
import { directologistChecks } from "@/lib/briefs/compare";
import { DEVELOPER_LEAD, DIRECTOLOGIST_LEAD, checkVerdict, seoOutline } from "@/lib/briefs/seo";
import { wordstatEnabled } from "@/lib/briefs/wordstat";
import FindingEditor from "@/components/briefs/finding-editor";
import BriefNotes from "@/components/briefs/notes-form";
import BriefRerun from "@/components/briefs/rerun-button";
import BriefProgress from "@/components/briefs/brief-progress";
import BriefSlots from "@/components/briefs/brief-slots";
import CopyBrief from "@/components/briefs/copy-brief";
import SemanticsBlock from "@/components/briefs/semantics-block";
import StrategyBlock from "@/components/briefs/strategy-block";
import AdsBlock from "@/components/briefs/ads-block";
import CompareBlock from "@/components/briefs/compare-block";
import LandingBlock from "@/components/briefs/landing-block";
import { landingMap } from "@/lib/briefs/landing";

const STATUS: Record<string, string> = {
  queued: "В очереди",
  running: "Читаю сайт",
  ready: "Готово",
  failed: "Не вышло",
};

const GROUP_ORDER: FindingKind[] = ["fact", "hypothesis", "recommendation"];

type Ctx = { params: Promise<{ id: string }> };

export default async function BriefProjectPage({ params }: Ctx) {
  const actor = await getBriefsActor();
  if (!actor) redirect(await deniedPath());
  const { id } = await params;
  const project = await db.briefProject.findUnique({
    where: { id },
    include: {
      findings: { orderBy: { sort: "asc" } },
      document: true,
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!project) notFound();

  const run = project.runs[0];
  const pages = run?.pages as { model?: string | null } | null;
  const active = project.status === "queued" || project.status === "running";
  const siteFindings: PresentFinding[] = project.findings
    .filter((finding) => finding.section === "site")
    .map(toPresent);
  const semantics = project.findings.filter((finding) => finding.section === "semantics").map(toPresent);
  const groups = findingsByKind(siteFindings);
  const host = hostOf(project.siteUrl);
  const company = companyName(siteFindings, host);
  const seoRows = seoOutline({
    niche: project.niche,
    regionName: project.regionName,
    findings: siteFindings,
  });
  const direct = directologistChecks({
    niche: project.niche,
    regionName: project.regionName,
    findings: siteFindings,
  });
  const text = telegramBrief({
    company,
    siteUrl: project.siteUrl,
    niche: project.niche,
    regionName: project.regionName,
    goal: project.goal,
    findings: siteFindings,
    semantics,
    seo: [...direct, ...seoRows]
      .filter((row) => row.tone === "bad")
      .slice(0, 4)
      .map((row) => `${checkVerdict(row)} · ${row.check}: ${row.action}`),
  });
  const outline = strategyOutline({
    company,
    niche: project.niche,
    regionName: project.regionName,
    goal: project.goal,
    findings: siteFindings,
    hasSemantics: semantics.some((finding) => /^\d+$/.test(finding.evidenceQuote || "")),
  });
  const ads = adsFromFindings({
    company,
    niche: project.niche,
    regionName: project.regionName,
    goal: project.goal,
    findings: siteFindings,
  });

  return (
    <div style={{ display: "grid", gap: 28, maxWidth: 960 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <Link href="/dashboard/admin/briefs" style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
          К списку
        </Link>
        <h1 style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: 650 }}>{company}</h1>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          <a href={project.siteUrl} target="_blank" rel="noreferrer">
            {host}
          </a>
          <span style={{ color: "var(--ink-muted)" }}>
            {" "}
            · {project.niche} · {project.regionName}
          </span>
        </p>
        <p style={{ margin: 0, color: "var(--ink-body)", lineHeight: 1.5 }}>{project.goal}</p>
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
          {STATUS[project.status] || project.status}
          {run?.error ? ` · ${run.error}` : ""}
          {project.status === "ready" && pages && !pages.model ? " · модель не вызывалась, ниже только факты со страниц" : ""}
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <CopyBrief text={text} />
          {!active && <BriefRerun projectId={project.id} />}
          <Link href={`/dashboard/admin/briefs/${project.id}/print`}>Версия для печати</Link>
          {!active && <a href={`/api/admin/briefs/${project.id}/pdf?for=client`}>PDF клиенту</a>}
          {!active && <a href={`/api/admin/briefs/${project.id}/pdf`}>PDF команде</a>}
        </div>
      </header>

      <BriefProgress projectId={project.id} active={active} host={host} />
      <BriefSlots findings={siteFindings} />
      <CompareBlock title="Директологу" lead={DIRECTOLOGIST_LEAD} rows={direct} />
      <LandingBlock rows={landingMap({ niche: project.niche, regionName: project.regionName, findings: siteFindings })} />
      <CompareBlock title="Разработчику" lead={DEVELOPER_LEAD} rows={seoRows} />

      {GROUP_ORDER.map((kind) => (
        <section key={kind} style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>{GROUP_LABELS[kind]}</h2>
          {groups[kind].length === 0 && (
            <p style={{ margin: 0, color: "var(--ink-muted)" }}>{active ? "Разбор ещё идёт." : "Пока нет."}</p>
          )}
          {groups[kind].map((finding) => (
            <FindingEditor key={finding.id} finding={finding} />
          ))}
        </section>
      ))}

      <SemanticsBlock findings={semantics} regionName={project.regionName} enabled={wordstatEnabled()} />

      <StrategyBlock outline={outline} />
      <AdsBlock ads={ads} />

      <BriefNotes projectId={project.id} initial={project.document?.body || ""} />
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function toPresent(finding: {
  id: string;
  kind: string;
  title: string;
  body: string;
  evidenceUrl: string | null;
  evidenceQuote: string | null;
}): PresentFinding {
  return {
    id: finding.id,
    kind: finding.kind,
    title: finding.title,
    body: finding.body,
    evidenceUrl: finding.evidenceUrl,
    evidenceQuote: finding.evidenceQuote,
  };
}

async function deniedPath(): Promise<string> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user) return "/auth";
  return homePathForRole(role);
}
