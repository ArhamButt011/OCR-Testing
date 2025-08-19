import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET() {
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.titan.email",
            port: 465,
            secure: true,
            auth: {
                user: "info@innate-nw.com",
                pass: "Innate@123",
            },
        });

        const mailOptions = {
            from: "info@innate-nw.com",
            to: "info@innate-nw.com",
            subject: "New Form Submission",
            html: `<h1>Hello!</h1><p>This is a email sent via Next.js API.</p>`,
        };

        const info = await transporter.sendMail(mailOptions);

        console.log("Email sent: ", info.messageId);

        return NextResponse.json({ success: true, message: "Email sent successfully." });
    } catch (error) {
        console.error("Error sending email: ", error);
        return NextResponse.json({ success: false, error: "Failed to send email." }, { status: 500 });
    }
}
