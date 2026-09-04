import { NextRequest, NextResponse } from "next/server";
import { requireIdeasUser } from "@/lib/ideas/guard";
import { isIdeaStatus, parseTags } from "@/lib/ideas/constants";
import { displayName, loadUsersByIds } from "@/lib/ideas/users";
import { db } from "@/lib/db";

/** GET /api/ideas?status=draft — список идей */
export async function GET(req: NextRequest) {
  const gate = await requireIdeasUser();
  if (gate.error) return gate.error;

  const status = req.nextUrl.searchParams.get("status");
  const where = status && isIdeaStatus(status) ? { status } : {};

  const ideas = await db.idea.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { comments: true } } },
  });

  const authors = await loadUsersByIds(ideas.map((i) => i.createdById));

  return NextResponse.json({
    ideas: ideas.map((idea) => {
      const author = authors.get(idea.createdById);
      return {
        id: idea.id,
        title: idea.title,
        body: idea.body,
        status: idea.status,
        tags: idea.tags,
        createdById: idea.createdById,
        authorName: displayName(author, idea.createdById),
        authorEmail: author?.email ?? null,
        hasAnalysis: idea.analysis != null,
        commentsCount: idea._count.comments,
        createdAt: idea.createdAt.toISOString(),
        updatedAt: idea.updatedAt.toISOString(),
      };
    }),
  });
}

/** POST /api/ideas — создать идею (только admin) */
export async function POST(req: NextRequest) {
  const gate = await requireIdeasUser();
  if (gate.error) return gate.error;
  if (!gate.isAdmin) {
    return NextResponse.json({ error: "Создавать идеи может только админ" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const text = String(body.body || "").trim();
  const tags = parseTags(body.tags);

  if (!title || title.length < 2) {
    return NextResponse.json({ error: "Укажите заголовок" }, { status: 400 });
  }
  if (!text || text.length < 2) {
    return NextResponse.json({ error: "Укажите описание" }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: "Заголовок слишком длинный" }, { status: 400 });
  }
  if (text.length > 20000) {
    return NextResponse.json({ error: "Описание слишком длинное" }, { status: 400 });
  }

  const idea = await db.idea.create({
    data: {
      title,
      body: text,
      tags,
      status: "draft",
      createdById: gate.user.id,
    },
  });

  return NextResponse.json(
    {
      idea: {
        id: idea.id,
        title: idea.title,
        body: idea.body,
        status: idea.status,
        tags: idea.tags,
        createdById: idea.createdById,
        createdAt: idea.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
