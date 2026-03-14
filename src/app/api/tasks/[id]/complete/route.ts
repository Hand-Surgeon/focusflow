import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Task } from '@/types/database';

interface CompleteTaskResponse {
  task: Task;
  streak: {
    today_completed: number;
    message: string;
  };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        status: 'COMPLETED',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count tasks completed today for streak info
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'COMPLETED')
      .gte('completed_at', todayStart.toISOString());

    const todayCompleted = count ?? 1;

    let message = 'Task completed!';
    if (todayCompleted >= 10) {
      message = 'Incredible! 10+ tasks today!';
    } else if (todayCompleted >= 5) {
      message = 'Amazing! 5+ tasks completed today!';
    } else if (todayCompleted >= 3) {
      message = 'Great momentum! Keep going!';
    }

    const response: CompleteTaskResponse = {
      task: task as Task,
      streak: {
        today_completed: todayCompleted,
        message,
      },
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
