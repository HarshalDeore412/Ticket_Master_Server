// const nodemailer = require("nodemailer");


// const mailSender = async (Email , title , body ) => {
//     try {
//         let transporter = nodemailer.createTransport({
//             host:process.env.MAIL_HOST,
//             auth:{
//                 user: process.env.MAIL_USER,
//                 pass: process.env.MAIL_PASS,
//             }
//         })

//         let info = await transporter.sendMail({
//             from: "ADA Support",
//             to:`${Email}`,
//             subject: `${title}`,
//             html: `${body}`,
//         })

//         console.log(info);
//         console.log("Mail Send")
//         return info;

//     }catch(err){
//         console.log(err.message);
//     }
// }

// module.exports = mailSender;



const nodemailer = require("nodemailer");

const mailSender = async (Email, title, otp) => {
  try {
    let transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    let html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Verification</title>
        <style>
          /* Styles for responsive design */
          @media only screen and (max-width: 600px) {
            .main {
              width: 90% !important;
            }
          }
          /* Global Styles */
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          .main {
            width: 60%;
            margin: 0 auto;
            background-color: #f9f9f9;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #333;
            color: #fff;
            padding: 10px;
            border-radius: 10px 10px 0 0;
          }
          .content {
            padding: 20px;
          }
          .footer {
            background-color: #333;
            color: #fff;
            padding: 10px;
            border-radius: 0 0 10px 10px;
          }
        </style>
      </head>
      <body>
        <div class="main">
          <div class="header">
            <h2>OTP Verification</h2>
          </div>
          <div class="content">
            <h3>Dear User,</h3>
            <p>Your OTP for verification is: <strong>${otp}</strong></p>
            <p>Please enter this OTP to complete the verification process.</p>
          </div>
          <div class="footer">
            <p>&copy; ADA Support, 2024</p>
          </div>
        </div>
      </body>
      </html>
    `;

    let info = await transporter.sendMail({
      from: `"ADA Tech Support Team" <${process.env.MAIL_USER}>`,
      to: `${Email}`,
      subject: `${title}`,
      html: html,
    });

    console.log(info);
    console.log("Mail Send");
    return info;
  } catch (err) {
    console.log(err.message);
  }
};

module.exports = mailSender;


