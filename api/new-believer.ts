import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";

export const config = {
    runtime: "nodejs",
};

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // const allowedOrigins = [
    //     "http://localhost:3000/",
    //     "http://localhost:3000/new-belivers",
    //     "https://www.householdofgodchurch.org/",
    // ];

    // const origin = req.headers.origin as string;

    // if (allowedOrigins.includes(origin)) {
    //     res.setHeader("Access-Control-Allow-Origin", origin);
    // }

    // res.setHeader("Access-Control-Allow-Origin", allowedOrigins);
    // res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    // res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    // if (req.method !== "POST") {
    //     return res.status(405).json({ error: "Method not allowed" });
    // }

    const allowedOrigins = [
        "http://localhost:3000",
        "https://www.householdofgodchurch.org",
    ];

    const origin = req.headers.origin as string | undefined;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // ✅ Handle preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Only allow POST after preflight
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return res
            .status(500)
            .json({ error: "Server misconfigured: RESEND_API_KEY is missing." });
    }

    const resend = new Resend(apiKey);

    try {
        const body = req.body ?? {};

        const fullName = String(body.fullName ?? "").trim();
        const email = String(body.email ?? "").trim();
        const phone = String(body.phone ?? "").trim();
        const address = String(body.address ?? "").trim();
        const contactMethod = String(body.contactMethod ?? "").trim();

        const isValidEmail = (value: string) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

        if (fullName.length < 2) {
            return res.status(400).json({ error: "Full name is required." });
        }

        const to = process.env.CONTACT_TO_EMAIL;
        const from = process.env.CONTACT_FROM_EMAIL;
        if (!to || !from) {
            return res.status(500).json({ error: "Server email config missing." });
        }

        const subject = `New Believer Connection: ${fullName}`;

        const submittedAt = new Date().toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        const text = [
            "New Believer Form Submission",
            "--------------------------------",
            `Full Name: ${fullName}`,
            `Email: ${email || "-"}`,
            `Phone: ${phone || "-"}`,
            `Address: ${address || "-"}`,
            `Preferred Contact Method: ${contactMethod || "-"}`,
            "",
            `Submitted: ${submittedAt}`,
        ].join("\n");

        const esc = (s: string) =>
            s
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");

        function row(label: string, value: string) {
            return `
<tr>
  <td style="width:170px; color:rgba(255,255,255,0.6); font-weight:900; font-size:12px; letter-spacing:0.12em; text-transform:uppercase;">
    ${esc(label)}
  </td>
  <td style="color:#ffffff; font-weight:800; font-size:14px;">
    ${esc(value)}
  </td>
</tr>`;
        }

        const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(subject)}</title>
</head>
<body>
  <h2>New Believer Connection</h2>
  <table>
    ${row("Email", email || "-")}
    ${row("Phone", phone || "-")}
    ${row("Address", address || "-")}
    ${row("Preferred Contact", contactMethod || "-")}
  </table>
</body>
</html>
`;

        const replyTo = isValidEmail(email) ? email : undefined;

        const { error } = await resend.emails.send({
            from,
            to,
            subject,
            text,
            html,
            replyTo,
        });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ ok: true });
    } catch (err: any) {
        console.error("API ERROR:", err);
        return res
            .status(500)
            .json({ error: err?.message ?? "Failed to send email." });
    }
}
