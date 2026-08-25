const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const formatPrice = (value = 0) => {
  return `$${Number(value).toLocaleString("es-AR")}`;
};

const sendOrderConfirmationEmail = async (order) => {
  try {
    const customer = order.customer;
    const items = order.items || [];

    const subtotal = order.totals?.subtotal || 0;
    const shipping = order.totals?.shipping || 0;
    const total = order.totals?.total || 0;

    const orderNumber = order._id.toString();

    const shippingAddress = order.shippingAddress;

    const productsHtml = items
      .map(
        (item) => `
          <tr>
            <td style="padding: 18px 0; border-bottom: 1px solid #eeeeea;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${
                    item.image
                      ? `
                        <td width="72" valign="top">
                          <img
                            src="${item.image}"
                            alt="${item.name}"
                            width="64"
                            height="64"
                            style="
                              display:block;
                              width:64px;
                              height:64px;
                              object-fit:cover;
                              background:#f4f4f1;
                              border:1px solid #e5e5e0;
                            "
                          />
                        </td>
                      `
                      : ""
                  }

                  <td valign="top" style="padding-left:${
                    item.image ? "12px" : "0"
                  };">
                    <div
                      style="
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:14px;
                        font-weight:700;
                        color:#101010;
                        line-height:20px;
                      "
                    >
                      ${item.name}
                    </div>

                    <div
                      style="
                        margin-top:4px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:12px;
                        color:#777770;
                        line-height:18px;
                      "
                    >
                      Cantidad: ${item.quantity}
                    </div>

                    <div
                      style="
                        margin-top:2px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:12px;
                        color:#777770;
                        line-height:18px;
                      "
                    >
                      ${formatPrice(item.price)} c/u
                    </div>
                  </td>

                  <td
                    width="100"
                    valign="top"
                    align="right"
                    style="padding-left:10px;"
                  >
                    <div
                      style="
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:14px;
                        font-weight:700;
                        color:#101010;
                      "
                    >
                      ${formatPrice(item.subtotal)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `,
      )
      .join("");

    const addressHtml = shippingAddress
      ? `
        <div
          style="
            font-family:Arial,Helvetica,sans-serif;
            font-size:13px;
            line-height:21px;
            color:#555550;
          "
        >
          <strong style="color:#101010;">
            ${shippingAddress.address}
            ${shippingAddress.addressNumber}
          </strong>

          ${
            shippingAddress.betweenStreet1
              ? `
                <br />
                Entre ${shippingAddress.betweenStreet1}
                ${
                  shippingAddress.betweenStreet2
                    ? ` y ${shippingAddress.betweenStreet2}`
                    : ""
                }
              `
              : ""
          }

          <br />

          ${shippingAddress.city}

          ${
            shippingAddress.province
              ? `, ${shippingAddress.province}`
              : ""
          }

          ${
            shippingAddress.postalCode
              ? ` · CP ${shippingAddress.postalCode}`
              : ""
          }
        </div>
      `
      : `
        <div
          style="
            font-family:Arial,Helvetica,sans-serif;
            font-size:13px;
            color:#555550;
          "
        >
          Dirección de envío no disponible.
        </div>
      `;

    const shippingMethod =
      order.shipping?.option?.title ||
      (order.shipping?.manual
        ? "Envío a coordinar"
        : "Envío estándar");

    await resend.emails.send({
      from: "AERYX <onboarding@resend.dev>",

      to: customer.email,

      subject: `✓ Compra confirmada · Pedido #${orderNumber}`,

      html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>Compra confirmada - AERYX</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f4f1;
  "
>

  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="background:#f4f4f1;"
  >
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- CONTAINER -->

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:620px;
            background:#ffffff;
          "
        >

          <!-- HEADER -->

          <tr>
            <td
              style="
                padding:30px 32px;
                border-bottom:1px solid #e8e8e3;
              "
            >

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                <tr>

                  <td>
                    <div
                      style="
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:27px;
                        font-weight:900;
                        letter-spacing:-1.5px;
                        color:#101010;
                      "
                    >
                      AERYX
                    </div>

                    <div
                      style="
                        margin-top:4px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:9px;
                        font-weight:700;
                        letter-spacing:2px;
                        text-transform:uppercase;
                        color:#999990;
                      "
                    >
                      BORN TO COMPETE
                    </div>
                  </td>

                  <td align="right">

                    <div
                      style="
                        display:inline-block;
                        padding:8px 12px;
                        background:#c9f158;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1px;
                        text-transform:uppercase;
                        color:#101010;
                      "
                    >
                      PAGO APROBADO
                    </div>

                  </td>

                </tr>
              </table>

            </td>
          </tr>


          <!-- HERO -->

          <tr>
            <td
              style="
                padding:44px 32px 36px;
                text-align:center;
              "
            >

              <div
                style="
                  margin:0 auto 22px;
                  width:58px;
                  height:58px;
                  line-height:58px;
                  border-radius:50%;
                  background:#c9f158;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:27px;
                  font-weight:700;
                  color:#101010;
                "
              >
                ✓
              </div>

              <div
                style="
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:10px;
                  font-weight:800;
                  letter-spacing:2px;
                  text-transform:uppercase;
                  color:#999990;
                "
              >
                COMPRA CONFIRMADA
              </div>

              <h1
                style="
                  margin:12px 0 0;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:34px;
                  line-height:40px;
                  letter-spacing:-1.5px;
                  color:#101010;
                "
              >
                ¡Gracias por tu compra,
                ${customer.firstName}!
              </h1>

              <p
                style="
                  margin:16px auto 0;
                  max-width:440px;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:14px;
                  line-height:23px;
                  color:#777770;
                "
              >
                Recibimos correctamente tu pago.
                Tu pedido ya está confirmado y
                comenzaremos a prepararlo.
              </p>

            </td>
          </tr>


          <!-- ORDER NUMBER -->

          <tr>
            <td style="padding:0 32px 28px;">

              <div
                style="
                  padding:16px 18px;
                  background:#f4f4f1;
                  border:1px solid #e7e7e1;
                "
              >

                <table
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                >
                  <tr>

                    <td>

                      <div
                        style="
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:9px;
                          font-weight:800;
                          letter-spacing:1.5px;
                          text-transform:uppercase;
                          color:#999990;
                        "
                      >
                        NÚMERO DE PEDIDO
                      </div>

                      <div
                        style="
                          margin-top:5px;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:13px;
                          font-weight:700;
                          color:#101010;
                          word-break:break-all;
                        "
                      >
                        #${orderNumber}
                      </div>

                    </td>

                    <td align="right">

                      <div
                        style="
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:9px;
                          font-weight:800;
                          letter-spacing:1.5px;
                          text-transform:uppercase;
                          color:#999990;
                        "
                      >
                        ESTADO
                      </div>

                      <div
                        style="
                          margin-top:5px;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:13px;
                          font-weight:700;
                          color:#101010;
                        "
                      >
                        Confirmado
                      </div>

                    </td>

                  </tr>
                </table>

              </div>

            </td>
          </tr>


          <!-- PRODUCTS -->

          <tr>
            <td style="padding:0 32px;">

              <div
                style="
                  padding-bottom:12px;
                  border-bottom:1px solid #101010;
                "
              >

                <span
                  style="
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:10px;
                    font-weight:800;
                    letter-spacing:1.5px;
                    text-transform:uppercase;
                    color:#101010;
                  "
                >
                  TU PEDIDO
                </span>

              </div>

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                ${productsHtml}
              </table>

            </td>
          </tr>


          <!-- TOTALS -->

          <tr>
            <td style="padding:26px 32px 32px;">

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >

                <tr>
                  <td
                    style="
                      padding:5px 0;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:13px;
                      color:#777770;
                    "
                  >
                    Subtotal
                  </td>

                  <td
                    align="right"
                    style="
                      padding:5px 0;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:13px;
                      font-weight:700;
                      color:#101010;
                    "
                  >
                    ${formatPrice(subtotal)}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:5px 0;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:13px;
                      color:#777770;
                    "
                  >
                    Envío
                  </td>

                  <td
                    align="right"
                    style="
                      padding:5px 0;
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:13px;
                      font-weight:700;
                      color:#101010;
                    "
                  >
                    ${
                      order.shipping?.manual
                        ? "A coordinar"
                        : formatPrice(shipping)
                    }
                  </td>
                </tr>

                <tr>
                  <td
                    colspan="2"
                    style="
                      padding-top:18px;
                      border-top:1px solid #deded8;
                    "
                  ></td>
                </tr>

                <tr>

                  <td
                    style="
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:11px;
                      font-weight:800;
                      letter-spacing:1px;
                      text-transform:uppercase;
                      color:#101010;
                    "
                  >
                    TOTAL
                  </td>

                  <td
                    align="right"
                    style="
                      font-family:Arial,Helvetica,sans-serif;
                      font-size:27px;
                      font-weight:800;
                      letter-spacing:-1px;
                      color:#101010;
                    "
                  >
                    ${formatPrice(total)}
                  </td>

                </tr>

              </table>

            </td>
          </tr>


          <!-- SHIPPING -->

          <tr>
            <td
              style="
                padding:0 32px 32px;
              "
            >

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  background:#fafaf8;
                  border:1px solid #e8e8e3;
                "
              >

                <tr>

                  <td style="padding:22px;">

                    <div
                      style="
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:10px;
                        font-weight:800;
                        letter-spacing:1.5px;
                        text-transform:uppercase;
                        color:#101010;
                      "
                    >
                      DATOS DE ENVÍO
                    </div>

                    <div style="height:12px;"></div>

                    ${addressHtml}

                    <div style="height:15px;"></div>

                    <div
                      style="
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:10px;
                        font-weight:800;
                        letter-spacing:1px;
                        text-transform:uppercase;
                        color:#999990;
                      "
                    >
                      MÉTODO
                    </div>

                    <div
                      style="
                        margin-top:5px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:13px;
                        font-weight:700;
                        color:#101010;
                      "
                    >
                      ${shippingMethod}
                    </div>

                  </td>

                </tr>

              </table>

            </td>
          </tr>


          <!-- CUSTOMER -->

          <tr>
            <td
              style="
                padding:0 32px 32px;
              "
            >

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >

                <tr>

                  <td width="50%" valign="top">

                    <div
                      style="
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1.5px;
                        text-transform:uppercase;
                        color:#999990;
                      "
                    >
                      COMPRADOR
                    </div>

                    <div
                      style="
                        margin-top:7px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:13px;
                        font-weight:700;
                        color:#101010;
                      "
                    >
                      ${customer.firstName}
                      ${customer.lastName}
                    </div>

                    <div
                      style="
                        margin-top:3px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:12px;
                        color:#777770;
                      "
                    >
                      ${customer.email}
                    </div>

                    ${
                      customer.phone
                        ? `
                          <div
                            style="
                              margin-top:3px;
                              font-family:Arial,Helvetica,sans-serif;
                              font-size:12px;
                              color:#777770;
                            "
                          >
                            ${customer.phone}
                          </div>
                        `
                        : ""
                    }

                  </td>

                  <td width="50%" valign="top">

                    <div
                      style="
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1.5px;
                        text-transform:uppercase;
                        color:#999990;
                      "
                    >
                      PAGO
                    </div>

                    <div
                      style="
                        margin-top:7px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:13px;
                        font-weight:700;
                        color:#101010;
                      "
                    >
                      ${
                        order.payment?.method === "mp"
                          ? "Mercado Pago"
                          : "Transferencia bancaria"
                      }
                    </div>

                    <div
                      style="
                        margin-top:3px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:12px;
                        color:#777770;
                      "
                    >
                      Pago aprobado
                    </div>

                  </td>

                </tr>

              </table>

            </td>
          </tr>


          <!-- CTA -->

          <tr>
            <td
              style="
                padding:0 32px 40px;
                text-align:center;
              "
            >

              <div
                style="
                  padding:24px;
                  background:#101010;
                "
              >

                <div
                  style="
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:18px;
                    font-weight:800;
                    letter-spacing:-0.5px;
                    color:#ffffff;
                  "
                >
                  BORN TO COMPETE
                </div>

                <div
                  style="
                    margin-top:8px;
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:12px;
                    line-height:19px;
                    color:#999999;
                  "
                >
                  Tu pedido está en nuestras manos.
                  <br />
                  Te avisaremos cuando esté listo para salir.
                </div>

              </div>

            </td>
          </tr>


          <!-- FOOTER -->

          <tr>
            <td
              style="
                padding:22px 32px;
                border-top:1px solid #e8e8e3;
                text-align:center;
              "
            >

              <div
                style="
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:9px;
                  line-height:16px;
                  letter-spacing:1.2px;
                  text-transform:uppercase;
                  color:#aaaaa3;
                "
              >
                Gracias por elegir AERYX
              </div>

              <div
                style="
                  margin-top:7px;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:9px;
                  color:#bbbbbb;
                "
              >
                Este correo confirma que recibimos correctamente
                tu pago.
              </div>

            </td>
          </tr>

        </table>

        <!-- OUTSIDE FOOTER -->

        <div
          style="
            max-width:620px;
            padding-top:18px;
            font-family:Arial,Helvetica,sans-serif;
            font-size:9px;
            line-height:15px;
            text-align:center;
            color:#aaa9a2;
          "
        >
          AERYX · BORN TO COMPETE
        </div>

      </td>
    </tr>
  </table>

</body>
</html>
      `,
    });

    console.log(
      `EMAIL DE CONFIRMACIÓN ENVIADO A ${customer.email} PARA ORDER ${orderNumber}`,
    );
  } catch (error) {
    console.error(
      "ERROR ENVIANDO EMAIL DE CONFIRMACIÓN:",
      error,
    );

    // No lanzamos el error para que un fallo de email
    // nunca rompa el webhook de Mercado Pago.
  }
};

module.exports = {
  sendOrderConfirmationEmail,
};