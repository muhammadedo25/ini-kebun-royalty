import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    const { data: visitors } = await supabase.from("visitors").select("*");
    const { data: scans } = await supabase.from("scans").select("*");
    const { data: latest } = await supabase
      .from("scans")
      .select("visitor_key, outlet_code, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    res.json({
      totalVisitors: visitors.length,
      totalScans: scans.length,
      visitors,
      latest
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
