require('dotenv').config({
  path: require('path').join(__dirname, '.env')
});
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/discover', require('./routes/discover'));
app.use('/api/likes', require('./routes/likes'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/safety', require('./routes/safety'));
app.use('/api/admin', require('./routes/admin'));
app.listen(process.env.PORT || 3000, () =>
  console.log('SoloTrip Match running on http://localhost:' + (process.env.PORT || 3000)));
