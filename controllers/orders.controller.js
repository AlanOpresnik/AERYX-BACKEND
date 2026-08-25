const order = require("../models/order");


exports.getOrders = async (req, res) => {
  try {
    const orders = await order.find();

    if (!orders) {
      return res.status(404).json({ message: "No hay orders" });
    }

    res.json(orders);
  } catch (error) {
    buildErrorResponse(res, error);
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "El ID de la order es requerido",
      });
    }

    const foundOrder = await order.findById(id);

    if (!foundOrder) {
      return res.status(404).json({
        success: false,
        message: "Order no encontrada",
      });
    }

    return res.status(200).json({
      success: true,
      order: foundOrder,
    });
  } catch (error) {
    console.error("ERROR OBTENIENDO ORDER:", error);

    return res.status(500).json({
      success: false,
      message: "No se pudo obtener la order",
      error: error.message,
    });
  }
};


exports.getDashboardMetrics = async (req, res) => {
  try {
    const result = await order.aggregate([
      {
        $facet: {
          // TODOS los pedidos
          totalOrders: [
            {
              $count: "count",
            },
          ],

          // SOLAMENTE pedidos pagados
          paidOrders: [
            {
              $match: {
                "payment.status": {
                  $in: ["approved", "paid"],
                },
              },
            },
            {
              $group: {
                _id: null,

                netSales: {
                  $sum: "$totals.total",
                },

                orders: {
                  $sum: 1,
                },
              },
            },
          ],
        },
      },
    ]);

    const data = result[0];

    const totalOrders =
      data.totalOrders[0]?.count ?? 0;

    const paidOrders =
      data.paidOrders[0]?.orders ?? 0;

    const netSales =
      data.paidOrders[0]?.netSales ?? 0;

    const averageTicket =
      paidOrders > 0
        ? netSales / paidOrders
        : 0;

    return res.status(200).json({
      success: true,

      metrics: {
        netSales,
        orders: paidOrders,
        totalOrders,
        averageTicket,
        conversion: 0,
      },
    });
  } catch (error) {
    console.error(
      "ERROR OBTENIENDO MÉTRICAS DEL DASHBOARD:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "No se pudieron obtener las métricas",
    });
  }
};