import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function getCookie(req, name) {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split(";").find(c => c.trim().startsWith(name + "="));
  return match ? match.split("=")[1] : null;
}

export default async function handler(req, res) {
  try {
    const outlet = req.query.outlet || "UNKNOWN";
    const nameFromQuery = req.query.name;
    let visitorKey = getCookie(req, "visitor_key");

    // ===== Visitor baru =====
    if (!visitorKey) {
      // Jika belum ada nama, tampilkan form
      if (!nameFromQuery) {
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"><title>Input Nama</title></head>
          <body>
            <h2>Masukkan Nama Anda</h2>
            <form method="GET">
              <input type="text" name="name" required placeholder="Nama Anda">
              <button type="submit">Kirim</button>
            </form>
          </body>
          </html>
        `);
      }

      visitorKey = crypto.randomUUID();
      const name = nameFromQuery;

      // Insert visitor baru
      const { error: visitorError } = await supabase.from("visitors").insert({
        visitor_key: visitorKey,
        name,
        total_visit: 1
      });
      if (visitorError) throw visitorError;

      // Insert scan pertama
      const { error: scanError } = await supabase.from("scans").insert({
        visitor_key: visitorKey,
        outlet_code: outlet
      });
      if (scanError) throw scanError;

      // Set cookie
      res.setHeader(
        "Set-Cookie",
        `visitor_key=${visitorKey}; Path=/; Max-Age=31536000; SameSite=Lax`
      );

      return res.redirect(`/visit.html?status=new&visit=1&name=${encodeURIComponent(name)}`);
    }

    // ===== Visitor lama =====
    const { data: visitor, error: fetchError } = await supabase
      .from("visitors")
      .select("*")
      .eq("visitor_key", visitorKey)
      .maybeSingle();
    if (fetchError) throw fetchError;

    // Kalau cookie ada tapi visitor tidak ada (misal DB reset)
    if (!visitor) return res.redirect(`/api/scan?outlet=${encodeURIComponent(outlet)}`);

    const visit = (visitor.total_visit || 0) + 1;

    // Update total_visit
    const { error: updateError } = await supabase
      .from("visitors")
      .update({ total_visit: visit })
      .eq("visitor_key", visitorKey);
    if (updateError) throw updateError;

    // Insert scan baru
    const { error: scanError } = await supabase.from("scans").insert({
      visitor_key: visitorKey,
      outlet_code: outlet
    });
    if (scanError) throw scanError;

    return res.redirect(`/visit.html?status=return&visit=${visit}&name=${encodeURIComponent(visitor.name)}`);

  } catch (err) {
    console.error(err);
    return res.status(500).send(`<h1>Server Error</h1><p>${err.message}</p>`);
  }
}
