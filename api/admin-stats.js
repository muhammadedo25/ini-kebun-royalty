import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  try {
    const { count: totalVisitors, data: visitors } = await supabase
      .from('visitors')
      .select('visitor_key, name, total_visit, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    const { count: totalScans } = await supabase
      .from('scans')
      .select('*', { count: 'exact', head: true })

    const { data: latest } = await supabase
      .from('scans')
      .select('visitor_key, outlet_code, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    res.json({
      totalVisitors,
      totalScans,
      visitors,
      latest
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
