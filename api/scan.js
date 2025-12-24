import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// helper untuk ambil cookie
function getCookie(req, name) {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split(";").find((c) => c.trim().startsWith(name + "="));
  return match ? match.split("=")[1] : null;
}

export default async function handler(req, res) {
  try {
    const outlet = req.query.outlet || "UNKNOWN";
    const nameFromQuery = req.query.name; // optional dari form
    let visitorKey = getCookie(req, "visitor_key");

    // ===== Visitor baru =====
    if (!visitorKey) {
      // Jika belum ada nama, minta input dari user
      if (!nameFromQuery) {
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Input Nama</title></head>
          <body>
            <h2>Masukkan Nama Anda</h2>
            <form method="GET">
              <input type="text" name="name" required>
              <button type="submit">Kirim</button>
            </form>
          </body>
          </html>
        `);
      }

      visitorKey = crypto.randomUUID();
      const name = nameFromQuery;

      // Insert visitor dulu
      const { error: visitorError } = await supabase.from("visitors").insert({
        visitor_key: visitorKey,
        name,
        total_visit: 1
      });

      if (visitorError) throw visitorError;

      // Insert scan setelah visitor berhasil
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

    if (!visitor) {
      // VisitorKey cookie ada tapi tidak ditemukan di database
      // Bisa jadi database di-reset, maka treat sebagai visitor baru
      return res.redirect(`/visit.html?outlet=${encodeURIComponent(outlet)}`);
    }

    const visit = (visitor.total_visit || 0) + 1;

    const { error: updateError } = await supabase
      .from("visitors")
      .update({ total_visit: visit })
      .eq("visitor_key", visitorKey);

    if (updateError) throw updateError;

    const { error: scanError } = await supabase.from("scans").insert({
      visitor_key: visitorKey,
      outlet_code: outlet
    });

    if (scanError) throw scanError;

    return res.redirect(`/visit.html?status=return&visit=${visit}&name=${encodeURIComponent(visitor.name)}`);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}
