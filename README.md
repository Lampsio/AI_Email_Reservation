Automated Reservation System for Japan Tour Guides
Overview
This project implements an automated email processing system built with NestJS, which:

Monitors a Gmail inbox for incoming reservation emails.

Uses LangChain (with Groq as the LLM provider) to analyze email content and detect if it’s related to a Japan tour guide booking.

Extracts reservation dates and checks for availability.

Syncs confirmed bookings with Google Calendar via the Google Cloud Platform API.

Sends automated replies (success confirmation or request for new dates if unavailable).

Tech Stack
Backend: NestJS (TypeScript)

AI/LLM: LangChain + Groq (for email intent classification & data extraction)

Google APIs:

Gmail API (email monitoring)

Google Calendar API (booking synchronization)

Google Cloud Platform (authentication & serverless functions if applicable)
