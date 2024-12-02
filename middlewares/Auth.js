const JWT = require('jsonwebtoken');
require("dotenv").config();
const USER = require("../models/User");

// Authentication middleware
exports.auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token missing' });
    }

    try {
      const decode = JWT.verify(token, process.env.JWT_SECRET);
      const user = await USER.findOne({ email: decode.user.email });

      if (!user) {
        return res.status(401).json({ success: false, message: "User not found" });
      }

      req.user = user;
      console.log('User authentication done');
      next();
    } catch (error) {
      console.error('Error verifying token:', error.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
  } catch (error) {
    console.error('Unexpected error:', error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Admin authorization middleware
exports.isAdmin = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: You are not authorized to access this page" });
    }

    console.log('Admin authentication done');
    next();
  } catch (error) {
    console.error("Error checking admin role:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
