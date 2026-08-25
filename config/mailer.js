const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOrderConfirmationEmail = async (order) => {
  try {
    await resend.emails.send({
      from: "AERYX <onboarding@resend.dev>", // dominio de pruebas de Resend
      to: order.customer.email, // ⚠️ mientras testeás, esto TIENE que ser tu propio email de Resend
      subject: `Confirmamos tu pedido #${order._id}`,
      html: `
        <h2>¡Gracias por tu compra, ${order.customer.firstName}!</h2>
        <p>Tu pago fue aprobado y ya estamos preparando tu pedido.</p>
        <p><strong>Total:</strong> $${order.totals.total}</p>
        <ul>
          ${order.items
            .map((item) => `<li>${item.quantity}x ${item.name} - $${item.subtotal}</li>`)
            .join("")}
        </ul>
      `,
    });
  } catch (error) {
    console.error("ERROR ENVIANDO EMAIL DE CONFIRMACIÓN:", error);
    // No relanzamos: si falla el mail, no queremos que falle el webhook
  }
};

module.exports = { sendOrderConfirmationEmail };