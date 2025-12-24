import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// helper cookie
function getCookie(req, name) {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split(";").find((c) => c.trim().startsWith(name + "="));
  return match ? match.split("=")[1] : null;
}

export default async function handler(req, res) {
  try {
    const outlet = req.query.outlet || "UNKNOWN";
    let visitorKey = getCookie(req, "visitor_key");

    // Visitor baru
    if (!visitorKey) {
      visitorKey = crypto.randomUUID();
      const name = req.query.name;

      // Jika belum ada nama, tampilkan form input
      if (!name) {
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

      // Simpan visitor baru
      await supabase.from("visitors").insert({
        visitor_key: visitorKey,
        name,
        total_visit: 1
      });

      // Simpan scan
      await supabase.from("scans").insert({
        visitor_key: visitorKey,
        outlet_code: outlet
      });

      // Set cookie
      res.setHeader(
        "Set-Cookie",
        `visitor_key=${visitorKey}; Path=/; Max-Age=31536000; SameSite=Lax`
      );

      return res.redirect(`/visit.html?status=new&visit=1&name=${encodeURIComponent(name)}`);
    }

    // Visitor lama
    const { data: visitor } = await supabase
      .from("visitors")
      .select("*")
      .eq("visitor_key", visitorKey)
      .maybeSingle();

    const visit = (visitor?.total_visit || 0) + 1;

    await supabase
      .from("visitors")
      .update({ total_visit: visit })
      .eq("visitor_key", visitorKey);

    await supabase.from("scans").insert({
      visitor_key: visitorKey,
      outlet_code: outlet
    });

    return res.redirect(`/visit.html?status=return&visit=${visit}&name=${encodeURIComponent(visitor?.name || "Anonim")}`);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}
