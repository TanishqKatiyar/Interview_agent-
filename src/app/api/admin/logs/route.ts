import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS (logs are read-restricted)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: Request) {
  if (!supabaseServiceKey) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const hours = parseInt(url.searchParams.get('hours') || '24');
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient
      .from('logs')
      .select('*')
      .gte('timestamp', startTime)
      .order('timestamp', { ascending: false })
      .limit(5000);

    if (error) {
      console.error('[admin/logs] Supabase error:', error.message);
      return Response.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    return Response.json({ logs: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/logs] error:', msg);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
