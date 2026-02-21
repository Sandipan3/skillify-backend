# Skillify Backend

Backend API for **Skillify**, a modern Learning Management System (LMS). This service handles authentication, course-related operations, payments, media uploads, caching, and email workflows.

The goal of this backend is to be **secure, scalable, and production‑ready** while staying developer-friendly.

---

## Tech Stack

**Core**

- Node.js (ES Modules)
- Express.js
- MongoDB + Mongoose

**Auth & Security**

- JWT authentication
- bcrypt password hashing
- Google OAuth (Passport)
- Express rate limiting
- Cookie parser
- CORS

**Performance**

- Redis (ioredis) for caching / rate limiting

**Media Handling**

- Multer
- Cloudinary

**Payments**

- Razorpay

**Email**

- Nodemailer

**Dev Tools**

- Nodemon
- Morgan

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Sandipan3/skillify-backend.git
cd skillify-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment variables

Create a `.env` file in the root directory.

```env
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_jwt_secret

# Redis
REDIS_URL=your_redis_url

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Email
EMAIL_USER=
EMAIL_PASS=
```

> ⚠️ Never commit your `.env` file.

---

## Run the Server

```bash
npm start
```

Server default:

```
http://localhost:5000
```

---

## Key Features

- Secure JWT authentication
- Google OAuth login support
- Role-based access control
- Redis-powered caching and rate limiting
- Cloudinary media uploads
- Razorpay payment integration
- Email notifications via Nodemailer
- Structured Express middleware
- Production-oriented setup

---

## Project Structure (typical)

```
skillify-backend/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── utils/
├── server.js
├── .env
└── package.json
```

---

## Security Notes

- Passwords are hashed using bcrypt
- Rate limiting helps prevent brute-force attacks
- Sensitive values are stored in environment variables
- JWT is used for stateless authentication

---

## Future Improvements

- Refresh token rotation
- API documentation (Swagger)
- Docker support
- Course progress tracking
- Payment webhooks
- Automated tests

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you would like to change.

---

## License

ISC

---

## Author

**Sandipan**
