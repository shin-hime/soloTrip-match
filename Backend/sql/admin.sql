-- Make your own account the System Admin (replace the email), then log in again
UPDATE users SET role = 'admin' WHERE email = '1234@gmail.com';
