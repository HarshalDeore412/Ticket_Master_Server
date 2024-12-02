const User = require("../models/User");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const { createObjectCsvWriter } = require("csv-writer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

async function uploadImageToCloudinary(file) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "tickets",
          public_id: Date.now() + "-" + file.originalname,
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      )
      .end(file.buffer);
  });
}

exports.createTicket = async (req, res) => {
  console.log("Request for creating ticket received");
  console.log("Request body:", req.file);

  try {
    const { deskNo, issue, description } = req.body;

    // Validate input fields
    if (!deskNo || !issue || !description) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all fields",
      });
    }

    if (
      typeof deskNo !== "string" ||
      typeof issue !== "string" ||
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid input type",
      });
    }

    let imageUrl = null;

    if (req.file) {
      try {
        imageUrl = await uploadImageToCloudinary(req.file);
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to Cloudinary",
          error: uploadError.message,
        });
      }
    }

    // Get user ID from request
    const empID = req.user.empID;

    // Find user by empID
    const user = await User.findOne({ empID });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // Create ticket
    const ticket = new Ticket({
      empID: user.empID,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      process: user.process,
      deskNo,
      issue,
      description,
      Image: imageUrl,
    });

    await ticket.save();

    console.log("Ticket created successfully:", ticket);

    return res.status(200).json({
      success: true,
      message: "Ticket created successfully",
      ticket,
    });
  } catch (error) {
    console.error("Server error:", error);
    // Handle specific errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    } else if (error.name === "MongoError") {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
};

exports.getAllTickets = async (req, res) => {
  try {
    console.log("Request received");

    // Validate content type
    if (
      !req.headers["content-type"] ||
      req.headers["content-type"] !== "application/json"
    ) {
      return res
        .status(415)
        .json({ success: false, message: "Invalid content type" });
    }

    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const empID = req.query.empID;
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Create query object
    const query = {};
    if (empID) query.empID = empID;
    if (status) query.status = status;
    if (startDate && endDate) {
      query.dateTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Fetch tickets with pagination
    const tickets = await Ticket.find(query)
      .populate("empID")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ dateTime: -1 });

    // Get total count
    const totalCount = await Ticket.countDocuments(query);

    // Check if tickets exist
    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "You have not raised any tickets yet.",
      });
    }

    console.log("Tickets sent");

    res.status(200).json({
      success: true,
      message: "Tickets fetched successfully",
      tickets,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error("Error:", err.message);

    // Handle specific errors
    if (err.name === "CastError") {
      res.status(400).json({ success: false, message: "Invalid ID" });
    } else if (err.name === "ValidationError") {
      res.status(400).json({ success: false, message: "Validation error" });
    } else if (err.message === "Invalid content type") {
      res.status(415).json({ success: false, message: "Invalid content type" });
    } else {
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
};

// Get Ticket by ID
exports.getTicketById = async (req, res) => {
  const id = req.params.id;
  console.log("ID:", id);

  // Validate the ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid ticket ID format" });
  }

  try {
    const ticket = await Ticket.findOne({ _id: id }).populate("empID");

    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }

    console.log("Ticket found:", ticket);
    return res
      .status(200)
      .json({ success: true, message: "Ticket found", ticket });
  } catch (err) {
    console.error("Error fetching ticket:", err);

    // Handle specific errors
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket ID format" });
    } else if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: err.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }
};

// Update Ticket
exports.updateTicket = async (req, res) => {
  console.log("Request received for ticket update");

  const _id = req.params._id;
  const { ticket } = req.body;

  console.log("ID:", _id);
  console.log("Ticket:", ticket);

  // Validate input
  if (!ticket || !ticket.issue || !ticket.description || !ticket.status) {
    return res
      .status(400)
      .json({ success: false, message: "All ticket fields are required" });
  }

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid ticket ID format" });
  }

  try {
    // Find the ticket by ID and update with new details
    const updatedTicket = await Ticket.findByIdAndUpdate(
      _id,
      {
        issue: ticket.issue,
        description: ticket.description,
        status: ticket.status,
        Note: ticket.Note,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedTicket) {
      console.log("Ticket Not Found");
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }

    console.log("Updated Ticket:", updatedTicket);

    return res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      updatedTicket,
    });
  } catch (err) {
    console.error("Error while updating ticket:", err);

    // Handle specific errors
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: err.message,
      });
    } else if (err.name === "MongoError") {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }
};

// Delete Ticket
exports.deleteTicket = async (req, res) => {
  console.log("Request params:", req.params);

  const id = req.params.id;

  // Validate the ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid ticket ID format" });
  }

  try {
    const deletedTicket = await Ticket.findByIdAndDelete(id);

    if (!deletedTicket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }

    console.log("Ticket deleted successfully:", deletedTicket);
    res
      .status(200)
      .json({ success: true, message: "Ticket deleted successfully" });
  } catch (err) {
    console.error("Error deleting ticket:", err.message);

    // Handle specific errors
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket ID format" });
    } else if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: err.message,
      });
    } else if (err.name === "MongoError") {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    // Validate user existence
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    // Extract empID from request user
    const empID = req.user.empID;
    console.log(`Employee ID: ${empID}`);

    // Validate empID existence
    if (!empID) {
      return res
        .status(400)
        .json({ success: false, message: "Employee ID not found" });
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Find tickets by empID with pagination
    const myTickets = await Ticket.find({ empID })
      .skip((page - 1) * limit)
      .limit(limit);

    // Count total tickets
    const totalCount = await Ticket.countDocuments({ empID });

    // Check if tickets exist
    if (!myTickets || myTickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "You Dont Have Tickets",
      });
    }

    console.log("My tickets fetched successfully");
    return res.status(200).json({
      success: true,
      message: "My tickets fetched successfully",
      data: myTickets,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error(`Error: ${err.message} | Stack: ${err.stack}`);

    // Handle specific errors
    if (err.message === "Unauthorized access") {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    } else if (err.message === "Employee ID not found") {
      return res
        .status(400)
        .json({ success: false, message: "Employee ID not found" });
    } else if (err.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    } else if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: err.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
    }
  }
};

exports.downloadReport = async (req, res) => {
  const { startDate, endDate, status, empID } = req.query;
  const query = {};

  if (startDate && endDate) {
    query.dateTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  if (status) {
    query.status = status;
  }
  if (empID) {
    query.empID = empID;
  }

  try {
    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }

    const tickets = await Ticket.find(query);
    console.log("Download report query tickets:", tickets);

    // Modify tickets data to split date and time
    const modifiedTickets = tickets.map((ticket) => {
      const dateTime = new Date(ticket.dateTime);

      // Function to format time in 12-hour format with AM/PM
      const formatTime = (date) => {
        let hours = date.getHours();
        let minutes = date.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12; // The hour '0' should be '12'
        minutes = minutes < 10 ? "0" + minutes : minutes;
        return `${hours}:${minutes} ${ampm}`;
      };

      return {
        ...ticket.toObject(), // toObject() to convert Mongoose document to plain JavaScript object
        date: dateTime.toISOString().split("T")[0], // Extract date part
        time: formatTime(dateTime), // Extract time part in 12-hour format with AM/PM
      };
    });

    const csvWriter = createObjectCsvWriter({
      path: path.join(reportsDir, "tickets_report.csv"),
      header: [
        { id: "name", title: "Name" },
        { id: "email", title: "Email" },
        { id: "process", title: "Process" },
        { id: "deskNo", title: "Desk No" },
        { id: "issue", title: "Issue" },
        { id: "description", title: "Description" },
        { id: "date", title: "Date" },
        { id: "time", title: "Time" },
        { id: "status", title: "Status" },
        { id: "Note", title: "Note" },
        { id: "empID", title: "Emp ID" },
      ],
    });

    await csvWriter.writeRecords(modifiedTickets);
    res.download(
      path.join(reportsDir, "tickets_report.csv"),
      "tickets_report.csv"
    );
  } catch (error) {
    console.error("Error generating report:", error);

    // Handle specific errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    } else if (error.name === "MongoError") {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: error.message,
      });
    } else if (error.code === "ENOENT") {
      return res.status(404).json({
        success: false,
        message: "File not found",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
};
