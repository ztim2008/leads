import { NextRequest, NextResponse } from "next/server";
import { requireIdeasUser } from "@/lib/ideas/guard";
import { isIdeaStatus, parseTags } from "@/lib/ideas/constants";
import { displayName, loadUsersByIds } from "@/lib/ideas/users";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/ideas/[id] — деталь + комментарии */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireIdeasUser();
  if (gate.error) return gate.error;

  const { id } = await ctx.params;
  const idea = await db.idea.findUnique({
    where: { id },
    include: { comments: { orderBy: { createdAt: "asc" } } },
  });
  if (!idea) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const userIds = [idea.createdById, ...idea.comments.map((c) => c.authorId)];
  const users = await loadUsersByIds(userIds);
  const author = users.get(idea.createdById);

  return NextResponse.json({
    idea: {
      id: idea.id,
      title: idea.title,
      body: idea.body,
      status: idea.status,
      tags: idea.tags,
      createdById: idea.createdById,
      authorName: displayName(author, idea.createdById),
      authorEmail: author?.email ?? null,
      hasAnalysis: idea.analysis != null,
      analysis: idea.analysis,
      analyzedAt: idea.analyzedAt?.toISOString() ?? null,
      createdAt: idea.createdAt.toISOString(),
      updatedAt: idea.updatedAt.toISOString(),
      comments: idea.comments.map((c) => {
        const u = users.get(c.authorId);
        return {
          id: c.id,
          body: c.body,
          authorId: c.authorId,
          authorName: displayName(u, c.authorId),
          authorEmail: u?.email ?? null,
          createdAt: c.createdAt.toISOString(),
        };
      }),
    },
  });
}

/** PATCH /api/ideas/[id] — статус (доступные); title/body — автор или admin */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireIdeasUser();
  if (gate.error) return gate.error;

  const { id } = await ctx.params;
  const idea = await db.idea.findUnique({ where: { id } });
  if (!idea) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: {
    status?: string;
    title?: string;
    body?: string;
    tags?: string[];
  } = {};

  if (body.status !== undefined) {
    if (!isIdeaStatus(body.status)) {
      return NextResponse.json({ error: "Некорректный статус" }, { status: 400 });
    }
    data.status = body.status;
  }

  const canEditContent = gate.isAdmin || idea.createdById === gate.user.id;
  if (body.title !== undefined || body.body !== undefined || body.tags !== undefined) {
    if (!canEditContent) {
      return NextResponse.json({ error: "Редактировать текст может автор или админ" }, { status: 403 });
    }
    if (body.title !== undefined) {
      const title = String(body.title || "").trim();
      if (!title || title.length < 2 || title.length > 200) {
        return NextResponse.json({ error: "Некорректный заголовок" }, { status: 400 });
      }
      data.title = title;
    }
    if (body.body !== undefined) {
      const text = String(body.body || "").trim();
      if (!text || text.length < 2 || text.length > 20000) {
        return NextResponse.json({ error: "Некорректное описание" }, { status: 400 });
      }
      data.body = text;
    }
    if (body.tags !== undefined) {
      data.tags = parseTags(body.tags);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  const updated = await db.idea.update({ where: { id }, data });
  return NextResponse.json({
    idea: {
      id: updated.id,
      title: updated.title,
      body: updated.body,
      status: updated.status,
      tags: updated.tags,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
