import { notFound, redirect } from "next/navigation";
import { getBriefsActor } from "@/lib/briefs/access";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { homePathForRole } from "@/lib/auth/roles";
import { GROUP_LABELS, type FindingKind } from "@/lib/briefs/sections";
import { adsFromFindings } from "@/lib/briefs/ads";
import { companyName, findingsByKind, type PresentFinding } from "@/lib/briefs/present";
import { developerCompare, directologistCompare } from "@/lib/briefs/compare";
import { seoOutline } from "@/lib/briefs/seo";
import { strategyOutline } from "@/lib/briefs/strategy";
import { wordstatEnabled } from "@/lib/briefs/wordstat";
import BriefSlots from "@/components/briefs/brief-slots";
import SemanticsBlock from "@/components/briefs/semantics-block";
import StrategyBlock from "@/components/briefs/strategy-block";
import AdsBlock from "@/components/briefs/ads-block";
import CompareBlock from "@/components/briefs/compare-block";

const GROUP_ORDER: FindingKind[] = ["fact", "hypothesis", "recommendation"];

type Ctx = { params: Promise<{ id: string }> };

export default async function BriefPrintPage({ params }: Ctx) {
  const actor = await getBriefsActor();
  if (!actor) {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;
    redirect(session?.user ? homePathForRole(role) : "/auth");
  }
  const { id } = await params;
  const project = await db.briefProject.findUnique({
    where: { id },
    include: {
      findings: { orderBy: { sort: "asc" } },
      document: true,
    },
  });
  if (!project) notFound();

  const findings: PresentFinding[] = project.findings
    .filter((finding) => finding.section === "site")
    .map((finding) => ({
      id: finding.id,
      kind: finding.kind,
      title: finding.title,
      body: finding.body,
      evidenceUrl: finding.evidenceUrl,
      evidenceQuote: finding.evidenceQuote,
    }));
  const semantics: PresentFinding[] = project.findings
    .filter((finding) => finding.section === "semantics")
    .map((finding) => ({
      id: finding.id,
      kind: finding.kind,
      title: finding.title,
      body: finding.body,
      evidenceUrl: finding.evidenceUrl,
      evidenceQuote: finding.evidenceQuote,
    }));
  const groups = findingsByKind(findings);
  const company = companyName(findings, hostOf(project.siteUrl));
  const outline = strategyOutline({
    company,
    niche: project.niche,
    regionName: project.regionName,
    goal: project.goal,
    findings,
    hasSemantics: semantics.some((finding) => /^\d+$/.test(finding.evidenceQuote || "")),
  });
  const ads = adsFromFindings({
    company,
    niche: project.niche,
    regionName: project.regionName,
    goal: project.goal,
    findings,
  });
  const seoRows = seoOutline({
    niche: project.niche,
    regionName: project.regionName,
    findings,
  });
  const direct = directologistCompare({ niche: project.niche, regionName: project.regionName, findings });
  const developer = developerCompare(seoRows);

  return (
    <article className="brief-print" style={{ display: "grid", gap: 24, maxWidth: 760 }}>
      <header>
        <p style={{ margin: "0 0 8px", color: "var(--ink-muted)" }}>Konversus · Стратег</p>
        <h1 style={{ margin: 0, fontSize: "var(--text-2xl)" }}>{company}</h1>
        <p style={{ margin: "8px 0 0" }}>{project.siteUrl}</p>
        <p style={{ margin: "8px 0 0" }}>
          {project.niche} · {project.regionName}
        </p>
        <p style={{ margin: "8px 0 0" }}>{project.goal}</p>
      </header>
      <BriefSlots findings={findings} />
      <CompareBlock
        title="Директологу"
        lead="Что можно брать в Директ и чего в текст объявления ставить нельзя, пока этого нет на сайте."
        good={direct.good}
        bad={direct.bad}
      />
      <CompareBlock
        title="Разработчику"
        lead="Что в HTML изученных страниц уже в порядке и что исправить. Позиции и трафик не измерялись."
        good={developer.good}
        bad={developer.bad}
      />
      {GROUP_ORDER.map((kind) => (
        <section key={kind}>
          <h2 style={{ fontSize: "var(--text-lg)", margin: "0 0 8px" }}>{GROUP_LABELS[kind]}</h2>
          {groups[kind].length === 0 && <p style={{ margin: 0, color: "var(--ink-muted)" }}>Пока нет.</p>}
          {groups[kind].map((finding) => (
            <div key={finding.id} className="brief-item">
              <p style={{ margin: 0, fontWeight: 650 }}>{finding.title}</p>
              <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{finding.body}</p>
              {finding.evidenceUrl && (
                <p style={{ margin: "6px 0 0", color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>{finding.evidenceUrl}</p>
              )}
            </div>
          ))}
        </section>
      ))}
      <SemanticsBlock findings={semantics} regionName={project.regionName} enabled={wordstatEnabled()} />
      <StrategyBlock outline={outline} />
      <AdsBlock ads={ads} />
      {project.document?.body && (
        <section>
          <h2 style={{ fontSize: "var(--text-lg)", margin: "0 0 8px" }}>Заметки</h2>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{project.document.body}</p>
        </section>
      )}
    </article>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
