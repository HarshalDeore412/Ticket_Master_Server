const USER = require("../models/User");
const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");
const dotenv = require("dotenv").config();
const OTP = require("../models/OTP");
const mailSender = require("../utils/mailSender");
const mongoose = require("mongoose");

exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, process, email, empID, password, otp } =
      req.body;

    console.log("Received all the data");

    // Validate input
    if (
      !firstName ||
      !process ||
      !lastName ||
      !email ||
      !empID ||
      !password ||
      !otp
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    console.log("Validated the data");

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    console.log("Email validated");

    const Email = email.toLowerCase();

    console.log("Email converted to lowercase");

    // Check OTP
    const isOtpAvailable = await OTP.findOne({ otp });
    if (!isOtpAvailable) {
      return res.status(404).json({
        success: false,
        message: "OTP does not match",
      });
    }

    console.log("OTP verified");

    // Hash password
    let hashPass;
    try {
      hashPass = await bcrypt.hash(password, 10);
    } catch (err) {
      console.error("Error hashing password:", err);
      return res.status(500).json({
        success: false,
        message: "Error hashing password",
        error: err.message,
      });
    }

    console.log("Password hashed");

    const existingUser = await USER.findOne({ empID });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this empID already exists",
      });
    }

    // Create user
    let response;
    try {
      response = await USER.create({
        firstName,
        lastName,
        process,
        email: Email,
        empID,
        password: hashPass,
      });
    } catch (err) {
      console.error("Error creating user:", err);
      return res.status(500).json({
        success: false,
        message: "Error creating user",
        error: err.message,
      });
    }

    console.log("User created:", response);

    // Remove OTP document
    try {
      await OTP.deleteOne({ otp });
    } catch (err) {
      console.error("Error deleting OTP:", err);
      return res.status(500).json({
        success: false,
        message: "Error deleting OTP",
        error: err.message,
      });
    }

    console.log("Deleted OTP");

    return res.status(200).json({
      success: true,
      message: "User created successfully",
      data: response,
    });
  } catch (err) {
    console.error("Internal Server Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

// send otp
exports.sendOTP = async (req, res) => {
  console.log("OTP request received...");
  try {
    const { email } = req.body;

    // Check if email is empty
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const Email = email.toLowerCase();

    const User = await USER.findOne({ email: Email });

    // Check if user is already registered
    if (User) {
      return res.status(409).json({
        success: false,
        message: "User already registered. Please login...",
      });
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000); // Ensure OTP is always 4 digits

    // Create OTP document with email
    const otpDoc = await OTP.create({ email: Email, otp });

    // Check if OTP document created successfully
    if (!otpDoc) {
      return res.status(500).json({
        success: false,
        message: "Failed to create OTP document",
      });
    }

    // Send OTP via email
    try {
      await mailSender(Email, "OTP Verification", `Your OTP is ${otp}`);

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        otp, // Consider removing this in production for security
      });
    } catch (mailError) {
      console.error("Email sending error:", mailError);

      return res.status(500).json({
        success: false,
        message: "Failed to send OTP via email",
      });
    }
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// login user
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const Email = email.toLowerCase();
    console.log("Email:", Email);

    // Check if user exists
    const User = await USER.findOne({ email: Email });
    console.log("User:", User);

    if (!User) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Compare passwords
    const isPasswordMatch = await bcrypt.compare(password, User.password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Wrong password",
      });
    }

    console.log("Password matched");

    // Create data payload for JWT
    const DATA = {
      user: {
        id: User.id,
        email: User.email,
      },
    };

    console.log("Data:", DATA);

    // Generate JWT token
    const authToken = JWT.sign(DATA, process.env.JWT_SECRET);

    console.log("Token created");

    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      User: User,
      token: authToken,
    });
  } catch (err) {
    console.error("Error while logging in:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    // Validate content type
    if (
      !req.headers["content-type"] ||
      req.headers["content-type"] !== "application/json"
    ) {
      return res.status(415).json({
        success: false,
        message: "Invalid content type",
      });
    }

    // Fetch users
    const users = await USER.find();

    // Check if users exist
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found",
      });
    }

    console.log("Users sent");

    // Return users
    return res.status(200).json({
      success: true,
      message: "User data retrieved successfully",
      users,
    });
  } catch (err) {
    // Handle specific errors
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    } else if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
      });
    } else {
      // Handle general errors
      console.error("Server error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
};

exports.deleteUser = async (req, res) => {
  try {
    console.log("Request to delete user:", req.params._id);

    // Check if the user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // Check if the user ID is provided
    if (!req.params._id) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Check if the user ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    // Find the user to be deleted
    const userToDelete = await USER.findById(req.params._id);

    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if the user to be deleted is an admin
    if (userToDelete.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "You cannot delete an admin",
      });
    }

    // Check if the user is trying to delete themselves
    if (String(req.user._id) === req.params._id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete yourself",
      });
    }

    // Delete the user
    const deleteUser = await USER.deleteOne({ _id: req.params._id });

    // Check if the user was deleted successfully
    if (deleteUser.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Return a success response
    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    // Handle specific errors
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    } else if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
      });
    } else {
      console.error("Error while deleting user:", err.message);
      // Return a generic error response
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
};



exports.updateUser = async (req, res) => {
  console.log("Request to update user info received");

  try {
    const { _id } = req.params;
    console.log(`User ID: ${_id}`);

    const { firstName, lastName, role } = req.body;
    console.log(`User data: firstName=${firstName}, lastName=${lastName}, role=${role}`);

    // Check if user ID is provided
    if (!_id) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID format" });
    }

    // Find user by ID
    const user = await USER.findById(_id);
    console.log(`User found: ${user ? "Yes" : "No"}`);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Update user data if values are provided
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (role) user.role = role;
    console.log(`Updated user data: firstName=${user.firstName}, lastName=${user.lastName}, role=${user.role}`);

    // Save updated user data
    await user.save();
    console.log("User data saved successfully");

    return res.status(200).json({ success: true, message: "User updated successfully", user });
  } catch (error) {
    // Handle specific errors
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid user ID format" });
    } else if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Validation error" });
    } else {
      console.error("Error occurred:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const _email_ = req.user.email;

    console.log("Request received for profile update");

    // Validate input
    const { firstName, lastName, jobTitle, phone } = req.body;
    if (!firstName || !lastName || !jobTitle || !phone) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate email format
    if (!req.user || !req.user.email) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // Update user profile
    const user = await User.findOneAndUpdate(
      { email: _email_ },
      { firstName, lastName, jobTitle, phone },
      { new: true, runValidators: true }
    );

    // Check if the user was found and updated
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("Profile details updated successfully");

    res.status(200).json({
      success: true,
      message: "Profile details updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error while updating profile details:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error while updating profile details",
      error: error.message,
    });
  }
};

exports.getProfileDetails = async (req, res) => {
  try {
    const user = req.user;

    // Check if the user object and email exist
    if (!user || !user.email) {
      return res.status(400).json({
        success: false,
        message: "Invalid user email",
      });
    }

    const email = user.email;

    // Fetch user details
    const userDetails = await USER.findOne({ email });

    // Check if user details exist
    if (!userDetails) {
      return res.status(404).json({
        success: false,
        message: "User details not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Details fetched successfully",
      profile: userDetails,
    });
  } catch (error) {
    console.error("Error while fetching user details:", error);

    // Handle specific errors
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid data format",
      });
    } else if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    } else {
      // Handle general errors
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
};
