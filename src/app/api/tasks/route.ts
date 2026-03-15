import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { Task, TaskQuadrant, TaskStatus, SourceType } from '@/types/database';

const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  quadrant: z
    .enum(['Q1', 'Q2', 'Q3', 'Q4', 'UNCLASSIFIED'] satisfies TaskQuadrant[])
    .default('UNCLASSIFIED'),
  energy_cost: z.number().int().min(1).max(5).default(3),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
  source_type: z
    .enum(['MANUAL', 'CALENDAR', 'EMAIL', 'BRAIN_DUMP'] satisfies SourceType[])
    .default('MANUAL'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const quadrant = searchParams.get('quadrant');
    const status = searchParams.get('status');
    const sort = searchParams.get('sort') ?? 'position';

    const validSortFields: Record<string, string> = {
      created_at: 'created_at',
      due_date: 'due_date',
      position: 'position',
    };
    const sortField = validSortFields[sort] ?? 'position';

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id);

    if (quadrant) {
      const validQuadrants: TaskQuadrant[] = ['Q1', 'Q2', 'Q3', 'Q4', 'UNCLASSIFIED'];
      if (validQuadrants.includes(quadrant as TaskQuadrant)) {
        query = query.eq('quadrant', quadrant as TaskQuadrant);
      }
    }

    if (status) {
      const validStatuses: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];
      if (validStatuses.includes(status as TaskStatus)) {
        query = query.eq('status', status as TaskStatus);
      }
    }

    query = query.order(sortField, { ascending: true });

    const { data: tasks, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(tasks as Task[]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure user profile exists (FK required for task insert)
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email ?? '',
          name: (user.user_metadata?.full_name as string) ?? null,
          avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
          role: 'user',
          preferences: {},
        });

      if (upsertError) {
        console.error('Failed to create user profile:', upsertError);
        return NextResponse.json(
          { error: 'Failed to create user profile', detail: upsertError.message },
          { status: 500 },
        );
      }
    }

    const body: unknown = await request.json();
    const parsed = CreateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, quadrant, energy_cost, due_date, source_type } = parsed.data;

    // Get the next position for the quadrant
    const { data: maxPositionRow } = await supabase
      .from('tasks')
      .select('position')
      .eq('user_id', user.id)
      .eq('quadrant', quadrant)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPositionRow?.position ?? 0) + 1;

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title,
        description: description ?? null,
        quadrant,
        energy_cost,
        due_date: due_date ?? null,
        source_type,
        source_id: null,
        ai_reason: null,
        parent_task_id: null,
        status: 'PENDING' as TaskStatus,
        position: nextPosition,
        completed_at: null,
      })
      .select()
      .single();

    if (error) {
      console.error('Task insert error:', { message: error.message, code: error.code, hint: error.hint });
      return NextResponse.json(
        { error: error.message, code: error.code, hint: error.hint ?? null },
        { status: 500 },
      );
    }

    return NextResponse.json(task as Task, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Task creation exception:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
