require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('./config/cors');
const productRoutes = require('./routes/product.routes');
const shippingRoutes = require('./routes/shipping.routes');
const cartRoutes = require('./routes/cart.routes');
const mpRoutes = require('./routes/mercado-pago');
const userRoutes = require('./routes/user.routes');
const orderRoutes = require('./routes/order.rutes')
const { clerkMiddleware } = require('@clerk/express');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors);
app.use(express.json());

app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }),
)

app.use('/api/products', productRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/cart', cartRoutes);
app.use("/api/mp", mpRoutes);
app.use("/api/users", userRoutes);
app.use('/api/orders', orderRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'Backend de ecommerce funcionando' });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();
