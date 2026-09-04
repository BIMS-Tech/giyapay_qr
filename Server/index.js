import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Sequelize } from 'sequelize';
import authRoutes from './middleware/auth.js';
import userRoutes from './Routes/userRoutes.js';
import adminRoutes from './Routes/adminRoutes.js';
import branchesRoutes from './Routes/branchesRoutes.js';
import BlacklistedToken from './model/blacklistedTokenModel.js';
import qrCodesRoute from './Routes/qrCodesRoutes.js';
import bodyParser from 'body-parser';
import http from 'http';
import { Server } from 'socket.io';
import uploadRoutes from './Routes/uploadRoutes.js'
import analyticsRoutes from './Routes/analyticsRoutes.js';
import { authenticateToken } from './middleware/authenticate.js';
import User from './model/userModel.js';
import { Op } from 'sequelize';
import Admin from './model/adminModel.js';
import "./middleware/checkTransactions.js"
import { setTransactionIo } from "./middleware/checkTransactions.js";
import internalRoutes from "./Routes/internalRoutes.js";

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
  // Cloud Run load-balances across instances with no session affinity, so a
  // polling request carrying a sid can reach an instance that never saw that
  // session and answers 400. Websocket holds one connection to one instance.
  transports: ['websocket'],
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Define routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/branches', branchesRoutes);
app.use('/api/qr-codes', qrCodesRoute);
app.use('/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/internal', internalRoutes);

//--------------------------------------------------------------Temporary users section for fast use issues will be fixed later----------------------------------------------------


app.get('/user/count', authenticateToken, async (req, res) => {
  try {
    const { userType, id, admin_id } = req.user;

    let adminId;
    if (userType === 'admin') {
      adminId = id;
    } else if (userType === 'Co-Admin' && admin_id) {
      adminId = admin_id;
    } else {
      return res.status(400).json({ Status: false, Error: 'Admin ID is missing' });
    }

    const userCount = await User.count({
      where: {
        [Sequelize.Op.or]: [
          { id: adminId },
          { admin_id: adminId }
        ]
      }
    });

    return res.json({ Status: true, Result: userCount });
  } catch (error) {
    console.error('Error counting users:', error);
    return res.status(500).json({ Status: false, Error: 'Internal server error' });
  }
});

// Check if username exists
app.get('/user/check-username/:username', async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ where: { username } });
  res.json({ exists: !!user });
});

// Check if email exists
app.get('/user/check-email/:email', async (req, res) => {
  const { email } = req.params;
  const user = await User.findOne({ where: { email } });
  res.json({ exists: !!user });
});
//--------------------------------------------------------------
// Check if username is taken, excluding the current user
app.get('/user/check-username/:username/:userId', async (req, res) => {
  const { username, userId } = req.params;
  const user = await User.findOne({ where: { username, id: { [Op.ne]: userId } } });
  res.json({ exists: !!user });
});

// Check if email is taken, excluding the current user (checks both 'users' and 'admin' tables)
app.get('/user/check-email/:email/:userId', async (req, res) => {
  const { email, userId } = req.params;

  try {
    // Check in 'users' table
    const user = await User.findOne({ where: { email, id: { [Op.ne]: userId } } });

    // Check in 'admin' table
    const admin = await Admin.findOne({ where: { email } });

    // If the email exists in either table, respond with 'exists: true'
    if (user || admin) {
      return res.json({ exists: true });
    }

    // If the email does not exist in both tables, respond with 'exists: false'
    return res.json({ exists: false });
  } catch (error) {
    console.error('Error checking email:', error);
    return res.status(500).json({ error: 'An error occurred while checking the email' });
  }
});

//---------------------------------------------------------------------Temporary user section ends here-----------------------------------------------------------------


// Cleanup old blacklisted tokens
const cleanUpBlacklistedTokens = async () => {
  try {
    const now = new Date();
    await BlacklistedToken.destroy({
      where: {
        expirationDate: {
          [Sequelize.Op.lt]: now,
        },
      },
    });
    console.log('Old blacklisted tokens cleaned up successfully.');
  } catch (error) {
    console.error('Error cleaning up blacklisted tokens:', error);
  }
};

setInterval(cleanUpBlacklistedTokens, 24 * 60 * 60 * 1000);

// Socket.IO connection event
app.set("socketio", io);

// So the scheduled transaction check can emit real-time updates; it was
// previously invoked with no io and its emits were silently dropped.
setTransactionIo(io);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Server listening port
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});