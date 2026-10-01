# 🗾 Japan Tour Guide Reservation System  

**Automated Gmail → Google Calendar Booking Sync**  

A NestJS-powered backend that processes reservation emails, extracts dates, checks availability, and syncs with Google Calendar—with AI-powered parsing (LangChain + Groq) and automated responses.  

---

## 🛠️ Tech Stack  
| Component          | Technology Used                          |
|--------------------|------------------------------------------|
| **Backend**        | NestJS (TypeScript)                      |
| **AI/Email Parsing** | LangChain + Groq (LLM)                  |
| **Google APIs**    | Gmail API, Google Calendar API           |
| **Auth/Cloud**     | Google Cloud Platform (OAuth 2.0)        |
| **Email Sending**  | Nodemailer / Gmail API                   |


---

## ✨ Features  
- **AI-Powered Email Processing**  
  - LangChain + Groq classify emails and extract structured data (dates, tour type).  
- **Smart Conflict Detection**  
  - Checks Google Calendar for existing bookings before confirmation.  
- **Automated Replies**  
  - ✅ Success: `"Your tour on [DATE] is confirmed!"`  
  - ❌ Conflict: `"Dates unavailable. Please suggest alternatives."`  
- **Secure Sync**  
  - OAuth 2.0 for Gmail/Calendar access with Google Cloud Secrets.  

---

<img src="n8n.png" alt="JavaPaint Screenshot">
