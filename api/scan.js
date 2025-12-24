import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function getCookie(req, name) {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split(";").find((c) => c.trim().startsWith(name + "="));
  return match ? match.split("=")[1] : null;
}

export default async function handler(req, res) {
  try {
    const outlet = req.query.outlet || "UNKNOWN";
    const name = req.query.name;
    let visitorKey = getCookie(req, "visitor_key");

    // Visitor baru
    if (!visitorKey) {
      if (!name) {
        return res.status(400).json({ error: "Nama harus diisi" });
      }

      visitorKey = crypto.randomUUID();

      // simpan visitor dulu
      const { error: visitorError } = await supabase.from("visitors").insert({
        visitor_key: visitorKey,
        name,
        total_visit: 1,
      });

      if (visitorError) throw visitorError; // pastikan insert berhasil dulu

      // baru simpan scan
      const { error: scanError } = await supabase.from("scans").insert({
        visitor_key: visitorKey,
        outlet_code: outlet,
      });

      if (scanError) throw scanError;

      // set cookie & redirect...

      res.setHeader(
        "Set-Cookie",
        `visitor_key=${visitorKey}; Path=/; Max-Age=31536000; SameSite=Lax`
      );

      return res.json({ status: "new", visit: 1, name });
    }

    // Visitor lama
    const { data: visitor, error: fetchError } = await supabase
      .from("visitors")
      .select("*")
      .eq("visitor_key", visitorKey)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const visit = (visitor?.total_visit || 0) + 1;

    const { error: updateError } = await supabase
      .from("visitors")
      .update({ total_visit: visit })
      .eq("visitor_key", visitorKey);

    if (updateError) throw updateError;

    const { error: scanError } = await supabase.from("scans").insert({
      visitor_key: visitorKey,
      outlet_code: outlet,
    });

    if (scanError) throw scanError;

    return res.json({
      status: "return",
      visit,
      name: visitor?.name || "Anonim",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
