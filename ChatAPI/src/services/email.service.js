import nodemailer from 'nodemailer';
import config from '../config/index.js';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} resetToken - Reset token
 * @param {string} userName - User display name
 */
export async function sendPasswordResetEmail(email, resetToken, userName) {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"ChatUI" <${process.env.SMTP_USER || 'noreply@chatui.com'}>`,
    to: email,
    subject: 'Khôi phục mật khẩu - ChatUI',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0068FF 0%, #0052CC 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ChatUI</h1>
        </div>
        
        <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e8e8e8; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1F1F1F; margin: 0 0 20px 0; font-size: 20px;">Xin chào ${userName},</h2>
          
          <p style="color: #757575; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Chúng tôi đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn. 
            Nhấn vào nút bên dưới để đặt lại mật khẩu mới.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #0068FF; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Đặt lại mật khẩu
            </a>
          </div>
          
          <p style="color: #757575; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            Link đặt lại mật khẩu sẽ hết hạn sau <strong>1 giờ</strong>.
          </p>
          
          <p style="color: #757575; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. 
            Tài khoản của bạn vẫn an toàn.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            Email này được gửi tự động từ ChatUI. Vui lòng không trả lời email này.
          </p>
        </div>
      </div>
    `,
    text: `
Xin chào ${userName},

Chúng tôi đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.

Nhấn vào link bên dưới để đặt lại mật khẩu mới:
${resetUrl}

Link đặt lại mật khẩu sẽ hết hạn sau 1 giờ.

Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.

Email này được gửi tự động từ ChatUI.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${email}:`, error.message);
    // Don't throw - we don't want to reveal email sending failures to attackers
    return false;
  }
}

/**
 * Verify SMTP connection
 */
export async function verifyConnection() {
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    return false;
  }
}

export default {
  sendPasswordResetEmail,
  verifyConnection,
};
