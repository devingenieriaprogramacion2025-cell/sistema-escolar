const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/users.routes');
const resourceRoutes = require('./routes/resources.routes');
const loanRoutes = require('./routes/loans.routes');
const reservationRoutes = require('./routes/reservations.routes');
const requestRoutes = require('./routes/internalRequests.routes');
const printRoutes = require('./routes/printRequests.routes');
const reportRoutes = require('./routes/reports.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const auditRoutes = require('./routes/auditLogs.routes');

const { notFoundMiddleware, errorMiddleware } = require('./middlewares/error.middleware');

connectDB();

const app = express();

app.use(
  cors({
    origin: '*',
    credentials: false
  })
);
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'School internal operations API online'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/prints', printRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
