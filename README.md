# donutste.com

Static pages (/, /menu, /fit, /doughssant, /coffee, /gift-cards, /press, /our-story) plus Vercel functions in `api/` that talk to Square.

Vercel environment variables (never commit these):
- SQUARE_ACCESS_TOKEN: production access token of the "Donutste Website" Square app
- SQUARE_APPLICATION_ID: sq0idp-M8Y5KYAX5aksi1JeJpJoxg
- SQUARE_LOCATION_ID: pickup location for Wednesday/Thursday/Saturday orders
- SQUARE_POPUP_LOCATION_ID (optional): location for pop-up orders
- SQUARE_ENV: production (or sandbox for testing)
- RESEND_API_KEY + MAIL_FROM (optional): gift card emails

Menu sections fill from Square categories named Wednesday, Thursday, Saturday and Pop-up.
Pickup hours come from the location's business hours in Square. The current pop-up lives in popup.json.
