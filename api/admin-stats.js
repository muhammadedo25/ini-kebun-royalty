import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const { count: visitors } = await supabase
    .from('visitors')
    .select('*', { count: 'exact', head: true })

  const { count: scans } = await supabase
    .from('scans')
    .select('*', { count: 'exact', head: true })

  const { data: latest } = await supabase
    .from('scans')
    .select('outlet_code, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  res.json({
    visitors,
    scans,
    latest
  })
}
