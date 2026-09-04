import { NextRequest, NextResponse } from "next/server";
import { requireIdeasUser } from "@/lib/ideas/guard";
import { displayName } from "@/lib/ideas/users";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/ideas/[id]/comments — { body } */
export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireIdeasUser();
  if (gate.error) return gate.error;

  const { id } = await ctx.params;
  const idea = await db.idea.findUnique({ where: { id }, select: { id: true } });
  if (!idea) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const payload = await req.json().catch(() => ({}));
  const text = String(payload.body || "").trim();
  if (!text || text.length < 1) {
    return NextResponse.json({ error: "Пустой комментарий" }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: "Комментарий слишком длинный" }, { status: 400 });
  }

  const comment = await db.ideaComment.create({
    data: {
      ideaId: id,
      authorId: gate.user.id,
      body: text,
    },
  });

  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        body: comment.body,
        authorId: comment.authorId,
        authorName: displayName(
          { id: gate.user.id, email: gate.user.email, firstName: gate.user.firstName },
          gate.user.id,
        ),
        authorEmail: gate.user.email,
        createdAt: comment.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
