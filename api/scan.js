import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const outlet = req.query.outlet || 'UNKNOWN'
  let visitorKey = req.cookies?.visitor_key

  // VISITOR BARU
  if (!visitorKey) {
    visitorKey = uuidv4()

    await supabase.from('visitors').insert({
      visitor_key: visitorKey,
      total_visit: 1
    })

    await supabase.from('scans').insert({
      visitor_key: visitorKey,
      outlet_code: outlet
    })

    res.setHeader('Set-Cookie',
      `visitor_key=${visitorKey}; Path=/; Max-Age=31536000`
    )

    return res.json({
      status: 'new',
      visit: 1
    })
  }

  // VISITOR LAMA
  const { data: visitor } = await supabase
    .from('visitors')
    .select('*')
    .eq('visitor_key', visitorKey)
    .single()

  const visit = visitor.total_visit + 1

  await supabase
    .from('visitors')
    .update({ total_visit: visit })
    .eq('visitor_key', visitorKey)

  await supabase.from('scans').insert({
    visitor_key: visitorKey,
    outlet_code: outlet
  })

  res.json({
    status: 'return',
    visit
  })
}
