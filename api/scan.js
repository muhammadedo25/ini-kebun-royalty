import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// --- ENV GUARD ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Supabase ENV not set')
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// --- COOKIE PARSER ---
function getCookie(req, name) {
  const cookies = req.headers.cookie
  if (!cookies) return null

  const match = cookies
    .split(';')
    .find(c => c.trim().startsWith(name + '='))

  return match ? match.split('=')[1] : null
}

export default async function handler(req, res) {
  try {
    const outlet = req.query.outlet || 'UNKNOWN'
    let visitorKey = getCookie(req, 'visitor_key')

    // =====================
    // VISITOR BARU
    // =====================
    if (!visitorKey) {
      visitorKey = uuidv4()

      const { error: insertVisitorError } = await supabase
        .from('visitors')
        .insert({
          visitor_key: visitorKey,
          total_visit: 1
        })

      if (insertVisitorError) throw insertVisitorError

      await supabase.from('scans').insert({
        visitor_key: visitorKey,
        outlet_code: outlet
      })

      res.setHeader(
        'Set-Cookie',
        `visitor_key=${visitorKey}; Path=/; Max-Age=31536000; SameSite=Lax`
      )

      return res.status(200).json({
        status: 'new',
        visit: 1
      })
    }

    // =====================
    // VISITOR LAMA
    // =====================
    const { data: visitor, error: visitorError } = await supabase
      .from('visitors')
      .select('*')
      .eq('visitor_key', visitorKey)
      .maybeSingle()

    // Jika cookie ada tapi data hilang → treat as new
    if (!visitor || visitorError) {
      await supabase.from('visitors').insert({
        visitor_key: visitorKey,
        total_visit: 1
      })

      return res.json({
        status: 'new',
        visit: 1
      })
    }

    const visit = visitor.total_visit + 1

    await supabase
      .from('visitors')
      .update({ total_visit: visit })
      .eq('visitor_key', visitorKey)

    await supabase.from('scans').insert({
      visitor_key: visitorKey,
      outlet_code: outlet
    })

    return res.json({
      status: 'return',
      visit
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({
      error: 'Server error',
      message: err.message
    })
  }
}
