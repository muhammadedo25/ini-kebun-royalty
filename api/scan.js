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

    // visitor baru
    if (!visitorKey) {
      visitorKey = crypto.randomUUID();
      const name = req.query.name || "Anonim";

      await supabase.from("visitors").insert({
        visitor_key: visitorKey,
        name,
        total_visit: 1,
      });

      await supabase.from("scans").insert({
        visitor_key: visitorKey,
        outlet_code: outlet,
      });

      res.setHeader(
        "Set-Cookie",
        `visitor_key=${visitorKey}; Path=/; Max-Age=31536000; SameSite=Lax`
      );

      return res.redirect(
        `/visit.html?status=new&visit=1&name=${encodeURIComponent(name)}`
      );
    }

    // VISITOR LAMA
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
      outlet_code: outlet,
    });

    return res.redirect(`/visit.html?status=return&visit=${visit}`);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Server error",
      message: err.message,
    });
  }
}
