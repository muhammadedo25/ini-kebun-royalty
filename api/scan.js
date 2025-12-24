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
    const nameFromQuery = req.query.name;
    let visitorKey = getCookie(req, "visitor_key");

    // ===== Visitor baru =====
    if (!visitorKey) {
      // Jika belum ada nama, tampilkan form
      if (!nameFromQuery) {
        return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Selamat Datang</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, sans-serif;
            background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: #fff;
          }
          .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 20px;
            width: 90%;
            max-width: 400px;
            text-align: center;
            backdrop-filter: blur(10px);
          }
          h1 { margin-bottom: 20px; font-size: 24px; }
          input {
            padding: 12px;
            width: 100%;
            border-radius: 10px;
            border: none;
            margin-bottom: 20px;
            font-size: 16px;
          }
          button {
            padding: 12px 20px;
            border: none;
            border-radius: 10px;
            background: #fff;
            color: #2575fc;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            transition: 0.3s;
          }
          button:hover {
            background: #e0e0e0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Selamat Datang!</h1>
          <p>Masukkan nama Anda untuk mulai scan</p>
          <form method="GET">
            <input type="text" name="name" placeholder="Nama Anda" required>
            <button type="submit">Mulai</button>
          </form>
        </div>
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
        total_visit: 1,
      });
      if (visitorError) throw visitorError;

      // Insert scan pertama
      const { error: scanError } = await supabase.from("scans").insert({
        visitor_key: visitorKey,
        outlet_code: outlet,
      });
      if (scanError) throw scanError;

      // Set cookie
      res.setHeader(
        "Set-Cookie",
        `visitor_key=${visitorKey}; Path=/; Max-Age=31536000; SameSite=Lax`
      );

      return res.redirect(
        `/visit.html?status=new&visit=1&name=${encodeURIComponent(name)}`
      );
    }

    // ===== Visitor lama =====
    const { data: visitor, error: fetchError } = await supabase
      .from("visitors")
      .select("*")
      .eq("visitor_key", visitorKey)
      .maybeSingle();
    if (fetchError) throw fetchError;

    // Kalau cookie ada tapi visitor tidak ada (misal DB reset)
    if (!visitor)
      return res.redirect(`/api/scan?outlet=${encodeURIComponent(outlet)}`);

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
      outlet_code: outlet,
    });
    if (scanError) throw scanError;

    return res.redirect(
      `/visit.html?status=return&visit=${visit}&name=${encodeURIComponent(
        visitor.name
      )}`
    );
  } catch (err) {
    console.error(err);
    return res.status(500).send(`<h1>Server Error</h1><p>${err.message}</p>`);
  }
}
